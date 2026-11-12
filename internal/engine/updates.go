package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Majidul17068/anchor/internal/acp"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

func newID(prefix string) string { return prefix + "_" + strings.ReplaceAll(uuid.NewString(), "-", "")[:12] }

// handleUpdate folds one session/update into the transcript. While
// l.loading it rebuilds history silently; while streaming it emits
// ChatEvents; otherwise it only tracks metadata (title, mode).
func (l *live) handleUpdate(u *acp.SessionUpdate) {
	l.mu.Lock()
	streaming := l.streamID != ""
	loading := l.loading
	l.mu.Unlock()

	switch u.SessionUpdate {
	case "session_info_update":
		if u.Title != "" {
			l.mu.Lock()
			changed := l.meta.Title != u.Title
			l.meta.Title = u.Title
			meta := l.meta
			l.mu.Unlock()
			if changed {
				_ = l.eng.st.SaveSession(meta)
				l.eng.emit("sessions:changed", map[string]any{"sessionId": meta.ID})
			}
		}
		return
	case "current_mode_update":
		if u.CurrentModeID != "" {
			l.mu.Lock()
			l.meta.Mode = model.Mode(u.CurrentModeID)
			l.mu.Unlock()
		}
		return
	case "config_option_update", "available_commands_update", "usage_update":
		return
	}
	if !streaming && !loading {
		return
	}

	switch u.SessionUpdate {
	case "user_message_chunk":
		if !loading || u.Content == nil {
			return // during our own turn the user step already exists
		}
		l.mu.Lock()
		if n := len(l.steps); n > 0 && l.steps[n-1].Kind == "user" && l.agentIdx == -1 {
			l.steps[n-1].Text += contentText(u.Content)
		} else {
			l.steps = append(l.steps, model.Step{Kind: "user", ID: newID("step_u"), Text: contentText(u.Content), At: store.Now()})
			l.resetCursor()
		}
		l.mu.Unlock()

	case "agent_message_chunk":
		if u.Content == nil {
			return
		}
		delta := contentText(u.Content)
		l.mu.Lock()
		n := len(l.steps)
		cont := l.agentIdx >= 0 && l.agentIdx == n-1 && (u.MessageID == "" || u.MessageID == l.lastMsgID)
		var ev model.ChatEvent
		if cont {
			l.steps[l.agentIdx].Markdown += delta
			ev = model.ChatEvent{Type: "token", StepID: l.steps[l.agentIdx].ID, Delta: delta}
		} else {
			t := true
			st := model.Step{Kind: "agent", ID: newID("step_ag"), Markdown: delta, Streaming: &t, At: store.Now()}
			l.steps = append(l.steps, st)
			l.agentIdx = len(l.steps) - 1
			l.thoughtIdx = -1
			l.lastMsgID = u.MessageID
			copyStep := st
			ev = model.ChatEvent{Type: "step", Step: &copyStep}
		}
		l.mu.Unlock()
		if streaming {
			l.emitChat(ev)
		}

	case "agent_thought_chunk":
		if u.Content == nil {
			return
		}
		delta := contentText(u.Content)
		l.mu.Lock()
		n := len(l.steps)
		if l.thoughtIdx >= 0 && l.thoughtIdx == n-1 {
			l.steps[l.thoughtIdx].Text += delta
			id, text := l.steps[l.thoughtIdx].ID, l.steps[l.thoughtIdx].Text
			l.mu.Unlock()
			if streaming {
				l.emitChat(model.ChatEvent{Type: "step_update", ID: id, Patch: model.StepPatch{"text": text}})
			}
		} else {
			st := model.Step{Kind: "thinking", ID: newID("step_th"), Text: delta, At: store.Now()}
			l.steps = append(l.steps, st)
			l.thoughtIdx = len(l.steps) - 1
			l.agentIdx = -1
			l.mu.Unlock()
			if streaming {
				l.emitChat(model.ChatEvent{Type: "step", Step: &st})
			}
		}

	case "plan":
		if len(u.Entries) == 0 {
			return
		}
		var b strings.Builder
		b.WriteString("Plan:\n")
		for _, en := range u.Entries {
			fmt.Fprintf(&b, "- [%s] %s (%s)\n", en.Status, en.Content, en.Priority)
		}
		st := model.Step{Kind: "thinking", ID: newID("step_plan"), Text: b.String(), At: store.Now()}
		l.mu.Lock()
		l.steps = append(l.steps, st)
		l.agentIdx, l.thoughtIdx = -1, -1
		l.mu.Unlock()
		if streaming {
			l.emitChat(model.ChatEvent{Type: "step", Step: &st})
		}

	case "tool_call":
		st := model.Step{Kind: "tool_call", ID: newID("step_tc"), Tool: toolName(u), Args: rawArgs(u), Status: toolStatus(u.Status), At: store.Now()}
		st.Output = toolOutput(u)
		l.mu.Lock()
		l.steps = append(l.steps, st)
		idx := len(l.steps) - 1
		l.tools[u.ToolCallID] = idx
		l.agentIdx, l.thoughtIdx = -1, -1
		l.mu.Unlock()
		if streaming {
			l.emitChat(model.ChatEvent{Type: "step", Step: &st})
		}
		l.diffsFrom(u, streaming)

	case "tool_call_update":
		l.mu.Lock()
		idx, ok := l.tools[u.ToolCallID]
		if !ok {
			st := model.Step{Kind: "tool_call", ID: newID("step_tc"), Tool: toolName(u), Args: rawArgs(u), Status: toolStatus(u.Status), At: store.Now()}
			l.steps = append(l.steps, st)
			idx = len(l.steps) - 1
			l.tools[u.ToolCallID] = idx
			l.agentIdx, l.thoughtIdx = -1, -1
			l.mu.Unlock()
			if streaming {
				l.emitChat(model.ChatEvent{Type: "step", Step: &st})
			}
			l.mu.Lock()
		}
		patch := model.StepPatch{}
		cur := &l.steps[idx]
		if u.Status != "" {
			cur.Status = toolStatus(u.Status)
			patch["status"] = cur.Status
			if cur.Status == "ok" || cur.Status == "error" {
				if t, err := time.Parse(time.RFC3339, cur.At); err == nil {
					cur.DurationMs = time.Since(t).Milliseconds()
					patch["durationMs"] = cur.DurationMs
				}
			}
		}
		if out := toolOutput(u); out != "" {
			cur.Output = out
			patch["output"] = out
		}
		if (u.Title != "" || u.Name != "") && cur.Tool == "" {
			cur.Tool = toolName(u)
			patch["tool"] = cur.Tool
		}
		if len(u.RawInput) > 0 && cur.Args == nil {
			cur.Args = rawArgs(u)
			patch["args"] = cur.Args
		}
		id := cur.ID
		l.mu.Unlock()
		if streaming {
			l.emitChat(model.ChatEvent{Type: "step_update", ID: id, Patch: patch})
		}
		l.diffsFrom(u, streaming)
	}
}

// diffsFrom appends a diff step for every diff item in a tool update.
func (l *live) diffsFrom(u *acp.SessionUpdate, streaming bool) {
	for _, it := range u.ToolItems {
		if it.Type != "diff" || it.Path == "" {
			continue
		}
		old := ""
		if it.OldText != nil {
			old = *it.OldText
		}
		accepted := true
		st := model.Step{Kind: "diff", ID: newID("step_df"), Path: it.Path, Patch: unifiedDiff(it.Path, old, it.NewText), Accepted: &accepted, At: store.Now()}
		l.mu.Lock()
		l.steps = append(l.steps, st)
		l.agentIdx, l.thoughtIdx = -1, -1
		l.mu.Unlock()
		if it.OldText != nil {
			diffOldText[st.ID] = old
		}
		if streaming {
			l.emitChat(model.ChatEvent{Type: "step", Step: &st})
		}
	}
}

func (l *live) handlePermission(ctx context.Context, req *acp.RequestPermissionParams) acp.RequestPermissionResult {
	tc := &req.ToolCall
	desc := permissionDescription(tc)
	st := model.Step{Kind: "permission", ID: newID("step_perm"), Tool: toolName(tc), Description: desc, At: store.Now()}
	ch := make(chan string, 1)
	l.mu.Lock()
	l.steps = append(l.steps, st)
	l.agentIdx, l.thoughtIdx = -1, -1
	l.perms[st.ID] = ch
	streaming := l.streamID != ""
	l.mu.Unlock()
	if streaming {
		l.emitChat(model.ChatEvent{Type: "step", Step: &st})
	} else {
		// No UI turn is listening (e.g. background run); do not block forever.
		return acp.RequestPermissionResult{Outcome: acp.PermissionOutcome{Outcome: "cancelled"}}
	}
	var decision string
	select {
	case decision = <-ch:
	case <-ctx.Done():
		decision = "cancelled"
	}
	l.mu.Lock()
	for i := range l.steps {
		if l.steps[i].ID == st.ID {
			l.steps[i].Resolved = decision
		}
	}
	delete(l.perms, st.ID)
	l.mu.Unlock()
	if decision == "cancelled" {
		return acp.RequestPermissionResult{Outcome: acp.PermissionOutcome{Outcome: "cancelled"}}
	}
	l.emitChat(model.ChatEvent{Type: "step_update", ID: st.ID, Patch: model.StepPatch{"resolved": decision}})
	want := map[string][]string{
		"once":   {"allow_once", "allow_always"},
		"always": {"allow_always", "allow_once"},
		"deny":   {"reject_once", "reject_always"},
	}[decision]
	for _, kind := range want {
		for _, o := range req.Options {
			if o.Kind == kind {
				return acp.RequestPermissionResult{Outcome: acp.PermissionOutcome{Outcome: "selected", OptionID: o.OptionID}}
			}
		}
	}
	if len(req.Options) > 0 {
		return acp.RequestPermissionResult{Outcome: acp.PermissionOutcome{Outcome: "selected", OptionID: req.Options[0].OptionID}}
	}
	return acp.RequestPermissionResult{Outcome: acp.PermissionOutcome{Outcome: "cancelled"}}
}

func permissionDescription(tc *acp.SessionUpdate) string {
	var args map[string]any
	if len(tc.RawInput) > 0 {
		_ = json.Unmarshal(tc.RawInput, &args)
	} else if len(tc.Args) > 0 {
		_ = json.Unmarshal(tc.Args, &args)
	}
	if args != nil {
		for _, k := range []string{"CommandLine", "command", "Command", "Path", "path", "toolSummary"} {
			if v, ok := args[k].(string); ok && v != "" {
				switch tc.Kind {
				case "execute":
					return "Run command: " + v
				case "edit":
					return "Edit file: " + v
				case "delete":
					return "Delete: " + v
				}
				return v
			}
		}
	}
	if tc.Title != "" {
		return tc.Title
	}
	return "The agent requests permission to continue."
}

func contentText(c *acp.ContentBlock) string {
	if c == nil {
		return ""
	}
	switch c.Type {
	case "text":
		return c.Text
	case "resource":
		if c.Resource != nil {
			return c.Resource.Text
		}
	case "resource_link":
		return c.URI
	case "image":
		return "[image]"
	}
	return c.Text
}

func toolName(u *acp.SessionUpdate) string {
	if u.Name != "" {
		return u.Name
	}
	if u.Title != "" {
		return u.Title
	}
	if u.Kind != "" {
		return u.Kind
	}
	return "tool"
}

func toolStatus(s string) string {
	switch s {
	case "", "pending":
		return "pending"
	case "in_progress":
		return "running"
	case "completed":
		return "ok"
	case "failed":
		return "error"
	}
	return s
}

func rawArgs(u *acp.SessionUpdate) any {
	var v any
	if len(u.RawInput) > 0 && json.Unmarshal(u.RawInput, &v) == nil {
		return v
	}
	if len(u.Args) > 0 && json.Unmarshal(u.Args, &v) == nil {
		return v
	}
	if u.Title != "" {
		return map[string]any{"title": u.Title}
	}
	return map[string]any{}
}

func toolOutput(u *acp.SessionUpdate) string {
	if len(u.RawOutput) > 0 {
		var m map[string]any
		if json.Unmarshal(u.RawOutput, &m) == nil {
			if s, ok := m["output"].(string); ok && s != "" {
				return s
			}
			if len(m) > 0 {
				b, _ := json.MarshalIndent(m, "", "  ")
				return string(b)
			}
		} else {
			var s string
			if json.Unmarshal(u.RawOutput, &s) == nil {
				return s
			}
		}
	}
	var parts []string
	for _, it := range u.ToolItems {
		if it.Type == "content" && it.Content != nil {
			parts = append(parts, contentText(it.Content))
		}
	}
	return strings.Join(parts, "\n")
}

// unifiedDiff renders a readable line diff (not a byte-exact patch).
func unifiedDiff(path, oldText, newText string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "--- %s\n+++ %s\n", path, path)
	oldLines := strings.Split(strings.TrimRight(oldText, "\n"), "\n")
	newLines := strings.Split(strings.TrimRight(newText, "\n"), "\n")
	if oldText == "" {
		oldLines = nil
	}
	if newText == "" {
		newLines = nil
	}
	// Simple LCS-based diff for moderate sizes; fall back to whole-file for large inputs.
	if len(oldLines)*len(newLines) > 4_000_000 {
		for _, ln := range oldLines {
			b.WriteString("-" + ln + "\n")
		}
		for _, ln := range newLines {
			b.WriteString("+" + ln + "\n")
		}
		return b.String()
	}
	n, m := len(oldLines), len(newLines)
	dp := make([][]int, n+1)
	for i := range dp {
		dp[i] = make([]int, m+1)
	}
	for i := n - 1; i >= 0; i-- {
		for j := m - 1; j >= 0; j-- {
			if oldLines[i] == newLines[j] {
				dp[i][j] = dp[i+1][j+1] + 1
			} else if dp[i+1][j] >= dp[i][j+1] {
				dp[i][j] = dp[i+1][j]
			} else {
				dp[i][j] = dp[i][j+1]
			}
		}
	}
	i, j := 0, 0
	for i < n && j < m {
		switch {
		case oldLines[i] == newLines[j]:
			b.WriteString(" " + oldLines[i] + "\n")
			i++
			j++
		case dp[i+1][j] >= dp[i][j+1]:
			b.WriteString("-" + oldLines[i] + "\n")
			i++
		default:
			b.WriteString("+" + newLines[j] + "\n")
			j++
		}
	}
	for ; i < n; i++ {
		b.WriteString("-" + oldLines[i] + "\n")
	}
	for ; j < m; j++ {
		b.WriteString("+" + newLines[j] + "\n")
	}
	return b.String()
}
