package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/Majidul17068/anchor/internal/agents"
	"github.com/Majidul17068/anchor/internal/cli"
	"github.com/Majidul17068/anchor/internal/drive"
	"github.com/Majidul17068/anchor/internal/engine"
	"github.com/Majidul17068/anchor/internal/folderdrive"
	"github.com/Majidul17068/anchor/internal/market"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
	"github.com/Majidul17068/anchor/internal/skills"
	"github.com/Majidul17068/anchor/internal/store"
	anchorsync "github.com/Majidul17068/anchor/internal/sync"
)

// API is bound into the webview as window.go.main.API. Every method maps
// onto one AnchorBridge call; streaming calls emit Wails events instead of
// returning async iterators (the TS adapter in frontend/src/bridge/wails.ts
// turns those events back into AsyncIterables).
type API struct {
	ctx     context.Context
	version string
	log     *log.Logger

	st     *store.Store
	loc    *cli.Locator
	eng    *engine.Engine
	skills *skills.Service
	agents *agents.Service
	drive  *drive.Service
	folder *folderdrive.Service
	sync   *anchorsync.Engine
	market *market.Service

	sharedMu   sync.Mutex
	sharedAt   time.Time
	sharedList []model.Skill
}

func NewAPI(version string, logger *log.Logger) *API {
	st, err := store.New()
	if err != nil {
		logger.Printf("store: %v", err)
	}
	a := &API{version: version, log: logger, st: st}
	logf := func(format string, args ...any) { logger.Printf(format, args...) }
	a.loc = cli.NewLocator(st.SettingString("cliPath"))
	a.eng = engine.New(a.loc, st, a.emit, logf, version)
	author := func() string {
		if acc := a.eng.AuthStatus(); acc != nil {
			return acc.Name
		}
		return "me"
	}
	a.skills = skills.New(st, a.eng, author)
	// A plugin repository is converted by the CLI's own installer.
	a.skills.SetPluginInstaller(func(dir string) (string, error) {
		bin, ok := a.loc.Find()
		if !ok {
			return "", errors.New("the Antigravity CLI (agy) is not installed")
		}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
		defer cancel()
		out, err := cli.Run(ctx, bin, "plugin", "install", dir)
		if err != nil {
			return "", err
		}
		return skills.PluginDirFromInstallOutput(out), nil
	})
	a.agents = agents.New(a.loc)
	a.drive = drive.New(st, a.openURL, logf)
	// Two ways to reach the user's Google Drive: a synced folder on this
	// machine (Google Drive for Desktop; no app registration needed) or the
	// Drive API (needs an OAuth client id in the build). The folder wins
	// when one was chosen.
	a.folder = folderdrive.New(st.SettingString("syncFolder"))
	a.sync = anchorsync.New(st, a.drive, a.emit, logf)
	if a.folder.Connected() {
		a.sync.SetDrive(a.folder, "folder", a.folder.Root(), folderdrive.KindOf(a.folder.Root()))
	}
	me := func() model.MarketAuthor {
		if acc := a.eng.AuthStatus(); acc != nil {
			return model.MarketAuthor{ID: acc.Email, Name: acc.Name, AvatarURL: acc.AvatarURL}
		}
		return model.MarketAuthor{ID: "anonymous", Name: "Anonymous"}
	}
	a.market = market.New(st, a.skills, a.openURL, me, logf)
	return a
}

func (a *API) startup(ctx context.Context) {
	a.ctx = ctx
	a.sync.Start()
	// Warm up in the background so the first screen is fast.
	go func() {
		if _, ok := a.loc.Find(); ok && a.eng.AuthStatus() != nil {
			if err := a.eng.Probe(); err != nil {
				a.log.Printf("startup probe: %v", err)
			}
		}
	}()
}

func (a *API) shutdown(ctx context.Context) {
	a.sync.Stop()
	a.eng.Shutdown()
}

func (a *API) emit(name string, data any) {
	if a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, name, data)
}

func (a *API) openURL(u string) {
	if a.ctx == nil {
		return
	}
	runtime.BrowserOpenURL(a.ctx, u)
}

// ---------------------------------------------------------------------------
// system
// ---------------------------------------------------------------------------

func (a *API) SystemVersion() string { return a.version }

func (a *API) SystemCliStatus() model.CliStatus { return a.loc.Status() }

// SystemInstallCli runs the official installer; progress is emitted on
// "cli:install" and the call returns when it finishes.
func (a *API) SystemInstallCli() (model.CliStatus, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	_, err := a.loc.Install(ctx, func(p model.InstallProgress) { a.emit("cli:install", p) })
	if err != nil {
		a.emit("cli:install", model.InstallProgress{Phase: "done", Percent: 100, Message: "Failed: " + err.Error()})
		return a.loc.Status(), err
	}
	return a.loc.Status(), nil
}

func (a *API) SystemLocateCli() (string, error) {
	p, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: "Locate the agy binary", DefaultDirectory: paths.Home()})
	if err != nil || p == "" {
		return "", err
	}
	if v := cli.Version(p); v == "" {
		return "", errors.New("that file does not look like the Antigravity CLI (agy --version failed)")
	}
	a.loc.SetOverride(p)
	_ = a.st.SetSettings(map[string]any{"cliPath": p})
	a.eng.Shutdown()
	return p, nil
}

func (a *API) SystemPlatform() string { return paths.Platform() }

func (a *API) SystemOpenExternal(u string) error {
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") && !strings.HasPrefix(u, "file://") && !strings.HasPrefix(u, "mailto:") {
		return errors.New("refusing to open non-web URL")
	}
	a.openURL(u)
	return nil
}

func (a *API) SystemPickFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose a workspace folder", DefaultDirectory: paths.Home()})
}

func (a *API) SystemPickFiles() ([]model.Attachment, error) {
	files, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{Title: "Attach files"})
	if err != nil {
		return nil, err
	}
	out := []model.Attachment{}
	for _, p := range files {
		st, err := os.Stat(p)
		if err != nil || st.IsDir() {
			continue
		}
		m := mime.TypeByExtension(filepath.Ext(p))
		if m == "" {
			m = "application/octet-stream"
		}
		out = append(out, model.Attachment{Name: filepath.Base(p), Path: p, Mime: m, Size: st.Size()})
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// auth / devices / models / projects
// ---------------------------------------------------------------------------

func (a *API) AuthStatus() *model.Account { return a.eng.AuthStatus() }

func (a *API) AuthLogin() (*model.Account, error) {
	if _, ok := a.loc.Find(); !ok {
		return nil, errors.New("install the Antigravity CLI first")
	}
	acc, err := a.eng.Login()
	// The browser took focus for Google's consent screen; its callback page
	// only says "return to your IDE", so bring Anchor back ourselves.
	if a.ctx != nil {
		runtime.WindowUnminimise(a.ctx)
		runtime.WindowShow(a.ctx)
		runtime.Show(a.ctx)
	}
	return acc, err
}

func (a *API) AuthLogout() error { return a.eng.Logout() }

func (a *API) DevicesThis() model.Device {
	d := a.st.Device()
	return model.Device{ID: d.ID, Name: d.Name, Platform: d.Platform, LastSeen: store.Now(), IsThisDevice: true}
}

func (a *API) DevicesRename(name string) error {
	if strings.TrimSpace(name) == "" {
		return errors.New("device name cannot be empty")
	}
	return a.st.RenameDevice(name)
}

func (a *API) DevicesList() []model.Device {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	return a.sync.Devices(ctx)
}

func (a *API) ModelsList() ([]model.Model, error) { return a.eng.Models() }

func (a *API) ProjectsList() ([]model.Project, error) { return a.eng.Projects() }

// ---------------------------------------------------------------------------
// sessions / chat / history
// ---------------------------------------------------------------------------

func (a *API) SessionsList() ([]model.Session, error) {
	list, err := a.eng.ListSessions()
	if list == nil {
		list = []model.Session{}
	}
	if err != nil && len(list) == 0 {
		return list, err
	}
	return list, nil
}

type SessionDetail struct {
	Session model.Session `json:"session"`
	Steps   []model.Step  `json:"steps"`
}

func (a *API) SessionsGet(id string) (SessionDetail, error) {
	s, steps, err := a.eng.GetSession(id)
	if steps == nil {
		steps = []model.Step{}
	}
	return SessionDetail{Session: s, Steps: steps}, err
}

func (a *API) SessionsCreate(in engine.CreateInput) (model.Session, error) { return a.eng.Create(in) }

func (a *API) SessionsUpdate(id string, patch engine.UpdatePatch) (model.Session, error) {
	return a.eng.Update(id, patch)
}

func (a *API) SessionsSetSync(id string, enabled bool) (model.Session, error) {
	s, err := a.eng.SetSync(id, enabled)
	if err == nil {
		go func() { _, _ = a.sync.SyncNow(context.Background()) }()
	}
	return s, err
}

func (a *API) SessionsDelete(id string) error { return a.eng.Delete(id) }

func (a *API) SessionsExportMarkdown(id string) (string, error) { return a.eng.ExportMarkdown(id) }

// ChatSend starts a turn; events arrive on "chat:<streamId>". The UI picks
// the stream id and subscribes before calling, so no event is lost.
func (a *API) ChatSend(sessionID, streamID, text string, attachments []model.Attachment) (string, error) {
	return a.eng.Prompt(sessionID, streamID, text, attachments)
}

func (a *API) ChatStop(sessionID string) error { return a.eng.Stop(sessionID) }

func (a *API) ChatResolvePermission(sessionID, stepID, decision string) error {
	return a.eng.ResolvePermission(sessionID, stepID, decision)
}

func (a *API) ChatResolveDiff(sessionID, stepID string, accept bool) error {
	return a.eng.ResolveDiff(sessionID, stepID, accept)
}

func (a *API) HistorySearch(q string, f engine.SearchFilters) ([]model.Session, error) {
	return a.eng.Search(q, f)
}

// ---------------------------------------------------------------------------
// agents
// ---------------------------------------------------------------------------

func (a *API) AgentsList() ([]model.Agent, error)          { return a.agents.List() }
func (a *API) AgentsGet(id string) (*model.Agent, error)   { return a.agents.Get(id) }
func (a *API) AgentsSave(in agents.SaveInput) (*model.Agent, error) {
	ag, err := a.agents.Save(in)
	if err == nil {
		a.eng.Shutdown() // so the CLI re-discovers agents
	}
	return ag, err
}
func (a *API) AgentsDelete(id string) error { return a.agents.Delete(id) }

// ---------------------------------------------------------------------------
// skills
// ---------------------------------------------------------------------------

func (a *API) SkillsList() ([]model.Skill, error) {
	list, err := a.skills.List()
	if err != nil {
		return nil, err
	}
	list = append(list, a.sharedWithMe()...)
	return list, nil
}

// sharedWithMe lists Drive skill folders other users shared that are not
// imported yet. Cached for a minute to keep the Skills page snappy.
func (a *API) sharedWithMe() []model.Skill {
	if !a.drive.Connected() {
		return nil
	}
	a.sharedMu.Lock()
	defer a.sharedMu.Unlock()
	if time.Since(a.sharedAt) < time.Minute {
		return a.sharedList
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	files, err := a.drive.SharedWithMe(ctx)
	if err != nil {
		a.log.Printf("sharedWithMe: %v", err)
		return a.sharedList
	}
	var out []model.Skill
	for _, f := range files {
		name := skills.Slug(f.Name)
		if _, err := os.Stat(filepath.Join(paths.UserSkillsDir(), name)); err == nil {
			continue // already imported
		}
		owner := f.Props["owner"]
		out = append(out, model.Skill{ID: "drive_" + f.ID, Name: f.Name, Description: "Shared with you by " + owner + ". Open it and choose Import to use it.",
			Version: f.Props["version"], Author: owner, Source: "shared", Triggers: []string{}, Files: []model.SkillFile{}, Examples: []model.SkillExample{},
			SharedWith: []model.Share{}, UpdatedAt: f.Modified})
	}
	a.sharedList, a.sharedAt = out, time.Now()
	return out
}

func (a *API) SkillsGet(id string) (*model.Skill, error) {
	if strings.HasPrefix(id, "drive_") {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		files, folder, err := a.drive.DownloadSkillFolder(ctx, strings.TrimPrefix(id, "drive_"))
		if err != nil {
			return nil, err
		}
		sk := &model.Skill{ID: id, Name: folder.Name, Source: "shared", Author: folder.Props["owner"], Version: folder.Props["version"], Triggers: []string{},
			Examples: []model.SkillExample{}, SharedWith: []model.Share{}, UpdatedAt: folder.Modified}
		for rel, b := range files {
			sk.Files = append(sk.Files, model.SkillFile{Path: rel, Content: string(b)})
			if rel == "SKILL.md" {
				fm, _ := skills.ParseFrontmatter(string(b))
				sk.Description = fm.Description
			}
		}
		return sk, nil
	}
	return a.skills.Get(id)
}

func (a *API) SkillsSave(in skills.SaveInput) (*model.Skill, error) { return a.skills.Save(in) }
func (a *API) SkillsDelete(id string) error                        { return a.skills.Delete(id) }

// SkillsEvaluate streams results on "skills:eval:<id>" and returns when done.
func (a *API) SkillsEvaluate(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	err := a.skills.Evaluate(ctx, id, func(ev model.EvalEvent) { a.emit("skills:eval:"+id, ev) })
	a.emit("skills:eval:"+id, model.EvalEvent{Done: true})
	return err
}

func (a *API) SkillsImprove(id string) (*model.Skill, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()
	return a.skills.Improve(ctx, id)
}

func (a *API) SkillsVersions(id string) ([]model.SkillVersion, error) { return a.skills.Versions(id) }
func (a *API) SkillsRollback(id, version string) (*model.Skill, error) {
	return a.skills.Rollback(id, version)
}

func (a *API) uploadSkill(ctx context.Context, id string) (string, *model.Skill, error) {
	sk, err := a.skills.Get(id)
	if err != nil {
		return "", nil, err
	}
	files := map[string][]byte{}
	for _, f := range sk.Files {
		files[f.Path] = []byte(f.Content)
	}
	owner := ""
	if acc := a.eng.AuthStatus(); acc != nil {
		owner = acc.Email
	}
	folderID, err := a.drive.UploadSkillFolder(ctx, skills.Slug(sk.Name), files, map[string]string{"version": sk.Version, "owner": owner})
	if err != nil {
		return "", nil, err
	}
	return folderID, sk, nil
}

func (a *API) SkillsShare(id, email, permission string) (model.Share, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	folderID, sk, err := a.uploadSkill(ctx, id)
	if err != nil {
		return model.Share{}, err
	}
	if err := a.drive.ShareWith(ctx, folderID, email, "reader"); err != nil {
		return model.Share{}, err
	}
	share := model.Share{Email: email, Permission: permission, SharedAt: store.Now()}
	shares := append([]model.Share(nil), sk.SharedWith...)
	replaced := false
	for i := range shares {
		if strings.EqualFold(shares[i].Email, email) {
			shares[i] = share
			replaced = true
		}
	}
	if !replaced {
		shares = append(shares, share)
	}
	return share, a.skills.SetShares(id, shares, folderID)
}

func (a *API) SkillsRevoke(id, email string) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	m, err := a.skills.Meta(id)
	if err != nil {
		return err
	}
	if m.DriveFolderID != "" {
		if err := a.drive.Revoke(ctx, m.DriveFolderID, email); err != nil {
			return err
		}
	}
	var keep []model.Share
	for _, s := range m.SharedWith {
		if !strings.EqualFold(s.Email, email) {
			keep = append(keep, s)
		}
	}
	if keep == nil {
		keep = []model.Share{}
	}
	return a.skills.SetShares(id, keep, "")
}

func (a *API) SkillsShareLink(id string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	folderID, _, err := a.uploadSkill(ctx, id)
	if err != nil {
		return "", err
	}
	link, err := a.drive.ShareLink(ctx, folderID)
	if err != nil {
		return "", err
	}
	m, _ := a.skills.Meta(id)
	_ = a.skills.SetShares(id, m.SharedWith, folderID)
	return link, nil
}

func (a *API) SkillsImportFromLink(link string) (*model.Skill, error) {
	folderID := drive.FolderIDFromLink(link)
	if strings.HasPrefix(link, "drive_") {
		folderID = strings.TrimPrefix(link, "drive_")
	}
	if folderID == "" {
		return nil, errors.New("that does not look like a Google Drive share link")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	files, folder, err := a.drive.DownloadSkillFolder(ctx, folderID)
	if err != nil {
		return nil, err
	}
	var list []model.SkillFile
	for rel, b := range files {
		list = append(list, model.SkillFile{Path: rel, Content: string(b)})
	}
	if len(list) == 0 {
		return nil, errors.New("the shared folder is empty")
	}
	a.sharedMu.Lock()
	a.sharedAt = time.Time{}
	a.sharedMu.Unlock()
	return a.skills.Install(folder.Name, "shared", folder.Props["owner"], folder.Props["version"], list, nil, "")
}

// GitHubImport mirrors frontend/src/bridge/types.ts GitHubImport.
type GitHubImport struct {
	Skills       []model.Skill `json:"skills"`
	Plugin       string        `json:"plugin,omitempty"`
	LinkedSkills []string      `json:"linkedSkills,omitempty"`
	FixedAgents  []string      `json:"fixedAgents,omitempty"`
	Notes        []string      `json:"notes,omitempty"`
}

// SkillsImportFromGitHub adapts a public GitHub repository: a plugin goes
// through `agy plugin install` and is then fixed up for the CLI; loose
// SKILL.md folders become acquired skills. See skills.ParseGitHubRef for
// the accepted forms.
func (a *API) SkillsImportFromGitHub(repo string) (GitHubImport, error) {
	// Download plus `agy plugin install` of a large repository can run for
	// several minutes on a slow link.
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	res, err := a.skills.ImportFromGitHub(ctx, repo)
	out := GitHubImport{Skills: []model.Skill{}}
	if res == nil {
		return out, err
	}
	for _, sk := range res.Skills {
		out.Skills = append(out.Skills, *sk)
	}
	out.Plugin = res.Plugin
	out.LinkedSkills = res.Adapt.LinkedSkills
	out.FixedAgents = res.Adapt.FixedAgents
	out.Notes = res.Adapt.Notes
	return out, err
}

// ---------------------------------------------------------------------------
// marketplace
// ---------------------------------------------------------------------------

func (a *API) ctxShort() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 45*time.Second)
}

func (a *API) MarketSearch(q string, o market.SearchOpts) (model.SearchResult, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.Search(ctx, q, o)
}
func (a *API) MarketFeatured() ([]model.Listing, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.Featured(ctx)
}
func (a *API) MarketGet(id string) (model.Listing, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.Get(ctx, id)
}
func (a *API) MarketReviews(id string) ([]model.Review, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.Reviews(ctx, id)
}
func (a *API) MarketReview(id string, rating int, text string) (model.Review, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.Review(ctx, id, rating, text)
}
func (a *API) MarketInstall(id string) (*model.Skill, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	return a.market.Install(ctx, id)
}
func (a *API) MarketUninstall(id string) error { return a.market.Uninstall(id) }
func (a *API) MarketCheckUpdates() ([]model.UpdateAvailable, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.CheckUpdates(ctx)
}
func (a *API) MarketPublish(skillID string, in market.PublishInput) (model.Listing, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.Publish(ctx, skillID, in)
}
func (a *API) MarketUnpublish(id string) error {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.Unpublish(ctx, id)
}
func (a *API) MarketMyListings() ([]model.Listing, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.MyListings(ctx)
}
func (a *API) MarketRequests(filter string) ([]model.SkillRequest, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.Requests(ctx, filter)
}
func (a *API) MarketCreateRequest(in market.RequestInput) (model.SkillRequest, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.CreateRequest(ctx, in)
}
func (a *API) MarketReplyRequest(id, text, listingID string) (model.SkillRequest, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.ReplyRequest(ctx, id, text, listingID)
}
func (a *API) MarketFulfillRequest(id string) (model.SkillRequest, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.FulfillRequest(ctx, id)
}
func (a *API) MarketNotifications() ([]model.Notification, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.market.Notifications(ctx)
}
func (a *API) MarketMarkRead(ids []string) error { return a.market.MarkRead(ids) }

// ---------------------------------------------------------------------------
// sync
// ---------------------------------------------------------------------------

func (a *API) SyncStatus() model.SyncStatus { return a.sync.Status() }

// SyncConnectDrive connects Google Drive the simplest way available:
//
//  1. a Google Drive for Desktop folder on this machine (or another synced
//     folder): nothing to register, the user just confirms; Anchor creates
//     the visible Anchor/ folder inside it;
//  2. otherwise the Drive API, when the build carries an OAuth client id;
//  3. otherwise an error telling the user to install Drive for Desktop or
//     choose a synced folder (SyncChooseFolder).
func (a *API) SyncConnectDrive() (model.SyncStatus, error) {
	cands := folderdrive.Candidates()
	// Only Google Drive is taken without asking: the button says Google
	// Drive. Other clouds found on the machine are offered, not assumed.
	if gd, ok := folderdrive.GoogleDrive(cands); ok {
		return a.useFolder(gd.Path)
	}
	if a.drive.Configured() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		if _, err := a.drive.Connect(ctx); err != nil {
			return a.sync.Status(), err
		}
		// The visible Anchor folder exists from the first connect, so the
		// user sees where their sessions will go before anything is published.
		if _, err := a.drive.RootFolder(ctx); err != nil {
			a.log.Printf("drive: create Anchor folder: %v", err)
		}
		a.sync.SetDrive(a.drive, "api", "", "")
		go func() { _, _ = a.sync.SyncNow(context.Background()) }()
		return a.sync.Status(), nil
	}
	msg := "DRIVE_NOT_FOUND: Google Drive for Desktop is not installed on this computer. Install it from https://www.google.com/drive/download/ and sign in, then click Connect again"
	if len(cands) > 0 {
		var names []string
		for _, c := range cands {
			names = append(names, c.Label)
		}
		msg += " — or use " + strings.Join(names, " / ") + " found on this computer"
	}
	return a.sync.Status(), errors.New(msg + ", or choose any folder your cloud client keeps in sync.")
}

// SyncUseFolder points Anchor at a detected synced folder (see
// SyncFolderCandidates) or any folder path.
func (a *API) SyncUseFolder(path string) (model.SyncStatus, error) {
	if strings.TrimSpace(path) == "" {
		return a.sync.Status(), errors.New("no folder given")
	}
	return a.useFolder(path)
}

// SyncChooseFolder lets the user point Anchor at a synced folder by hand.
func (a *API) SyncChooseFolder() (model.SyncStatus, error) {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose the folder your Google Drive (or other cloud) client keeps in sync", DefaultDirectory: paths.Home()})
	if err != nil {
		return a.sync.Status(), err
	}
	if path == "" {
		return a.sync.Status(), nil
	}
	return a.useFolder(path)
}

// SyncFolderCandidates lists synced folders detected on this machine.
func (a *API) SyncFolderCandidates() []folderdrive.Candidate {
	c := folderdrive.Candidates()
	if c == nil {
		c = []folderdrive.Candidate{}
	}
	return c
}

func (a *API) useFolder(path string) (model.SyncStatus, error) {
	a.folder.SetRoot(path)
	if err := a.folder.Ensure(); err != nil {
		a.folder.SetRoot("")
		return a.sync.Status(), fmt.Errorf("cannot create the Anchor folder in %s: %w", path, err)
	}
	if err := a.st.SetSettings(map[string]any{"syncFolder": path}); err != nil {
		return a.sync.Status(), err
	}
	a.sync.SetDrive(a.folder, "folder", path, folderdrive.KindOf(path))
	a.emit("sync:status", a.sync.Status())
	go func() { _, _ = a.sync.SyncNow(context.Background()) }()
	return a.sync.Status(), nil
}

// SyncAvailable lists sessions other devices published to Drive that this
// device has not pulled.
func (a *API) SyncAvailable() ([]model.RemoteSession, error) {
	ctx, cancel := a.ctxShort()
	defer cancel()
	return a.sync.Available(ctx)
}

// SyncPull fetches one published session as a local replica.
func (a *API) SyncPull(sessionID string) (model.Session, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	return a.sync.Pull(ctx, sessionID)
}

func (a *API) SyncDisconnectDrive() error {
	var err error
	if a.folder.Connected() {
		a.folder.SetRoot("")
		err = a.st.SetSettings(map[string]any{"syncFolder": ""})
		a.sync.SetDrive(a.drive, "api", "", "")
	} else {
		err = a.drive.Disconnect()
	}
	a.emit("sync:status", a.sync.Status())
	return err
}

func (a *API) SyncNow() (model.SyncStatus, error) {
	if !a.sync.Status().DriveConnected {
		return a.sync.Status(), errors.New("DRIVE_NOT_CONNECTED: connect Google Drive first")
	}
	return a.sync.SyncNow(context.Background())
}

func (a *API) SyncConflicts() []model.Conflict { return a.sync.Conflicts() }

func (a *API) SyncResolveConflict(sessionID, as string) error { return a.sync.Resolve(sessionID, as) }

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

func (a *API) SettingsGet() map[string]any {
	s := a.st.Settings()
	s["version"] = a.version
	s["anchorDir"] = paths.AnchorDir()
	s["driveConfigured"] = a.drive.Configured()
	s["syncFolder"] = a.folder.Root()
	s["marketIndexUrlDefault"] = market.DefaultIndexURL
	if _, ok := s["telemetryEnabled"]; !ok {
		s["telemetryEnabled"] = true
	}
	return s
}

func (a *API) SettingsSet(patch map[string]any) error {
	if err := a.st.SetSettings(patch); err != nil {
		return err
	}
	if _, ok := patch["telemetryEnabled"]; ok {
		a.eng.Shutdown()
	}
	if v, ok := patch["cliPath"].(string); ok {
		a.loc.SetOverride(v)
		a.eng.Shutdown()
	}
	if _, ok := patch["cacheClearedAt"]; ok {
		a.eng.Shutdown()
	}
	return nil
}

var _ = fmt.Sprintf
