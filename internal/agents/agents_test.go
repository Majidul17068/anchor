package agents

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Majidul17068/anchor/internal/cli"
)

// A saved agent must never carry a commandExecutionPolicy the CLI rejects,
// and files written by older Anchor versions ("ask") are repaired on the
// next listing so `agy agents` sees them again.
func TestSaveOmitsPolicyAndListRepairsOldFiles(t *testing.T) {
	t.Setenv("GEMINI_DIR", t.TempDir())
	t.Setenv("ANCHOR_HOME", t.TempDir())
	s := New(cli.NewLocator(filepath.Join(t.TempDir(), "no-agy")))

	a, err := s.Save(SaveInput{Name: "Paper Reviewer", Description: "Reviews papers", Instructions: "Be strict.", ModelID: "gemini-3.8-flash", Effort: "medium", Tools: []string{"view_file"}})
	if err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(filepath.Join(os.Getenv("GEMINI_DIR"), "config", "agents", "paper-reviewer.md"))
	if strings.Contains(string(b), "commandExecutionPolicy") {
		t.Fatalf("saved file carries a policy the CLI rejects:\n%s", b)
	}
	if !strings.Contains(string(b), "name: paper-reviewer") || !strings.Contains(string(b), "model: gemini-3.8-flash") {
		t.Fatalf("unexpected file:\n%s", b)
	}
	if a.ID != "mine:paper-reviewer" {
		t.Fatalf("id = %q", a.ID)
	}

	// An old file with "ask" is rewritten without it.
	old := "---\nname: reviewer\ndescription: old\ntools:\n  - view_file\nmainAgent: true\nsubagent: true\ncommandExecutionPolicy: ask\n---\n\nReview.\n"
	oldPath := filepath.Join(os.Getenv("GEMINI_DIR"), "config", "agents", "reviewer.md")
	if err := os.WriteFile(oldPath, []byte(old), 0o644); err != nil {
		t.Fatal(err)
	}
	list, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	var mine []string
	for _, a := range list {
		if a.Source == "mine" {
			mine = append(mine, a.Name)
		}
	}
	if len(mine) != 2 {
		t.Fatalf("want 2 agents of mine, got %v", mine)
	}
	b, _ = os.ReadFile(oldPath)
	if strings.Contains(string(b), "commandExecutionPolicy") {
		t.Fatalf("old file not repaired:\n%s", b)
	}
	if !strings.Contains(string(b), "Review.") {
		t.Fatalf("repair lost the body:\n%s", b)
	}
	// The locator may still find a real agy on this machine (it looks in
	// the usual places); only without one is "discovered" known to be true.
	if _, hasCLI := s.loc.Find(); !hasCLI {
		for _, a := range list {
			if !a.Discovered {
				t.Fatalf("without a CLI, agents must not be flagged as hidden: %+v", a)
			}
		}
	}

	// Export carries the file for sharing; InstallFile brings it back under
	// the given name, policy stripped.
	name, content, err := s.Export("mine:paper-reviewer")
	if err != nil || name != "paper-reviewer.md" {
		t.Fatalf("export: %v %q", err, name)
	}
	in, err := s.InstallFile("Shared Reviewer.md", strings.Replace(content, "---\n\n", "commandExecutionPolicy: ask\n---\n\n", 1))
	if err != nil {
		t.Fatal(err)
	}
	if in.ID != "mine:shared-reviewer" {
		t.Fatalf("installed id = %q", in.ID)
	}
	b, _ = os.ReadFile(filepath.Join(os.Getenv("GEMINI_DIR"), "config", "agents", "shared-reviewer.md"))
	if strings.Contains(string(b), "commandExecutionPolicy") || !strings.Contains(string(b), "name: shared-reviewer") {
		t.Fatalf("installed file wrong:\n%s", b)
	}
}
