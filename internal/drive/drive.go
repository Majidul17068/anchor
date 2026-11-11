// Package drive connects Anchor to the user's own Google Drive: OAuth 2.0
// with PKCE on a loopback redirect, the hidden appDataFolder for sync, and
// a visible "Anchor" folder for skills shared with other Google accounts.
//
// No Anchor server is involved. The OAuth client id/secret identify the
// Anchor application to Google; for installed apps Google documents that
// the secret is not treated as confidential.
package drive

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	gdrive "google.golang.org/api/drive/v3"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"

	"github.com/Majidul17068/anchor/internal/paths"
	"github.com/Majidul17068/anchor/internal/store"
)

// Set at build time: -ldflags "-X .../internal/drive.BuildClientID=... -X .../internal/drive.BuildClientSecret=..."
var (
	BuildClientID     string
	BuildClientSecret string
)

var Scopes = []string{
	gdrive.DriveAppdataScope,
	gdrive.DriveFileScope,
	"https://www.googleapis.com/auth/userinfo.email",
}

const (
	appFolderName    = "Anchor"
	sharedFolderName = "Shared skills"
	PropSkill        = "anchorSkill"
	PropKind         = "anchorKind"
)

type Service struct {
	st      *store.Store
	logf    func(string, ...any)
	openURL func(string)
	mu      sync.Mutex
	client  *gdrive.Service
}

type savedToken struct {
	oauth2.Token
	Email string `json:"email"`
}

func New(st *store.Store, openURL func(string), logf func(string, ...any)) *Service {
	if logf == nil {
		logf = func(string, ...any) {}
	}
	return &Service{st: st, logf: logf, openURL: openURL}
}

func (s *Service) tokenPath() string { return filepath.Join(paths.AnchorDir(), "drive-token.json") }

func (s *Service) credentials() (id, secret string) {
	set := s.st.Settings()
	id, _ = set["driveClientId"].(string)
	secret, _ = set["driveClientSecret"].(string)
	if id == "" {
		id = os.Getenv("ANCHOR_GOOGLE_CLIENT_ID")
		secret = os.Getenv("ANCHOR_GOOGLE_CLIENT_SECRET")
	}
	if id == "" {
		id, secret = BuildClientID, BuildClientSecret
	}
	return id, secret
}

// Configured reports whether an OAuth client id is available.
func (s *Service) Configured() bool {
	id, _ := s.credentials()
	return id != ""
}

func (s *Service) config(redirect string) (*oauth2.Config, error) {
	id, secret := s.credentials()
	if id == "" {
		return nil, errors.New("DRIVE_NOT_CONFIGURED: Google Drive sync needs an OAuth client id. Add driveClientId (and driveClientSecret) in Settings, or build Anchor with one.")
	}
	return &oauth2.Config{ClientID: id, ClientSecret: secret, Endpoint: google.Endpoint, RedirectURL: redirect, Scopes: Scopes}, nil
}

func (s *Service) loadToken() (*savedToken, error) {
	b, err := os.ReadFile(s.tokenPath())
	if err != nil {
		return nil, err
	}
	var t savedToken
	if err := json.Unmarshal(b, &t); err != nil {
		return nil, err
	}
	if t.RefreshToken == "" && t.AccessToken == "" {
		return nil, errors.New("empty token")
	}
	return &t, nil
}

func (s *Service) saveToken(t *savedToken) error {
	b, _ := json.MarshalIndent(t, "", "  ")
	return os.WriteFile(s.tokenPath(), b, 0o600)
}

func (s *Service) Connected() bool {
	_, err := s.loadToken()
	return err == nil
}

func (s *Service) Email() string {
	t, err := s.loadToken()
	if err != nil {
		return ""
	}
	return t.Email
}

func (s *Service) Disconnect() error {
	s.mu.Lock()
	s.client = nil
	s.mu.Unlock()
	err := os.Remove(s.tokenPath())
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func randomString(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// Connect runs the browser consent flow and stores the token.
func (s *Service) Connect(ctx context.Context) (string, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	defer ln.Close()
	redirect := fmt.Sprintf("http://%s/callback", ln.Addr().String())
	cfg, err := s.config(redirect)
	if err != nil {
		return "", err
	}
	verifier := randomString(48)
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	state := randomString(16)

	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/callback" {
			http.NotFound(w, r)
			return
		}
		q := r.URL.Query()
		if q.Get("state") != state {
			http.Error(w, "state mismatch", http.StatusBadRequest)
			errCh <- errors.New("OAuth state mismatch")
			return
		}
		if e := q.Get("error"); e != "" {
			fmt.Fprintf(w, "<html><body style='font-family:sans-serif'><h2>Google Drive was not connected</h2><p>%s</p><p>You can close this tab.</p></body></html>", e)
			errCh <- errors.New("Google returned: " + e)
			return
		}
		fmt.Fprint(w, "<html><body style='font-family:sans-serif;text-align:center;padding-top:60px'><h2>Google Drive connected to Anchor</h2><p>You can close this tab and return to Anchor.</p></body></html>")
		codeCh <- q.Get("code")
	})}
	go func() { _ = srv.Serve(ln) }()
	defer srv.Close()

	url := cfg.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce,
		oauth2.SetAuthURLParam("code_challenge", challenge), oauth2.SetAuthURLParam("code_challenge_method", "S256"))
	if s.openURL != nil {
		s.openURL(url)
	}
	var code string
	select {
	case code = <-codeCh:
	case err := <-errCh:
		return "", err
	case <-ctx.Done():
		return "", errors.New("sign-in timed out")
	case <-time.After(10 * time.Minute):
		return "", errors.New("sign-in timed out")
	}
	tok, err := cfg.Exchange(ctx, code, oauth2.SetAuthURLParam("code_verifier", verifier))
	if err != nil {
		return "", fmt.Errorf("token exchange failed: %w", err)
	}
	email := s.fetchEmail(ctx, cfg, tok)
	if err := s.saveToken(&savedToken{Token: *tok, Email: email}); err != nil {
		return "", err
	}
	s.mu.Lock()
	s.client = nil
	s.mu.Unlock()
	return email, nil
}

func (s *Service) fetchEmail(ctx context.Context, cfg *oauth2.Config, tok *oauth2.Token) string {
	hc := cfg.Client(ctx, tok)
	resp, err := hc.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	var v struct {
		Email string `json:"email"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&v)
	return v.Email
}

// persistingSource saves refreshed tokens back to disk.
type persistingSource struct {
	s    *Service
	base oauth2.TokenSource
	last *savedToken
}

func (p *persistingSource) Token() (*oauth2.Token, error) {
	t, err := p.base.Token()
	if err != nil {
		return nil, err
	}
	if p.last == nil || t.AccessToken != p.last.AccessToken {
		email := ""
		if p.last != nil {
			email = p.last.Email
		}
		p.last = &savedToken{Token: *t, Email: email}
		_ = p.s.saveToken(p.last)
	}
	return t, nil
}

// Client returns an authenticated Drive client.
func (s *Service) Client(ctx context.Context) (*gdrive.Service, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.client != nil {
		return s.client, nil
	}
	tok, err := s.loadToken()
	if err != nil {
		return nil, errors.New("DRIVE_NOT_CONNECTED: connect Google Drive in Sync settings")
	}
	cfg, err := s.config("")
	if err != nil {
		return nil, err
	}
	src := &persistingSource{s: s, base: cfg.TokenSource(context.Background(), &tok.Token), last: tok}
	cl, err := gdrive.NewService(ctx, option.WithTokenSource(oauth2.ReuseTokenSource(nil, src)))
	if err != nil {
		return nil, err
	}
	s.client = cl
	return cl, nil
}

// ---------------------------------------------------------------------------
// appDataFolder helpers
// ---------------------------------------------------------------------------

type File struct {
	ID       string
	Name     string
	Size     int64
	Modified string
	Props    map[string]string
}

func fromAPI(f *gdrive.File) File {
	return File{ID: f.Id, Name: f.Name, Size: f.Size, Modified: f.ModifiedTime, Props: f.AppProperties}
}

func escape(s string) string { return strings.ReplaceAll(s, "'", `\'`) }

// ListApp lists files in appDataFolder whose name starts with prefix.
func (s *Service) ListApp(ctx context.Context, prefix string) ([]File, error) {
	cl, err := s.Client(ctx)
	if err != nil {
		return nil, err
	}
	q := "'appDataFolder' in parents and trashed = false"
	if prefix != "" {
		q += fmt.Sprintf(" and name contains '%s'", escape(prefix))
	}
	var out []File
	pageToken := ""
	for {
		call := cl.Files.List().Spaces("appDataFolder").Q(q).Fields("nextPageToken, files(id, name, size, modifiedTime, appProperties)").PageSize(200)
		if pageToken != "" {
			call = call.PageToken(pageToken)
		}
		res, err := call.Context(ctx).Do()
		if err != nil {
			return nil, err
		}
		for _, f := range res.Files {
			if prefix == "" || strings.HasPrefix(f.Name, prefix) {
				out = append(out, fromAPI(f))
			}
		}
		if res.NextPageToken == "" {
			break
		}
		pageToken = res.NextPageToken
	}
	return out, nil
}

// PutApp creates or replaces a file by name in appDataFolder.
func (s *Service) PutApp(ctx context.Context, name string, props map[string]string, content []byte) (File, error) {
	cl, err := s.Client(ctx)
	if err != nil {
		return File{}, err
	}
	existing, err := s.ListApp(ctx, name)
	if err != nil {
		return File{}, err
	}
	for _, f := range existing {
		if f.Name == name {
			meta := &gdrive.File{AppProperties: props}
			res, err := cl.Files.Update(f.ID, meta).Media(bytes.NewReader(content)).Fields("id, name, size, modifiedTime, appProperties").Context(ctx).Do()
			if err != nil {
				return File{}, err
			}
			return fromAPI(res), nil
		}
	}
	meta := &gdrive.File{Name: name, Parents: []string{"appDataFolder"}, AppProperties: props, MimeType: "application/json"}
	res, err := cl.Files.Create(meta).Media(bytes.NewReader(content)).Fields("id, name, size, modifiedTime, appProperties").Context(ctx).Do()
	if err != nil {
		return File{}, err
	}
	return fromAPI(res), nil
}

func (s *Service) Get(ctx context.Context, id string) ([]byte, error) {
	cl, err := s.Client(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := cl.Files.Get(id).Context(ctx).Download()
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func (s *Service) Delete(ctx context.Context, id string) error {
	cl, err := s.Client(ctx)
	if err != nil {
		return err
	}
	err = cl.Files.Delete(id).Context(ctx).Do()
	var ge *googleapi.Error
	if errors.As(err, &ge) && ge.Code == 404 {
		return nil
	}
	return err
}

// ---------------------------------------------------------------------------
// visible folder for sharing skills
// ---------------------------------------------------------------------------

func (s *Service) folder(ctx context.Context, name, parent string) (string, error) {
	cl, err := s.Client(ctx)
	if err != nil {
		return "", err
	}
	q := fmt.Sprintf("name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false", escape(name))
	if parent != "" {
		q += fmt.Sprintf(" and '%s' in parents", parent)
	}
	res, err := cl.Files.List().Q(q).Fields("files(id)").Context(ctx).Do()
	if err != nil {
		return "", err
	}
	if len(res.Files) > 0 {
		return res.Files[0].Id, nil
	}
	f := &gdrive.File{Name: name, MimeType: "application/vnd.google-apps.folder"}
	if parent != "" {
		f.Parents = []string{parent}
	}
	created, err := cl.Files.Create(f).Fields("id").Context(ctx).Do()
	if err != nil {
		return "", err
	}
	return created.Id, nil
}

// SharedSkillsFolder returns the id of Anchor/Shared skills, creating it.
func (s *Service) SharedSkillsFolder(ctx context.Context) (string, error) {
	root, err := s.folder(ctx, appFolderName, "")
	if err != nil {
		return "", err
	}
	return s.folder(ctx, sharedFolderName, root)
}

// UploadSkillFolder mirrors a skill directory into Drive as a folder with
// one file per skill file, tagged so other Anchor installs recognise it.
func (s *Service) UploadSkillFolder(ctx context.Context, skillName string, files map[string][]byte, props map[string]string) (string, error) {
	cl, err := s.Client(ctx)
	if err != nil {
		return "", err
	}
	parent, err := s.SharedSkillsFolder(ctx)
	if err != nil {
		return "", err
	}
	folderID, err := s.folder(ctx, skillName, parent)
	if err != nil {
		return "", err
	}
	p := map[string]string{PropSkill: "true"}
	for k, v := range props {
		p[k] = v
	}
	if _, err := cl.Files.Update(folderID, &gdrive.File{AppProperties: p}).Context(ctx).Do(); err != nil {
		return "", err
	}
	existing, _ := cl.Files.List().Q(fmt.Sprintf("'%s' in parents and trashed = false", folderID)).Fields("files(id, name)").Context(ctx).Do()
	byName := map[string]string{}
	if existing != nil {
		for _, f := range existing.Files {
			byName[f.Name] = f.Id
		}
	}
	for rel, content := range files {
		name := strings.ReplaceAll(rel, "/", "__")
		if id, ok := byName[name]; ok {
			if _, err := cl.Files.Update(id, &gdrive.File{}).Media(bytes.NewReader(content)).Context(ctx).Do(); err != nil {
				return "", err
			}
			continue
		}
		f := &gdrive.File{Name: name, Parents: []string{folderID}, MimeType: "text/plain", AppProperties: map[string]string{"anchorPath": rel}}
		if _, err := cl.Files.Create(f).Media(bytes.NewReader(content)).Context(ctx).Do(); err != nil {
			return "", err
		}
	}
	return folderID, nil
}

func (s *Service) ShareWith(ctx context.Context, fileID, email, role string) error {
	cl, err := s.Client(ctx)
	if err != nil {
		return err
	}
	if role == "" {
		role = "reader"
	}
	_, err = cl.Permissions.Create(fileID, &gdrive.Permission{Type: "user", Role: role, EmailAddress: email}).SendNotificationEmail(true).Context(ctx).Do()
	return err
}

func (s *Service) Revoke(ctx context.Context, fileID, email string) error {
	cl, err := s.Client(ctx)
	if err != nil {
		return err
	}
	res, err := cl.Permissions.List(fileID).Fields("permissions(id, emailAddress)").Context(ctx).Do()
	if err != nil {
		return err
	}
	for _, p := range res.Permissions {
		if strings.EqualFold(p.EmailAddress, email) {
			return cl.Permissions.Delete(fileID, p.Id).Context(ctx).Do()
		}
	}
	return nil
}

// ShareLink makes the folder readable by anyone with the link.
func (s *Service) ShareLink(ctx context.Context, fileID string) (string, error) {
	cl, err := s.Client(ctx)
	if err != nil {
		return "", err
	}
	if _, err := cl.Permissions.Create(fileID, &gdrive.Permission{Type: "anyone", Role: "reader"}).Context(ctx).Do(); err != nil {
		return "", err
	}
	f, err := cl.Files.Get(fileID).Fields("webViewLink").Context(ctx).Do()
	if err != nil {
		return "", err
	}
	return f.WebViewLink, nil
}

// SharedWithMe lists skill folders other Anchor users shared with this account.
func (s *Service) SharedWithMe(ctx context.Context) ([]File, error) {
	cl, err := s.Client(ctx)
	if err != nil {
		return nil, err
	}
	res, err := cl.Files.List().Q(fmt.Sprintf("sharedWithMe = true and trashed = false and appProperties has { key='%s' and value='true' }", PropSkill)).
		Fields("files(id, name, modifiedTime, appProperties, owners(emailAddress))").Context(ctx).Do()
	if err != nil {
		return nil, err
	}
	var out []File
	for _, f := range res.Files {
		file := fromAPI(f)
		if len(f.Owners) > 0 {
			if file.Props == nil {
				file.Props = map[string]string{}
			}
			file.Props["owner"] = f.Owners[0].EmailAddress
		}
		out = append(out, file)
	}
	return out, nil
}

// DownloadSkillFolder fetches every file in a shared skill folder.
func (s *Service) DownloadSkillFolder(ctx context.Context, folderID string) (map[string][]byte, File, error) {
	cl, err := s.Client(ctx)
	if err != nil {
		return nil, File{}, err
	}
	folder, err := cl.Files.Get(folderID).Fields("id, name, modifiedTime, appProperties").SupportsAllDrives(true).Context(ctx).Do()
	if err != nil {
		return nil, File{}, err
	}
	res, err := cl.Files.List().Q(fmt.Sprintf("'%s' in parents and trashed = false", folderID)).Fields("files(id, name, appProperties)").Context(ctx).Do()
	if err != nil {
		return nil, File{}, err
	}
	files := map[string][]byte{}
	for _, f := range res.Files {
		b, err := s.Get(ctx, f.Id)
		if err != nil {
			return nil, File{}, err
		}
		rel := f.AppProperties["anchorPath"]
		if rel == "" {
			rel = strings.ReplaceAll(f.Name, "__", "/")
		}
		files[rel] = b
	}
	return files, fromAPI(folder), nil
}

// FolderIDFromLink extracts a Drive id from a share link.
func FolderIDFromLink(link string) string {
	link = strings.TrimSpace(link)
	for _, marker := range []string{"/folders/", "/d/", "id="} {
		if i := strings.Index(link, marker); i >= 0 {
			rest := link[i+len(marker):]
			if j := strings.IndexAny(rest, "?/&#"); j >= 0 {
				rest = rest[:j]
			}
			return rest
		}
	}
	if !strings.Contains(link, "/") && len(link) > 10 {
		return link
	}
	return ""
}
