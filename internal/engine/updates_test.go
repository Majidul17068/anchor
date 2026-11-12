package engine

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/Majidul17068/anchor/internal/acp"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

func newTestLive(t *testing.T) (*live, *[]model.ChatEvent) {
	t.Helper()
	t.Setenv("ANCHOR_HOME", t.TempDir())
	st, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	var events []model.ChatEvent
	eng := New(nil, st, func(name string, data any) {
		if ev, ok := data.(model.ChatEvent); ok {
			events = append(events, ev)
		}
	}, nil, "test")
	meta := &store.SessionMeta{Session: model.Session{ID: "s1"}}
	l := eng.liveFor(meta)
	l.streamID = "stream"
	return l, &events
}

func update(t *testing.T, raw string) *acp.SessionUpdate {
	t.Helper()
	var u acp.SessionUpdate
	if err := json.Unmarshal([]byte(raw), &u); err != nil {
		t.Fatal(err)
	}
	return &u
}

func TestAgentChunksMergeIntoOneStep(t *testing.T) {
	l, events := newTestLive(t)
	l.handleUpdate(update(t, `{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"Hello "}}`))
	l.handleUpdate(update(t, `{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"world"}}`))
	if len(l.steps) != 1 || l.steps[0].Kind != "agent" || l.steps[0].Markdown != "Hello world" {
		t.Fatalf("unexpected steps: %+v", l.steps)
	}
	if len(*events) != 2 || (*events)[0].Type != "step" || (*events)[1].Type != "token" {
		t.Fatalf("unexpected events: %+v", *events)
	}
}

func TestToolCallInterruptsAgentText(t *testing.T) {
	l, _ := newTestLive(t)
	l.handleUpdate(update(t, `{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"Let me look."}}`))
	l.handleUpdate(update(t, `{"sessionUpdate":"tool_call","toolCallId":"c1","name":"run_command","kind":"execute","status":"in_progress","title":"ls","rawInput":{"CommandLine":"ls"}}`))
	l.handleUpdate(update(t, `{"sessionUpdate":"tool_call_update","toolCallId":"c1","status":"completed","rawOutput":{"output":"a\nb","exit_code":0},"content":[{"type":"content","content":{"type":"text","text":"a\nb"}}]}`))
	l.handleUpdate(update(t, `{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"Done."}}`))
	if len(l.steps) != 3 {
		t.Fatalf("want 3 steps, got %d: %+v", len(l.steps), l.steps)
	}
	tc := l.steps[1]
	if tc.Kind != "tool_call" || tc.Tool != "run_command" || tc.Status != "ok" || tc.Output != "a\nb" {
		t.Fatalf("bad tool step: %+v", tc)
	}
	if l.steps[2].Markdown != "Done." {
		t.Fatalf("agent text after tool should start a new step: %+v", l.steps[2])
	}
}

func TestDiffContentProducesDiffStep(t *testing.T) {
	l, _ := newTestLive(t)
	l.handleUpdate(update(t, `{"sessionUpdate":"tool_call","toolCallId":"w1","name":"write_file","kind":"edit","status":"in_progress"}`))
	l.handleUpdate(update(t, `{"sessionUpdate":"tool_call_update","toolCallId":"w1","status":"completed","content":[{"type":"diff","path":"/tmp/x.txt","oldText":"a\nb\n","newText":"a\nc\n"}]}`))
	if len(l.steps) != 2 || l.steps[1].Kind != "diff" {
		t.Fatalf("want diff step, got %+v", l.steps)
	}
	patch := l.steps[1].Patch
	if !strings.Contains(patch, "-b") || !strings.Contains(patch, "+c") || !strings.Contains(patch, " a") {
		t.Fatalf("unexpected patch:\n%s", patch)
	}
}

func TestThoughtChunksAccumulate(t *testing.T) {
	l, events := newTestLive(t)
	l.handleUpdate(update(t, `{"sessionUpdate":"agent_thought_chunk","content":{"type":"text","text":"Think "}}`))
	l.handleUpdate(update(t, `{"sessionUpdate":"agent_thought_chunk","content":{"type":"text","text":"more"}}`))
	if len(l.steps) != 1 || l.steps[0].Kind != "thinking" || l.steps[0].Text != "Think more" {
		t.Fatalf("unexpected: %+v", l.steps)
	}
	last := (*events)[len(*events)-1]
	if last.Type != "step_update" || last.Patch == nil || last.Patch["text"] != "Think more" {
		t.Fatalf("unexpected last event: %+v", last)
	}
}

func TestLoadingReplaysUserMessages(t *testing.T) {
	l, events := newTestLive(t)
	l.streamID = ""
	l.loading = true
	l.handleUpdate(update(t, `{"sessionUpdate":"user_message_chunk","content":{"type":"text","text":"hi"}}`))
	l.handleUpdate(update(t, `{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"hello"}}`))
	l.handleUpdate(update(t, `{"sessionUpdate":"user_message_chunk","content":{"type":"text","text":"again"}}`))
	if len(l.steps) != 3 || l.steps[0].Kind != "user" || l.steps[1].Kind != "agent" || l.steps[2].Kind != "user" {
		t.Fatalf("unexpected: %+v", l.steps)
	}
	if len(*events) != 0 {
		t.Fatalf("replay must not emit chat events, got %d", len(*events))
	}
}

func TestClampEffort(t *testing.T) {
	for in, want := range map[model.Effort]string{"low": "low", "medium": "medium", "high": "high", "xhigh": "high", "max": "high", "": "medium"} {
		if got := clampEffort(in); got != want {
			t.Errorf("clampEffort(%q)=%q want %q", in, got, want)
		}
	}
}

func TestPlanFromTier(t *testing.T) {
	if planFromTier(&acp.Tier{ID: "g1-pro-tier", Name: "Google AI Pro"}) != model.PlanPro {
		t.Error("pro tier not detected")
	}
	if planFromTier(&acp.Tier{ID: "g1-ultra-tier", Name: "Google AI Ultra"}) != model.PlanUltra {
		t.Error("ultra tier not detected")
	}
	if planFromTier(nil) != model.PlanUnknown {
		t.Error("nil tier should be unknown")
	}
}
