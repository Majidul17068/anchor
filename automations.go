package main

import (
	"context"
	"errors"
	"time"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/Majidul17068/anchor/internal/automation"
	"github.com/Majidul17068/anchor/internal/engine"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/osutil"
	"github.com/Majidul17068/anchor/internal/paths"
)

// Automations: see internal/automation. This file gives the scheduler a way
// to run a conversation and exposes it to the UI.

func (a *API) newAutomations(logf func(string, ...any)) *automation.Service {
	run := func(ctx context.Context, au model.Automation) (string, string, error) {
		if a.eng.AuthStatus() == nil {
			return "", "", errors.New("not signed in to Google; open Anchor and sign in")
		}
		// What a run may do with nobody to ask.
		mode, policy := model.Mode("default"), "deny"
		switch au.Access {
		case "edit":
			mode, policy = "accept-edits", "deny"
		case "full":
			mode, policy = "auto", "allow"
		}
		in := engine.CreateInput{Title: "⏱ " + au.Name, AgentID: au.AgentID, ModelID: au.ModelID, Effort: au.Effort, Mode: mode}
		if au.Workspace != "" {
			in.WorkspacePaths = []string{au.Workspace}
		}
		s, summary, err := a.eng.RunUnattended(ctx, in, au.Prompt, policy)
		a.emit("sessions:changed", map[string]any{"sessionId": s.ID, "source": "automation"})
		return s.ID, summary, err
	}
	return automation.New(a.st, run, a.emit, logf)
}

func (a *API) AutomationsList() []model.Automation { return a.auto.List() }

func (a *API) AutomationsSave(in model.Automation) (model.Automation, error) {
	return a.auto.Save(in)
}

func (a *API) AutomationsSetEnabled(id string, on bool) (model.Automation, error) {
	return a.auto.SetEnabled(id, on)
}

func (a *API) AutomationsDelete(id string) error { return a.auto.Delete(id) }

// AutomationsRunNow starts a run at once; progress arrives as
// "automations:changed" and "automations:run" events.
func (a *API) AutomationsRunNow(id string) error { return a.auto.RunNow(id) }

func (a *API) AutomationsRuns(id string) []model.AutomationRun { return a.auto.Runs(id) }

// AutomationsPreview says a schedule in words and when it next runs, for
// the editor, without saving anything.
func (a *API) AutomationsPreview(s model.AutomationSchedule) (map[string]string, error) {
	next, err := automation.NextRun(s, time.Now())
	if err != nil {
		return nil, err
	}
	return map[string]string{"text": automation.Describe(s), "nextRunAt": next.UTC().Format("2006-01-02T15:04:05Z")}, nil
}

// AutomationsImportable lists the Antigravity CLI's own scheduled
// automations that are not in Anchor yet.
func (a *API) AutomationsImportable() []model.Automation { return a.auto.Importable() }

// AutomationsExport writes an automation in the CLI's format (it then shows
// in Google's Automations dashboard, switched off) and returns the path.
func (a *API) AutomationsExport(id string) (string, error) { return a.auto.Export(id) }

// AutomationsPickFolder lets the user choose the folder a run works in.
func (a *API) AutomationsPickFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Folder the automation works in", DefaultDirectory: paths.Home()})
}

// ---------------------------------------------------------------------------
// running without a window
// ---------------------------------------------------------------------------

// runsInBackground: closing the window keeps Anchor (and its automations)
// running. Read once at launch; a change applies from the next start.
func (a *API) runsInBackground() bool {
	v, _ := a.st.Settings()["runInBackground"].(bool)
	return v
}

// BackgroundStatus is what Settings shows about running in the background.
type BackgroundStatus struct {
	RunInBackground bool `json:"runInBackground"`
	StartAtLogin    bool `json:"startAtLogin"`
	// Active is whether this running copy already hides instead of quitting.
	Active bool `json:"active"`
}

func (a *API) BackgroundGet() BackgroundStatus {
	return BackgroundStatus{RunInBackground: a.runsInBackground(), StartAtLogin: osutil.AutostartEnabled(), Active: a.backgroundActive}
}

// BackgroundSet changes both switches. Starting at login implies running in
// the background (a login start opens no window), so it turns that on too.
func (a *API) BackgroundSet(runInBackground, startAtLogin bool) (BackgroundStatus, error) {
	if startAtLogin {
		runInBackground = true
	}
	if err := a.st.SetSettings(map[string]any{"runInBackground": runInBackground}); err != nil {
		return a.BackgroundGet(), err
	}
	if err := osutil.SetAutostart(startAtLogin); err != nil {
		return a.BackgroundGet(), err
	}
	return a.BackgroundGet(), nil
}

// onSecondInstance: Anchor was started again while already running (maybe
// hidden in the background): show the existing window.
func (a *API) onSecondInstance(_ options.SecondInstanceData) {
	if a.ctx == nil {
		return
	}
	runtime.WindowUnminimise(a.ctx)
	runtime.WindowShow(a.ctx)
}

// AppQuit really quits, for when closing the window only hides it.
func (a *API) AppQuit() {
	if a.ctx != nil {
		runtime.Quit(a.ctx)
	}
}
