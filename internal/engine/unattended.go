package engine

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/Majidul17068/anchor/internal/model"
)

// RunUnattended starts a new conversation, sends one prompt and waits for
// the turn to end, with nobody at the keyboard: permission prompts are
// answered by policy ("allow" or "deny"). Unlike RunOnce the conversation is
// a normal session, kept in the list so the user can read what happened and
// continue it. It returns the session and the agent's final text; err is set
// when the turn failed (the session still exists and shows why).
func (e *Engine) RunUnattended(ctx context.Context, in CreateInput, prompt, policy string) (model.Session, string, error) {
	if strings.TrimSpace(prompt) == "" {
		return model.Session{}, "", errors.New("the automation has no prompt")
	}
	if policy != "allow" {
		policy = "deny"
	}
	s, err := e.Create(in)
	if err != nil {
		return model.Session{}, "", err
	}
	l := e.getLive(s.ID)
	if l == nil {
		return s, "", errors.New("session not found")
	}
	streamID := "auto-" + uuid.NewString()
	l.mu.Lock()
	l.autoPerm = policy
	l.streamID = streamID
	l.lastTurnErr = ""
	l.mu.Unlock()

	// Stop the turn if the caller gives up (timeout, app closing).
	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			_ = e.Stop(s.ID)
		case <-done:
		}
	}()
	l.runTurn(streamID, prompt, nil)
	close(done)

	l.mu.Lock()
	l.autoPerm = ""
	turnErr := l.lastTurnErr
	var last string
	var refused []string
	for _, st := range l.steps {
		if st.Kind == "agent" && strings.TrimSpace(st.Markdown) != "" {
			last = st.Markdown
		}
		if st.Kind == "permission" && st.Resolved == "deny" && strings.TrimSpace(st.Description) != "" {
			refused = append(refused, st.Description)
		}
	}
	l.mu.Unlock()
	if meta, gerr := e.st.GetSession(s.ID); gerr == nil {
		s = e.view(meta)
	}
	if ctx.Err() != nil {
		return s, last, errors.New("stopped: the run took too long or Anchor was closing")
	}
	if turnErr != "" {
		return s, last, errors.New(turnErr)
	}
	// The CLI ends a turn when a permission is refused. A run that stopped
	// that way with nothing to show did not do its job: say what it wanted,
	// so the user can allow it or reword the task.
	if len(refused) > 0 && strings.TrimSpace(last) == "" {
		if len(refused) > 3 {
			refused = refused[:3]
		}
		return s, last, errors.New("stopped because it is not allowed to: " + strings.Join(refused, "; ") +
			". Give this automation more access, or reword the task so it does not need that")
	}
	return s, last, nil
}
