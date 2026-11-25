package sync

import (
	"context"
	"testing"

	"github.com/Majidul17068/anchor/internal/model"
)

// Changing the Google account: sessions this device created and had Sync on
// for are saved afresh to the new Drive; copies pulled from other devices
// stay as local copies; nothing is deleted from the old Drive and nothing
// in the new Drive is mistaken for a file from the old one.
func TestChangingDriveAccountMovesSyncToTheNewDrive(t *testing.T) {
	t.Setenv("ANCHOR_HOME", "")
	oldDrive := newFakeDrive()
	a := newDevice(t, "A", oldDrive)
	b := newDevice(t, "B", oldDrive)
	publish(t, a, "mine1", "My chat", step("user", "u1", "hello"), step("agent", "a1", "hi"))
	publish(t, b, "theirs1", "From B", step("user", "u9", "from b"))
	a.sync()
	a.do(func() {
		if _, err := a.eng.Pull(context.Background(), "theirs1"); err != nil {
			t.Fatal(err)
		}
	})
	oldCount := len(oldDrive.paths())

	// A switches to another account: a different, empty Drive.
	newDrive := newFakeDrive()
	a.do(func() {
		a.eng.SetDrive(newDrive, "api", "", "")
		a.eng.ResetLinks(true)
		m, _ := a.st.GetSession("mine1")
		if m.DriveFileID != "" || m.RemoteVersion != 0 || !m.SyncEnabled {
			t.Fatalf("own session not cut loose but kept syncing: %+v", m)
		}
		r, _ := a.st.GetSession("theirs1")
		if r.SyncState != model.SyncLocal || r.SyncEnabled || len(a.st.Steps("theirs1")) != 1 {
			t.Fatalf("pulled copy should stay as a local copy with its transcript: %+v", r)
		}
		if a.eng.Status().LastSyncAt != "" {
			t.Fatal("last sync time of the old Drive survived the change")
		}
	})
	a.sync()

	if !newDrive.has("(mine1)") {
		t.Fatalf("own session was not saved to the new Drive: %v", newDrive.paths())
	}
	if newDrive.has("(theirs1)") {
		t.Fatal("another device's session was published to the new Drive by a replica")
	}
	if len(oldDrive.paths()) != oldCount {
		t.Fatal("changing account modified the old Drive")
	}
	a.do(func() {
		if _, err := a.st.GetSession("theirs1"); err != nil {
			t.Fatal("the pulled copy was deleted by the next sync")
		}
	})

	// Without keepSyncing, own sessions become local only.
	a.do(func() {
		a.eng.ResetLinks(false)
		m, _ := a.st.GetSession("mine1")
		if m.SyncEnabled || m.SyncState != model.SyncLocal {
			t.Fatalf("keepSyncing=false left sync on: %+v", m)
		}
	})
}
