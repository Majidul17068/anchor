package folderdrive

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Majidul17068/anchor/internal/drive"
)

func TestFilesCarryPropsAndRoundTrip(t *testing.T) {
	root := t.TempDir()
	s := New(root)
	if err := s.Ensure(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "Anchor", ".anchor", "devices")); err != nil {
		t.Fatal("Ensure did not create the Anchor folder")
	}
	ctx := context.Background()
	day, err := s.DayFolder(ctx, time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	payload := []byte(`{"session":{"id":"s1"},"version":1,"steps":[]}`)
	props := map[string]string{drive.PropKind: "session", drive.PropSession: "s1", drive.PropTitle: "Hello"}
	f, err := s.PutIn(ctx, day, "Hello (s1).json", props, payload)
	if err != nil {
		t.Fatal(err)
	}
	if f.ParentID != day || f.Name != "Hello (s1).json" || f.Props[drive.PropSession] != "s1" {
		t.Fatalf("file = %+v", f)
	}
	// What the user sees in Drive: a readable path and a JSON file.
	onDisk := filepath.Join(root, "Anchor", filepath.FromSlash(day), "Hello (s1).json")
	if _, err := os.Stat(onDisk); err != nil {
		t.Fatalf("file not at %s", onDisk)
	}
	if _, err := os.Stat(onDisk + ".anchor-tmp"); err == nil {
		t.Fatal("temp file left behind")
	}
	// Get returns the payload without the props member.
	got, err := s.Get(ctx, f.ID)
	if err != nil {
		t.Fatal(err)
	}
	var obj map[string]any
	if err := json.Unmarshal(got, &obj); err != nil {
		t.Fatal(err)
	}
	if _, leaked := obj[propsKey]; leaked || obj["version"].(float64) != 1 {
		t.Fatalf("payload = %s", got)
	}
	// ListKind finds it by kind; other kinds do not match.
	list, err := s.ListKind(ctx, "session")
	if err != nil || len(list) != 1 || list[0].ID != f.ID {
		t.Fatalf("list = %+v err=%v", list, err)
	}
	if list, _ := s.ListKind(ctx, "append"); len(list) != 0 {
		t.Fatalf("unexpected appends: %+v", list)
	}
	// Replace keeps one file; delete removes it.
	if _, err := s.PutIn(ctx, day, "Hello (s1).json", props, []byte(`{"version":2}`)); err != nil {
		t.Fatal(err)
	}
	if list, _ := s.ListKind(ctx, "session"); len(list) != 1 {
		t.Fatalf("replace duplicated the file: %+v", list)
	}
	if err := s.Delete(ctx, f.ID); err != nil {
		t.Fatal(err)
	}
	if list, _ := s.ListKind(ctx, "session"); len(list) != 0 {
		t.Fatal("delete did not remove the file")
	}
	if err := s.Delete(ctx, f.ID); err != nil {
		t.Fatal("deleting twice should be fine")
	}
}

func TestDevicesLiveInTheHiddenFolder(t *testing.T) {
	s := New(t.TempDir())
	ctx := context.Background()
	if _, err := s.PutApp(ctx, "device-abc.json", map[string]string{drive.PropKind: "device"}, []byte(`{"id":"abc"}`)); err != nil {
		t.Fatal(err)
	}
	list, err := s.ListApp(ctx, "device-")
	if err != nil || len(list) != 1 || list[0].Name != "device-abc.json" {
		t.Fatalf("list = %+v err=%v", list, err)
	}
	if list, _ := s.ListKind(ctx, "device"); len(list) != 0 {
		t.Fatal("hidden folder must not show up in the session listing")
	}
	if _, err := os.Stat(filepath.Join(s.AnchorDir(), ".anchor", "devices", "device-abc.json")); err != nil {
		t.Fatal(err)
	}
}

func TestEmailFromDriveForDesktopPath(t *testing.T) {
	s := New("/Users/x/Library/CloudStorage/GoogleDrive-someone@gmail.com/My Drive")
	if s.Email() != "someone@gmail.com" {
		t.Fatalf("got %q", s.Email())
	}
	if New("/Users/x/Dropbox").Email() != "" {
		t.Fatal("non-Drive folder should have no email")
	}
}

func TestNotConnectedWithoutFolder(t *testing.T) {
	s := New("")
	if s.Connected() {
		t.Fatal("empty root must not be connected")
	}
	if _, err := s.PutIn(context.Background(), "x", "y.json", nil, []byte("{}")); err == nil {
		t.Fatal("writes without a folder must fail")
	}
	s.SetRoot(t.TempDir())
	if !s.Connected() {
		t.Fatal("existing folder should be connected")
	}
}
