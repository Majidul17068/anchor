package skills

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

func newService(t *testing.T) *Service {
	t.Helper()
	t.Setenv("ANCHOR_HOME", t.TempDir())
	t.Setenv("GEMINI_DIR", t.TempDir())
	st, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	return New(st, nil, func() string { return "Tester" })
}

func TestSaveCreatesFolderWithFrontmatter(t *testing.T) {
	s := newService(t)
	sk, err := s.Save(SaveInput{Name: "PR Reviewer", Description: "Reviews pull requests carefully", Triggers: []string{"review"},
		Files: []model.SkillFile{{Path: "SKILL.md", Content: "# PR Reviewer\n\nDo the review.\n"}}})
	if err != nil {
		t.Fatal(err)
	}
	if sk.ID != "skill_pr-reviewer" || sk.Source != "mine" || sk.Version != "1.0.0" {
		t.Fatalf("unexpected skill: %+v", sk)
	}
	b, err := os.ReadFile(filepath.Join(os.Getenv("GEMINI_DIR"), "config", "skills", "pr-reviewer", "SKILL.md"))
	if err != nil {
		t.Fatal(err)
	}
	fm, body := ParseFrontmatter(string(b))
	if fm.Name != "pr-reviewer" || fm.Description != "Reviews pull requests carefully" || len(fm.Triggers) != 1 {
		t.Fatalf("bad frontmatter: %+v", fm)
	}
	if body == "" || body[0] != '#' {
		t.Fatalf("body lost: %q", body)
	}
}

func TestSaveBumpsVersionAndRollbackRestores(t *testing.T) {
	s := newService(t)
	first, err := s.Save(SaveInput{Name: "notes", Description: "Keeps notes tidy and short", Files: []model.SkillFile{{Path: "SKILL.md", Content: "# v1\n"}}})
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.Save(SaveInput{ID: first.ID, Name: "notes", Description: "Keeps notes tidy and short", Files: []model.SkillFile{{Path: "SKILL.md", Content: "# v2\n"}, {Path: "scripts/run.sh", Content: "echo hi\n"}}})
	if err != nil {
		t.Fatal(err)
	}
	if second.Version != "1.0.1" || len(second.Files) != 2 {
		t.Fatalf("unexpected second save: %+v", second)
	}
	versions, _ := s.Versions(first.ID)
	if len(versions) < 2 {
		t.Fatalf("want history, got %+v", versions)
	}
	rolled, err := s.Rollback(first.ID, "1.0.0")
	if err != nil {
		t.Fatal(err)
	}
	var skillMD string
	for _, f := range rolled.Files {
		if f.Path == "SKILL.md" {
			skillMD = f.Content
		}
	}
	if !contains(skillMD, "# v1") {
		t.Fatalf("rollback did not restore v1 content: %q", skillMD)
	}
	if len(rolled.Files) != 1 {
		t.Fatalf("rollback should drop files added later, got %+v", rolled.Files)
	}
}

func TestInstallMarksAcquired(t *testing.T) {
	s := newService(t)
	sk, err := s.Install("Shared Thing", "acquired", "Someone", "2.0.0", []model.SkillFile{{Path: "SKILL.md", Content: "---\nname: shared-thing\ndescription: d\n---\n# x\n"}}, nil, "someone/shared-thing")
	if err != nil {
		t.Fatal(err)
	}
	if sk.ID != "skill_acquired_shared-thing" || sk.Version != "2.0.0" {
		t.Fatalf("unexpected: %+v", sk)
	}
	if v := s.Installed()["someone/shared-thing"]; v != "2.0.0" {
		t.Fatalf("installed map wrong: %v", s.Installed())
	}
	list, _ := s.List()
	if len(list) != 1 || list[0].ID != sk.ID {
		t.Fatalf("list: %+v", list)
	}
}

func TestRejectsPathTraversal(t *testing.T) {
	s := newService(t)
	_, err := s.Save(SaveInput{Name: "bad", Description: "bad skill with traversal path", Files: []model.SkillFile{{Path: "SKILL.md", Content: "# b\n"}, {Path: "../escape.txt", Content: "x"}}})
	if err == nil {
		t.Fatal("expected error for path traversal")
	}
}

func contains(s, sub string) bool { return len(s) >= len(sub) && (s == sub || indexOf(s, sub) >= 0) }

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
