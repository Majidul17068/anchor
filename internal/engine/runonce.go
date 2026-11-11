package engine

import (
	"context"
	"strings"
	"time"

	"github.com/Majidul17068/anchor/internal/acp"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

// RunOnce opens a throwaway ACP session in cwd, sends one prompt, and
// returns the agent's text. Used for skill evaluation and improvement.
func (e *Engine) RunOnce(ctx context.Context, cwd, prompt, mode string) (string, error) {
	p, err := e.Proc("")
	if err != nil {
		return "", err
	}
	setupCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	var res acp.SessionSetupResult
	err = p.client.Call(setupCtx, "session/new", map[string]any{"cwd": cwd, "mcpServers": []any{}}, &res)
	cancel()
	if err != nil {
		return "", translateErr(err)
	}
	e.noteSetup(&res)
	meta := &store.SessionMeta{Session: model.Session{ID: "transient-" + res.SessionID, Mode: model.Mode(mode), Effort: DefaultEffort, ModelID: DefaultModel}}
	l := &live{eng: e, meta: meta, proc: p, acpID: res.SessionID, attached: true, loading: true, agentIdx: -1, thoughtIdx: -1,
		tools: map[string]int{}, perms: map[string]chan string{}}
	e.mu.Lock()
	e.byACP[res.SessionID] = l
	e.mu.Unlock()
	defer func() {
		e.mu.Lock()
		delete(e.byACP, res.SessionID)
		e.mu.Unlock()
		closeCtx, c := context.WithTimeout(context.Background(), 10*time.Second)
		_ = p.client.Call(closeCtx, "session/close", map[string]any{"sessionId": res.SessionID}, nil)
		c()
	}()
	l.applyConfig()
	runCtx, cancelRun := context.WithTimeout(ctx, 15*time.Minute)
	defer cancelRun()
	var pr acp.PromptResult
	if err := p.client.Call(runCtx, "session/prompt", map[string]any{"sessionId": res.SessionID, "prompt": []acp.ContentBlock{{Type: "text", Text: prompt}}}, &pr); err != nil {
		_ = p.client.Notify("session/cancel", map[string]any{"sessionId": res.SessionID})
		return "", translateErr(err)
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	var parts []string
	for _, st := range l.steps {
		if st.Kind == "agent" && strings.TrimSpace(st.Markdown) != "" {
			parts = append(parts, st.Markdown)
		}
	}
	return strings.Join(parts, "\n\n"), nil
}
