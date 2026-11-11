package skills

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
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
		hdr := &tar.Header{Name: "repo-abc123/" + e.name, Mode: 0o644, Size: int64(len(b)), Typeflag: typ}
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

func TestBundlesFromTarballFindsEverySkillFolder(t *testing.T) {
	buf := archive(t,
		entry{name: "README.md", body: "# repo"},
		entry{name: "skills/pdf/SKILL.md", body: "---\nname: pdf\ndescription: PDFs\n---\n# pdf"},
		entry{name: "skills/pdf/scripts/fill.py", body: "print('x')"},
		entry{name: "skills/pdf/.hidden", body: "nope"},
		entry{name: "skills/xlsx/skill.md", body: "---\nname: xlsx\n---\n"},
		entry{name: "skills/xlsx/logo.png", content: []byte{0xff, 0xd8, 0x00, 0x01}},
		entry{name: "skills/xlsx/link", typ: tar.TypeSymlink},
		entry{name: "node_modules/x/SKILL.md", body: "junk"},
	)
	bundles, _, _, err := bundlesFromTarball(buf, "")
	if err != nil {
		t.Fatal(err)
	}
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
	// lower-case skill.md is normalised; binary and symlink are dropped.
	if got := strings.Join(paths(xlsx), ","); got != "SKILL.md" {
		t.Fatalf("xlsx files = %s", got)
	}
}

func TestBundlesFromTarballSubdirAndNesting(t *testing.T) {
	buf := archive(t,
		entry{name: "a/SKILL.md", body: "a"},
		entry{name: "a/notes.md", body: "n"},
		entry{name: "a/inner/SKILL.md", body: "inner"},
		entry{name: "a/inner/x.txt", body: "x"},
		entry{name: "b/SKILL.md", body: "b"},
	)
	bundles, _, _, err := bundlesFromTarball(buf, "a")
	if err != nil {
		t.Fatal(err)
	}
	if len(bundles) != 2 || bundles[0].Dir != "a" || bundles[1].Dir != "a/inner" {
		t.Fatalf("bundles = %+v", bundles)
	}
	// a's files must not include a/inner's.
	for _, f := range bundles[0].Files {
		if strings.HasPrefix(f.Path, "inner/") {
			t.Fatalf("outer bundle swallowed nested skill file %s", f.Path)
		}
	}
	if len(bundles[1].Files) != 2 {
		t.Fatalf("inner files = %+v", bundles[1].Files)
	}
}

func TestBundlesFromTarballFallsBackToReadme(t *testing.T) {
	buf := archive(t,
		entry{name: "README.md", body: "# Tool\n\n[![badge](x)](y)\n\nDoes a useful thing\nfor people.\n\n## Install\n"},
		entry{name: "docs/guide.md", body: "guide"},
		entry{name: "main.go", body: "package main"},
	)
	bundles, readme, docs, err := bundlesFromTarball(buf, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(bundles) != 0 || readme == "" {
		t.Fatalf("bundles=%d readme=%q", len(bundles), readme)
	}
	if len(docs) != 1 || docs[0].Path != "docs/guide.md" {
		t.Fatalf("docs = %+v", docs)
	}
	files := synthesiseSkill("tool", "github.com/o/tool", readme, docs)
	fm, _ := ParseFrontmatter(files[0].Content)
	if fm.Name != "tool" || fm.Description != "Does a useful thing for people." {
		t.Fatalf("frontmatter = %+v", fm)
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
