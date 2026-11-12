package engine

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/Majidul17068/anchor/internal/paths"
)

// Current Antigravity CLI builds keep the sign-in in the OS keyring
// (macOS Keychain service "gemini") and no longer write google_accounts.json
// or oauth_creds.json. The one place they still state the signed-in account
// is their own log, on every process start:
//
//	I1112 15:45:01 ... server_oauth.go:221] applyAuthResult: email=<email>, authMethod=consumer
//
// So the account email is taken from, in order: the legacy files when
// present, then the newest CLI log. Whether the user is signed in at all is
// never decided from these; that comes from the CLI answering session/new.

var applyAuthRe = regexp.MustCompile(`applyAuthResult: email=([^,\s]+)`)

const cliLogLookback = 24 * time.Hour

// emailFromCLILogs returns the account the newest recent CLI log reports.
func emailFromCLILogs() string {
	dir := filepath.Join(paths.CLIDataDir(), "log")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}
	type logFile struct {
		path string
		mod  time.Time
	}
	var logs []logFile
	cutoff := time.Now().Add(-cliLogLookback)
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), "cli-") || !strings.HasSuffix(e.Name(), ".log") {
			continue
		}
		info, err := e.Info()
		if err != nil || info.ModTime().Before(cutoff) {
			continue
		}
		logs = append(logs, logFile{filepath.Join(dir, e.Name()), info.ModTime()})
	}
	sort.Slice(logs, func(i, j int) bool { return logs[i].mod.After(logs[j].mod) })
	for i, l := range logs {
		if i >= 12 {
			break
		}
		f, err := os.Open(l.path)
		if err != nil {
			continue
		}
		b, _ := io.ReadAll(io.LimitReader(f, 8<<20))
		f.Close()
		if m := applyAuthRe.FindAllSubmatch(b, -1); len(m) > 0 {
			return string(m[len(m)-1][1])
		}
	}
	return ""
}

// The Antigravity CLI keeps its Google sign-in in two files under ~/.gemini:
//
//   google_accounts.json  {"active": "<email>", "old": [...]}
//   oauth_creds.json      the OAuth token set, including an OpenID id_token
//
// Anchor never writes tokens. It reads the id_token for the profile Google
// already attached to the sign-in (display name, picture) and, on sign-out,
// removes both files so the CLI and Anchor forget the account together.

func oauthCredsFile() string { return filepath.Join(paths.GeminiDir(), "oauth_creds.json") }

// googleProfile is the subset of OpenID claims Anchor shows.
type googleProfile struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// readGoogleProfile decodes the id_token payload from oauth_creds.json. The
// signature is not verified: the file is the CLI's own credential store on
// the local disk, and nothing here grants access based on its contents.
func readGoogleProfile() (*googleProfile, error) {
	b, err := os.ReadFile(oauthCredsFile())
	if err != nil {
		return nil, err
	}
	var creds struct {
		IDToken string `json:"id_token"`
	}
	if err := json.Unmarshal(b, &creds); err != nil {
		return nil, err
	}
	return decodeIDToken(creds.IDToken)
}

func decodeIDToken(tok string) (*googleProfile, error) {
	parts := strings.Split(tok, ".")
	if len(parts) != 3 {
		return nil, errors.New("id_token is not a JWT")
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(parts[1], "="))
	if err != nil {
		return nil, err
	}
	var p googleProfile
	if err := json.Unmarshal(payload, &p); err != nil {
		return nil, err
	}
	if p.Email == "" {
		return nil, errors.New("id_token carries no email claim")
	}
	return &p, nil
}

// clearCLICredentials signs the Antigravity CLI out: the token file is
// removed and the active account is moved to the "old" list, which is the
// shape the CLI itself writes after its own logout.
func clearCLICredentials() error {
	var firstErr error
	if err := os.Remove(oauthCredsFile()); err != nil && !errors.Is(err, os.ErrNotExist) {
		firstErr = err
	}
	path := paths.GoogleAccountsFile()
	b, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return firstErr
		}
		return err
	}
	var v struct {
		Active string   `json:"active"`
		Old    []string `json:"old"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	if v.Active != "" {
		seen := false
		for _, o := range v.Old {
			if o == v.Active {
				seen = true
				break
			}
		}
		if !seen {
			v.Old = append(v.Old, v.Active)
		}
		v.Active = ""
	}
	if v.Old == nil {
		v.Old = []string{}
	}
	out, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, out, 0o600); err != nil {
		return err
	}
	return firstErr
}
