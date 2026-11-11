package skills

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseGitHubRef(t *testing.T) {
	cases := []struct {
		in   string
		want GitHubRef
		err  bool
	}{
		{"anthropics/skills", GitHubRef{Owner: "anthropics", Repo: "skills"}, false},
		{"github.com/anthropics/skills", GitHubRef{Owner: "anthropics", Repo: "skills"}, false},
		{"https://github.com/anthropics/skills", GitHubRef{Owner: "anthropics", Repo: "skills"}, false},
		{"https://github.com/anthropics/skills.git", GitHubRef{Owner: "anthropics", Repo: "skills"}, false},
		{"git@github.com:anthropics/skills.git", GitHubRef{Owner: "anthropics", Repo: "skills"}, false},
		{"https://github.com/imbad0202/academic-research-skills", GitHubRef{Owner: "imbad0202", Repo: "academic-research-skills"}, false},
		{"https://github.com/anthropics/skills/tree/main/skills/pdf", GitHubRef{Owner: "anthropics", Repo: "skills", Ref: "main", Subdir: "skills/pdf"}, false},
		{"https://github.com/anthropics/skills/tree/v1.2", GitHubRef{Owner: "anthropics", Repo: "skills", Ref: "v1.2"}, false},
		{"https://gitlab.com/a/b", GitHubRef{}, true},
		{"anthropics", GitHubRef{}, true},
		{"https://github.com/a/b/issues/3", GitHubRef{}, true},
		{"https://github.com/a/b/tree/main/../../etc", GitHubRef{}, true},
		{"a b/c", GitHubRef{}, true},
		{"", GitHubRef{}, true},
	}
	for _, c := range cases {
		got, err := ParseGitHubRef(c.in)
		if (err != nil) != c.err {
			t.Errorf("%q: err=%v, want err=%v", c.in, err, c.err)
			continue
		}
		if !c.err && got != c.want {
			t.Errorf("%q: got %+v want %+v", c.in, got, c.want)
		}
	}
}

type entry struct {
	name    string
	body    string
	typ     byte
	mode    int64
	content []byte
}

func archive(t *testing.T, entries ...entry) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for _, e := range entries {
		typ := e.typ
		if typ == 0 {
			typ = tar.TypeReg
		}
		b := e.content
		if b == nil {
			b = []byte(e.body)
		}
		mode := e.mode
		if mode == 0 {
			mode = 0o644
		}
		hdr := &tar.Header{Name: "repo-abc123/" + e.name, Mode: mode, Size: int64(len(b)), Typeflag: typ}
		if typ == tar.TypeSymlink {
			hdr.Linkname = "/etc/passwd"
			hdr.Size = 0
			b = nil
		}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatal(err)
		}
		if len(b) > 0 {
			if _, err := tw.Write(b); err != nil {
				t.Fatal(err)
			}
		}
	}
	tw.Close()
	gz.Close()
	return &buf
}

func extractAndRead(t *testing.T, buf *bytes.Buffer, subdir string) (string, map[string]string) {
	t.Helper()
	dir := t.TempDir()
	if err := extractTarball(buf, dir); err != nil {
		t.Fatal(err)
	}
	files, err := readTextFiles(dir, subdir)
	if err != nil {
		t.Fatal(err)
	}
	return dir, files
}

func TestExtractTarballIsSafeAndKeepsExecBit(t *testing.T) {
	buf := archive(t,
		entry{name: "hooks/run.sh", body: "#!/bin/sh\n", mode: 0o755},
		entry{name: "a/b.txt", body: "b"},
		entry{name: "../escape.txt", body: "no"},
		entry{name: "link", typ: tar.TypeSymlink},
	)
	dir := t.TempDir()
	if err := extractTarball(buf, dir); err != nil {
		t.Fatal(err)
	}
	st, err := os.Stat(filepath.Join(dir, "hooks", "run.sh"))
	if err != nil || st.Mode()&0o100 == 0 {
		t.Fatalf("hook script not executable: %v %v", st, err)
	}
	if _, err := os.Stat(filepath.Join(dir, "a", "b.txt")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Lstat(filepath.Join(dir, "link")); err == nil {
		t.Fatal("symlink was extracted")
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(dir), "escape.txt")); err == nil {
		t.Fatal("path escaped the extraction root")
	}
}

func TestBundlesFindEverySkillFolder(t *testing.T) {
	buf := archive(t,
		entry{name: "README.md", body: "# repo"},
		entry{name: "skills/pdf/SKILL.md", body: "---\nname: pdf\ndescription: PDFs\n---\n# pdf"},
		entry{name: "skills/pdf/scripts/fill.py", body: "print('x')"},
		entry{name: "skills/pdf/.hidden", body: "nope"},
		entry{name: "skills/xlsx/skill.md", body: "---\nname: xlsx\n---\n"},
		entry{name: "skills/xlsx/logo.png", content: []byte{0xff, 0xd8, 0x00, 0x01}},
		entry{name: "node_modules/x/SKILL.md", body: "junk"},
	)
	dir, files := extractAndRead(t, buf, "")
	if IsPluginSource(dir) {
		t.Fatal("loose skills misdetected as a plugin")
	}
	bundles, _, _ := bundlesFromFiles(files, "")
	if len(bundles) != 2 {
		t.Fatalf("got %d bundles: %+v", len(bundles), bundles)
	}
	pdf, xlsx := bundles[0], bundles[1]
	if pdf.Dir != "skills/pdf" || xlsx.Dir != "skills/xlsx" {
		t.Fatalf("dirs: %q %q", pdf.Dir, xlsx.Dir)
	}
	paths := func(b bundle) []string {
		var p []string
		for _, f := range b.Files {
			p = append(p, f.Path)
		}
		return p
	}
	if got := strings.Join(paths(pdf), ","); got != "SKILL.md,scripts/fill.py" {
		t.Fatalf("pdf files = %s", got)
	}
	// lower-case skill.md is normalised; the binary is dropped.
	if got := strings.Join(paths(xlsx), ","); got != "SKILL.md" {
		t.Fatalf("xlsx files = %s", got)
	}
}

func TestBundlesSubdirAndNesting(t *testing.T) {
	buf := archive(t,
		entry{name: "a/SKILL.md", body: "a"},
		entry{name: "a/notes.md", body: "n"},
		entry{name: "a/inner/SKILL.md", body: "inner"},
		entry{name: "a/inner/x.txt", body: "x"},
		entry{name: "b/SKILL.md", body: "b"},
	)
	_, files := extractAndRead(t, buf, "a")
	bundles, _, _ := bundlesFromFiles(files, "a")
	if len(bundles) != 2 || bundles[0].Dir != "a" || bundles[1].Dir != "a/inner" {
		t.Fatalf("bundles = %+v", bundles)
	}
	for _, f := range bundles[0].Files {
		if strings.HasPrefix(f.Path, "inner/") {
			t.Fatalf("outer bundle swallowed nested skill file %s", f.Path)
		}
	}
	if len(bundles[1].Files) != 2 {
		t.Fatalf("inner files = %+v", bundles[1].Files)
	}
}

func TestBundlesFallBackToReadme(t *testing.T) {
	buf := archive(t,
		entry{name: "README.md", body: "# Tool\n\n[![badge](x)](y)\n\nDoes a useful thing\nfor people.\n\n## Install\n"},
		entry{name: "docs/guide.md", body: "guide"},
		entry{name: "main.go", body: "package main"},
	)
	_, files := extractAndRead(t, buf, "")
	bundles, readme, docs := bundlesFromFiles(files, "")
	if len(bundles) != 0 || readme == "" {
		t.Fatalf("bundles=%d readme=%q", len(bundles), readme)
	}
	if len(docs) != 1 || docs[0].Path != "docs/guide.md" {
		t.Fatalf("docs = %+v", docs)
	}
	out := synthesiseSkill("tool", "github.com/o/tool", readme, docs)
	fm, _ := ParseFrontmatter(out[0].Content)
	if fm.Name != "tool" || fm.Description != "Does a useful thing for people." {
		t.Fatalf("frontmatter = %+v", fm)
	}
}

func TestClaudePluginIsDetected(t *testing.T) {
	buf := archive(t,
		entry{name: ".claude-plugin/plugin.json", body: `{"name":"ars","skills":["./academic-paper"]}`},
		entry{name: "academic-paper/SKILL.md", body: "---\nname: academic-paper\n---\n"},
	)
	dir, _ := extractAndRead(t, buf, "")
	if !IsPluginSource(dir) {
		t.Fatal("Claude Code plugin not detected")
	}
}

func TestStripRootRejectsEscapes(t *testing.T) {
	for _, bad := range []string{"repo-x/../../etc/passwd", "repo-x", "repo-x/.."} {
		if got := stripRoot(bad); got != "" {
			t.Errorf("stripRoot(%q) = %q, want empty", bad, got)
		}
	}
	if got := stripRoot("repo-x/a/b.md"); got != "a/b.md" {
		t.Errorf("got %q", got)
	}
}
