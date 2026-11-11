// Package store is Anchor's local metadata store: JSON files under ~/.anchor.
// It holds everything the CLI does not know about a session (origin device,
// sync flags, pinned state, cached transcript) plus settings and device id.
package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
)

type DeviceInfo struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Platform  string `json:"platform"`
	CreatedAt string `json:"createdAt"`
}

// SessionMeta is the persisted per-session record.
type SessionMeta struct {
	model.Session
	// ACPSessionID is the CLI conversation backing this session on this
	// machine. For sessions created here it equals ID; for replicas pulled
	// from Drive it is set the first time the replica is resumed locally.
	ACPSessionID string `json:"acpSessionId,omitempty"`
	// CachedAt is when the transcript cache was last refreshed from the CLI.
	CachedAt string `json:"cachedAt,omitempty"`
	// Version counters used by the sync engine.
	LocalVersion  int64  `json:"localVersion"`
	RemoteVersion int64  `json:"remoteVersion"`
	DriveFileID   string `json:"driveFileId,omitempty"`
	Unpublished   bool   `json:"unpublished,omitempty"`
}

type Store struct {
	mu sync.Mutex
}

func New() (*Store, error) {
	if err := paths.EnsureDirs(); err != nil {
		return nil, err
	}
	return &Store{}, nil
}

func Now() string { return time.Now().UTC().Format(time.RFC3339) }

func readJSON(path string, v any) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func writeJSON(path string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// ---------- settings ----------

func (s *Store) settingsPath() string { return filepath.Join(paths.AnchorDir(), "settings.json") }

func (s *Store) Settings() map[string]any {
	s.mu.Lock()
	defer s.mu.Unlock()
	m := map[string]any{}
	_ = readJSON(s.settingsPath(), &m)
	return m
}

func (s *Store) SetSettings(patch map[string]any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	m := map[string]any{}
	_ = readJSON(s.settingsPath(), &m)
	for k, v := range patch {
		if v == nil {
			delete(m, k)
		} else {
			m[k] = v
		}
	}
	return writeJSON(s.settingsPath(), m)
}

func (s *Store) SettingString(key string) string {
	v, _ := s.Settings()[key].(string)
	return v
}

func (s *Store) SettingBool(key string) bool {
	v, _ := s.Settings()[key].(bool)
	return v
}

// ---------- device ----------

func (s *Store) devicePath() string { return filepath.Join(paths.AnchorDir(), "device.json") }

func (s *Store) Device() DeviceInfo {
	s.mu.Lock()
	defer s.mu.Unlock()
	var d DeviceInfo
	if err := readJSON(s.devicePath(), &d); err == nil && d.ID != "" {
		return d
	}
	host, _ := os.Hostname()
	host = strings.TrimSuffix(host, ".local")
	if host == "" {
		host = "This device"
	}
	d = DeviceInfo{ID: uuid.NewString(), Name: host, Platform: paths.Platform(), CreatedAt: Now()}
	_ = writeJSON(s.devicePath(), d)
	return d
}

func (s *Store) RenameDevice(name string) error {
	d := s.Device()
	d.Name = strings.TrimSpace(name)
	s.mu.Lock()
	defer s.mu.Unlock()
	return writeJSON(s.devicePath(), d)
}

// ---------- account cache ----------

func (s *Store) accountPath() string { return filepath.Join(paths.AnchorDir(), "account.json") }

func (s *Store) Account() *model.Account {
	s.mu.Lock()
	defer s.mu.Unlock()
	var a model.Account
	if err := readJSON(s.accountPath(), &a); err != nil || a.Email == "" {
		return nil
	}
	return &a
}

func (s *Store) SaveAccount(a *model.Account) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if a == nil {
		err := os.Remove(s.accountPath())
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	return writeJSON(s.accountPath(), a)
}

// ---------- sessions ----------

func (s *Store) metaPath(id string) string {
	return filepath.Join(paths.SessionsDir(), id+".json")
}
func (s *Store) stepsPath(id string) string {
	return filepath.Join(paths.SessionsDir(), id+".steps.json")
}

func (s *Store) GetSession(id string) (*SessionMeta, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var m SessionMeta
	if err := readJSON(s.metaPath(id), &m); err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *Store) SaveSession(m *SessionMeta) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if m.WorkspacePaths == nil {
		m.WorkspacePaths = []string{}
	}
	return writeJSON(s.metaPath(m.ID), m)
}

func (s *Store) DeleteSession(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = os.Remove(s.stepsPath(id))
	err := os.Remove(s.metaPath(id))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func (s *Store) ListSessions() []*SessionMeta {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries, _ := os.ReadDir(paths.SessionsDir())
	var out []*SessionMeta
	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(name, ".json") || strings.HasSuffix(name, ".steps.json") {
			continue
		}
		var m SessionMeta
		if err := readJSON(filepath.Join(paths.SessionsDir(), name), &m); err == nil && m.ID != "" {
			out = append(out, &m)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].LastModified > out[j].LastModified })
	return out
}

func (s *Store) Steps(id string) []model.Step {
	s.mu.Lock()
	defer s.mu.Unlock()
	var steps []model.Step
	_ = readJSON(s.stepsPath(id), &steps)
	if steps == nil {
		steps = []model.Step{}
	}
	return steps
}

func (s *Store) SaveSteps(id string, steps []model.Step) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if steps == nil {
		steps = []model.Step{}
	}
	return writeJSON(s.stepsPath(id), steps)
}

// ---------- generic named JSON blobs (skills meta, market cache, drive token) ----------

func (s *Store) ReadBlob(dir, name string, v any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return readJSON(filepath.Join(dir, name+".json"), v)
}

func (s *Store) WriteBlob(dir, name string, v any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	return writeJSON(filepath.Join(dir, name+".json"), v)
}

func (s *Store) DeleteBlob(dir, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	err := os.Remove(filepath.Join(dir, name+".json"))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func (s *Store) ListBlobs(dir string) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries, _ := os.ReadDir(dir)
	var names []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".json") {
			names = append(names, strings.TrimSuffix(e.Name(), ".json"))
		}
	}
	sort.Strings(names)
	return names
}
