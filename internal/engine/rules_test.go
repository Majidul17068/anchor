package engine

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRulesBlockRoundTripPreservesUserContent(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("GEMINI_DIR", dir)
	own := "# My own notes\n\nAlways use tabs.\n"
	if err := os.WriteFile(filepath.Join(dir, "GEMINI.md"), []byte(own), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := WriteGlobalRules("Majidul Islam", "Reply in British English.\nNever delete files without asking."); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(filepath.Join(dir, "GEMINI.md"))
	s := string(b)
	if !strings.HasPrefix(s, own) {
		t.Fatalf("user content not preserved at top:\n%s", s)
	}
	if !strings.Contains(s, "from Majidul Islam") || !strings.Contains(s, "Never delete files without asking.") {
		t.Fatalf("rules missing:\n%s", s)
	}
	if got := ReadGlobalRules(); got != "Reply in British English.\nNever delete files without asking." {
		t.Fatalf("ReadGlobalRules = %q", got)
	}

	// Updating replaces the block in place rather than appending a second one.
	if err := WriteGlobalRules("Majidul Islam", "Be brief."); err != nil {
		t.Fatal(err)
	}
	b, _ = os.ReadFile(filepath.Join(dir, "GEMINI.md"))
	if strings.Count(string(b), rulesStart) != 1 || strings.Contains(string(b), "British") {
		t.Fatalf("block not replaced:\n%s", b)
	}

	// Clearing removes the block and leaves the user's text.
	if err := WriteGlobalRules("", ""); err != nil {
		t.Fatal(err)
	}
	b, _ = os.ReadFile(filepath.Join(dir, "GEMINI.md"))
	if strings.Contains(string(b), rulesStart) || !strings.Contains(string(b), "Always use tabs.") {
		t.Fatalf("clear went wrong:\n%s", b)
	}
}

func TestRulesOnEmptyFile(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("GEMINI_DIR", dir)
	if err := WriteGlobalRules("A", "Rule one."); err != nil {
		t.Fatal(err)
	}
	if got := ReadGlobalRules(); got != "Rule one." {
		t.Fatalf("got %q", got)
	}
}
