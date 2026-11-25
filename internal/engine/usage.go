package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Majidul17068/anchor/internal/cli"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

// The CLI answers a few slash commands in print mode without starting an
// agent turn, spending quota or leaving a conversation behind (`agy -p
// /help` lists them). `/usage` and `/credits` return structured data under
// "command.data" with --output-format json; that is the only supported way
// to read the account's limits (ACP has no quota method, verified with agy
// 1.5.17).

const usageTTL = 60 * time.Second

type usageCache struct {
	mu  sync.Mutex
	val *model.Usage
	at  time.Time
}

type printResult struct {
	Status   string `json:"status"`
	Response string `json:"response"`
	Error    string `json:"error"`
	Command  struct {
		Name string          `json:"name"`
		Data json.RawMessage `json:"data"`
	} `json:"command"`
}

type usageData struct {
	Description string `json:"description"`
	Groups      []struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Buckets     []struct {
			ID                string  `json:"id"`
			Name              string  `json:"name"`
			Description       string  `json:"description"`
			Window            string  `json:"window"`
			RemainingFraction float64 `json:"remaining_fraction"`
			ResetTime         string  `json:"reset_time"`
		} `json:"buckets"`
	} `json:"groups"`
}

type creditsData struct {
	RemainingCredits float64 `json:"remaining_credits"`
	UpgradeURI       string  `json:"upgrade_uri"`
}

// parsePrint extracts the JSON object from print-mode output, which may be
// preceded by progress lines.
func parsePrint(out string) (*printResult, error) {
	i := strings.Index(out, "{")
	if i < 0 {
		return nil, errors.New("the CLI returned no data")
	}
	var r printResult
	if err := json.Unmarshal([]byte(out[i:]), &r); err != nil {
		// Several JSON documents or trailing text: take the first line that parses.
		for _, line := range strings.Split(out, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "{") && json.Unmarshal([]byte(line), &r) == nil {
				return &r, nil
			}
		}
		return nil, fmt.Errorf("could not read the CLI's answer: %w", err)
	}
	return &r, nil
}

func parseUsage(out string) (*model.Usage, error) {
	r, err := parsePrint(out)
	if err != nil {
		return nil, err
	}
	if len(r.Command.Data) == 0 {
		msg := strings.TrimSpace(r.Error + " " + r.Response)
		if msg == "" {
			msg = "the CLI did not report usage"
		}
		return nil, errors.New(msg)
	}
	var d usageData
	if err := json.Unmarshal(r.Command.Data, &d); err != nil {
		return nil, err
	}
	u := &model.Usage{Description: d.Description, Groups: []model.UsageGroup{}}
	for _, g := range d.Groups {
		grp := model.UsageGroup{Name: g.Name, Description: g.Description, Buckets: []model.UsageBucket{}}
		for _, b := range g.Buckets {
			f := b.RemainingFraction
			if f < 0 {
				f = 0
			}
			if f > 1 {
				f = 1
			}
			grp.Buckets = append(grp.Buckets, model.UsageBucket{ID: b.ID, Name: b.Name, Description: b.Description,
				Window: b.Window, RemainingFraction: f, ResetTime: b.ResetTime})
		}
		u.Groups = append(u.Groups, grp)
	}
	return u, nil
}

// Usage returns the signed-in account's model limits: per model group, the
// weekly and five-hour buckets with the fraction remaining and the reset
// time, plus remaining AI credits. Results are cached for a minute; force
// asks the CLI again.
func (e *Engine) Usage(force bool) (model.Usage, error) {
	e.usage.mu.Lock()
	defer e.usage.mu.Unlock()
	if !force && e.usage.val != nil && time.Since(e.usage.at) < usageTTL {
		return *e.usage.val, nil
	}
	bin, err := e.binary()
	if err != nil {
		return model.Usage{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	out, err := cli.Run(ctx, bin, "-p", "/usage", "--output-format", "json")
	if err != nil && strings.TrimSpace(out) == "" {
		return model.Usage{}, translateErr(err)
	}
	u, err := parseUsage(out)
	if err != nil {
		low := strings.ToLower(err.Error())
		if strings.Contains(low, "auth") || strings.Contains(low, "sign in") || strings.Contains(low, "log in") {
			return model.Usage{}, errors.New("AUTH_REQUIRED: sign in to see your limits")
		}
		return model.Usage{}, err
	}
	// Credits are a second command; a failure there must not hide the limits.
	if cout, cerr := cli.Run(ctx, bin, "-p", "/credits", "--output-format", "json"); cerr == nil || strings.TrimSpace(cout) != "" {
		if r, perr := parsePrint(cout); perr == nil && len(r.Command.Data) > 0 {
			var c creditsData
			if json.Unmarshal(r.Command.Data, &c) == nil {
				u.Credits = &model.UsageCredits{Remaining: c.RemainingCredits, UpgradeURI: c.UpgradeURI}
			}
		}
	}
	e.mu.Lock()
	if e.tier != nil {
		u.Tier = e.tier.Name
	}
	e.mu.Unlock()
	u.FetchedAt = store.Now()
	e.usage.val, e.usage.at = u, time.Now()
	return *u, nil
}
