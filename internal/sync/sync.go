// Package sync backs sessions up to the user's own Google Drive and lets
// their other devices pull them, following the parent-source rule:
//
//   - the device that created a session is its parent source and is the
//     only one that can publish or unpublish it;
//   - a published session is saved as a visible file in the user's Drive,
//     under Anchor/YYYY/MM/DD/ (the day the session was created);
//   - another device signed in to the same Google account sees the list of
//     published sessions and pulls the ones it wants as replicas;
//   - a replica may continue the conversation; its new steps are uploaded as
//     an append file next to the session that the parent merges into the
//     canonical transcript;
//   - when both sides changed since the last merge the session is flagged
//     as a conflict until the parent chooses "parent wins" or "merge".
//
// Device records stay in the hidden appDataFolder; they are not for people.
package sync

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
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
	kindSession  = "session"
	kindAppend   = "append"
)

// Drive is the slice of the Google Drive client the sync engine needs. It
// is an interface so the push/pull cycle can be exercised against an
// in-memory drive in tests, without a Google OAuth client.
type Drive interface {
	Connected() bool
	Email() string
	// Hidden appDataFolder, used for device records.
	ListApp(ctx context.Context, prefix string) ([]drive.File, error)
	PutApp(ctx context.Context, name string, props map[string]string, content []byte) (drive.File, error)
	// Visible Anchor/YYYY/MM/DD tree, used for sessions.
	DayFolder(ctx context.Context, t time.Time) (string, error)
	PutIn(ctx context.Context, parentID, name string, props map[string]string, content []byte) (drive.File, error)
	ListKind(ctx context.Context, kind string) ([]drive.File, error)
	Get(ctx context.Context, id string) ([]byte, error)
	Delete(ctx context.Context, id string) error
}

var _ Drive = (*drive.Service)(nil)

type Engine struct {
	st      *store.Store
	drv     Drive
	backend string // "api" (Drive API) or "folder" (a synced folder on disk)
	folder  string // path of the synced folder when backend is "folder"
	emit    func(string, any)
	logf    func(string, ...any)
	mu      gosync.Mutex
	status  model.SyncStatus
	confl   map[string]model.Conflict
	stop    chan struct{}
	runMu   gosync.Mutex
}

// SetDrive switches the storage backend. backend is "api" or "folder";
// folder is the synced folder's path for the latter.
func (e *Engine) SetDrive(d Drive, backend, folder string) {
	e.runMu.Lock()
	defer e.runMu.Unlock()
	e.mu.Lock()
	e.drv, e.backend, e.folder = d, backend, folder
	e.mu.Unlock()
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
	e := &Engine{st: st, drv: drv, backend: "api", emit: emit, logf: logf, confl: map[string]model.Conflict{}}
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
	st.Backend = e.backend
	st.FolderPath = e.folder
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

// ---------------------------------------------------------------------------
// what is on Drive
// ---------------------------------------------------------------------------

// index is one listing of the session and append files on Drive.
type index struct {
	sessions map[string]drive.File   // by session id
	appends  map[string][]drive.File // by session id
	usage    int64
}

func (e *Engine) list(ctx context.Context) (*index, error) {
	idx := &index{sessions: map[string]drive.File{}, appends: map[string][]drive.File{}}
	ss, err := e.drv.ListKind(ctx, kindSession)
	if err != nil {
		return nil, err
	}
	for _, f := range ss {
		id := f.Props[drive.PropSession]
		if id == "" {
			continue
		}
		// Two files for one id (should not happen): keep the newest.
		if cur, ok := idx.sessions[id]; !ok || f.Modified > cur.Modified {
			idx.sessions[id] = f
		}
		idx.usage += f.Size
	}
	as, err := e.drv.ListKind(ctx, kindAppend)
	if err != nil {
		return nil, err
	}
	for _, f := range as {
		id := f.Props[drive.PropSession]
		if id == "" {
			continue
		}
		idx.appends[id] = append(idx.appends[id], f)
		idx.usage += f.Size
	}
	return idx, nil
}

// SyncNow runs one push/pull cycle: publish or refresh this device's
// sessions, upload replica additions, and refresh replicas already pulled.
// It never pulls a session this device has not asked for; see Pull.
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
	idx, err := e.list(ctx)
	if err != nil {
		return e.Status(), err
	}
	me := e.st.Device().ID
	// Refresh replicas before pushing their additions: once the parent has
	// merged an append, the replica must learn that first, or it re-uploads
	// the same steps and the parent's next change looks like a conflict.
	pulled, err := e.refreshReplicas(ctx, idx, me)
	if err != nil {
		e.logf("pull: %v", err)
	}
	changed = changed || pulled
	for _, m := range e.st.ListSessions() {
		var c bool
		var err error
		switch {
		case m.OriginDeviceID == me:
			c, err = e.pushParent(ctx, m, idx)
		case m.SyncState == model.SyncReplica || m.SyncState == model.SyncConflict:
			c, err = e.pushReplica(ctx, m, idx)
		}
		if err != nil {
			e.logf("sync %s: %v", m.ID, err)
		}
		changed = changed || c
	}
	e.setStatus(func(s *model.SyncStatus) {
		s.LastSyncAt = store.Now()
		s.UsageBytes = idx.usage
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
	_, err := e.drv.PutApp(ctx, "device-"+d.ID+".json", map[string]string{drive.PropKind: "device"}, b)
	return err
}

// ---------------------------------------------------------------------------
// file names in the visible folder
// ---------------------------------------------------------------------------

func shortID(id string) string {
	if len(id) > 8 {
		return id[:8]
	}
	return id
}

// safeTitle turns a session title into something every file system and
// Drive accept, so the file reads well in the user's Drive.
func safeTitle(title string) string {
	t := strings.TrimSpace(title)
	if t == "" {
		t = "Session"
	}
	var b strings.Builder
	for _, r := range t {
		switch {
		case strings.ContainsRune(`/\:*?"<>|`, r), r < 0x20:
			b.WriteRune('-')
		default:
			b.WriteRune(r)
		}
	}
	out := strings.TrimSpace(b.String())
	if len(out) > 80 {
		out = strings.TrimSpace(out[:80])
	}
	return out
}

func sessionName(title, id string) string {
	return fmt.Sprintf("%s (%s).json", safeTitle(title), shortID(id))
}

func appendName(title, id, device string) string {
	return fmt.Sprintf("%s (%s) - from %s.json", safeTitle(title), shortID(id), shortID(device))
}

func createdAt(m *store.SessionMeta) time.Time {
	for _, s := range []string{m.CreatedAt, m.LastModified} {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			return t
		}
	}
	return time.Now()
}

// ---------------------------------------------------------------------------
// push
// ---------------------------------------------------------------------------

// pushParent publishes or unpublishes a session owned by this device and
// merges replica appends.
func (e *Engine) pushParent(ctx context.Context, m *store.SessionMeta, idx *index) (bool, error) {
	remote, exists := idx.sessions[m.ID]
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
		for _, f := range idx.appends[m.ID] {
			_ = e.drv.Delete(ctx, f.ID)
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
	for _, f := range idx.appends[m.ID] {
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
			if len(missingSteps(steps, a.data.Steps)) == 0 {
				// Everything in it is already here (a stale re-upload).
				_ = e.drv.Delete(ctx, a.file.ID)
				continue
			}
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
		created := createdAt(m)
		folder, err := e.drv.DayFolder(ctx, created)
		if err != nil {
			return changed, err
		}
		props := map[string]string{
			drive.PropKind: kindSession, drive.PropSession: m.ID, drive.PropOrigin: m.OriginDeviceID,
			drive.PropDay: drive.DayPath(created), drive.PropTitle: m.Title, drive.PropSteps: strconv.Itoa(len(steps)),
		}
		// A renamed session gets a new file name; drop the old file first.
		name := sessionName(m.Title, m.ID)
		if exists && remote.Name != name {
			_ = e.drv.Delete(ctx, remote.ID)
		}
		f, err := e.drv.PutIn(ctx, folder, name, props, b)
		if err != nil {
			return changed, err
		}
		m.DriveFileID = f.ID
		m.SyncState = model.SyncPublished
		return true, e.st.SaveSession(m)
	}
	return changed, nil
}

// pushReplica uploads steps added on this device to a replica session, as
// an append file beside the canonical one.
func (e *Engine) pushReplica(ctx context.Context, m *store.SessionMeta, idx *index) (bool, error) {
	if m.LocalVersion <= m.RemoteVersion {
		return false, nil
	}
	canonical, ok := idx.sessions[m.ID]
	if !ok {
		return false, nil // unpublished; refreshReplicas handles it
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
	props := map[string]string{drive.PropKind: kindAppend, drive.PropSession: m.ID, drive.PropDevice: me}
	if _, err := e.drv.PutIn(ctx, canonical.ParentID, appendName(m.Title, m.ID, me), props, b); err != nil {
		return false, err
	}
	return false, nil
}

// ---------------------------------------------------------------------------
// pull
// ---------------------------------------------------------------------------

// refreshReplicas updates sessions this device already pulled and notices
// ones the parent unpublished. It does not pull new sessions.
func (e *Engine) refreshReplicas(ctx context.Context, idx *index, me string) (bool, error) {
	changed := false
	for _, m := range e.st.ListSessions() {
		if m.OriginDeviceID == me || (m.SyncState != model.SyncReplica && m.SyncState != model.SyncConflict) {
			continue
		}
		f, ok := idx.sessions[m.ID]
		if !ok {
			if m.DriveFileID != "" {
				// The parent switched sync off: keep the local copy, stop syncing.
				m.SyncEnabled = false
				m.SyncState = model.SyncLocal
				m.Unpublished = true
				m.DriveFileID = ""
				_ = e.st.SaveSession(m)
				changed = true
			}
			continue
		}
		if m.RemoteVersion > 0 && m.DriveFileID == f.ID && f.Modified != "" && f.Modified <= m.LastModified && m.LocalVersion == m.RemoteVersion {
			continue // unchanged
		}
		if c, err := e.applyRemote(ctx, f, m); err != nil {
			e.logf("refresh %s: %v", m.ID, err)
		} else {
			changed = changed || c
		}
	}
	return changed, nil
}

// applyRemote downloads a canonical session file and stores it locally as a
// replica, keeping any steps this device added that the parent has not
// merged yet. local may be nil for a first pull.
func (e *Engine) applyRemote(ctx context.Context, f drive.File, local *store.SessionMeta) (bool, error) {
	b, err := e.drv.Get(ctx, f.ID)
	if err != nil {
		return false, err
	}
	var rs remoteSession
	if err := json.Unmarshal(b, &rs); err != nil {
		return false, err
	}
	id := f.Props[drive.PropSession]
	if local != nil && rs.Version <= local.RemoteVersion && local.DriveFileID == f.ID {
		return false, nil
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
		// Only steps genuinely absent from the canonical transcript count:
		// re-flagging ones the parent already merged produced a second
		// append and a phantom conflict on the parent's next change.
		localSteps := e.st.Steps(id)
		if len(localSteps) > local.StepCount {
			if extra := missingSteps(rs.Steps, localSteps[local.StepCount:]); len(extra) > 0 {
				rs.Steps = mergeSteps(rs.Steps, extra)
				meta.LocalVersion = meta.RemoteVersion + 1
			}
		}
	}
	if meta.WorkspacePaths == nil {
		meta.WorkspacePaths = []string{}
	}
	if err := e.st.SaveSteps(id, rs.Steps); err != nil {
		return false, err
	}
	return true, e.st.SaveSession(meta)
}

// Available lists sessions other devices published that this device has
// not pulled, newest first.
func (e *Engine) Available(ctx context.Context) ([]model.RemoteSession, error) {
	out := []model.RemoteSession{}
	if !e.drv.Connected() {
		return out, nil
	}
	idx, err := e.list(ctx)
	if err != nil {
		return out, err
	}
	me := e.st.Device().ID
	local := map[string]bool{}
	for _, m := range e.st.ListSessions() {
		local[m.ID] = true
	}
	names := e.deviceNames(ctx)
	for id, f := range idx.sessions {
		if local[id] || f.Props[drive.PropOrigin] == me {
			continue
		}
		steps, _ := strconv.Atoi(f.Props[drive.PropSteps])
		out = append(out, model.RemoteSession{
			ID: id, Title: f.Props[drive.PropTitle], OriginDeviceID: f.Props[drive.PropOrigin],
			OriginDeviceName: names[f.Props[drive.PropOrigin]], Day: f.Props[drive.PropDay],
			StepCount: steps, UpdatedAt: f.Modified, SizeBytes: f.Size,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt > out[j].UpdatedAt })
	return out, nil
}

// Pull fetches one published session as a replica on this device.
func (e *Engine) Pull(ctx context.Context, sessionID string) (model.Session, error) {
	if !e.drv.Connected() {
		return model.Session{}, fmt.Errorf("DRIVE_NOT_CONNECTED: connect Google Drive first")
	}
	if m, err := e.st.GetSession(sessionID); err == nil {
		return m.Session, nil // already here
	}
	idx, err := e.list(ctx)
	if err != nil {
		return model.Session{}, err
	}
	f, ok := idx.sessions[sessionID]
	if !ok {
		return model.Session{}, fmt.Errorf("session %s is not on Drive", shortID(sessionID))
	}
	if _, err := e.applyRemote(ctx, f, nil); err != nil {
		return model.Session{}, err
	}
	m, err := e.st.GetSession(sessionID)
	if err != nil {
		return model.Session{}, err
	}
	if e.emit != nil {
		e.emit("sessions:changed", map[string]any{"source": "pull", "sessionId": sessionID})
	}
	return m.Session, nil
}

// missingSteps returns the steps of extra whose ids are not in base.
func missingSteps(base, extra []model.Step) []model.Step {
	have := map[string]bool{}
	for _, s := range base {
		have[s.ID] = true
	}
	var out []model.Step
	for _, s := range extra {
		if !have[s.ID] {
			out = append(out, s)
		}
	}
	return out
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

// deviceNames maps device id -> name from the device records on Drive.
func (e *Engine) deviceNames(ctx context.Context) map[string]string {
	out := map[string]string{}
	d := e.st.Device()
	out[d.ID] = d.Name
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
		if json.Unmarshal(b, &rd) == nil && rd.ID != "" {
			out[rd.ID] = rd.Name
		}
	}
	return out
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
