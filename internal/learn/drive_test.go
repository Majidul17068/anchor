package learn

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/Majidul17068/anchor/internal/drive"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

// memDrive is one Google Drive shared by the devices in a test.
type memDrive struct {
	mu    sync.Mutex
	files map[string]*drive.File
	body  map[string][]byte
	n     int
	puts  int
}

func newMemDrive() *memDrive {
	return &memDrive{files: map[string]*drive.File{}, body: map[string][]byte{}}
}
func (m *memDrive) Connected() bool                            { return true }
func (m *memDrive) RootFolder(context.Context) (string, error) { return "root", nil }
func (m *memDrive) PutIn(_ context.Context, parent, name string, props map[string]string, content []byte) (drive.File, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.n++
	m.puts++
	id := parent + "/" + name
	f := &drive.File{ID: id, Name: name, ParentID: parent, Props: props, Size: int64(len(content)), Modified: fmt.Sprintf("2026-11-25T10:00:%02dZ", m.n)}
	m.files[id], m.body[id] = f, append([]byte(nil), content...)
	return *f, nil
}
func (m *memDrive) ListKind(_ context.Context, kind string) ([]drive.File, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []drive.File
	for _, f := range m.files {
		if f.Props[drive.PropKind] == kind {
			out = append(out, *f)
		}
	}
	return out, nil
}
func (m *memDrive) Get(_ context.Context, id string) ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.body[id], nil
}

// dev is one machine: its own ANCHOR_HOME (exported around each action),
// rules, skills and agents.
type dev struct {
	home   string
	svc    *Service
	st     *store.Store
	skills []string
	agents []string
}

func newDev(t *testing.T) *dev {
	t.Helper()
	d := &dev{home: t.TempDir()}
	os.Setenv("ANCHOR_HOME", d.home)
	st, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	d.st = st
	rules := func() string { s, _ := st.Settings()["agentRules"].(string); return s }
	hooks := Hooks{
		Rules: rules,
		SetRules: func(text string) error {
			return st.SetSettings(map[string]any{"agentRules": text, "agentRulesAt": store.Now()})
		},
		SetRulesAt: func(text, at string) error {
			return st.SetSettings(map[string]any{"agentRules": text, "agentRulesAt": at})
		},
		SaveSkill: func(name, _, _ string) (string, error) {
			d.skills = append(d.skills, name)
			return "skill_" + name, nil
		},
		SaveAgent: func(name, _, _ string, _ []string) (string, error) {
			d.agents = append(d.agents, name)
			return "mine:" + name, nil
		},
		Existing: func() ([]string, []string) { return d.skills, d.agents },
	}
	d.svc = New(st, func(context.Context, string, string, string) (string, error) { return `{"suggestions":[]}`, nil }, hooks, nil, nil)
	return d
}

func (d *dev) do(fn func()) { os.Setenv("ANCHOR_HOME", d.home); fn() }

func (d *dev) sync(t *testing.T, m *memDrive) {
	t.Helper()
	d.do(func() {
		if err := d.svc.SyncDrive(context.Background(), m); err != nil {
			t.Fatal(err)
		}
	})
}

func (d *dev) add(sg model.Suggestion) {
	d.do(func() {
		st := d.svc.load()
		sg.Status, sg.CreatedAt = model.SuggestionDraft, store.Now()
		st.Suggestions = append(st.Suggestions, sg)
		_ = d.svc.save(st)
	})
}

func (d *dev) status(id string) string {
	var out string
	d.do(func() {
		for _, s := range d.svc.List() {
			if s.ID == id {
				out = s.Status
			}
		}
	})
	return out
}

// What one device learns and decides reaches the other through the single
// knowledge file at the top of the Anchor folder: drafts appear there, an
// approval creates the skill there too (once), a dismissal sticks, and the
// instructions follow whichever device changed them last.
func TestKnowledgeTravelsBetweenDevices(t *testing.T) {
	t.Setenv("ANCHOR_HOME", "")
	m := newMemDrive()
	a, b := newDev(t), newDev(t)

	a.add(model.Suggestion{ID: "sg_skill", Kind: model.SuggestionSkill, Title: "Release notes", Name: "release-notes", Description: "d", Body: "steps"})
	a.add(model.Suggestion{ID: "sg_agent", Kind: model.SuggestionAgent, Title: "Reviewer", Name: "reviewer", Body: "be strict"})
	a.add(model.Suggestion{ID: "sg_rule", Kind: model.SuggestionRule, Title: "TypeScript", Rule: "Use TypeScript."})
	a.sync(t, m)
	var f drive.File
	for _, x := range m.files {
		f = *x
	}
	if f.Name != "Anchor knowledge.json" || f.ParentID != "root" {
		t.Fatalf("knowledge file is %q in %q; want it at the top of the Anchor folder", f.Name, f.ParentID)
	}

	// B sees A's drafts without having studied anything.
	b.sync(t, m)
	if b.status("sg_skill") != model.SuggestionDraft || b.status("sg_rule") != model.SuggestionDraft {
		t.Fatal("B did not receive A's drafts")
	}

	// A approves the skill and the rule; B dismisses the agent.
	a.do(func() {
		if _, err := a.svc.Accept("sg_skill", Edit{}); err != nil {
			t.Fatal(err)
		}
		if _, err := a.svc.Accept("sg_rule", Edit{}); err != nil {
			t.Fatal(err)
		}
	})
	b.do(func() { _ = b.svc.Reject("sg_agent") })
	a.sync(t, m)
	b.sync(t, m)
	a.sync(t, m)

	if got := strings.Join(a.skills, ","); got != "release-notes" {
		t.Fatalf("A skills = %q (created once, on approval)", got)
	}
	if got := strings.Join(b.skills, ","); got != "release-notes" {
		t.Fatalf("B skills = %q; the approved skill should be created on B too", got)
	}
	if len(a.agents)+len(b.agents) != 0 {
		t.Fatal("the dismissed agent was created somewhere")
	}
	if a.status("sg_agent") != model.SuggestionRejected {
		t.Fatal("B's dismissal did not reach A")
	}
	var bRules string
	b.do(func() { bRules, _ = b.st.Settings()["agentRules"].(string) })
	if !strings.Contains(bRules, "Use TypeScript.") {
		t.Fatalf("B's instructions = %q; A's approved rule should be there", bRules)
	}

	// B deletes the skill locally: it must not come back.
	b.skills = nil
	b.sync(t, m)
	if len(b.skills) != 0 {
		t.Fatal("a skill deleted on B was re-created by sync")
	}

	// Nothing changed anywhere: no more uploads.
	puts := m.puts
	a.sync(t, m)
	b.sync(t, m)
	a.sync(t, m)
	if m.puts != puts {
		t.Fatalf("idle syncs uploaded %d times", m.puts-puts)
	}

	// B edits the instructions later: A follows.
	b.do(func() {
		_ = b.st.SetSettings(map[string]any{"agentRules": "- Reply in Bangla.\n", "agentRulesAt": "2099-01-01T00:00:00Z"})
	})
	b.sync(t, m)
	a.sync(t, m)
	var aRules string
	a.do(func() { aRules, _ = a.st.Settings()["agentRules"].(string) })
	if aRules != "- Reply in Bangla.\n" {
		t.Fatalf("A's instructions = %q; B changed them last", aRules)
	}

	// "Forget everything" on A erases the list on B as well.
	a.do(func() { _ = a.svc.Forget() })
	a.sync(t, m)
	b.sync(t, m)
	var left int
	b.do(func() { left = len(b.svc.List()) })
	if left != 0 {
		t.Fatalf("%d suggestions survived on B after A forgot everything", left)
	}
}

// Two devices that studied the same history and proposed the same idea end
// up with one entry, and a decision on either side wins over the draft.
func TestSameIdeaFromTwoDevicesIsOne(t *testing.T) {
	local := []model.Suggestion{{ID: "a1", Kind: "rule", Title: "Use  TypeScript", Status: model.SuggestionDraft}}
	remote := []model.Suggestion{{ID: "b1", Kind: "rule", Title: "use typescript", Status: model.SuggestionRejected, DecidedAt: "2026-11-25T00:00:00Z"}}
	got := mergeSuggestions(local, remote)
	if len(got) != 1 || got[0].Status != model.SuggestionRejected {
		t.Fatalf("merged = %+v", got)
	}
}
