package learn

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

type fixture struct {
	svc     *Service
	st      *store.Store
	rules   string
	skills  []string
	agents  []string
	prompts []string
	reply   string
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	t.Setenv("ANCHOR_HOME", t.TempDir())
	st, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	f := &fixture{st: st, rules: "- Answer briefly.\n"}
	run := func(_ context.Context, _ string, prompt, _ string) (string, error) {
		f.prompts = append(f.prompts, prompt)
		return f.reply, nil
	}
	hooks := Hooks{
		Rules:    func() string { return f.rules },
		SetRules: func(s string) error { f.rules = s; return nil },
		SaveSkill: func(name, _, _ string) (string, error) {
			f.skills = append(f.skills, name)
			return "skill_mine_" + name, nil
		},
		SaveAgent: func(name, _, _ string, _ []string) (string, error) {
			f.agents = append(f.agents, name)
			return "mine:" + name, nil
		},
		Existing: func() ([]string, []string) { return f.skills, f.agents },
	}
	f.svc = New(st, run, hooks, nil, nil)
	return f
}

func (f *fixture) chat(t *testing.T, id, title string, userMsgs ...string) {
	t.Helper()
	m := &store.SessionMeta{Session: model.Session{ID: id, Title: title, WorkspacePaths: []string{"/Users/someone/secret-client/app"},
		CreatedAt: store.Now(), LastModified: store.Now()}}
	if err := f.st.SaveSession(m); err != nil {
		t.Fatal(err)
	}
	var steps []model.Step
	for i, u := range userMsgs {
		steps = append(steps, model.Step{Kind: "user", ID: fmt.Sprintf("%s-u%d", id, i), Text: u, At: store.Now()})
		steps = append(steps, model.Step{Kind: "agent", ID: fmt.Sprintf("%s-a%d", id, i), Markdown: "AGENT REPLY MUST NOT BE STUDIED", At: store.Now()})
	}
	if err := f.st.SaveSteps(id, steps); err != nil {
		t.Fatal(err)
	}
}

const reply = "Here you go:\n```json\n" + `{"suggestions":[
 {"kind":"rule","title":"Use TypeScript","reason":"Asked 3 times","occurrences":3,"evidence":["use typescript not js"],"rule":"Write new code in TypeScript, not JavaScript."},
 {"kind":"skill","title":"Release notes","reason":"4 requests","occurrences":4,"evidence":["write release notes"],"name":"release-notes","description":"Write release notes from commits.","body":"1. Read the commits.\n2. Group them."},
 {"kind":"agent","title":"PR reviewer","reason":"3 requests","occurrences":3,"evidence":[],"name":"pr-reviewer","description":"Reviews diffs.","instructions":"Review strictly.","tools":["view_file","rm_rf"]},
 {"kind":"skill","title":"Seen once","reason":"1 request","occurrences":1,"name":"once","body":"x"},
 {"kind":"rule","title":"Empty","reason":"x","occurrences":5,"rule":""},
 {"kind":"poem","title":"Nope","occurrences":9}
]}` + "\n```"

func seed(f *fixture, t *testing.T) {
	f.chat(t, "s1", "Build feature", "use typescript not js", "write release notes for v1", "review this PR")
	f.chat(t, "s2", "Another", "again: typescript please", "write release notes for v2", "review this PR too", "release notes again")
	f.chat(t, "s3", "Test · reviewer", "this scratch chat must be ignored")
}

func TestRunKeepsOnlySoundSuggestionsAndStudiesOnlyUserMessages(t *testing.T) {
	f := newFixture(t)
	seed(f, t)
	f.reply = reply
	n, err := f.svc.Run(context.Background(), true)
	if err != nil {
		t.Fatal(err)
	}
	if n != 3 {
		t.Fatalf("added %d, want 3 (weak, empty and unknown-kind proposals dropped)", n)
	}
	p := f.prompts[0]
	if strings.Contains(p, "AGENT REPLY") || strings.Contains(p, "scratch chat") {
		t.Fatal("digest contains agent replies or scratch sessions")
	}
	if strings.Contains(p, "secret-client") || strings.Contains(p, "/Users/someone") {
		t.Fatal("digest leaks the workspace path beyond its last folder")
	}
	if !strings.Contains(p, "use typescript not js") || !strings.Contains(p, "Answer briefly.") {
		t.Fatal("digest lacks the user's messages or current rules")
	}
	for _, sg := range f.svc.List() {
		if sg.Kind == model.SuggestionAgent && (len(sg.Tools) != 1 || sg.Tools[0] != "view_file") {
			t.Fatalf("unknown tool not dropped: %v", sg.Tools)
		}
		if sg.Status != model.SuggestionDraft {
			t.Fatalf("new suggestion is not a draft: %+v", sg)
		}
	}
	// Nothing took effect yet.
	if f.rules != "- Answer briefly.\n" || len(f.skills) != 0 || len(f.agents) != 0 {
		t.Fatal("a draft changed something before approval")
	}
	if st := f.svc.Status(); st.Drafts != 3 || st.LastRunAt == "" {
		t.Fatalf("status: %+v", st)
	}
}

func TestAcceptRejectAndNeverProposeAgain(t *testing.T) {
	f := newFixture(t)
	seed(f, t)
	f.reply = reply
	if _, err := f.svc.Run(context.Background(), true); err != nil {
		t.Fatal(err)
	}
	byKind := map[string]model.Suggestion{}
	for _, sg := range f.svc.List() {
		byKind[sg.Kind] = sg
	}

	// Rule: edited, then appended to the existing instructions.
	edited := "Always write new code in TypeScript."
	if _, err := f.svc.Accept(byKind["rule"].ID, Edit{Rule: &edited}); err != nil {
		t.Fatal(err)
	}
	if f.rules != "- Answer briefly.\n- Always write new code in TypeScript.\n" {
		t.Fatalf("rules = %q", f.rules)
	}
	// Skill: created, id returned for sharing.
	got, err := f.svc.Accept(byKind["skill"].ID, Edit{})
	if err != nil || got.CreatedID != "skill_mine_release-notes" || got.Status != model.SuggestionAccepted {
		t.Fatalf("accept skill: %+v %v", got, err)
	}
	// Agent: rejected; nothing created.
	if err := f.svc.Reject(byKind["agent"].ID); err != nil {
		t.Fatal(err)
	}
	if len(f.agents) != 0 {
		t.Fatal("rejected agent was created")
	}
	if _, err := f.svc.Accept(byKind["agent"].ID, Edit{}); err == nil {
		t.Fatal("a rejected suggestion could still be accepted")
	}

	// The next run is told about all three and adds none of them again.
	n, err := f.svc.Run(context.Background(), true)
	if err != nil || n != 0 {
		t.Fatalf("second run added %d (%v), want 0", n, err)
	}
	p := f.prompts[1]
	for _, title := range []string{"Use TypeScript", "Release notes", "PR reviewer"} {
		if !strings.Contains(p, title) {
			t.Fatalf("second prompt does not list %q as already proposed", title)
		}
	}
	if st := f.svc.Status(); st.Drafts != 0 {
		t.Fatalf("drafts left: %d", st.Drafts)
	}
}

func TestAutomaticRunSkipsWhenNothingNewAndNeedsHistory(t *testing.T) {
	f := newFixture(t)
	f.chat(t, "s1", "Tiny", "hello")
	f.reply = reply
	if _, err := f.svc.Run(context.Background(), true); err == nil || !strings.Contains(err.Error(), "not enough history") {
		t.Fatalf("err = %v", err)
	}
	seed(f, t)
	if _, err := f.svc.Run(context.Background(), false); err != nil {
		t.Fatal(err)
	}
	calls := len(f.prompts)
	if _, err := f.svc.Run(context.Background(), false); err != ErrNothingNew {
		t.Fatalf("err = %v, want ErrNothingNew", err)
	}
	if len(f.prompts) != calls {
		t.Fatal("an automatic run with nothing new still spent a turn")
	}
	// Off by default: never due until the user switches it on.
	if f.svc.AutoDue() {
		t.Fatal("learning is due although the user never enabled it")
	}
}
