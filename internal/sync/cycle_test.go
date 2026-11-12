package sync

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	gosync "sync"
	"testing"
	"time"

	"github.com/Majidul17068/anchor/internal/drive"
	"github.com/Majidul17068/anchor/internal/folderdrive"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

// fakeDrive is an in-memory Google Drive shared by every "device" in a
// test: a hidden app folder for device records and a visible
// Anchor/YYYY/MM/DD tree for sessions.
type fakeDrive struct {
	mu    gosync.Mutex
	files map[string]*fakeFile // by id
	next  int
}

type fakeFile struct {
	drive.File
	body []byte
}

const appParent = "appDataFolder"

func newFakeDrive() *fakeDrive { return &fakeDrive{files: map[string]*fakeFile{}} }

func (f *fakeDrive) Connected() bool { return true }
func (f *fakeDrive) Email() string   { return "owner@example.com" }

func (f *fakeDrive) put(parent, name string, props map[string]string, content []byte) drive.File {
	for _, ff := range f.files {
		if ff.ParentID == parent && ff.Name == name {
			ff.body = append([]byte(nil), content...)
			ff.Size = int64(len(content))
			ff.Props = props
			ff.Modified = store.Now()
			return ff.File
		}
	}
	f.next++
	ff := &fakeFile{File: drive.File{ID: fmt.Sprintf("f%d", f.next), Name: name, Size: int64(len(content)), Modified: store.Now(), Props: props, ParentID: parent}, body: append([]byte(nil), content...)}
	f.files[ff.ID] = ff
	return ff.File
}

func (f *fakeDrive) ListApp(_ context.Context, prefix string) ([]drive.File, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []drive.File
	for _, ff := range f.files {
		if ff.ParentID == appParent && strings.HasPrefix(ff.Name, prefix) {
			out = append(out, ff.File)
		}
	}
	return out, nil
}

func (f *fakeDrive) PutApp(_ context.Context, name string, props map[string]string, content []byte) (drive.File, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.put(appParent, name, props, content), nil
}

func (f *fakeDrive) DayFolder(_ context.Context, t time.Time) (string, error) {
	return "Anchor/" + drive.DayPath(t), nil
}

func (f *fakeDrive) PutIn(_ context.Context, parentID, name string, props map[string]string, content []byte) (drive.File, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.put(parentID, name, props, content), nil
}

func (f *fakeDrive) ListKind(_ context.Context, kind string) ([]drive.File, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []drive.File
	for _, ff := range f.files {
		if ff.Props[drive.PropKind] == kind {
			out = append(out, ff.File)
		}
	}
	return out, nil
}

func (f *fakeDrive) Get(_ context.Context, id string) ([]byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	ff, ok := f.files[id]
	if !ok {
		return nil, fmt.Errorf("no such file %s", id)
	}
	return append([]byte(nil), ff.body...), nil
}

func (f *fakeDrive) Delete(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.files, id)
	return nil
}

// paths returns "parent/name" for every file, for assertions.
func (f *fakeDrive) paths() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []string
	for _, ff := range f.files {
		out = append(out, ff.ParentID+"/"+ff.Name)
	}
	return out
}

func (f *fakeDrive) has(substr string) bool {
	for _, p := range f.paths() {
		if strings.Contains(p, substr) {
			return true
		}
	}
	return false
}

// device is one machine: its own ANCHOR_HOME, store and sync engine. The
// store resolves its directory from the environment on every call, so each
// action runs with the device's home exported.
type device struct {
	t    *testing.T
	home string
	st   *store.Store
	eng  *Engine
	id   string
}

func newDevice(t *testing.T, name string, drv Drive) *device {
	t.Helper()
	home := t.TempDir()
	os.Setenv("ANCHOR_HOME", home)
	st, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	d := &device{t: t, home: home, st: st}
	d.eng = New(st, drv, nil, nil)
	d.id = st.Device().ID
	if d.id == "" {
		t.Fatalf("%s has no device id", name)
	}
	return d
}

func (d *device) do(fn func()) {
	os.Setenv("ANCHOR_HOME", d.home)
	fn()
}

func (d *device) sync() {
	d.do(func() {
		if _, err := d.eng.SyncNow(context.Background()); err != nil {
			d.t.Fatal(err)
		}
	})
}

func step(kind, id, text string) model.Step {
	return model.Step{Kind: kind, ID: id, Text: text, At: store.Now()}
}

func TestSessionsStayLocalUntilSyncIsEnabled(t *testing.T) {
	t.Setenv("ANCHOR_HOME", "")
	drv := newFakeDrive()
	a := newDevice(t, "A", drv)
	a.do(func() {
		m := &store.SessionMeta{Session: model.Session{ID: "s1", Title: "Private", OriginDeviceID: a.id, SyncState: model.SyncLocal}}
		m.ACPSessionID = "s1"
		if err := a.st.SaveSession(m); err != nil {
			t.Fatal(err)
		}
		_ = a.st.SaveSteps("s1", []model.Step{step("user", "u1", "hello")})
	})
	a.sync()
	if drv.has("Private") || drv.has("(s1)") {
		t.Fatalf("local-only session was uploaded: %v", drv.paths())
	}
}

// probe lets the cycle test look at what landed on the drive, whichever
// backend is under test.
type probe interface {
	Drive
	has(substr string) bool
	paths() []string
}

// folderProbe wraps the on-disk backend used with Google Drive for Desktop.
type folderProbe struct {
	*folderdrive.Service
	root string
}

func (f folderProbe) paths() []string {
	var out []string
	_ = filepath.WalkDir(f.root, func(p string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			rel, _ := filepath.Rel(f.root, p)
			out = append(out, filepath.ToSlash(rel))
		}
		return nil
	})
	return out
}

func (f folderProbe) has(substr string) bool {
	for _, p := range f.paths() {
		if strings.Contains(p, substr) {
			return true
		}
	}
	return false
}

func TestPublishListPullAppendMergeUnpublish_API(t *testing.T) {
	runCycle(t, newFakeDrive())
}

// The same cycle through a synced folder on disk: two devices sharing one
// Drive for Desktop folder (what Google syncs between machines).
func TestPublishListPullAppendMergeUnpublish_Folder(t *testing.T) {
	root := t.TempDir()
	runCycle(t, folderProbe{folderdrive.New(root), root})
}

func runCycle(t *testing.T, drv probe) {
	t.Setenv("ANCHOR_HOME", "")
	a := newDevice(t, "A", drv)
	b := newDevice(t, "B", drv)
	if a.id == b.id {
		t.Fatal("devices share an id")
	}

	// A creates a session on 12 Nov 2026 and switches sync on (parent source).
	created := "2026-11-12T09:30:00Z"
	a.do(func() {
		m := &store.SessionMeta{Session: model.Session{ID: "s1", Title: "Fix: login/flow", OriginDeviceID: a.id, SyncEnabled: true,
			SyncState: model.SyncPublished, WorkspacePaths: []string{}, CreatedAt: created, LastModified: created}}
		m.ACPSessionID = "s1"
		m.LocalVersion = 1
		if err := a.st.SaveSession(m); err != nil {
			t.Fatal(err)
		}
		_ = a.st.SaveSteps("s1", []model.Step{step("user", "u1", "hello"), step("agent", "a1", "hi there")})
	})
	a.sync()
	want := "Anchor/" + drive.DayPath(time.Date(2026, 11, 12, 9, 30, 0, 0, time.UTC)) + "/Fix- login-flow (s1).json"
	if !drv.has(want) {
		t.Fatalf("published session not filed by day with a readable name: %v", drv.paths())
	}

	// B does not get it automatically; it appears in the list to pull from.
	b.sync()
	b.do(func() {
		if _, err := b.st.GetSession("s1"); err == nil {
			t.Fatal("session was pulled without being asked for")
		}
		avail, err := b.eng.Available(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if len(avail) != 1 || avail[0].ID != "s1" || avail[0].Title != "Fix: login/flow" || avail[0].StepCount != 2 || avail[0].OriginDeviceID != a.id || avail[0].Day == "" {
			t.Fatalf("available = %+v", avail)
		}
		if _, err := b.eng.Pull(context.Background(), "s1"); err != nil {
			t.Fatal(err)
		}
		m, err := b.st.GetSession("s1")
		if err != nil {
			t.Fatalf("replica missing on B after pull: %v", err)
		}
		if m.SyncState != model.SyncReplica || m.OriginDeviceID != a.id || !m.SyncEnabled {
			t.Fatalf("replica meta = %+v", m.Session)
		}
		steps := b.st.Steps("s1")
		if len(steps) != 2 || steps[1].Text != "hi there" {
			t.Fatalf("replica steps = %+v", steps)
		}
		if avail, _ := b.eng.Available(context.Background()); len(avail) != 0 {
			t.Fatalf("pulled session still listed as available: %+v", avail)
		}
		// B continues the conversation locally.
		_ = b.st.SaveSteps("s1", append(steps, step("user", "u2", "from B")))
		m.LocalVersion++
		_ = b.st.SaveSession(m)
	})
	b.sync()
	if !drv.has("- from ") {
		t.Fatalf("B's addition was not uploaded as an append: %v", drv.paths())
	}

	// A merges the append into the canonical transcript.
	a.sync()
	a.do(func() {
		steps := a.st.Steps("s1")
		if len(steps) != 3 || steps[2].Text != "from B" {
			t.Fatalf("parent did not merge: %+v", steps)
		}
		m, _ := a.st.GetSession("s1")
		if m.StepCount != 3 || m.SyncState != model.SyncPublished {
			t.Fatalf("parent meta after merge = %+v", m.Session)
		}
	})
	if drv.has("- from ") {
		t.Fatalf("append not cleaned up after merge: %v", drv.paths())
	}

	// B sees the merged canonical transcript on its next refresh.
	b.sync()
	b.do(func() {
		if steps := b.st.Steps("s1"); len(steps) != 3 {
			t.Fatalf("replica not updated after merge: %+v", steps)
		}
	})

	// A renames the session: the Drive file follows.
	a.do(func() {
		m, _ := a.st.GetSession("s1")
		m.Title = "Login fixed"
		m.LocalVersion++
		_ = a.st.SaveSession(m)
	})
	a.sync()
	if !drv.has("Login fixed (s1).json") || drv.has("Fix- login-flow (s1).json") {
		t.Fatalf("rename not reflected: %v", drv.paths())
	}

	// A switches sync off: the file goes, B's copy becomes local.
	a.do(func() {
		m, _ := a.st.GetSession("s1")
		m.SyncEnabled = false
		m.LocalVersion++
		_ = a.st.SaveSession(m)
	})
	a.sync()
	if drv.has("(s1)") {
		t.Fatalf("unpublished session still on drive: %v", drv.paths())
	}
	b.sync()
	b.do(func() {
		m, _ := b.st.GetSession("s1")
		if m.SyncState != model.SyncLocal || m.SyncEnabled || !m.Unpublished {
			t.Fatalf("replica after unpublish = %+v unpublished=%v", m.Session, m.Unpublished)
		}
		if steps := b.st.Steps("s1"); len(steps) != 3 {
			t.Fatal("unpublishing must not erase B's local copy")
		}
	})
}
