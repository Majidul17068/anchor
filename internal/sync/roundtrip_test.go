package sync

import (
	"context"
	"testing"

	"github.com/Majidul17068/anchor/internal/model"
)

func stepIDs(steps []model.Step) []string {
	var out []string
	for _, s := range steps {
		out = append(out, s.ID)
	}
	return out
}

func hasStep(steps []model.Step, id string) bool {
	for _, s := range steps {
		if s.ID == id {
			return true
		}
	}
	return false
}

// A chat started on device A, continued on B, pulled back on A, continued on
// A, pulled again on B: every "Pull latest" ends with the full transcript on
// the device that asked, and the chat engine is told each time a transcript
// changed under it.
func TestPullLatestRoundTrip(t *testing.T) {
	t.Setenv("ANCHOR_HOME", "")
	drv := newFakeDrive()
	a := newDevice(t, "A", drv)
	b := newDevice(t, "B", drv)
	var aUpdated, bUpdated []string
	a.eng.OnSessionUpdated(func(id string) { aUpdated = append(aUpdated, id) })
	b.eng.OnSessionUpdated(func(id string) { bUpdated = append(bUpdated, id) })

	publish(t, a, "rt1", "Round trip", step("user", "u1", "start on A"), step("agent", "a1", "ok"))

	// B pulls and continues.
	b.sync()
	b.do(func() {
		if _, err := b.eng.Pull(context.Background(), "rt1"); err != nil {
			t.Fatal(err)
		}
		m, _ := b.st.GetSession("rt1")
		_ = b.st.SaveSteps("rt1", append(b.st.Steps("rt1"), step("user", "u2", "continued on B")))
		m.LocalVersion++
		_ = b.st.SaveSession(m)
		if err := b.eng.RefreshSession(context.Background(), "rt1"); err != nil {
			t.Fatal(err)
		}
	})
	if len(bUpdated) == 0 {
		t.Fatal("B's engine was not told about the pulled transcript")
	}

	// A pulls latest: B's step is merged, the engine is told.
	a.do(func() {
		if err := a.eng.RefreshSession(context.Background(), "rt1"); err != nil {
			t.Fatal(err)
		}
		steps := a.st.Steps("rt1")
		if !hasStep(steps, "u2") {
			t.Fatalf("A did not receive B's step: %v", stepIDs(steps))
		}
		m, _ := a.st.GetSession("rt1")
		if m.LastSyncedAt == "" {
			t.Fatal("A's session has no lastSyncedAt")
		}
	})
	if len(aUpdated) != 1 || aUpdated[0] != "rt1" {
		t.Fatalf("A's engine should have been told once, got %v", aUpdated)
	}

	// A continues; B pulls latest and sees it.
	a.do(func() {
		m, _ := a.st.GetSession("rt1")
		_ = a.st.SaveSteps("rt1", append(a.st.Steps("rt1"), step("agent", "a2", "answer from A")))
		m.LocalVersion++
		_ = a.st.SaveSession(m)
		if err := a.eng.RefreshSession(context.Background(), "rt1"); err != nil {
			t.Fatal(err)
		}
	})
	b.do(func() {
		before := len(bUpdated)
		if err := b.eng.RefreshSession(context.Background(), "rt1"); err != nil {
			t.Fatal(err)
		}
		steps := b.st.Steps("rt1")
		for _, id := range []string{"u1", "a1", "u2", "a2"} {
			if !hasStep(steps, id) {
				t.Fatalf("B is missing %s after pull: %v", id, stepIDs(steps))
			}
		}
		if len(bUpdated) == before {
			t.Fatal("B's engine was not told about A's new step")
		}
		st := b.eng.Status()
		if st.LastSyncAt == "" {
			t.Fatal("status has no lastSyncAt")
		}
		// A fresh engine on the same store remembers when it last synced.
		again := New(b.st, drv, nil, nil)
		if again.Status().LastSyncAt != st.LastSyncAt {
			t.Fatalf("lastSyncAt not persisted: %q vs %q", again.Status().LastSyncAt, st.LastSyncAt)
		}
	})
}

// Parent devices refreshing a session that nobody else touched must not
// report a change or re-upload.
func TestRefreshUnchangedIsQuiet(t *testing.T) {
	t.Setenv("ANCHOR_HOME", "")
	drv := newFakeDrive()
	a := newDevice(t, "A", drv)
	var updated []string
	a.eng.OnSessionUpdated(func(id string) { updated = append(updated, id) })
	publish(t, a, "q1", "Quiet", step("user", "u1", "hi"))
	a.do(func() {
		m, _ := a.st.GetSession("q1")
		before := m.LastSyncedAt
		if err := a.eng.RefreshSession(context.Background(), "q1"); err != nil {
			t.Fatal(err)
		}
		m, _ = a.st.GetSession("q1")
		if m.LastSyncedAt != before {
			t.Fatal("unchanged session was re-uploaded")
		}
	})
	if len(updated) != 0 {
		t.Fatalf("engine told about a change that did not happen: %v", updated)
	}
}
