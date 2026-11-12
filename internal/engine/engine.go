// Package engine owns the Antigravity CLI processes and maps ACP sessions to
// Anchor sessions: it creates, lists, loads, resumes, and streams them, and
// turns session/update notifications into the UI's Step/ChatEvent model.
package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Majidul17068/anchor/internal/acp"
	"github.com/Majidul17068/anchor/internal/cli"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
	"github.com/Majidul17068/anchor/internal/store"
)

// Emitter delivers an event to the UI (Wails runtime.EventsEmit).
type Emitter func(name string, data any)

const (
	DefaultModel  = "gemini-4-argon"
	DefaultEffort = model.Effort("medium")
	DefaultMode   = model.Mode("default")
)

var ErrNotParentSource = errors.New("NOT_PARENT_SOURCE")

type Engine struct {
	loc     *cli.Locator
	st      *store.Store
	emit    Emitter
	logf    func(string, ...any)
	version string

	mu          sync.Mutex
	procs       map[string]*proc
	live        map[string]*live
	byACP       map[string]*live
	models      []model.Model
	tier        *acp.Tier
	authMethods []acp.AuthMethod
	probed      bool
	probeErr    error // result of the last Probe; AUTH_REQUIRED means signed out
}

type proc struct {
	eng    *Engine
	agent  string
	client *acp.Client
	init   acp.InitializeResult
}

type live struct {
	eng   *Engine
	mu    sync.Mutex
	meta  *store.SessionMeta
	steps []model.Step

	proc      *proc
	acpID     string
	attached  bool
	needsSeed bool

	loading    bool
	streamID   string
	agentIdx   int
	thoughtIdx int
	lastMsgID  string
	tools      map[string]int
	perms      map[string]chan string
	turnCancel context.CancelFunc
}

func New(loc *cli.Locator, st *store.Store, emit Emitter, logf func(string, ...any), version string) *Engine {
	if logf == nil {
		logf = func(string, ...any) {}
	}
	return &Engine{loc: loc, st: st, emit: emit, logf: logf, version: version,
		procs: map[string]*proc{}, live: map[string]*live{}, byACP: map[string]*live{}}
}

func (e *Engine) Store() *store.Store { return e.st }

// Shutdown closes every CLI process.
func (e *Engine) Shutdown() {
	e.mu.Lock()
	defer e.mu.Unlock()
	for k, p := range e.procs {
		p.client.Close()
		delete(e.procs, k)
	}
}

// ---------------------------------------------------------------------------
// processes
// ---------------------------------------------------------------------------

func (e *Engine) binary() (string, error) {
	p, ok := e.loc.Find()
	if !ok {
		return "", errors.New("Antigravity CLI (agy) is not installed")
	}
	return p, nil
}

// Proc returns a running ACP process for the given agent ("" = default),
// starting and initializing one if needed.
func (e *Engine) Proc(agent string) (*proc, error) {
	e.mu.Lock()
	if p, ok := e.procs[agent]; ok && p.client.Alive() {
		e.mu.Unlock()
		return p, nil
	}
	e.mu.Unlock()

	bin, err := e.binary()
	if err != nil {
		return nil, err
	}
	args := []string{"acp", "--stdio"}
	if agent != "" {
		args = append(args, "--agent", agent)
	}
	if v, ok := e.st.Settings()["telemetryEnabled"].(bool); ok && !v {
		args = append(args, "--disable-telemetry")
	}
	args = append(args, "--log-file", filepath.Join(paths.LogDir(), "acp.log"))
	p := &proc{eng: e, agent: agent}
	client, err := acp.Start(bin, args, nil, p, e.logf)
	if err != nil {
		return nil, fmt.Errorf("could not start Antigravity CLI: %w", err)
	}
	p.client = client
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	err = client.Call(ctx, "initialize", acp.InitializeParams{
		ProtocolVersion:    1,
		ClientCapabilities: acp.ClientCapabilities{FS: acp.FSCapabilities{}, Terminal: false},
		ClientInfo:         acp.ClientInfo{Name: "Anchor", Version: e.version},
	}, &p.init)
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("Antigravity CLI handshake failed: %w", err)
	}
	e.mu.Lock()
	if old, ok := e.procs[agent]; ok && old.client.Alive() {
		e.mu.Unlock()
		client.Close()
		return old, nil
	}
	e.procs[agent] = p
	e.authMethods = p.init.AuthMethods
	e.mu.Unlock()
	go func() {
		<-client.Done()
		e.mu.Lock()
		if e.procs[agent] == p {
			delete(e.procs, agent)
		}
		for _, l := range e.live {
			if l.proc == p {
				l.mu.Lock()
				l.attached = false
				l.mu.Unlock()
			}
		}
		e.mu.Unlock()
	}()
	return p, nil
}

// OnNotification implements acp.Handler.
func (p *proc) OnNotification(method string, params json.RawMessage) {
	if method != "session/update" {
		return
	}
	var up acp.SessionUpdateParams
	if err := json.Unmarshal(params, &up); err != nil {
		p.eng.logf("bad session/update: %v", err)
		return
	}
	p.eng.mu.Lock()
	l := p.eng.byACP[up.SessionID]
	p.eng.mu.Unlock()
	if l == nil {
		return
	}
	l.handleUpdate(&up.Update)
}

// OnRequest implements acp.Handler.
func (p *proc) OnRequest(ctx context.Context, method string, params json.RawMessage) (any, *acp.RPCError) {
	switch method {
	case "session/request_permission":
		var req acp.RequestPermissionParams
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, &acp.RPCError{Code: -32602, Message: err.Error()}
		}
		p.eng.mu.Lock()
		l := p.eng.byACP[req.SessionID]
		p.eng.mu.Unlock()
		if l == nil {
			return acp.RequestPermissionResult{Outcome: acp.PermissionOutcome{Outcome: "cancelled"}}, nil
		}
		return l.handlePermission(ctx, &req), nil
	default:
		return nil, &acp.RPCError{Code: -32601, Message: "method not supported by Anchor"}
	}
}

// ---------------------------------------------------------------------------
// account / tier / models
// ---------------------------------------------------------------------------

func planFromTier(t *acp.Tier) model.Plan {
	if t == nil {
		return model.PlanUnknown
	}
	id := strings.ToLower(t.ID + " " + t.Name)
	switch {
	case strings.Contains(id, "ultra"):
		return model.PlanUltra
	case strings.Contains(id, "pro"):
		return model.PlanPro
	case strings.Contains(id, "free"):
		return model.PlanFree
	}
	return model.PlanUnknown
}

func (e *Engine) noteSetup(res *acp.SessionSetupResult) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if res.Meta != nil && res.Meta.Antigravity != nil && res.Meta.Antigravity.Tier != nil {
		e.tier = res.Meta.Antigravity.Tier
		if a := e.st.Account(); a != nil {
			a.Plan = planFromTier(e.tier)
			_ = e.st.SaveAccount(a)
		} else if email := activeEmail(); email != "" {
			_ = e.st.SaveAccount(&model.Account{Email: email, Name: displayName(email), Plan: planFromTier(e.tier)})
		}
	}
	if len(res.ConfigOptions) > 0 {
		var models []model.Model
		var efforts []model.Effort
		for _, o := range res.ConfigOptions {
			if o.Category == "thought_level" || o.ID == "thought_level" {
				for _, v := range o.Options {
					efforts = append(efforts, model.Effort(v.Value))
				}
			}
		}
		for _, o := range res.ConfigOptions {
			if o.Category == "model" || o.ID == "model" {
				for _, v := range o.Options {
					models = append(models, model.Model{ID: v.Value, Label: v.Name, Family: family(v.Value), ReasoningEfforts: efforts})
				}
			}
		}
		if len(models) > 0 {
			e.models = models
		}
	}
}

func family(id string) string {
	switch {
	case strings.HasPrefix(id, "gemini"):
		return "gemini"
	case strings.HasPrefix(id, "claude"):
		return "claude"
	}
	return "other"
}

// Tier returns the last subscription tier reported by the CLI.
func (e *Engine) Tier() *acp.Tier {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.tier
}

// Models lists the models the account can use. It needs a session to ask
// the CLI, so it opens and closes a throwaway one the first time.
func (e *Engine) Models() ([]model.Model, error) {
	e.mu.Lock()
	if len(e.models) > 0 {
		m := e.models
		e.mu.Unlock()
		return m, nil
	}
	e.mu.Unlock()
	if err := e.Probe(); err != nil {
		return nil, err
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	if len(e.models) == 0 {
		return []model.Model{{ID: DefaultModel, Label: "Gemini 4 Argon", Family: "gemini"}}, nil
	}
	return e.models, nil
}

// Probe opens a throwaway session to learn models and the account tier.
func (e *Engine) Probe() (err error) {
	defer func() {
		e.mu.Lock()
		e.probeErr = err
		e.mu.Unlock()
	}()
	p, err := e.Proc("")
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	var res acp.SessionSetupResult
	if err := p.client.Call(ctx, "session/new", map[string]any{"cwd": paths.Home(), "mcpServers": []any{}}, &res); err != nil {
		return translateErr(err)
	}
	e.noteSetup(&res)
	_ = p.client.Call(ctx, "session/close", map[string]any{"sessionId": res.SessionID}, nil)
	return nil
}

func translateErr(err error) error {
	var rpc *acp.RPCError
	if errors.As(err, &rpc) {
		switch rpc.Code {
		case acp.CodeAuthRequired:
			return errors.New("AUTH_REQUIRED: sign in with Google to use the Antigravity CLI")
		case acp.CodeNotFound:
			return errors.New("SESSION_NOT_FOUND: the conversation no longer exists in the Antigravity CLI")
		}
		return errors.New(rpc.Message)
	}
	return err
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

func activeEmail() string {
	b, err := os.ReadFile(paths.GoogleAccountsFile())
	if err != nil {
		return ""
	}
	var v struct {
		Active string `json:"active"`
	}
	_ = json.Unmarshal(b, &v)
	return v.Active
}

func displayName(email string) string {
	local := email
	if i := strings.Index(email, "@"); i > 0 {
		local = email[:i]
	}
	local = strings.NewReplacer(".", " ", "_", " ", "-", " ").Replace(local)
	words := strings.Fields(local)
	for i, w := range words {
		words[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	if len(words) == 0 {
		return email
	}
	return strings.Join(words, " ")
}

// AuthStatus reports the signed-in Google account, or nil.
//
// Whether someone is signed in is the CLI's call: a session/new that comes
// back with a tier means yes, AUTH_REQUIRED means no. The legacy credential
// files are consulted only for the email and profile, because current CLI
// builds keep the sign-in in the OS keyring and do not write them; trusting
// them for the yes/no answer left a freshly signed-in user stuck on the
// welcome screen.
func (e *Engine) AuthStatus() *model.Account {
	prev := e.st.Account()
	if _, ok := e.loc.Find(); !ok {
		return prev // no CLI to ask; show what we last knew
	}
	if prev == nil && e.Tier() == nil {
		// Nothing recorded: ask the CLI once per process.
		e.probeOnce()
	}
	if e.probeSaidSignedOut() {
		_ = e.st.SaveAccount(nil)
		return nil
	}
	if prev == nil && e.Tier() == nil {
		return nil // the probe did not run or failed for another reason
	}
	a := e.accountFromCLI(prev)
	if prev == nil || *a != *prev {
		_ = e.st.SaveAccount(a)
	}
	return a
}

// accountFromCLI assembles the account record for a sign-in the CLI has
// confirmed. prev (may be nil) supplies fields no source can refresh.
func (e *Engine) accountFromCLI(prev *model.Account) *model.Account {
	a := &model.Account{Plan: model.PlanUnknown}
	if prev != nil {
		*a = *prev
	}
	email := activeEmail()
	profile, _ := readGoogleProfile()
	if email == "" && profile != nil {
		email = profile.Email
	}
	if email == "" {
		email = emailFromCLILogs()
	}
	if email != "" && !strings.EqualFold(email, a.Email) {
		// A different account than last time: start the profile over.
		a.Email, a.Name, a.AvatarURL, a.Plan = email, displayName(email), "", model.PlanUnknown
	}
	if profile != nil && strings.EqualFold(profile.Email, a.Email) {
		if profile.Name != "" {
			a.Name = profile.Name
		}
		if profile.Picture != "" {
			a.AvatarURL = profile.Picture
		}
	}
	if a.Name == "" {
		if a.Email != "" {
			a.Name = displayName(a.Email)
		} else {
			a.Name = "Google account"
		}
	}
	if t := e.Tier(); t != nil {
		a.Plan = planFromTier(t)
		a.PlanName, a.UpgradeURL = t.Name, t.UpgradeURI
	}
	return a
}

// probeOnce runs Probe at most once per process (until Login/Logout reset it).
func (e *Engine) probeOnce() bool {
	e.mu.Lock()
	if e.probed {
		e.mu.Unlock()
		return false
	}
	e.probed = true
	e.mu.Unlock()
	return e.Probe() == nil
}

// probeSaidSignedOut is true when the last probe was refused for want of a
// sign-in, which outranks any account record on disk.
func (e *Engine) probeSaidSignedOut() bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.probeErr != nil && strings.HasPrefix(e.probeErr.Error(), "AUTH_REQUIRED")
}

// Login runs the CLI's own Google OAuth flow (opens the browser) and then
// probes a session to learn the subscription tier.
func (e *Engine) Login() (*model.Account, error) {
	p, err := e.Proc("")
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	method := "oauth-personal"
	if err := p.client.Call(ctx, "authenticate", map[string]any{"methodId": method}, nil); err != nil {
		return nil, fmt.Errorf("Google sign-in failed: %w", translateErr(err))
	}
	// Restart the CLI processes so every session uses the new account, then
	// confirm with a session of our own: that reply carries the tier and is
	// the proof of sign-in. The legacy files may or may not appear.
	e.Shutdown()
	e.mu.Lock()
	e.tier, e.probed, e.probeErr = nil, true, nil
	e.mu.Unlock()
	if err := e.Probe(); err != nil {
		return nil, fmt.Errorf("Google sign-in succeeded but the CLI could not open a session: %w", err)
	}
	a := e.accountFromCLI(nil)
	if err := e.st.SaveAccount(a); err != nil {
		return nil, err
	}
	return a, nil
}

// Logout signs out of Google everywhere Anchor can reach: the running CLI
// processes are closed, the CLI's credential files are cleared, and Anchor's
// own account record is removed. Clearing only the local record (as this
// once did) left the CLI signed in, so the next status check simply read the
// account straight back.
func (e *Engine) Logout() error {
	// The CLI advertises an auth.logout capability on initialize; ask it
	// first so it can drop whatever it caches in memory. Best effort: the
	// files below are what actually hold the sign-in.
	if p, err := e.Proc(""); err == nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		if err := p.client.Call(ctx, "auth/logout", nil, nil); err != nil {
			_ = p.client.Call(ctx, "logout", nil, nil)
		}
		cancel()
	}
	// Close every CLI process so none of them rewrites the credential files
	// after they have been cleared.
	e.Shutdown()
	err := clearCLICredentials()
	e.mu.Lock()
	e.tier = nil
	e.models = nil
	e.probed = false
	e.probeErr = nil
	e.mu.Unlock()
	if err2 := e.st.SaveAccount(nil); err == nil {
		err = err2
	}
	return err
}

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

func (e *Engine) getLive(id string) *live {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.live[id]
}

func (e *Engine) liveFor(meta *store.SessionMeta) *live {
	e.mu.Lock()
	defer e.mu.Unlock()
	if l, ok := e.live[meta.ID]; ok {
		l.mu.Lock()
		l.meta = meta
		l.mu.Unlock()
		return l
	}
	l := &live{eng: e, meta: meta, steps: e.st.Steps(meta.ID), acpID: meta.ACPSessionID, agentIdx: -1, thoughtIdx: -1,
		tools: map[string]int{}, perms: map[string]chan string{}}
	e.live[meta.ID] = l
	if l.acpID != "" {
		e.byACP[l.acpID] = l
	}
	return l
}

func (e *Engine) deviceID() string { return e.st.Device().ID }

// ListSessions merges the CLI's conversation list with Anchor's metadata.
func (e *Engine) ListSessions() ([]model.Session, error) {
	metas := map[string]*store.SessionMeta{}
	for _, m := range e.st.ListSessions() {
		metas[m.ID] = m
	}
	infos, err := e.acpSessions()
	if err != nil {
		e.logf("session/list: %v", err)
	}
	seen := map[string]bool{}
	dev := e.deviceID()
	deleted := e.st.DeletedSessions()
	for _, info := range infos {
		if at, gone := deleted[info.SessionID]; gone {
			if info.UpdatedAt <= at {
				continue // deleted in Anchor; the CLI still lists it
			}
			_ = e.st.Undelete(info.SessionID) // continued from the terminal since
		}
		seen[info.SessionID] = true
		m, ok := metas[info.SessionID]
		if !ok {
			m = &store.SessionMeta{Session: model.Session{
				ID: info.SessionID, Title: info.Title, ModelID: DefaultModel, Effort: DefaultEffort, Mode: DefaultMode,
				WorkspacePaths: nonEmpty(info.Cwd), OriginDeviceID: dev, SyncState: model.SyncLocal,
				CreatedAt: info.UpdatedAt, LastModified: info.UpdatedAt}, ACPSessionID: info.SessionID}
			metas[m.ID] = m
			_ = e.st.SaveSession(m)
			continue
		}
		changed := false
		if info.Title != "" && info.Title != m.Title {
			m.Title = info.Title
			changed = true
		}
		if info.UpdatedAt > m.LastModified {
			m.LastModified = info.UpdatedAt
			// If this process drives the session, its cache already holds
			// everything the CLI knows; only foreign edits make it stale.
			if l := e.getLive(m.ID); l != nil {
				l.mu.Lock()
				if l.attached {
					m.CachedAt = info.UpdatedAt
				}
				l.mu.Unlock()
			}
			changed = true
		}
		if len(m.WorkspacePaths) == 0 && info.Cwd != "" {
			m.WorkspacePaths = []string{info.Cwd}
			changed = true
		}
		if changed {
			_ = e.st.SaveSession(m)
		}
	}
	// Drop local records whose CLI conversation disappeared (deleted in the
	// terminal) unless they came from another device.
	if err == nil {
		for id, m := range metas {
			if !seen[id] && m.ACPSessionID == m.ID && m.SyncState == model.SyncLocal {
				_ = e.st.DeleteSession(id)
				delete(metas, id)
			}
		}
	}
	out := make([]model.Session, 0, len(metas))
	for _, m := range metas {
		out = append(out, e.view(m))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Pinned != out[j].Pinned {
			return out[i].Pinned
		}
		return out[i].LastModified > out[j].LastModified
	})
	return out, nil
}

func nonEmpty(s string) []string {
	if s == "" {
		return []string{}
	}
	return []string{s}
}

func (e *Engine) acpSessions() ([]acp.SessionInfo, error) {
	p, err := e.Proc("")
	if err != nil {
		return nil, err
	}
	var all []acp.SessionInfo
	cursor := ""
	for i := 0; i < 50; i++ {
		params := map[string]any{}
		if cursor != "" {
			params["cursor"] = cursor
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		var res acp.ListSessionsResult
		err := p.client.Call(ctx, "session/list", params, &res)
		cancel()
		if err != nil {
			return all, translateErr(err)
		}
		all = append(all, res.Sessions...)
		if res.NextCursor == "" || res.NextCursor == cursor {
			break
		}
		cursor = res.NextCursor
	}
	return all, nil
}

func (e *Engine) view(m *store.SessionMeta) model.Session {
	s := m.Session
	if s.Title == "" {
		s.Title = "New Session"
	}
	if s.StepCount == 0 || s.Preview == "" {
		steps := e.st.Steps(m.ID)
		if len(steps) > 0 {
			s.StepCount = len(steps)
			s.Preview = previewOf(steps)
		} else if m.ACPSessionID != "" {
			s.Preview = "Antigravity CLI conversation · open to load the transcript"
		}
	}
	if s.WorkspacePaths == nil {
		s.WorkspacePaths = []string{}
	}
	return s
}

func previewOf(steps []model.Step) string {
	for i := len(steps) - 1; i >= 0; i-- {
		st := steps[i]
		var t string
		switch st.Kind {
		case "agent":
			t = st.Markdown
		case "user":
			t = st.Text
		}
		t = strings.TrimSpace(strings.ReplaceAll(t, "\n", " "))
		if t != "" {
			if len(t) > 140 {
				t = t[:140] + "…"
			}
			return t
		}
	}
	return ""
}

func (e *Engine) GetSession(id string) (model.Session, []model.Step, error) {
	meta, err := e.st.GetSession(id)
	if err != nil {
		// Maybe the CLI knows it but we have not listed yet.
		if _, lerr := e.ListSessions(); lerr != nil {
			return model.Session{}, nil, lerr
		}
		meta, err = e.st.GetSession(id)
		if err != nil {
			return model.Session{}, nil, errors.New("session not found")
		}
	}
	l := e.liveFor(meta)
	l.mu.Lock()
	stale := (len(l.steps) == 0 || meta.LastModified > meta.CachedAt) && l.streamID == ""
	l.mu.Unlock()
	if stale && meta.ACPSessionID != "" && meta.ACPSessionID == meta.ID {
		if err := l.reload(); err != nil {
			e.logf("reload %s: %v", id, err)
		}
	}
	l.mu.Lock()
	steps := append([]model.Step(nil), l.steps...)
	l.mu.Unlock()
	return e.view(meta), steps, nil
}

type CreateInput struct {
	Title          string       `json:"title"`
	AgentID        string       `json:"agentId"`
	ModelID        string       `json:"modelId"`
	Effort         model.Effort `json:"effort"`
	Mode           model.Mode   `json:"mode"`
	WorkspacePaths []string     `json:"workspacePaths"`
}

func (e *Engine) Create(in CreateInput) (model.Session, error) {
	cwd := paths.Home()
	var wps []string
	for _, p := range in.WorkspacePaths {
		if st, err := os.Stat(p); err == nil && st.IsDir() {
			wps = append(wps, p)
		}
	}
	if len(wps) > 0 {
		cwd = wps[0]
	} else {
		wps = []string{cwd}
	}
	if in.ModelID == "" {
		in.ModelID = DefaultModel
	}
	if in.Effort == "" {
		in.Effort = DefaultEffort
	}
	if in.Mode == "" {
		in.Mode = DefaultMode
	}
	agent := agentName(in.AgentID)
	p, err := e.Proc(agent)
	if err != nil {
		return model.Session{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	var res acp.SessionSetupResult
	if err := p.client.Call(ctx, "session/new", map[string]any{"cwd": cwd, "mcpServers": []any{}}, &res); err != nil {
		return model.Session{}, translateErr(err)
	}
	e.noteSetup(&res)
	now := store.Now()
	meta := &store.SessionMeta{Session: model.Session{
		ID: res.SessionID, Title: strings.TrimSpace(in.Title), AgentID: in.AgentID, ModelID: in.ModelID, Effort: in.Effort, Mode: in.Mode,
		WorkspacePaths: wps, OriginDeviceID: e.deviceID(), SyncState: model.SyncLocal, CreatedAt: now, LastModified: now},
		ACPSessionID: res.SessionID, CachedAt: now}
	if meta.Title == "" || meta.Title == "New Session" {
		meta.Title = "New Session"
	}
	if err := e.st.SaveSession(meta); err != nil {
		return model.Session{}, err
	}
	_ = e.st.SaveSteps(meta.ID, []model.Step{})
	l := e.liveFor(meta)
	l.mu.Lock()
	l.proc, l.acpID, l.attached = p, res.SessionID, true
	l.mu.Unlock()
	e.mu.Lock()
	e.byACP[res.SessionID] = l
	e.mu.Unlock()
	l.applyConfig()
	return e.view(meta), nil
}

func agentName(agentID string) string {
	if agentID == "" || agentID == "agent_general" {
		return ""
	}
	if i := strings.Index(agentID, ":"); i >= 0 {
		agentID = agentID[i+1:]
	}
	if i := strings.LastIndex(agentID, "/"); i >= 0 {
		agentID = agentID[i+1:]
	}
	return agentID
}

type UpdatePatch struct {
	Title   *string       `json:"title,omitempty"`
	Pinned  *bool         `json:"pinned,omitempty"`
	ModelID *string       `json:"modelId,omitempty"`
	Effort  *model.Effort `json:"effort,omitempty"`
	Mode    *model.Mode   `json:"mode,omitempty"`
	AgentID *string       `json:"agentId,omitempty"`
}

func (e *Engine) Update(id string, patch UpdatePatch) (model.Session, error) {
	meta, err := e.st.GetSession(id)
	if err != nil {
		return model.Session{}, errors.New("session not found")
	}
	reconfigure := false
	if patch.Title != nil && strings.TrimSpace(*patch.Title) != "" {
		meta.Title = strings.TrimSpace(*patch.Title)
	}
	if patch.Pinned != nil {
		meta.Pinned = *patch.Pinned
	}
	if patch.ModelID != nil && *patch.ModelID != "" {
		meta.ModelID = *patch.ModelID
		reconfigure = true
	}
	if patch.Effort != nil && *patch.Effort != "" {
		meta.Effort = *patch.Effort
		reconfigure = true
	}
	if patch.Mode != nil && *patch.Mode != "" {
		meta.Mode = *patch.Mode
		reconfigure = true
	}
	if patch.AgentID != nil {
		meta.AgentID = *patch.AgentID
	}
	meta.LocalVersion++
	if err := e.st.SaveSession(meta); err != nil {
		return model.Session{}, err
	}
	l := e.liveFor(meta)
	if reconfigure {
		l.mu.Lock()
		attached := l.attached
		l.mu.Unlock()
		if attached {
			l.applyConfig()
		}
	}
	return e.view(meta), nil
}

func (e *Engine) SetSync(id string, enabled bool) (model.Session, error) {
	meta, err := e.st.GetSession(id)
	if err != nil {
		return model.Session{}, errors.New("session not found")
	}
	if meta.OriginDeviceID != e.deviceID() {
		return model.Session{}, ErrNotParentSource
	}
	if enabled {
		// The push uploads the cached transcript. A session listed from the
		// CLI but never opened in Anchor has no cache yet; load it now so the
		// first publish carries the conversation rather than an empty one.
		if _, _, err := e.GetSession(id); err != nil {
			e.logf("sync %s: transcript not loaded before publish: %v", id, err)
		}
		if meta, err = e.st.GetSession(id); err != nil {
			return model.Session{}, errors.New("session not found")
		}
	}
	meta.SyncEnabled = enabled
	if enabled {
		meta.SyncState = model.SyncPublished
	} else {
		meta.SyncState = model.SyncLocal
	}
	meta.LocalVersion++
	if err := e.st.SaveSession(meta); err != nil {
		return model.Session{}, err
	}
	e.emit("sync:changed", map[string]any{"sessionId": id, "enabled": enabled})
	return e.view(meta), nil
}

// Delete removes a session from Anchor. The CLI keeps the conversation (it
// has no delete over ACP); a tombstone keeps it out of the list unless the
// terminal adds to it later.
func (e *Engine) Delete(id string) error {
	meta, err := e.st.GetSession(id)
	if err == nil {
		if meta.ACPSessionID != "" {
			_ = e.st.MarkDeleted(meta.ACPSessionID, meta.LastModified)
		}
		if l := e.getLive(id); l != nil {
			l.mu.Lock()
			if l.attached && l.proc != nil {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				_ = l.proc.client.Call(ctx, "session/close", map[string]any{"sessionId": l.acpID}, nil)
				cancel()
			}
			l.attached = false
			l.mu.Unlock()
			e.mu.Lock()
			delete(e.live, id)
			if l.acpID != "" {
				delete(e.byACP, l.acpID)
			}
			e.mu.Unlock()
		}
		_ = meta
	}
	return e.st.DeleteSession(id)
}

func (e *Engine) ExportMarkdown(id string) (string, error) {
	s, steps, err := e.GetSession(id)
	if err != nil {
		return "", err
	}
	return transcriptMarkdown(s, steps), nil
}

func transcriptMarkdown(s model.Session, steps []model.Step) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n\n", s.Title)
	fmt.Fprintf(&b, "_Model: %s · Effort: %s · Mode: %s · Created: %s_\n\n", s.ModelID, s.Effort, s.Mode, s.CreatedAt)
	for _, st := range steps {
		switch st.Kind {
		case "user":
			fmt.Fprintf(&b, "## You\n\n%s\n\n", st.Text)
		case "agent":
			fmt.Fprintf(&b, "## Agent\n\n%s\n\n", st.Markdown)
		case "thinking":
			fmt.Fprintf(&b, "<details><summary>Thinking</summary>\n\n%s\n\n</details>\n\n", st.Text)
		case "tool_call":
			args, _ := json.Marshal(st.Args)
			fmt.Fprintf(&b, "**Tool `%s`** (%s)\n\n```json\n%s\n```\n", st.Tool, st.Status, string(args))
			if st.Output != "" {
				fmt.Fprintf(&b, "```\n%s\n```\n\n", st.Output)
			}
		case "permission":
			fmt.Fprintf(&b, "**Permission** %s — %s\n\n", st.Tool, st.Resolved)
		case "diff":
			fmt.Fprintf(&b, "**Edit** `%s`\n\n```diff\n%s\n```\n\n", st.Path, st.Patch)
		}
	}
	return b.String()
}

// ---------------------------------------------------------------------------
// attach / config / reload
// ---------------------------------------------------------------------------

// attach makes sure the live session has an open ACP session in a running
// process. It creates one for replicas that have never run on this device.
func (l *live) attach() error {
	l.mu.Lock()
	if l.attached && l.proc != nil && l.proc.client.Alive() {
		l.mu.Unlock()
		return nil
	}
	meta := l.meta
	acpID := l.acpID
	haveSteps := len(l.steps) > 0
	l.mu.Unlock()

	p, err := l.eng.Proc(agentName(meta.AgentID))
	if err != nil {
		return err
	}
	cwd := paths.Home()
	if len(meta.WorkspacePaths) > 0 {
		if st, err := os.Stat(meta.WorkspacePaths[0]); err == nil && st.IsDir() {
			cwd = meta.WorkspacePaths[0]
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	var res acp.SessionSetupResult
	newSession := func() error {
		if err := p.client.Call(ctx, "session/new", map[string]any{"cwd": cwd, "mcpServers": []any{}}, &res); err != nil {
			return translateErr(err)
		}
		l.mu.Lock()
		l.acpID = res.SessionID
		l.needsSeed = haveSteps
		l.meta.ACPSessionID = res.SessionID
		l.mu.Unlock()
		_ = l.eng.st.SaveSession(l.meta)
		return nil
	}
	if acpID == "" {
		if err := newSession(); err != nil {
			return err
		}
	} else {
		method := "session/resume"
		if !haveSteps {
			method = "session/load"
			l.mu.Lock()
			l.loading = true
			l.steps = nil
			l.resetCursor()
			l.mu.Unlock()
		}
		l.eng.mu.Lock()
		l.eng.byACP[acpID] = l
		l.eng.mu.Unlock()
		err := p.client.Call(ctx, method, map[string]any{"sessionId": acpID, "cwd": cwd, "mcpServers": []any{}}, &res)
		l.mu.Lock()
		l.loading = false
		l.mu.Unlock()
		if err != nil {
			var rpc *acp.RPCError
			if errors.As(err, &rpc) && rpc.Code == acp.CodeNotFound {
				if err := newSession(); err != nil {
					return err
				}
			} else {
				return translateErr(err)
			}
		} else if method == "session/load" {
			l.mu.Lock()
			l.meta.CachedAt = store.Now()
			steps := append([]model.Step(nil), l.steps...)
			l.mu.Unlock()
			_ = l.eng.st.SaveSteps(l.meta.ID, steps)
			_ = l.eng.st.SaveSession(l.meta)
		}
	}
	l.eng.noteSetup(&res)
	l.mu.Lock()
	l.proc = p
	l.attached = true
	id := l.acpID
	l.mu.Unlock()
	l.eng.mu.Lock()
	l.eng.byACP[id] = l
	l.eng.mu.Unlock()
	l.applyConfig()
	return nil
}

// reload replays the CLI's history for this session into the step cache.
func (l *live) reload() error {
	l.mu.Lock()
	l.attached = false
	l.steps = nil
	l.mu.Unlock()
	return l.attach()
}

func (l *live) resetCursor() {
	l.agentIdx, l.thoughtIdx, l.lastMsgID = -1, -1, ""
	l.tools = map[string]int{}
}

func clampEffort(e model.Effort) string {
	switch e {
	case "low", "medium", "high":
		return string(e)
	case "xhigh", "max":
		return "high"
	}
	return "medium"
}

func (l *live) applyConfig() {
	l.mu.Lock()
	p, id, meta := l.proc, l.acpID, l.meta
	l.mu.Unlock()
	if p == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	set := func(configID, value string) {
		if err := p.client.Call(ctx, "session/set_config_option", map[string]any{"sessionId": id, "configId": configID, "value": value}, nil); err != nil {
			l.eng.logf("set_config_option %s=%s: %v", configID, value, err)
		}
	}
	if meta.ModelID != "" {
		set("model", meta.ModelID)
	}
	set("thought_level", clampEffort(meta.Effort))
	mode := string(meta.Mode)
	if mode == "" {
		mode = string(DefaultMode)
	}
	if err := p.client.Call(ctx, "session/set_mode", map[string]any{"sessionId": id, "modeId": mode}, nil); err != nil {
		set("mode", mode)
	}
}

// ---------------------------------------------------------------------------
// prompting
// ---------------------------------------------------------------------------

// Prompt starts a turn. Events are emitted on "chat:<streamId>" until a
// done event. The caller chooses streamID so it can subscribe before the
// first event is emitted.
func (e *Engine) Prompt(sessionID, streamID, text string, attachments []model.Attachment) (string, error) {
	meta, err := e.st.GetSession(sessionID)
	if err != nil {
		return "", errors.New("session not found")
	}
	if strings.TrimSpace(text) == "" && len(attachments) == 0 {
		return "", errors.New("nothing to send")
	}
	if streamID == "" {
		streamID = uuid.NewString()
	}
	l := e.liveFor(meta)
	l.mu.Lock()
	busy := l.streamID != ""
	if !busy {
		l.streamID = streamID
	}
	l.mu.Unlock()
	if busy {
		return "", errors.New("a turn is already running for this session")
	}
	go l.runTurn(streamID, text, attachments)
	return streamID, nil
}

func (l *live) emitChat(ev model.ChatEvent) {
	l.mu.Lock()
	sid := l.streamID
	l.mu.Unlock()
	if sid == "" {
		return
	}
	l.eng.emit("chat:"+sid, ev)
}

func (l *live) runTurn(streamID, text string, attachments []model.Attachment) {
	finish := func(errMsg, code string) {
		l.mu.Lock()
		if l.agentIdx >= 0 && l.agentIdx < len(l.steps) {
			f := false
			l.steps[l.agentIdx].Streaming = &f
			l.mu.Unlock()
			l.emitChat(model.ChatEvent{Type: "step_update", ID: l.steps[l.agentIdx].ID, Patch: model.StepPatch{"streaming": false}})
			l.mu.Lock()
		}
		l.resetCursor()
		for id, ch := range l.perms {
			select {
			case ch <- "cancelled":
			default:
			}
			delete(l.perms, id)
		}
		l.turnCancel = nil
		steps := append([]model.Step(nil), l.steps...)
		l.meta.StepCount = len(steps)
		l.meta.Preview = previewOf(steps)
		l.meta.LastModified = store.Now()
		l.meta.CachedAt = l.meta.LastModified
		l.meta.LocalVersion++
		meta := l.meta
		l.mu.Unlock()
		_ = l.eng.st.SaveSteps(meta.ID, steps)
		_ = l.eng.st.SaveSession(meta)
		if errMsg != "" {
			l.emitChat(model.ChatEvent{Type: "error", Message: errMsg, Code: code})
		}
		l.emitChat(model.ChatEvent{Type: "done", SessionID: meta.ID})
		l.mu.Lock()
		l.streamID = ""
		l.mu.Unlock()
		l.eng.emit("sessions:changed", map[string]any{"sessionId": meta.ID})
	}

	if err := l.attach(); err != nil {
		code := "cli"
		if strings.HasPrefix(err.Error(), "AUTH_REQUIRED") {
			code = "auth"
		}
		finish(err.Error(), code)
		return
	}

	user := model.Step{Kind: "user", ID: "step_u_" + uuid.NewString()[:8], Text: text, Attachments: attachments, At: store.Now()}
	l.mu.Lock()
	l.steps = append(l.steps, user)
	l.resetCursor()
	seed := l.needsSeed
	l.needsSeed = false
	steps := l.steps
	p, id := l.proc, l.acpID
	ctx, cancel := context.WithCancel(context.Background())
	l.turnCancel = cancel
	l.mu.Unlock()
	l.emitChat(model.ChatEvent{Type: "step", Step: &user})

	var blocks []acp.ContentBlock
	if seed {
		// Replica resumed on a new device: give the CLI the prior transcript.
		prior := steps[:len(steps)-1]
		blocks = append(blocks, acp.ContentBlock{Type: "resource", Resource: &struct {
			URI      string `json:"uri"`
			MimeType string `json:"mimeType,omitempty"`
			Text     string `json:"text,omitempty"`
		}{URI: "anchor://session/" + l.meta.ID + "/history.md", MimeType: "text/markdown",
			Text: "The following is the earlier part of this conversation, synced from another device. Continue it naturally.\n\n" + transcriptMarkdown(l.meta.Session, prior)}})
	}
	blocks = append(blocks, attachmentBlocks(attachments)...)
	blocks = append(blocks, acp.ContentBlock{Type: "text", Text: text})

	var res acp.PromptResult
	err := p.client.Call(ctx, "session/prompt", map[string]any{"sessionId": id, "prompt": blocks}, &res)
	cancel()
	if err != nil {
		if errors.Is(err, context.Canceled) {
			finish("", "")
			return
		}
		msg := translateErr(err).Error()
		code := "cli"
		lower := strings.ToLower(msg)
		switch {
		case strings.HasPrefix(msg, "AUTH_REQUIRED"):
			code = "auth"
		case strings.Contains(lower, "quota") || strings.Contains(lower, "rate") || strings.Contains(lower, "429"):
			code = "rate_limited"
		case strings.Contains(lower, "network") || strings.Contains(lower, "dial") || strings.Contains(lower, "offline"):
			code = "offline"
		}
		finish(msg, code)
		return
	}
	switch res.StopReason {
	case "refusal":
		finish("The model declined to continue this turn.", "")
	case "max_tokens":
		finish("The turn stopped at the model's token limit.", "")
	default:
		finish("", "")
	}
}

func attachmentBlocks(atts []model.Attachment) []acp.ContentBlock {
	var out []acp.ContentBlock
	for _, a := range atts {
		if a.Path == "" {
			continue
		}
		uri := "file://" + filepath.ToSlash(a.Path)
		st, err := os.Stat(a.Path)
		if err != nil {
			continue
		}
		if st.Size() <= 2*1024*1024 && isTextMime(a.Mime, a.Path) {
			if b, err := os.ReadFile(a.Path); err == nil {
				out = append(out, acp.ContentBlock{Type: "resource", Resource: &struct {
					URI      string `json:"uri"`
					MimeType string `json:"mimeType,omitempty"`
					Text     string `json:"text,omitempty"`
				}{URI: uri, MimeType: a.Mime, Text: string(b)}})
				continue
			}
		}
		out = append(out, acp.ContentBlock{Type: "resource_link", URI: uri, Name: a.Name, MimeType: a.Mime})
	}
	return out
}

func isTextMime(mime, path string) bool {
	if strings.HasPrefix(mime, "text/") || strings.Contains(mime, "json") || strings.Contains(mime, "xml") || strings.Contains(mime, "yaml") || strings.Contains(mime, "javascript") {
		return true
	}
	switch strings.ToLower(filepath.Ext(path)) {
	case ".txt", ".md", ".go", ".ts", ".tsx", ".js", ".py", ".json", ".yaml", ".yml", ".toml", ".sh", ".css", ".html", ".sql", ".rs", ".java", ".kt", ".swift", ".c", ".h", ".cpp", ".cs", ".rb", ".php", ".csv", ".log", ".env", ".ini", ".cfg":
		return true
	}
	return false
}

func (e *Engine) Stop(sessionID string) error {
	l := e.getLive(sessionID)
	if l == nil {
		return nil
	}
	l.mu.Lock()
	p, id := l.proc, l.acpID
	cancel := l.turnCancel
	l.mu.Unlock()
	if p != nil && id != "" {
		_ = p.client.Notify("session/cancel", map[string]any{"sessionId": id})
	}
	if cancel != nil {
		// Give the agent a moment to answer with stopReason=cancelled.
		go func() {
			time.Sleep(3 * time.Second)
			cancel()
		}()
	}
	return nil
}

// ResolvePermission answers a pending permission step.
func (e *Engine) ResolvePermission(sessionID, stepID, decision string) error {
	l := e.getLive(sessionID)
	if l == nil {
		return errors.New("session not active")
	}
	l.mu.Lock()
	ch, ok := l.perms[stepID]
	if ok {
		delete(l.perms, stepID)
	}
	for i := range l.steps {
		if l.steps[i].ID == stepID {
			l.steps[i].Resolved = decision
		}
	}
	l.mu.Unlock()
	if !ok {
		return nil
	}
	ch <- decision
	return nil
}

// ResolveDiff records the user's verdict on an edit card. Edits shown in
// the transcript were already applied by the CLI; rejecting one reverts the
// file to the old text when we have it.
func (e *Engine) ResolveDiff(sessionID, stepID string, accept bool) error {
	l := e.getLive(sessionID)
	if l == nil {
		return errors.New("session not active")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	for i := range l.steps {
		if l.steps[i].ID == stepID && l.steps[i].Kind == "diff" {
			a := accept
			l.steps[i].Accepted = &a
			if !accept && l.steps[i].Path != "" {
				old, ok := diffOldText[stepID]
				if ok {
					_ = os.WriteFile(l.steps[i].Path, []byte(old), 0o644)
				}
			}
		}
	}
	steps := append([]model.Step(nil), l.steps...)
	go func() { _ = e.st.SaveSteps(sessionID, steps) }()
	return nil
}

// diffOldText remembers the previous file contents for diff steps produced
// in this process so a rejected edit can be reverted.
var diffOldText = map[string]string{}
