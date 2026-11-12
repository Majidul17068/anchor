package sync

import (
	"context"
	"fmt"
	"os"
	gosync "sync"
	"testing"

	"github.com/Majidul17068/anchor/internal/drive"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

// fakeDrive is an in-memory appDataFolder shared by every "device" in a test.
type fakeDrive struct {
	mu    gosync.Mutex
	files map[string]*fakeFile // by id
	next  int
}

type fakeFile struct {
	drive.File
	body []byte
}

func newFakeDrive() *fakeDrive { return &fakeDrive{files: map[string]*fakeFile{}} }

func (f *fakeDrive) Connected() bool { return true }
func (f *fakeDrive) Email() string   { return "owner@example.com" }

func (f *fakeDrive) ListApp(_ context.Context, prefix string) ([]drive.File, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []drive.File
	for _, ff := range f.files {
		if prefix == "" || len(ff.Name) >= len(prefix) && ff.Name[:len(prefix)] == prefix {
			out = append(out, ff.File)
		}
	}
	return out, nil
}

func (f *fakeDrive) PutApp(_ context.Context, name string, props map[string]string, content []byte) (drive.File, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, ff := range f.files {
		if ff.Name == name {
			ff.body = append([]byte(nil), content...)
			ff.Size = int64(len(content))
			ff.Props = props
			ff.Modified = store.Now()
			return ff.File, nil
		}
	}
	f.next++
	ff := &fakeFile{File: drive.File{ID: fmt.Sprintf("f%d", f.next), Name: name, Size: int64(len(content)), Modified: store.Now(), Props: props}, body: append([]byte(nil), content...)}
	f.files[ff.ID] = ff
	return ff.File, nil
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

func (f *fakeDrive) names() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []string
	for _, ff := range f.files {
		out = append(out, ff.Name)
	}
	return out
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
	for _, n := range drv.names() {
		if n == sessionFile("s1") {
			t.Fatalf("local-only session was uploaded: %v", drv.names())
		}
	}
}

func TestPublishPullAppendMergeUnpublish(t *testing.T) {
	t.Setenv("ANCHOR_HOME", "") // restored afterwards by the testing package
	drv := newFakeDrive()
	a := newDevice(t, "A", drv)
	b := newDevice(t, "B", drv)
	if a.id == b.id {
		t.Fatal("devices share an id")
	}

	// A creates a session and switches sync on (parent source).
	a.do(func() {
		m := &store.SessionMeta{Session: model.Session{ID: "s1", Title: "Shared", OriginDeviceID: a.id, SyncEnabled: true, SyncState: model.SyncPublished, WorkspacePaths: []string{}}}
		m.ACPSessionID = "s1"
		m.LocalVersion = 1
		if err := a.st.SaveSession(m); err != nil {
			t.Fatal(err)
		}
		_ = a.st.SaveSteps("s1", []model.Step{step("user", "u1", "hello"), step("agent", "a1", "hi there")})
	})
	a.sync()
	if _, err := drv.ListApp(context.Background(), sessionFile("s1")); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, n := range drv.names() {
		if n == sessionFile("s1") {
			found = true
		}
	}
	if !found {
		t.Fatalf("published session not on drive: %v", drv.names())
	}

	// B pulls it as a replica with the transcript.
	b.sync()
	b.do(func() {
		m, err := b.st.GetSession("s1")
		if err != nil {
			t.Fatalf("replica missing on B: %v", err)
		}
		if m.SyncState != model.SyncReplica || m.OriginDeviceID != a.id || !m.SyncEnabled {
			t.Fatalf("replica meta = %+v", m.Session)
		}
		steps := b.st.Steps("s1")
		if len(steps) != 2 || steps[1].Text != "hi there" {
			t.Fatalf("replica steps = %+v", steps)
		}
		// B continues the conversation locally.
		_ = b.st.SaveSteps("s1", append(steps, step("user", "u2", "from B")))
		m.LocalVersion++
		_ = b.st.SaveSession(m)
	})
	b.sync()
	hasAppend := false
	for _, n := range drv.names() {
		if isAppendOf(n, "s1") {
			hasAppend = true
		}
	}
	if !hasAppend {
		t.Fatalf("B's addition was not uploaded as an append: %v", drv.names())
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
	for _, n := range drv.names() {
		if isAppendOf(n, "s1") {
			t.Fatalf("append not cleaned up after merge: %v", drv.names())
		}
	}

	// B sees the merged canonical transcript.
	b.sync()
	b.do(func() {
		if steps := b.st.Steps("s1"); len(steps) != 3 {
			t.Fatalf("replica not updated after merge: %+v", steps)
		}
	})

	// A switches sync off: the file goes, B's copy becomes local.
	a.do(func() {
		m, _ := a.st.GetSession("s1")
		m.SyncEnabled = false
		m.LocalVersion++
		_ = a.st.SaveSession(m)
	})
	a.sync()
	for _, n := range drv.names() {
		if n == sessionFile("s1") {
			t.Fatalf("unpublished session still on drive: %v", drv.names())
		}
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
