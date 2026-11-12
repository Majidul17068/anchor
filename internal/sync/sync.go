// Package sync keeps sessions in step across the user's devices through
// their own Google Drive appDataFolder, following the parent-source rule:
//
//   - the device that created a session is its parent source and is the
//     only one that can publish or unpublish it;
//   - every other device pulls published sessions automatically as replicas;
//   - a replica may continue the conversation; its new steps are uploaded as
//     an append file that the parent merges into the canonical transcript;
//   - when both sides changed since the last merge the session is flagged
//     as a conflict until the parent chooses "parent wins" or "merge".
package sync

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	gosync "sync"
	"time"

	"github.com/Majidul17068/anchor/internal/drive"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
	"github.com/Majidul17068/anchor/internal/store"
)

const (
	pollInterval = 30 * time.Second
)

// Drive is the slice of the Google Drive client the sync engine needs. It
// is an interface so the push/pull cycle can be exercised against an
// in-memory drive in tests, without a Google OAuth client.
type Drive interface {
	Connected() bool
	Email() string
	ListApp(ctx context.Context, prefix string) ([]drive.File, error)
	PutApp(ctx context.Context, name string, props map[string]string, content []byte) (drive.File, error)
	Get(ctx context.Context, id string) ([]byte, error)
	Delete(ctx context.Context, id string) error
}

var _ Drive = (*drive.Service)(nil)

type Engine struct {
	st     *store.Store
	drv    Drive
	emit   func(string, any)
	logf   func(string, ...any)
	mu     gosync.Mutex
	status model.SyncStatus
	confl  map[string]model.Conflict
	stop   chan struct{}
	runMu  gosync.Mutex
}

type remoteSession struct {
	Session        model.Session `json:"session"`
	Version        int64         `json:"version"`
	OriginDeviceID string        `json:"originDeviceId"`
	Steps          []model.Step  `json:"steps"`
	UpdatedAt      string        `json:"updatedAt"`
}

type remoteAppend struct {
	DeviceID    string       `json:"deviceId"`
	BaseVersion int64        `json:"baseVersion"`
	Steps       []model.Step `json:"steps"`
	UpdatedAt   string       `json:"updatedAt"`
}

type remoteDevice struct {
	model.Device
}

func New(st *store.Store, drv Drive, emit func(string, any), logf func(string, ...any)) *Engine {
	if logf == nil {
		logf = func(string, ...any) {}
	}
	e := &Engine{st: st, drv: drv, emit: emit, logf: logf, confl: map[string]model.Conflict{}}
	_ = st.ReadBlob(paths.AnchorDir(), "conflicts", &e.confl)
	if e.confl == nil {
		e.confl = map[string]model.Conflict{}
	}
	return e
}

func (e *Engine) Start() {
	e.mu.Lock()
	if e.stop != nil {
		e.mu.Unlock()
		return
	}
	e.stop = make(chan struct{})
	stop := e.stop
	e.mu.Unlock()
	go func() {
		t := time.NewTicker(pollInterval)
		defer t.Stop()
		if e.drv.Connected() {
			_, _ = e.SyncNow(context.Background())
		}
		for {
			select {
			case <-stop:
				return
			case <-t.C:
				if e.drv.Connected() {
					_, _ = e.SyncNow(context.Background())
				}
			}
		}
	}()
}

func (e *Engine) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.stop != nil {
		close(e.stop)
		e.stop = nil
	}
}

func (e *Engine) Status() model.SyncStatus {
	e.mu.Lock()
	defer e.mu.Unlock()
	st := e.status
	st.DriveConnected = e.drv.Connected()
	st.DriveEmail = e.drv.Email()
	st.Pending = e.pendingLocked()
	st.Conflicts = e.unresolvedLocked()
	return st
}

func (e *Engine) pendingLocked() int {
	me := e.st.Device().ID
	n := 0
	for _, m := range e.st.ListSessions() {
		if m.OriginDeviceID == me && m.SyncEnabled && m.LocalVersion > m.RemoteVersion {
			n++
		}
		if m.OriginDeviceID != me && m.SyncState == model.SyncReplica && m.LocalVersion > m.RemoteVersion {
			n++
		}
	}
	return n
}

func (e *Engine) unresolvedLocked() int {
	n := 0
	for _, c := range e.confl {
		if c.ResolvedAs == "" {
			n++
		}
	}
	return n
}

func (e *Engine) Conflicts() []model.Conflict {
	e.mu.Lock()
	defer e.mu.Unlock()
	var out []model.Conflict
	for _, c := range e.confl {
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].At > out[j].At })
	if out == nil {
		out = []model.Conflict{}
	}
	return out
}

func (e *Engine) saveConflicts() {
	_ = e.st.WriteBlob(paths.AnchorDir(), "conflicts", e.confl)
}

func (e *Engine) setStatus(fn func(*model.SyncStatus)) {
	e.mu.Lock()
	fn(&e.status)
	e.mu.Unlock()
	if e.emit != nil {
		e.emit("sync:status", e.Status())
	}
}

// SyncNow runs one push/pull cycle.
func (e *Engine) SyncNow(ctx context.Context) (model.SyncStatus, error) {
	e.runMu.Lock()
	defer e.runMu.Unlock()
	if !e.drv.Connected() {
		return e.Status(), nil
	}
	ctx, cancel := context.WithTimeout(ctx, 4*time.Minute)
	defer cancel()
	changed := false
	if err := e.pushDevice(ctx); err != nil {
		e.logf("sync device: %v", err)
	}
	files, err := e.drv.ListApp(ctx, "")
	if err != nil {
		return e.Status(), err
	}
	byName := map[string]drive.File{}
	var usage int64
	for _, f := range files {
		byName[f.Name] = f
		usage += f.Size
	}
	me := e.st.Device().ID
	for _, m := range e.st.ListSessions() {
		var c bool
		var err error
		switch {
		case m.OriginDeviceID == me:
			c, err = e.pushParent(ctx, m, byName)
		case m.SyncState == model.SyncReplica || m.SyncState == model.SyncConflict:
			c, err = e.pushReplica(ctx, m, byName)
		}
		if err != nil {
			e.logf("sync %s: %v", m.ID, err)
		}
		changed = changed || c
	}
	pulled, err := e.pull(ctx, byName, me)
	if err != nil {
		e.logf("pull: %v", err)
	}
	changed = changed || pulled
	e.setStatus(func(s *model.SyncStatus) {
		s.LastSyncAt = store.Now()
		s.UsageBytes = usage
	})
	if changed && e.emit != nil {
		e.emit("sessions:changed", map[string]any{"source": "sync"})
	}
	return e.Status(), nil
}

func (e *Engine) pushDevice(ctx context.Context) error {
	d := e.st.Device()
	rd := remoteDevice{Device: model.Device{ID: d.ID, Name: d.Name, Platform: d.Platform, LastSeen: store.Now()}}
	b, _ := json.Marshal(rd)
	_, err := e.drv.PutApp(ctx, "device-"+d.ID+".json", map[string]string{"anchorKind": "device"}, b)
	return err
}

func sessionFile(id string) string         { return "session-" + id + ".json" }
func appendFile(id, dev string) string      { return "session-" + id + ".append-" + dev + ".json" }
func isAppendOf(name, id string) bool       { return strings.HasPrefix(name, "session-"+id+".append-") }
func appendDevice(name, id string) string   { return strings.TrimSuffix(strings.TrimPrefix(name, "session-"+id+".append-"), ".json") }

// pushParent publishes or unpublishes a session owned by this device and
// merges replica appends.
func (e *Engine) pushParent(ctx context.Context, m *store.SessionMeta, byName map[string]drive.File) (bool, error) {
	name := sessionFile(m.ID)
	remote, exists := byName[name]
	if !m.SyncEnabled {
		if !exists && m.DriveFileID == "" {
			return false, nil
		}
		// Unpublish: remove canonical and any appends.
		if exists {
			if err := e.drv.Delete(ctx, remote.ID); err != nil {
				return false, err
			}
		}
		for n, f := range byName {
			if isAppendOf(n, m.ID) {
				_ = e.drv.Delete(ctx, f.ID)
			}
		}
		m.DriveFileID = ""
		m.RemoteVersion = 0
		m.SyncState = model.SyncLocal
		return true, e.st.SaveSession(m)
	}

	steps := e.st.Steps(m.ID)
	changed := false
	// Merge replica appends.
	var appends []struct {
		file drive.File
		data remoteAppend
	}
	for n, f := range byName {
		if !isAppendOf(n, m.ID) {
			continue
		}
		b, err := e.drv.Get(ctx, f.ID)
		if err != nil {
			continue
		}
		var ra remoteAppend
		if json.Unmarshal(b, &ra) == nil && len(ra.Steps) > 0 {
			appends = append(appends, struct {
				file drive.File
				data remoteAppend
			}{f, ra})
		}
	}
	if len(appends) > 0 {
		e.mu.Lock()
		c, hasConflict := e.confl[m.ID]
		e.mu.Unlock()
		parentChanged := m.LocalVersion > m.RemoteVersion
		for _, a := range appends {
			if parentChanged && a.data.BaseVersion < m.RemoteVersion && (!hasConflict || c.ResolvedAs == "") {
				// Both sides moved: flag and wait for the user's decision.
				e.mu.Lock()
				if !hasConflict {
					e.confl[m.ID] = model.Conflict{SessionID: m.ID, Devices: []string{m.OriginDeviceID, a.data.DeviceID}, At: store.Now()}
					e.saveConflicts()
				}
				e.mu.Unlock()
				if m.SyncState != model.SyncConflict {
					m.SyncState = model.SyncConflict
					_ = e.st.SaveSession(m)
				}
				return true, nil
			}
			resolution := "merged"
			if hasConflict && c.ResolvedAs != "" {
				resolution = c.ResolvedAs
			}
			if resolution == "merged" {
				steps = mergeSteps(steps, a.data.Steps)
				changed = true
			}
			_ = e.drv.Delete(ctx, a.file.ID)
		}
		if hasConflict && c.ResolvedAs != "" {
			e.mu.Lock()
			delete(e.confl, m.ID)
			e.saveConflicts()
			e.mu.Unlock()
		}
		if changed {
			_ = e.st.SaveSteps(m.ID, steps)
			m.StepCount = len(steps)
			m.LocalVersion++
		}
	}
	if m.SyncState == model.SyncConflict {
		m.SyncState = model.SyncPublished
		changed = true
	}
	if !exists || m.LocalVersion > m.RemoteVersion || changed {
		m.RemoteVersion = m.LocalVersion
		if m.RemoteVersion == 0 {
			m.RemoteVersion = 1
			m.LocalVersion = 1
		}
		payload := remoteSession{Session: m.Session, Version: m.RemoteVersion, OriginDeviceID: m.OriginDeviceID, Steps: steps, UpdatedAt: store.Now()}
		payload.Session.StepCount = len(steps)
		b, _ := json.Marshal(payload)
		f, err := e.drv.PutApp(ctx, name, map[string]string{"anchorKind": "session", "origin": m.OriginDeviceID}, b)
		if err != nil {
			return changed, err
		}
		m.DriveFileID = f.ID
		m.SyncState = model.SyncPublished
		return true, e.st.SaveSession(m)
	}
	return changed, nil
}

// pushReplica uploads steps added on this device to a replica session.
func (e *Engine) pushReplica(ctx context.Context, m *store.SessionMeta, byName map[string]drive.File) (bool, error) {
	if m.LocalVersion <= m.RemoteVersion {
		return false, nil
	}
	steps := e.st.Steps(m.ID)
	if len(steps) <= m.StepCount {
		m.RemoteVersion = m.LocalVersion
		return false, e.st.SaveSession(m)
	}
	extra := steps[m.StepCount:]
	me := e.st.Device().ID
	payload := remoteAppend{DeviceID: me, BaseVersion: m.RemoteVersion, Steps: extra, UpdatedAt: store.Now()}
	b, _ := json.Marshal(payload)
	if _, err := e.drv.PutApp(ctx, appendFile(m.ID, me), map[string]string{"anchorKind": "append"}, b); err != nil {
		return false, err
	}
	return false, nil
}

// pull downloads sessions published by other devices.
func (e *Engine) pull(ctx context.Context, byName map[string]drive.File, me string) (bool, error) {
	changed := false
	seen := map[string]bool{}
	for name, f := range byName {
		if !strings.HasPrefix(name, "session-") || strings.Contains(name, ".append-") {
			continue
		}
		if f.Props["origin"] == me {
			continue
		}
		id := strings.TrimSuffix(strings.TrimPrefix(name, "session-"), ".json")
		seen[id] = true
		local, err := e.st.GetSession(id)
		if err == nil && local.OriginDeviceID == me {
			continue
		}
		if err == nil && local.RemoteVersion > 0 && local.DriveFileID == f.ID && f.Modified != "" && f.Modified <= local.LastModified && local.LocalVersion == local.RemoteVersion {
			continue // unchanged
		}
		b, err := e.drv.Get(ctx, f.ID)
		if err != nil {
			continue
		}
		var rs remoteSession
		if err := json.Unmarshal(b, &rs); err != nil {
			continue
		}
		if err == nil && local != nil && rs.Version <= local.RemoteVersion && local.DriveFileID == f.ID {
			continue
		}
		meta := &store.SessionMeta{Session: rs.Session}
		meta.ID = id
		meta.OriginDeviceID = rs.OriginDeviceID
		meta.SyncEnabled = true
		meta.SyncState = model.SyncReplica
		meta.DriveFileID = f.ID
		meta.RemoteVersion = rs.Version
		meta.LocalVersion = rs.Version
		meta.StepCount = len(rs.Steps)
		meta.CachedAt = store.Now()
		if local != nil {
			meta.ACPSessionID = local.ACPSessionID
			meta.Pinned = local.Pinned
			// Keep steps this replica added that the parent has not merged yet.
			localSteps := e.st.Steps(id)
			if len(localSteps) > local.StepCount {
				rs.Steps = mergeSteps(rs.Steps, localSteps[local.StepCount:])
				meta.LocalVersion = meta.RemoteVersion + 1
			}
		}
		if meta.WorkspacePaths == nil {
			meta.WorkspacePaths = []string{}
		}
		_ = e.st.SaveSteps(id, rs.Steps)
		_ = e.st.SaveSession(meta)
		changed = true
	}
	// Replicas whose canonical file vanished were unpublished by the parent.
	for _, m := range e.st.ListSessions() {
		if m.OriginDeviceID != me && (m.SyncState == model.SyncReplica || m.SyncState == model.SyncConflict) && !seen[m.ID] && m.DriveFileID != "" {
			m.SyncEnabled = false
			m.SyncState = model.SyncLocal
			m.Unpublished = true
			m.DriveFileID = ""
			_ = e.st.SaveSession(m)
			changed = true
		}
	}
	return changed, nil
}

// mergeSteps appends steps not already present, ordered by time.
func mergeSteps(base, extra []model.Step) []model.Step {
	have := map[string]bool{}
	for _, s := range base {
		have[s.ID] = true
	}
	out := append([]model.Step(nil), base...)
	for _, s := range extra {
		if !have[s.ID] {
			out = append(out, s)
			have[s.ID] = true
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].At < out[j].At })
	return out
}

func (e *Engine) Resolve(sessionID, as string) error {
	if as != "parent" && as != "merged" {
		return fmt.Errorf("unknown resolution %q", as)
	}
	e.mu.Lock()
	c, ok := e.confl[sessionID]
	if !ok {
		e.mu.Unlock()
		return nil
	}
	c.ResolvedAs = as
	e.confl[sessionID] = c
	e.saveConflicts()
	e.mu.Unlock()
	if m, err := e.st.GetSession(sessionID); err == nil {
		m.LocalVersion++
		_ = e.st.SaveSession(m)
	}
	go func() { _, _ = e.SyncNow(context.Background()) }()
	return nil
}

// Devices lists this device plus every device seen on Drive.
func (e *Engine) Devices(ctx context.Context) []model.Device {
	d := e.st.Device()
	out := []model.Device{{ID: d.ID, Name: d.Name, Platform: d.Platform, LastSeen: store.Now(), IsThisDevice: true}}
	if !e.drv.Connected() {
		return out
	}
	files, err := e.drv.ListApp(ctx, "device-")
	if err != nil {
		return out
	}
	for _, f := range files {
		b, err := e.drv.Get(ctx, f.ID)
		if err != nil {
			continue
		}
		var rd remoteDevice
		if json.Unmarshal(b, &rd) == nil && rd.ID != "" && rd.ID != d.ID {
			rd.IsThisDevice = false
			out = append(out, rd.Device)
		}
	}
	return out
}
