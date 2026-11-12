// Package folderdrive backs session sync with a folder that a desktop sync
// client keeps in the user's cloud storage: Google Drive for Desktop by
// default, but any synced folder works (Dropbox, OneDrive, iCloud Drive).
//
// It implements the same interface as the Drive API client, so the sync
// engine does not know the difference. Anchor writes plain files; Google's
// own client uploads them, and the user's other devices see them through
// their own Drive folder. No OAuth client, no Google Cloud project: the
// user installs Drive for Desktop (or already has it) and clicks Connect.
//
// Layout inside the chosen folder:
//
//	Anchor/
//	  YYYY/MM/DD/<title> (<id>).json            sessions, as the API backend
//	  .anchor/devices/device-<id>.json          device records (hidden)
//
// Each file is the JSON payload the engine wrote, plus an "_anchor" member
// carrying the properties the API backend keeps as Drive appProperties.
package folderdrive

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Majidul17068/anchor/internal/drive"
	"github.com/Majidul17068/anchor/internal/paths"
)

const (
	appFolderName = "Anchor"
	hiddenDir     = ".anchor"
	devicesDir    = "devices"
	propsKey      = "_anchor"
)

// Service is a sync backend over a local synced folder.
type Service struct {
	mu   sync.Mutex
	root string // the folder that holds Anchor/; "" = not connected
	// cache of parsed props by file path, keyed on size+mtime
	props map[string]cachedProps
}

type cachedProps struct {
	size  int64
	mtime time.Time
	props map[string]string
}

func New(root string) *Service {
	return &Service{root: root, props: map[string]cachedProps{}}
}

// Root is the synced folder in use ("" when not connected).
func (s *Service) Root() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.root
}

// SetRoot switches to another synced folder.
func (s *Service) SetRoot(root string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.root = root
	s.props = map[string]cachedProps{}
}

// Connected reports whether the folder exists and can be written to.
func (s *Service) Connected() bool {
	root := s.Root()
	if root == "" {
		return false
	}
	st, err := os.Stat(root)
	return err == nil && st.IsDir()
}

var emailInPath = regexp.MustCompile(`GoogleDrive-([^/\\]+@[^/\\]+)`)

// Email is the Google account when the folder is a Drive for Desktop mount
// (its path carries the address); empty otherwise.
func (s *Service) Email() string {
	if m := emailInPath.FindStringSubmatch(s.Root()); m != nil {
		return m[1]
	}
	return ""
}

// AnchorDir is the visible Anchor folder inside the synced folder.
func (s *Service) AnchorDir() string { return filepath.Join(s.Root(), appFolderName) }

// Ensure creates the Anchor folder (and its hidden devices folder) so the
// user sees it in Drive right after connecting.
func (s *Service) Ensure() error {
	if s.Root() == "" {
		return errors.New("no synced folder chosen")
	}
	return os.MkdirAll(filepath.Join(s.AnchorDir(), hiddenDir, devicesDir), 0o755)
}

// ---------------------------------------------------------------------------
// detection
// ---------------------------------------------------------------------------

// Candidates lists synced folders found on this machine, Drive for Desktop
// first. Each is a folder that holds (or may hold) an Anchor/ subfolder.
func Candidates() []Candidate {
	home := paths.Home()
	var out []Candidate
	add := func(path, kind string) {
		if st, err := os.Stat(path); err == nil && st.IsDir() {
			out = append(out, Candidate{Path: path, Kind: kind, Label: Label(kind)})
		}
	}
	switch runtime.GOOS {
	case "darwin":
		entries, _ := os.ReadDir(filepath.Join(home, "Library", "CloudStorage"))
		for _, e := range entries {
			name := e.Name()
			switch {
			case strings.HasPrefix(name, "GoogleDrive-"):
				add(filepath.Join(home, "Library", "CloudStorage", name, "My Drive"), "google-drive")
			case strings.HasPrefix(name, "OneDrive"):
				add(filepath.Join(home, "Library", "CloudStorage", name), "onedrive")
			case strings.HasPrefix(name, "Dropbox"):
				add(filepath.Join(home, "Library", "CloudStorage", name), "dropbox")
			}
		}
		add(filepath.Join(home, "Google Drive", "My Drive"), "google-drive") // older client
		add(filepath.Join(home, "Google Drive"), "google-drive")
		add(filepath.Join(home, "Dropbox"), "dropbox")
		// iCloud Drive is deliberately not detected: Anchor is a Google Drive
		// product. A user who wants iCloud can still pick the folder by hand.
	case "windows":
		// Drive for Desktop mounts a drive letter with "My Drive" at its root.
		for _, letter := range "GHIJKLMNOPQRSTUVWXYZ" {
			add(fmt.Sprintf("%c:\\My Drive", letter), "google-drive")
		}
		add(filepath.Join(home, "Google Drive", "My Drive"), "google-drive")
		add(filepath.Join(home, "Google Drive"), "google-drive")
		if od := os.Getenv("OneDrive"); od != "" {
			add(od, "onedrive")
		}
		add(filepath.Join(home, "Dropbox"), "dropbox")
	default:
		add(filepath.Join(home, "GoogleDrive"), "google-drive") // common FUSE mount names
		add(filepath.Join(home, "google-drive"), "google-drive")
		add(filepath.Join(home, "Dropbox"), "dropbox")
		add(filepath.Join(home, "OneDrive"), "onedrive")
	}
	return out
}

type Candidate struct {
	Path  string `json:"path"`
	Kind  string `json:"kind"` // google-drive | onedrive | dropbox | icloud | folder
	Label string `json:"label"`
}

// KindOf guesses which cloud client keeps a folder in sync, from its path.
func KindOf(path string) string {
	p := strings.ToLower(filepath.ToSlash(path))
	switch {
	case strings.Contains(p, "googledrive-"), strings.Contains(p, "google drive"), strings.Contains(p, "/my drive"), strings.Contains(p, "googledrive"), strings.Contains(p, "google-drive"):
		return "google-drive"
	case strings.Contains(p, "com~apple~clouddocs"):
		return "icloud"
	case strings.Contains(p, "dropbox"):
		return "dropbox"
	case strings.Contains(p, "onedrive"):
		return "onedrive"
	}
	return "folder"
}

// Label is the human name for a kind.
func Label(kind string) string {
	switch kind {
	case "google-drive":
		return "Google Drive"
	case "icloud":
		return "iCloud Drive"
	case "dropbox":
		return "Dropbox"
	case "onedrive":
		return "OneDrive"
	}
	return "synced folder"
}

// GoogleDrive returns the first Google Drive candidate, if any.
func GoogleDrive(c []Candidate) (Candidate, bool) {
	for _, x := range c {
		if x.Kind == "google-drive" {
			return x, true
		}
	}
	return Candidate{}, false
}

// ---------------------------------------------------------------------------
// sync.Drive implementation
// ---------------------------------------------------------------------------

func (s *Service) abs(id string) string { return filepath.Join(s.AnchorDir(), filepath.FromSlash(id)) }

func (s *Service) rel(path string) string {
	r, err := filepath.Rel(s.AnchorDir(), path)
	if err != nil {
		return path
	}
	return filepath.ToSlash(r)
}

func (s *Service) DayFolder(_ context.Context, t time.Time) (string, error) {
	if s.Root() == "" {
		return "", errors.New("no synced folder chosen")
	}
	day := drive.DayPath(t)
	if err := os.MkdirAll(s.abs(day), 0o755); err != nil {
		return "", err
	}
	return day, nil
}

func (s *Service) ListApp(_ context.Context, prefix string) ([]drive.File, error) {
	dir := filepath.Join(s.AnchorDir(), hiddenDir, devicesDir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	var out []drive.File
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), prefix) {
			continue
		}
		f, err := s.fileInfo(filepath.Join(dir, e.Name()))
		if err == nil {
			out = append(out, f)
		}
	}
	return out, nil
}

func (s *Service) PutApp(ctx context.Context, name string, props map[string]string, content []byte) (drive.File, error) {
	return s.PutIn(ctx, hiddenDir+"/"+devicesDir, name, props, content)
}

func (s *Service) PutIn(_ context.Context, parentID, name string, props map[string]string, content []byte) (drive.File, error) {
	if s.Root() == "" {
		return drive.File{}, errors.New("no synced folder chosen")
	}
	if strings.Contains(name, "/") || strings.Contains(name, "\\") || strings.HasPrefix(parentID, "..") {
		return drive.File{}, fmt.Errorf("invalid file name %q", name)
	}
	dir := s.abs(parentID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return drive.File{}, err
	}
	body, err := embedProps(content, props)
	if err != nil {
		return drive.File{}, err
	}
	path := filepath.Join(dir, name)
	// Write whole, then rename: the sync client must never upload a torn file.
	tmp := path + ".anchor-tmp"
	if err := os.WriteFile(tmp, body, 0o644); err != nil {
		return drive.File{}, err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return drive.File{}, err
	}
	return s.fileInfo(path)
}

func (s *Service) ListKind(_ context.Context, kind string) ([]drive.File, error) {
	root := s.AnchorDir()
	if s.Root() == "" {
		return nil, nil
	}
	var out []drive.File
	err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			if p != root && strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(d.Name(), ".json") || strings.HasSuffix(d.Name(), ".anchor-tmp") {
			return nil
		}
		f, err := s.fileInfo(p)
		if err != nil || f.Props[drive.PropKind] != kind {
			return nil
		}
		out = append(out, f)
		return nil
	})
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

func (s *Service) Get(_ context.Context, id string) ([]byte, error) {
	b, err := os.ReadFile(s.abs(id))
	if err != nil {
		return nil, err
	}
	payload, _, err := splitProps(b)
	return payload, err
}

func (s *Service) Delete(_ context.Context, id string) error {
	path := s.abs(id) // resolves the root under the lock; must not nest
	err := os.Remove(path)
	s.mu.Lock()
	delete(s.props, path)
	s.mu.Unlock()
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}

// fileInfo describes a file as drive.File: the id is its path relative to
// the Anchor folder, the parent its directory, props from the embedded
// "_anchor" member (cached by size and mtime).
func (s *Service) fileInfo(path string) (drive.File, error) {
	st, err := os.Stat(path)
	if err != nil {
		return drive.File{}, err
	}
	s.mu.Lock()
	c, ok := s.props[path]
	s.mu.Unlock()
	if !ok || c.size != st.Size() || !c.mtime.Equal(st.ModTime()) {
		b, err := os.ReadFile(path)
		if err != nil {
			return drive.File{}, err
		}
		_, props, err := splitProps(b)
		if err != nil {
			return drive.File{}, err
		}
		c = cachedProps{size: st.Size(), mtime: st.ModTime(), props: props}
		s.mu.Lock()
		s.props[path] = c
		s.mu.Unlock()
	}
	id := s.rel(path)
	parent := filepath.ToSlash(filepath.Dir(filepath.FromSlash(id)))
	if parent == "." {
		parent = ""
	}
	return drive.File{ID: id, Name: filepath.Base(path), Size: st.Size(), Modified: st.ModTime().UTC().Format(time.RFC3339), Props: c.props, ParentID: parent}, nil
}

// embedProps adds the "_anchor" member to a JSON object payload.
func embedProps(payload []byte, props map[string]string) ([]byte, error) {
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(payload, &obj); err != nil {
		return nil, fmt.Errorf("payload is not a JSON object: %w", err)
	}
	if obj == nil {
		obj = map[string]json.RawMessage{}
	}
	p, _ := json.Marshal(props)
	obj[propsKey] = p
	return json.MarshalIndent(obj, "", "  ")
}

// splitProps returns the payload without "_anchor", and the props.
func splitProps(b []byte) ([]byte, map[string]string, error) {
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(b, &obj); err != nil {
		return nil, nil, err
	}
	props := map[string]string{}
	if raw, ok := obj[propsKey]; ok {
		_ = json.Unmarshal(raw, &props)
		delete(obj, propsKey)
	}
	payload, err := json.Marshal(obj)
	return payload, props, err
}
