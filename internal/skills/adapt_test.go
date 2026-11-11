package skills

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFixClaudeAgentFrontmatter(t *testing.T) {
	in := "---\nname: synthesis-agent\ndescription: \"Integrates findings\"\nmodel: inherit\ntools: Read, Write, Edit, Grep, Glob\n---\n\n# Body\n\ntools: untouched in body\n"
	out, changed, err := FixClaudeAgentFrontmatter(in)
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Fatal("expected a change")
	}
	for _, want := range []string{"tools:\n  - view_file\n  - write_to_file\n  - replace_file_content\n  - grep_search\n  - find_by_name\n", "name: synthesis-agent\n", "model: inherit\n", "\n# Body\n\ntools: untouched in body\n"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in:\n%s", want, out)
		}
	}
	// Idempotent.
	again, changed2, err := FixClaudeAgentFrontmatter(out)
	if err != nil || changed2 || again != out {
		t.Fatalf("second pass changed=%v err=%v", changed2, err)
	}
}

func TestFixClaudeAgentFrontmatterDropsUnknownTools(t *testing.T) {
	out, changed, err := FixClaudeAgentFrontmatter("---\nname: x\ntools: Task, Foo\n---\nbody\n")
	if err != nil || !changed {
		t.Fatalf("changed=%v err=%v", changed, err)
	}
	if strings.Contains(out, "tools") {
		t.Fatalf("tools key should be removed when nothing maps:\n%s", out)
	}
	// No frontmatter: untouched.
	if _, ch, _ := FixClaudeAgentFrontmatter("# plain\n"); ch {
		t.Fatal("plain markdown should not change")
	}
}

func TestPluginDirFromInstallOutput(t *testing.T) {
	out := "  [ok]    academic-research-skills\n          ✔ agents : 4 installed\n          Installed to /Users/x/.gemini/config/plugins/academic-research-skills\n"
	if got := PluginDirFromInstallOutput(out); got != "/Users/x/.gemini/config/plugins/academic-research-skills" {
		t.Fatalf("got %q", got)
	}
	if got := PluginDirFromInstallOutput("nothing"); got != "" {
		t.Fatalf("got %q", got)
	}
	// A reinstall appends a note after the path.
	re := "          Installed to /Users/x/.gemini/config/plugins/academic-research-skills (replaced existing installation)\n"
	if got := PluginDirFromInstallOutput(re); got != "/Users/x/.gemini/config/plugins/academic-research-skills" {
		t.Fatalf("reinstall: got %q", got)
	}
}

func TestAdaptPluginLinksSkillsAndFixesAgents(t *testing.T) {
	src := t.TempDir()
	installed := t.TempDir()
	write := func(root, rel, body string) {
		p := filepath.Join(root, rel)
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write(src, ".claude-plugin/plugin.json", `{"name":"ars","skills":["./academic-paper","./missing"]}`)
	write(installed, "plugin.json", `{"name":"ars"}`)
	write(installed, "academic-paper/SKILL.md", "---\nname: academic-paper\n---\nuses ../shared/x.md\n")
	write(installed, "shared/x.md", "shared")
	write(installed, "deep-research/SKILL.md", "---\nname: deep-research\n---\n") // not in manifest, still a skill
	write(installed, "skills/ars-cmd-plan/SKILL.md", "converted command")
	write(installed, "agents/synth.md", "---\nname: synth\ntools: Read, Grep\n---\nbody\n")
	write(installed, "agents/ok.md", "---\nname: ok\ntools:\n  - view_file\n---\nbody\n")

	rep, err := AdaptPlugin(installed, src)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(rep.LinkedSkills, ",") != "academic-paper,deep-research" {
		t.Fatalf("linked = %v", rep.LinkedSkills)
	}
	if strings.Join(rep.FixedAgents, ",") != "synth" {
		t.Fatalf("fixed = %v", rep.FixedAgents)
	}
	// The exposed skill resolves through to the original folder, so its
	// ../shared reference still works, and Anchor's reader follows it.
	files, err := readFiles(filepath.Join(installed, "skills", "academic-paper"))
	if err != nil || len(files) != 1 || files[0].Path != "SKILL.md" {
		t.Fatalf("files=%+v err=%v", files, err)
	}
	// Only meaningful for the symlink strategy: the kernel resolves `..`
	// against the link target, so ../shared from inside the exposed skill
	// is the plugin's shared/ folder. (filepath.Join would clean the `..`
	// lexically, so resolve the link first.)
	exposed := filepath.Join(installed, "skills", "academic-paper")
	if runtime_isSymlink(exposed) {
		real, err := filepath.EvalSymlinks(exposed)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := os.Stat(filepath.Join(real, "..", "shared", "x.md")); err != nil {
			t.Fatalf("../shared no longer resolves from the exposed skill: %v", err)
		}
	}
	b, _ := os.ReadFile(filepath.Join(installed, "agents", "synth.md"))
	if !strings.Contains(string(b), "- view_file\n  - grep_search") {
		t.Fatalf("agent not fixed:\n%s", b)
	}

	// Second run: nothing to do.
	rep2, err := AdaptPlugin(installed, src)
	if err != nil || len(rep2.LinkedSkills) != 0 || len(rep2.FixedAgents) != 0 {
		t.Fatalf("second run rep=%+v err=%v", rep2, err)
	}
}

func runtime_isSymlink(p string) bool {
	st, err := os.Lstat(p)
	return err == nil && st.Mode()&os.ModeSymlink != 0
}
