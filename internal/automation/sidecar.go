package automation

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/osutil"
	"github.com/Majidul17068/anchor/internal/paths"
)

// The Antigravity CLI describes a scheduled automation as a "sidecar":
// ~/.gemini/config/sidecars/<id>/sidecar.json with "builtin": "schedule" and
// args ["CRON_TZ=<zone> <cron>", "agentapi", "new-conversation", "--",
// "<prompt>"]. Anchor reads those (Import) and writes them (Export) so an
// automation can move between Anchor and Google's own Automations
// dashboard. An exported file is not switched on there by Anchor: that is
// the user's step in the dashboard, and switching it on in both places
// would run it twice.

type sidecarFile struct {
	Builtin       string   `json:"builtin"`
	Args          []string `json:"args"`
	RestartPolicy string   `json:"restart_policy"`
	DisplayName   string   `json:"display_name"`
	Description   string   `json:"description,omitempty"`
	Permissions   *struct {
		AccessGrants  []string `json:"access_grants,omitempty"`
		WorkspaceURIs []string `json:"workspace_uris,omitempty"`
	} `json:"agent_permissions,omitempty"`
}

func sidecarsDir() string { return filepath.Join(paths.ConfigDir(), "sidecars") }

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slug(s string) string {
	s = strings.Trim(slugRe.ReplaceAllString(strings.ToLower(s), "-"), "-")
	if s == "" {
		s = "automation"
	}
	if len(s) > 48 {
		s = strings.Trim(s[:48], "-")
	}
	return s
}

// localZone is the computer's IANA zone name, or "" when it cannot be told.
func localZone() string {
	if n := time.Local.String(); n != "" && n != "Local" {
		return n
	}
	if tz := os.Getenv("TZ"); tz != "" {
		return tz
	}
	// macOS and Linux: /etc/localtime links into the zone database.
	if p, err := filepath.EvalSymlinks("/etc/localtime"); err == nil {
		if i := strings.Index(p, "zoneinfo/"); i >= 0 {
			return p[i+len("zoneinfo/"):]
		}
	}
	return ""
}

// Export writes the automation in the CLI's format and returns the file's
// path. The CLI lists it in its Automations dashboard, switched off.
func (s *Service) Export(id string) (string, error) {
	a, err := s.Get(id)
	if err != nil {
		return "", err
	}
	expr, err := CronOf(a.Schedule)
	if err != nil {
		return "", err
	}
	if !strings.HasPrefix(expr, "CRON_TZ=") && !strings.HasPrefix(expr, "TZ=") {
		zone := a.Schedule.Timezone
		if zone == "" {
			zone = localZone()
		}
		if zone != "" {
			expr = "CRON_TZ=" + zone + " " + expr
		}
	}
	f := sidecarFile{Builtin: "schedule", Args: []string{expr, "agentapi", "new-conversation", "--", a.Prompt},
		RestartPolicy: "always", DisplayName: a.Name, Description: a.Description}
	if f.Description == "" {
		f.Description = Describe(a.Schedule) + "."
	}
	if a.Workspace != "" && a.Access != "read" {
		f.Permissions = &struct {
			AccessGrants  []string `json:"access_grants,omitempty"`
			WorkspaceURIs []string `json:"workspace_uris,omitempty"`
		}{WorkspaceURIs: []string{osutil.FileURI(a.Workspace)}}
	}
	dir := filepath.Join(sidecarsDir(), "anchor-"+slug(a.Name))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	b, _ := json.MarshalIndent(f, "", "  ")
	path := filepath.Join(dir, "sidecar.json")
	return path, os.WriteFile(path, append(b, '\n'), 0o644)
}

// Importable lists the CLI's own scheduled automations that are not in
// Anchor yet (matched by name), ready to be saved as Anchor automations.
func (s *Service) Importable() []model.Automation {
	out := []model.Automation{}
	have := map[string]bool{}
	for _, a := range s.load().Automations {
		have[strings.ToLower(a.Name)] = true
	}
	entries, _ := os.ReadDir(sidecarsDir())
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		a, err := readSidecar(filepath.Join(sidecarsDir(), e.Name(), "sidecar.json"))
		if err != nil || have[strings.ToLower(a.Name)] {
			continue
		}
		if a.Name == "" {
			a.Name = e.Name()
		}
		a.ScheduleText = Describe(a.Schedule)
		out = append(out, a)
	}
	return out
}

func readSidecar(path string) (model.Automation, error) {
	var a model.Automation
	b, err := os.ReadFile(path)
	if err != nil {
		return a, err
	}
	var f sidecarFile
	if err := json.Unmarshal(b, &f); err != nil {
		return a, err
	}
	if f.Builtin != "schedule" || len(f.Args) < 2 {
		return a, errors.New("not a scheduled automation")
	}
	prompt := ""
	for i, arg := range f.Args {
		if arg == "--" && i+1 < len(f.Args) {
			prompt = strings.Join(f.Args[i+1:], " ")
		}
	}
	if prompt == "" {
		return a, errors.New("no prompt")
	}
	expr := strings.TrimSpace(f.Args[0])
	if _, _, err := parseCron(expr); err != nil {
		return a, err
	}
	a = model.Automation{Name: f.DisplayName, Description: f.Description, Prompt: prompt, Access: "read", CatchUp: false,
		Schedule: model.AutomationSchedule{Kind: "custom", Cron: expr, Weekdays: []int{}}}
	if f.Permissions != nil {
		if len(f.Permissions.AccessGrants) > 0 {
			a.Access = "full"
		} else if len(f.Permissions.WorkspaceURIs) > 0 {
			a.Access = "edit"
		}
		if len(f.Permissions.WorkspaceURIs) > 0 {
			if p, ok := osutil.PathFromFileURI(f.Permissions.WorkspaceURIs[0]); ok {
				a.Workspace = p
			}
		}
	}
	return a, nil
}
