package skills

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// Adapting a Claude Code plugin for the Antigravity CLI.
//
// `agy plugin install <dir>` already converts most of a Claude Code plugin:
// commands become skills, hooks are rewritten, agents are copied. Two things
// it leaves behind, measured against academic-research-skills:
//
//   - Skills listed in .claude-plugin/plugin.json ("skills": ["./academic-paper"])
//     stay where they are, outside skills/, and the CLI never loads them.
//   - Claude agent frontmatter writes `tools: Read, Write, Grep` as one string
//     and names Claude's tools; the CLI wants a YAML list of its own tool
//     names and skips the agent otherwise.
//
// AdaptPlugin fixes both in the installed plugin directory.

// PluginInstaller runs the CLI's own converter on a plugin source directory
// and returns the directory it installed into.
type PluginInstaller func(dir string) (installedDir string, err error)

// "Installed to /path" on a fresh install; "Installed to /path (replaced
// existing installation)" on a reinstall. The path never contains " (".
var installedToRe = regexp.MustCompile(`(?m)Installed to (.+?)(?: \([^)]*\))?\s*$`)

// PluginDirFromInstallOutput finds the install location in `agy plugin
// install` output.
func PluginDirFromInstallOutput(out string) string {
	m := installedToRe.FindStringSubmatch(out)
	if m == nil {
		return ""
	}
	return strings.TrimSpace(m[1])
}

// claudeManifest is the subset of .claude-plugin/plugin.json Anchor reads.
type claudeManifest struct {
	Name   string   `json:"name"`
	Skills []string `json:"skills"`
}

// IsPluginSource reports whether a checked-out repository is a plugin in any
// format the CLI's installer understands, as opposed to loose SKILL.md folders.
func IsPluginSource(dir string) bool {
	for _, p := range []string{
		".claude-plugin/plugin.json", ".claude-plugin/marketplace.json",
		"plugin.json", ".antigravity-plugin/plugin.json", ".gemini-plugin/plugin.json",
	} {
		if st, err := os.Stat(filepath.Join(dir, p)); err == nil && !st.IsDir() {
			return true
		}
	}
	return false
}

func readClaudeManifest(dir string) claudeManifest {
	var m claudeManifest
	b, err := os.ReadFile(filepath.Join(dir, ".claude-plugin", "plugin.json"))
	if err != nil {
		return m
	}
	_ = json.Unmarshal(b, &m)
	return m
}

// AdaptReport says what AdaptPlugin changed, for the UI.
type AdaptReport struct {
	LinkedSkills []string
	FixedAgents  []string
	Notes        []string
}

// AdaptPlugin post-processes a plugin the CLI installed from the source at
// srcDir. It is idempotent: a second run finds nothing to do.
func AdaptPlugin(installedDir, srcDir string) (AdaptReport, error) {
	var rep AdaptReport
	if st, err := os.Stat(installedDir); err != nil || !st.IsDir() {
		return rep, fmt.Errorf("plugin directory %s does not exist", installedDir)
	}

	// 1. Skills the manifest lists, plus any top-level folder with a SKILL.md,
	//    must be reachable under skills/.
	wanted := map[string]bool{}
	for _, s := range readClaudeManifest(srcDir).Skills {
		s = filepath.Clean(filepath.FromSlash(strings.TrimPrefix(s, "./")))
		if s != "." && !strings.HasPrefix(s, "..") && !filepath.IsAbs(s) {
			wanted[s] = true
		}
	}
	entries, _ := os.ReadDir(installedDir)
	for _, e := range entries {
		if !e.IsDir() || e.Name() == "skills" || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		if _, err := os.Stat(filepath.Join(installedDir, e.Name(), "SKILL.md")); err == nil {
			wanted[e.Name()] = true
		}
	}
	var names []string
	for n := range wanted {
		names = append(names, n)
	}
	sort.Strings(names)
	skillsDir := filepath.Join(installedDir, "skills")
	for _, rel := range names {
		src := filepath.Join(installedDir, rel)
		if _, err := os.Stat(filepath.Join(src, "SKILL.md")); err != nil {
			continue
		}
		dst := filepath.Join(skillsDir, filepath.Base(rel))
		if _, err := os.Lstat(dst); err == nil {
			continue // already there, from the installer or an earlier run
		}
		if err := os.MkdirAll(skillsDir, 0o755); err != nil {
			return rep, err
		}
		if err := linkOrCopyDir(src, dst, rel); err != nil {
			return rep, fmt.Errorf("exposing skill %s: %w", rel, err)
		}
		rep.LinkedSkills = append(rep.LinkedSkills, filepath.Base(rel))
	}

	// 2. Agent frontmatter.
	agentsDir := filepath.Join(installedDir, "agents")
	agents, _ := os.ReadDir(agentsDir)
	for _, e := range agents {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		p := filepath.Join(agentsDir, e.Name())
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		fixed, changed, err := FixClaudeAgentFrontmatter(string(b))
		if err != nil {
			rep.Notes = append(rep.Notes, fmt.Sprintf("agent %s: %v", e.Name(), err))
			continue
		}
		if changed {
			if err := os.WriteFile(p, []byte(fixed), 0o644); err != nil {
				return rep, err
			}
			rep.FixedAgents = append(rep.FixedAgents, strings.TrimSuffix(e.Name(), ".md"))
		}
	}
	return rep, nil
}

// linkOrCopyDir prefers a relative symlink so that `../shared`-style
// references inside the skill keep resolving; Windows usually refuses
// symlinks without elevation, so the folder is copied there.
func linkOrCopyDir(src, dst, relFromPluginRoot string) error {
	if runtime.GOOS != "windows" {
		// dst is skills/<name>; the target is one level up from skills/.
		target := filepath.Join("..", filepath.ToSlash(relFromPluginRoot))
		if err := os.Symlink(target, dst); err == nil {
			return nil
		}
	}
	return copyDir(src, dst)
}

// claudeToolNames maps Claude Code's agent tool names onto the Antigravity
// CLI's. Names not listed here are dropped: an unknown name makes the CLI
// skip the agent, and an agent with no `tools` key keeps every tool, which
// is closer to what the author meant than losing the agent.
var claudeToolNames = map[string]string{
	"read":         "view_file",
	"write":        "write_to_file",
	"edit":         "replace_file_content",
	"multiedit":    "replace_file_content",
	"notebookedit": "replace_file_content",
	"grep":         "grep_search",
	"glob":         "find_by_name",
	"ls":           "list_dir",
	"bash":         "run_command",
	"webfetch":     "browser",
	"websearch":    "web_search",
}

// FixClaudeAgentFrontmatter rewrites a Claude Code agent's `tools:` entry
// into the YAML list of CLI tool names the Antigravity loader expects. The
// rest of the frontmatter and the body are left byte-for-byte.
func FixClaudeAgentFrontmatter(content string) (out string, changed bool, err error) {
	c := strings.ReplaceAll(content, "\r\n", "\n")
	if !strings.HasPrefix(c, "---\n") {
		return content, false, nil
	}
	end := strings.Index(c[4:], "\n---")
	if end < 0 {
		return content, false, nil
	}
	raw := c[4 : 4+end]
	rest := c[4+end:] // starts with "\n---"

	var doc yaml.Node
	if err := yaml.Unmarshal([]byte(raw), &doc); err != nil {
		return content, false, err
	}
	if doc.Kind != yaml.DocumentNode || len(doc.Content) == 0 || doc.Content[0].Kind != yaml.MappingNode {
		return content, false, nil
	}
	m := doc.Content[0]
	for i := 0; i+1 < len(m.Content); i += 2 {
		k, v := m.Content[i], m.Content[i+1]
		if k.Value != "tools" {
			continue
		}
		var names []string
		switch v.Kind {
		case yaml.ScalarNode:
			for _, part := range strings.Split(v.Value, ",") {
				names = append(names, strings.TrimSpace(part))
			}
		case yaml.SequenceNode:
			for _, n := range v.Content {
				names = append(names, strings.TrimSpace(n.Value))
			}
		default:
			return content, false, errors.New("unexpected tools value")
		}
		var mapped []string
		seen := map[string]bool{}
		for _, n := range names {
			if n == "" {
				continue
			}
			cli, ok := claudeToolNames[strings.ToLower(n)]
			if !ok {
				// Already a CLI name? Keep it.
				if strings.Contains(n, "_") {
					cli = n
				} else {
					continue
				}
			}
			if !seen[cli] {
				seen[cli] = true
				mapped = append(mapped, cli)
			}
		}
		already := v.Kind == yaml.SequenceNode && len(mapped) == len(names)
		if already {
			same := true
			for j, n := range names {
				if n != mapped[j] {
					same = false
					break
				}
			}
			if same {
				return content, false, nil
			}
		}
		if len(mapped) == 0 {
			m.Content = append(m.Content[:i], m.Content[i+2:]...)
		} else {
			seq := &yaml.Node{Kind: yaml.SequenceNode, Tag: "!!seq"}
			for _, n := range mapped {
				seq.Content = append(seq.Content, &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: n})
			}
			m.Content[i+1] = seq
		}
		var buf bytes.Buffer
		enc := yaml.NewEncoder(&buf)
		enc.SetIndent(2)
		if err := enc.Encode(&doc); err != nil {
			return content, false, err
		}
		_ = enc.Close()
		return "---\n" + strings.TrimRight(buf.String(), "\n") + rest, true, nil
	}
	return content, false, nil
}
