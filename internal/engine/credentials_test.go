package engine

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Majidul17068/anchor/internal/paths"
)

func fakeJWT(t *testing.T, claims map[string]any) string {
	t.Helper()
	hdr := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
	body, _ := json.Marshal(claims)
	return hdr + "." + base64.RawURLEncoding.EncodeToString(body) + ".sig"
}

func TestDecodeIDTokenReadsProfileClaims(t *testing.T) {
	tok := fakeJWT(t, map[string]any{
		"email": "someone@example.com", "name": "Some One", "picture": "https://img/x=s96-c",
	})
	p, err := decodeIDToken(tok)
	if err != nil {
		t.Fatal(err)
	}
	if p.Name != "Some One" || p.Picture != "https://img/x=s96-c" || p.Email != "someone@example.com" {
		t.Fatalf("got %+v", p)
	}
}

func TestDecodeIDTokenRejectsGarbage(t *testing.T) {
	for _, tok := range []string{"", "abc", "a.b", "a.!!!.c"} {
		if _, err := decodeIDToken(tok); err == nil {
			t.Fatalf("%q decoded without error", tok)
		}
	}
	// A well-formed token with no email is not a usable profile.
	if _, err := decodeIDToken(fakeJWT(t, map[string]any{"name": "x"})); err == nil {
		t.Fatal("token without email decoded")
	}
}

func TestEmailFromCLILogsTakesTheNewestReport(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("GEMINI_DIR", dir)
	logs := filepath.Join(dir, "antigravity-cli", "log")
	if err := os.MkdirAll(logs, 0o755); err != nil {
		t.Fatal(err)
	}
	if emailFromCLILogs() != "" {
		t.Fatal("empty log dir should yield no email")
	}
	write := func(name, body string, age time.Duration) {
		p := filepath.Join(logs, name)
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
		at := time.Now().Add(-age)
		_ = os.Chtimes(p, at, at)
	}
	write("cli-20261111_100000.log", "I1111 ... applyAuthResult: email=old@example.com, authMethod=consumer\n", 3*time.Hour)
	write("cli-20261112_150000.log", "W1112 ... You are not logged into Antigravity.\n", 2*time.Minute)
	write("cli-20261112_154500.log", "x\nI1112 ... applyAuthResult: email=new@example.com, authMethod=consumer\n", time.Minute)
	if got := emailFromCLILogs(); got != "new@example.com" {
		t.Fatalf("got %q", got)
	}
	// A log older than the lookback is ignored even when it is the only one.
	_ = os.Remove(filepath.Join(logs, "cli-20261112_154500.log"))
	write("cli-20261111_100000.log", "applyAuthResult: email=stale@example.com, authMethod=consumer\n", 48*time.Hour)
	if got := emailFromCLILogs(); got != "" {
		t.Fatalf("stale log used: %q", got)
	}
}

func TestClearCLICredentialsForgetsTheAccount(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("GEMINI_DIR", dir)

	accounts := filepath.Join(dir, "google_accounts.json")
	if err := os.WriteFile(accounts, []byte(`{"active":"a@b.c","old":["z@b.c"]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "oauth_creds.json"), []byte(`{"id_token":"x"}`), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := clearCLICredentials(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "oauth_creds.json")); !os.IsNotExist(err) {
		t.Fatal("oauth_creds.json still exists")
	}
	if activeEmail() != "" {
		t.Fatalf("active email still %q", activeEmail())
	}
	b, _ := os.ReadFile(paths.GoogleAccountsFile())
	var v struct {
		Old []string `json:"old"`
	}
	_ = json.Unmarshal(b, &v)
	if len(v.Old) != 2 || v.Old[1] != "a@b.c" {
		t.Fatalf("old list = %v", v.Old)
	}

	// Idempotent: a second sign-out with nothing to clear is not an error.
	if err := clearCLICredentials(); err != nil {
		t.Fatal(err)
	}
}
