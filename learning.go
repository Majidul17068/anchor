package main

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/Majidul17068/anchor/internal/agents"
	"github.com/Majidul17068/anchor/internal/engine"
	"github.com/Majidul17068/anchor/internal/learn"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/skills"
)

// Learning ("Learn from my work"): see internal/learn. This file connects
// it to the things an approved suggestion changes.

func (a *API) newLearn(logf func(string, ...any)) *learn.Service {
	hooks := learn.Hooks{
		Rules: func() string { return asString(a.st.Settings()["agentRules"]) },
		SetRules: func(text string) error {
			return a.SettingsSet(map[string]any{"agentRules": text})
		},
		SaveSkill: func(name, description, body string) (string, error) {
			slug := skills.Slug(name)
			md := "---\nname: " + slug + "\ndescription: " + oneLine(description) + "\n---\n\n" + strings.TrimSpace(body) + "\n"
			sk, err := a.skills.Save(skills.SaveInput{Name: slug, Description: description, Version: "0.1.0",
				Files: []model.SkillFile{{Path: "SKILL.md", Content: md}}})
			if err != nil {
				return "", err
			}
			a.eng.Shutdown() // so the CLI discovers it
			return sk.ID, nil
		},
		SaveAgent: func(name, description, instructions string, tools []string) (string, error) {
			ag, err := a.AgentsSave(agents.SaveInput{Name: name, Description: description, Instructions: instructions,
				ModelID: engine.DefaultModel, Effort: string(engine.DefaultEffort), Tools: tools})
			if err != nil {
				return "", err
			}
			return ag.ID, nil
		},
		Existing: func() (sk, ag []string) {
			if list, err := a.skills.List(); err == nil {
				for _, s := range list {
					sk = append(sk, s.Name)
				}
			}
			// Files only: asking the CLI for built-ins is slow and irrelevant here.
			if list, err := a.agents.List(); err == nil {
				for _, x := range list {
					ag = append(ag, x.Name)
				}
			}
			return sk, ag
		},
	}
	return learn.New(a.st, a.eng.RunOnce, hooks, a.emit, logf)
}

func oneLine(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	// A colon or quote would break the YAML header.
	if strings.ContainsAny(s, ":#\"'") {
		return `"` + strings.ReplaceAll(strings.ReplaceAll(s, `\`, `\\`), `"`, `\"`) + `"`
	}
	return s
}

// learnLoop starts the daily automatic study when the user enabled it. It
// waits a few minutes after launch so it never competes with the first chat.
func (a *API) learnLoop() {
	time.Sleep(4 * time.Minute)
	for {
		if a.learn.AutoDue() && a.eng.AuthStatus() != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 12*time.Minute)
			if n, err := a.learn.Run(ctx, false); err != nil && !errors.Is(err, learn.ErrNothingNew) {
				a.log.Printf("learn: %v", err)
			} else if n > 0 {
				a.log.Printf("learn: %d new suggestions", n)
			}
			cancel()
		}
		time.Sleep(time.Hour)
	}
}

func (a *API) LearnStatus() model.LearnStatus { return a.learn.Status() }

func (a *API) LearnSuggestions() []model.Suggestion { return a.learn.List() }

// LearnRun studies recent conversations now and returns the number of new
// drafts. It spends some of the account's allowance (one agent turn).
func (a *API) LearnRun() (int, error) {
	if !a.learn.Enabled() {
		return 0, errors.New("switch on \"Learn from my work\" first")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Minute)
	defer cancel()
	return a.learn.Run(ctx, true)
}

func (a *API) LearnUpdate(id string, e learn.Edit) (model.Suggestion, error) {
	return a.learn.Update(id, e)
}

// LearnAccept puts a draft into effect, with the user's last edits.
func (a *API) LearnAccept(id string, e learn.Edit) (model.Suggestion, error) {
	return a.learn.Accept(id, e)
}

func (a *API) LearnReject(id string) error { return a.learn.Reject(id) }

// LearnForget erases all drafts, decisions and run history.
func (a *API) LearnForget() error { return a.learn.Forget() }
