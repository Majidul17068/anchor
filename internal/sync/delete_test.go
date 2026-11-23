package sync

import (
	"context"
	"testing"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

// publish creates a published session on device a with the given steps.
func publish(t *testing.T, a *device, id, title string, steps ...model.Step) {
	t.Helper()
	a.do(func() {
		m := &store.SessionMeta{Session: model.Session{ID: id, Title: title, OriginDeviceID: a.id, SyncEnabled: true,
			SyncState: model.SyncPublished, WorkspacePaths: []string{}, CreatedAt: "2026-11-20T10:00:00Z", LastModified: "2026-11-20T10:00:00Z"}}
		m.ACPSessionID = id
		m.LocalVersion = 1
		if err := a.st.SaveSession(m); err != nil {
			t.Fatal(err)
		}
		_ = a.st.SaveSteps(id, steps)
	})
	a.sync()
}

// The parent deleting a session removes its file and every append from
// Drive; the replica keeps only what it already had, as a local copy.
func TestParentDeleteRemovesDriveCopyAndAppends(t *testing.T) {
	t.Setenv("ANCHOR_HOME", "")
	drv := newFakeDrive()
	a := newDevice(t, "A", drv)
	b := newDevice(t, "B", drv)
	publish(t, a, "s9", "Office chat", step("user", "u1", "hi"), step("agent", "a1", "hello"))

	b.sync()
	b.do(func() {
		if _, err := b.eng.Pull(context.Background(), "s9"); err != nil {
			t.Fatal(err)
		}
		m, _ := b.st.GetSession("s9")
		_ = b.st.SaveSteps("s9", append(b.st.Steps("s9"), step("user", "u2", "from home")))
		m.LocalVersion++
		_ = b.st.SaveSession(m)
	})
	b.sync()
	if !drv.has("- from ") {
		t.Fatalf("expected an append on drive: %v", drv.paths())
	}

	// A deletes: canonical and append both leave Drive.
	a.do(func() {
		if err := a.eng.Unpublish(context.Background(), "s9"); err != nil {
			t.Fatal(err)
		}
	})
	if drv.has("(s9)") {
		t.Fatalf("drive still holds the deleted session: %v", drv.paths())
	}

	// B notices on its next sync and keeps a local, unsynced copy.
	b.sync()
	b.do(func() {
		m, err := b.st.GetSession("s9")
		if err != nil {
			t.Fatal("replica vanished from B; it must stay as a local copy")
		}
		if m.SyncEnabled || m.SyncState != model.SyncLocal || !m.Unpublished {
			t.Fatalf("replica after parent delete = %+v unpublished=%v", m.Session, m.Unpublished)
		}
	})
}

// A replica deleting its copy does not touch Drive: the parent still owns
// the original, and the session stays available to pull again.
func TestReplicaDeleteLeavesDriveAlone(t *testing.T) {
	t.Setenv("ANCHOR_HOME", "")
	drv := newFakeDrive()
	a := newDevice(t, "A", drv)
	b := newDevice(t, "B", drv)
	publish(t, a, "s10", "Keep me", step("user", "u1", "hi"))
	b.sync()
	b.do(func() {
		if _, err := b.eng.Pull(context.Background(), "s10"); err != nil {
			t.Fatal(err)
		}
		_ = b.st.DeleteSession("s10") // what the API does for a replica
	})
	b.sync()
	if !drv.has("(s10)") {
		t.Fatalf("replica delete removed the parent's file: %v", drv.paths())
	}
	b.do(func() {
		avail, _ := b.eng.Available(context.Background())
		if len(avail) != 1 || avail[0].ID != "s10" {
			t.Fatalf("session should be available to pull again, got %+v", avail)
		}
	})
}

// A third device pulling a session sees additions another replica uploaded
// even though the parent has not merged them yet.
func TestPullIncludesUnmergedAppends(t *testing.T) {
	t.Setenv("ANCHOR_HOME", "")
	drv := newFakeDrive()
	a := newDevice(t, "A", drv)
	b := newDevice(t, "B", drv)
	c := newDevice(t, "C", drv)
	publish(t, a, "s11", "Shared", step("user", "u1", "hi"), step("agent", "a1", "hello"))

	b.sync()
	b.do(func() {
		if _, err := b.eng.Pull(context.Background(), "s11"); err != nil {
			t.Fatal(err)
		}
		m, _ := b.st.GetSession("s11")
		_ = b.st.SaveSteps("s11", append(b.st.Steps("s11"), step("user", "u2", "B adds")))
		m.LocalVersion++
		_ = b.st.SaveSession(m)
	})
	b.sync() // uploads the append; A is "offline" and has not merged

	c.sync()
	c.do(func() {
		if _, err := c.eng.Pull(context.Background(), "s11"); err != nil {
			t.Fatal(err)
		}
		steps := c.st.Steps("s11")
		if len(steps) != 3 || steps[2].Text != "B adds" {
			t.Fatalf("C should see B's unmerged addition, got %+v", steps)
		}
	})
	if !drv.has("- from ") {
		t.Fatal("pulling must not consume the append; the parent merges it")
	}

	// The parent comes back, merges, and the append is gone.
	a.sync()
	if drv.has("- from ") {
		t.Fatalf("parent did not merge the append: %v", drv.paths())
	}
	a.do(func() {
		if steps := a.st.Steps("s11"); len(steps) != 3 {
			t.Fatalf("parent transcript = %+v", steps)
		}
	})
}
