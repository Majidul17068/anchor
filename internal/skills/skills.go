// Package skills reads and writes Antigravity skills (folders with a
// SKILL.md) and keeps Anchor's extra metadata (versions, training examples,
// shares) beside them.
package skills

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"gopkg.in/yaml.v3"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
	"github.com/Majidul17068/anchor/internal/store"
)

// Runner executes a one-shot agent turn (implemented by the engine).
type Runner interface {
	RunOnce(ctx context.Context, cwd, prompt, mode string) (string, error)
}

type Meta struct {
	Name             string               `json:"name"`
	Kind             string               `json:"kind"` // mine | acquired | shared
	Version          string               `json:"version"`
	Author           string               `json:"author"`
	Triggers         []string             `json:"triggers"`
	Examples         []model.SkillExample `json:"examples"`
	SharedWith       []model.Share        `json:"sharedWith"`
	ListingID        string               `json:"listingId,omitempty"`
	InstalledVersion string               `json:"installedVersion,omitempty"`
	DriveFolderID    string               `json:"driveFolderId,omitempty"`
	UpdatedAt        string               `json:"updatedAt"`
	History          []model.SkillVersion `json:"history"`
}

type Service struct {
	st     *store.Store
	runner Runner
	author func() string
}

func New(st *store.Store, runner Runner, author func() string) *Service {
	return &Service{st: st, runner: runner, author: author}
}

const maxFileBytes = 256 * 1024

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func Slug(name string) string {
	s := slugRe.ReplaceAllString(strings.ToLower(strings.TrimSpace(name)), "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "skill"
	}
	return s
}

func idFor(kind, name string) string {
	switch kind {
	case "acquired":
		return "skill_acquired_" + name
	case "shared":
		return "skill_shared_" + name
	default:
		return "skill_" + name
	}
}

func idPlugin(plugin, name string) string { return "plugin_" + plugin + "_" + name }
func idBuiltin(name string) string        { return "builtin_" + name }

// Resolve maps a skill id back to its directory and source.
func (s *Service) Resolve(id string) (dir, source, name string, err error) {
	switch {
	case strings.HasPrefix(id, "skill_acquired_"):
		name = strings.TrimPrefix(id, "skill_acquired_")
		return filepath.Join(paths.UserSkillsDir(), name), "mine", name, nil
	case strings.HasPrefix(id, "skill_shared_"):
		name = strings.TrimPrefix(id, "skill_shared_")
		return filepath.Join(paths.UserSkillsDir(), name), "shared", name, nil
	case strings.HasPrefix(id, "skill_"):
		name = strings.TrimPrefix(id, "skill_")
		return filepath.Join(paths.UserSkillsDir(), name), "mine", name, nil
	case strings.HasPrefix(id, "plugin_"):
		rest := strings.TrimPrefix(id, "plugin_")
		entries, _ := os.ReadDir(paths.PluginsDir())
		for _, e := range entries {
			if strings.HasPrefix(rest, e.Name()+"_") {
				name = strings.TrimPrefix(rest, e.Name()+"_")
				return filepath.Join(paths.PluginsDir(), e.Name(), "skills", name), "plugin", name, nil
			}
		}
	case strings.HasPrefix(id, "builtin_"):
		name = strings.TrimPrefix(id, "builtin_")
		return filepath.Join(paths.BuiltinSkillsDir(), name), "builtin", name, nil
	}
	return "", "", "", errors.New("skill not found: " + id)
}

func (s *Service) meta(name string) Meta {
	var m Meta
	_ = s.st.ReadBlob(paths.SkillMetaDir(), name, &m)
	if m.Name == "" {
		m.Name = name
	}
	if m.Kind == "" {
		m.Kind = "mine"
	}
	if m.Version == "" {
		m.Version = "1.0.0"
	}
	if m.Triggers == nil {
		m.Triggers = []string{}
	}
	if m.Examples == nil {
		m.Examples = []model.SkillExample{}
	}
	if m.SharedWith == nil {
		m.SharedWith = []model.Share{}
	}
	return m
}

func (s *Service) saveMeta(m Meta) error {
	m.UpdatedAt = store.Now()
	return s.st.WriteBlob(paths.SkillMetaDir(), m.Name, m)
}

// Frontmatter of a SKILL.md.
type Frontmatter struct {
	Name        string   `yaml:"name"`
	Description string   `yaml:"description"`
	Triggers    []string `yaml:"triggers,omitempty"`
	Version     string   `yaml:"version,omitempty"`
	Author      string   `yaml:"author,omitempty"`
}

func ParseFrontmatter(content string) (Frontmatter, string) {
	var fm Frontmatter
	c := strings.ReplaceAll(content, "\r\n", "\n")
	if !strings.HasPrefix(c, "---\n") {
		return fm, c
	}
	end := strings.Index(c[4:], "\n---")
	if end < 0 {
		return fm, c
	}
	raw := c[4 : 4+end]
	body := strings.TrimLeft(c[4+end+4:], "\n")
	_ = yaml.Unmarshal([]byte(raw), &fm)
	return fm, body
}

func RenderFrontmatter(fm Frontmatter, body string) string {
	var b bytes.Buffer
	b.WriteString("---\n")
	enc := yaml.NewEncoder(&b)
	enc.SetIndent(2)
	_ = enc.Encode(fm)
	_ = enc.Close()
	b.WriteString("---\n\n")
	b.WriteString(strings.TrimLeft(body, "\n"))
	if !strings.HasSuffix(body, "\n") {
		b.WriteString("\n")
	}
	return b.String()
}

func readFiles(dir string) ([]model.SkillFile, error) {
	var files []model.SkillFile
	err := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(dir, p)
		if d.IsDir() {
			if rel != "." && strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(d.Name(), ".") {
			return nil
		}
		info, err := d.Info()
		if err != nil || info.Size() > maxFileBytes {
			return nil
		}
		b, err := os.ReadFile(p)
		if err != nil || !utf8.Valid(b) {
			return nil
		}
		files = append(files, model.SkillFile{Path: filepath.ToSlash(rel), Content: string(b)})
		return nil
	})
	sort.Slice(files, func(i, j int) bool {
		if files[i].Path == "SKILL.md" {
			return true
		}
		if files[j].Path == "SKILL.md" {
			return false
		}
		return files[i].Path < files[j].Path
	})
	return files, err
}

func (s *Service) load(dir, source, name, id string) (*model.Skill, error) {
	st, err := os.Stat(dir)
	if err != nil || !st.IsDir() {
		return nil, errors.New("skill not found: " + name)
	}
	files, err := readFiles(dir)
	if err != nil {
		return nil, err
	}
	var fm Frontmatter
	for _, f := range files {
		if f.Path == "SKILL.md" {
			fm, _ = ParseFrontmatter(f.Content)
			break
		}
	}
	sk := &model.Skill{ID: id, Name: name, Description: strings.TrimSpace(fm.Description), Source: source, Files: files,
		Triggers: []string{}, Examples: []model.SkillExample{}, SharedWith: []model.Share{}, Version: "1.0.0", UpdatedAt: st.ModTime().UTC().Format(time.RFC3339)}
	if fm.Name != "" {
		sk.Name = fm.Name
	}
	if fm.Version != "" {
		sk.Version = fm.Version
	}
	if fm.Author != "" {
		sk.Author = fm.Author
	}
	if len(fm.Triggers) > 0 {
		sk.Triggers = fm.Triggers
	}
	switch source {
	case "builtin":
		sk.Author = "Antigravity"
	case "plugin":
		if sk.Author == "" {
			sk.Author = "Plugin"
		}
	default:
		m := s.meta(name)
		sk.Version = m.Version
		if m.Author != "" {
			sk.Author = m.Author
		}
		if len(m.Triggers) > 0 {
			sk.Triggers = m.Triggers
		}
		sk.Examples = m.Examples
		sk.SharedWith = m.SharedWith
		if m.UpdatedAt != "" {
			sk.UpdatedAt = m.UpdatedAt
		}
		if m.Kind == "acquired" {
			sk.ID = idFor("acquired", name)
		} else if m.Kind == "shared" {
			sk.ID = idFor("shared", name)
			sk.Source = "shared"
		}
	}
	if sk.Author == "" {
		sk.Author = s.author()
	}
	return sk, nil
}

func (s *Service) List() ([]model.Skill, error) {
	var out []model.Skill
	addDir := func(root, source, plugin string) {
		entries, _ := os.ReadDir(root)
		for _, e := range entries {
			if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
				continue
			}
			if _, err := os.Stat(filepath.Join(root, e.Name(), "SKILL.md")); err != nil {
				continue
			}
			var id string
			switch source {
			case "plugin":
				id = idPlugin(plugin, e.Name())
			case "builtin":
				id = idBuiltin(e.Name())
			default:
				id = idFor(s.meta(e.Name()).Kind, e.Name())
			}
			if sk, err := s.load(filepath.Join(root, e.Name()), source, e.Name(), id); err == nil {
				out = append(out, *sk)
			}
		}
	}
	addDir(paths.UserSkillsDir(), "mine", "")
	plugins, _ := os.ReadDir(paths.PluginsDir())
	for _, p := range plugins {
		if p.IsDir() {
			addDir(filepath.Join(paths.PluginsDir(), p.Name(), "skills"), "plugin", p.Name())
		}
	}
	addDir(paths.BuiltinSkillsDir(), "builtin", "")
	if out == nil {
		out = []model.Skill{}
	}
	return out, nil
}

func (s *Service) Get(id string) (*model.Skill, error) {
	dir, source, name, err := s.Resolve(id)
	if err != nil {
		return nil, err
	}
	return s.load(dir, source, name, id)
}

type SaveInput struct {
	ID          string               `json:"id"`
	Name        string               `json:"name"`
	Description string               `json:"description"`
	Version     string               `json:"version"`
	Author      string               `json:"author"`
	Triggers    []string             `json:"triggers"`
	Files       []model.SkillFile    `json:"files"`
	Examples    []model.SkillExample `json:"examples"`
}

func bumpPatch(v string) string {
	parts := strings.Split(v, ".")
	for len(parts) < 3 {
		parts = append(parts, "0")
	}
	n, _ := strconv.Atoi(parts[2])
	parts[2] = strconv.Itoa(n + 1)
	return strings.Join(parts[:3], ".")
}

// Save writes a skill folder under the user skills dir, snapshotting the
// previous version first.
func (s *Service) Save(in SaveInput) (*model.Skill, error) {
	name := ""
	if in.ID != "" {
		_, source, n, err := s.Resolve(in.ID)
		if err == nil && (source == "mine" || source == "shared") {
			name = n
		} else if err == nil {
			return nil, errors.New("builtin and plugin skills are read-only; duplicate it into Mine first")
		}
	}
	if name == "" {
		name = Slug(in.Name)
	}
	dir := filepath.Join(paths.UserSkillsDir(), name)
	m := s.meta(name)
	existed := false
	if _, err := os.Stat(dir); err == nil {
		existed = true
		if err := s.snapshot(name, dir, m.Version, "Before edit"); err != nil {
			return nil, err
		}
		m.Version = bumpPatch(m.Version)
	} else if in.Version != "" {
		m.Version = in.Version
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	if in.Author != "" {
		m.Author = in.Author
	} else if m.Author == "" {
		m.Author = s.author()
	}
	if in.Triggers != nil {
		m.Triggers = in.Triggers
	}
	if in.Examples != nil {
		m.Examples = in.Examples
		for i := range m.Examples {
			if m.Examples[i].ID == "" {
				m.Examples[i].ID = fmt.Sprintf("ex_%d_%d", time.Now().UnixNano(), i)
			}
		}
	}
	displayName := strings.TrimSpace(in.Name)
	if displayName == "" {
		displayName = name
	}
	hasSkillMD := false
	for _, f := range in.Files {
		if f.Path == "SKILL.md" {
			hasSkillMD = true
		}
	}
	files := in.Files
	if !hasSkillMD {
		files = append([]model.SkillFile{{Path: "SKILL.md", Content: RenderFrontmatter(Frontmatter{Name: name, Description: in.Description}, "# "+displayName+"\n\nDescribe the procedure the agent should follow.\n")}}, files...)
	}
	// Rewrite existing files, delete ones removed in the editor.
	if existed {
		keep := map[string]bool{}
		for _, f := range files {
			keep[filepath.ToSlash(f.Path)] = true
		}
		_ = filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			rel, _ := filepath.Rel(dir, p)
			if !keep[filepath.ToSlash(rel)] && !strings.HasPrefix(d.Name(), ".") {
				_ = os.Remove(p)
			}
			return nil
		})
	}
	for _, f := range files {
		rel := filepath.Clean(filepath.FromSlash(f.Path))
		if rel == "." || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
			return nil, fmt.Errorf("invalid file path %q", f.Path)
		}
		content := f.Content
		if f.Path == "SKILL.md" {
			fm, body := ParseFrontmatter(content)
			fm.Name = name
			if in.Description != "" {
				fm.Description = in.Description
			}
			if len(m.Triggers) > 0 {
				fm.Triggers = m.Triggers
			}
			content = RenderFrontmatter(fm, body)
		}
		full := filepath.Join(dir, rel)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			return nil, err
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			return nil, err
		}
	}
	m.History = append(m.History, model.SkillVersion{Version: m.Version, At: store.Now(), Summary: "Saved in Anchor"})
	if err := s.saveMeta(m); err != nil {
		return nil, err
	}
	return s.load(dir, "mine", name, idFor(m.Kind, name))
}

func (s *Service) Delete(id string) error {
	dir, source, name, err := s.Resolve(id)
	if err != nil {
		return err
	}
	if source == "builtin" || source == "plugin" {
		return errors.New("builtin and plugin skills cannot be deleted from Anchor")
	}
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	_ = os.RemoveAll(filepath.Join(paths.SkillVersionsDir(), name))
	return s.st.DeleteBlob(paths.SkillMetaDir(), name)
}

func (s *Service) snapshot(name, dir, version, summary string) error {
	dst := filepath.Join(paths.SkillVersionsDir(), name, version)
	if _, err := os.Stat(dst); err == nil {
		return nil // already captured
	}
	if err := copyDir(dir, dst); err != nil {
		return err
	}
	return nil
}

func copyDir(src, dst string) error {
	return filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, p)
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		return os.WriteFile(target, b, 0o644)
	})
}

func (s *Service) Versions(id string) ([]model.SkillVersion, error) {
	_, source, name, err := s.Resolve(id)
	if err != nil {
		return nil, err
	}
	if source == "builtin" || source == "plugin" {
		return []model.SkillVersion{}, nil
	}
	m := s.meta(name)
	out := append([]model.SkillVersion(nil), m.History...)
	sort.Slice(out, func(i, j int) bool { return out[i].At > out[j].At })
	if out == nil {
		out = []model.SkillVersion{}
	}
	return out, nil
}

func (s *Service) Rollback(id, version string) (*model.Skill, error) {
	dir, source, name, err := s.Resolve(id)
	if err != nil {
		return nil, err
	}
	if source == "builtin" || source == "plugin" {
		return nil, errors.New("builtin and plugin skills cannot be rolled back")
	}
	snap := filepath.Join(paths.SkillVersionsDir(), name, version)
	if _, err := os.Stat(snap); err != nil {
		return nil, errors.New("no snapshot for version " + version)
	}
	m := s.meta(name)
	if err := s.snapshot(name, dir, m.Version, "Before rollback"); err != nil {
		return nil, err
	}
	if err := os.RemoveAll(dir); err != nil {
		return nil, err
	}
	if err := copyDir(snap, dir); err != nil {
		return nil, err
	}
	m.Version = bumpPatch(m.Version)
	m.History = append(m.History, model.SkillVersion{Version: m.Version, At: store.Now(), Summary: "Rolled back to " + version})
	if err := s.saveMeta(m); err != nil {
		return nil, err
	}
	return s.load(dir, "mine", name, idFor(m.Kind, name))
}

// Evaluate runs every training example through the agent with the skill
// loaded and asks a second turn to judge the result.
func (s *Service) Evaluate(ctx context.Context, id string, report func(model.EvalEvent)) error {
	if s.runner == nil {
		return errors.New("agent runner unavailable")
	}
	dir, source, name, err := s.Resolve(id)
	if err != nil {
		return err
	}
	if source == "builtin" || source == "plugin" {
		return errors.New("only your own skills can be trained")
	}
	m := s.meta(name)
	if len(m.Examples) == 0 {
		return errors.New("add at least one example before running an evaluation")
	}
	skillMD, _ := os.ReadFile(filepath.Join(dir, "SKILL.md"))
	for i := range m.Examples {
		ex := &m.Examples[i]
		if ctx.Err() != nil {
			return ctx.Err()
		}
		prompt := fmt.Sprintf("You must follow the skill defined in the folder %s. Read its SKILL.md first and apply it to this request. Reply with your final answer only.\n\nRequest:\n%s", dir, ex.Prompt)
		output, err := s.runner.RunOnce(ctx, dir, prompt, "plan")
		if err != nil {
			ex.LastResult = &model.ExampleResult{Pass: false, Output: "Run failed: " + err.Error()}
			report(model.EvalEvent{ExampleID: ex.ID, Pass: false, Output: ex.LastResult.Output})
			continue
		}
		judge := fmt.Sprintf("You are grading whether an AI response satisfies an expectation.\n\nSKILL (for context):\n%s\n\nREQUEST:\n%s\n\nEXPECTED BEHAVIOR:\n%s\n\nACTUAL RESPONSE:\n%s\n\nAnswer with exactly one line: PASS: <one sentence reason> or FAIL: <one sentence reason>.",
			truncate(string(skillMD), 6000), ex.Prompt, ex.Expected, truncate(output, 8000))
		verdict, jerr := s.runner.RunOnce(ctx, dir, judge, "plan")
		pass := false
		reason := strings.TrimSpace(verdict)
		if jerr != nil {
			reason = "Judge failed: " + jerr.Error()
		} else {
			upper := strings.ToUpper(reason)
			pass = strings.Contains(upper, "PASS") && !strings.HasPrefix(upper, "FAIL")
		}
		ex.LastResult = &model.ExampleResult{Pass: pass, Output: reason + "\n\n--- Response ---\n" + truncate(output, 4000)}
		report(model.EvalEvent{ExampleID: ex.ID, Pass: pass, Output: ex.LastResult.Output})
		_ = s.saveMeta(m)
	}
	return s.saveMeta(m)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "\n…(truncated)"
}

// Improve asks the agent to revise SKILL.md from failing examples.
func (s *Service) Improve(ctx context.Context, id string) (*model.Skill, error) {
	if s.runner == nil {
		return nil, errors.New("agent runner unavailable")
	}
	dir, source, name, err := s.Resolve(id)
	if err != nil {
		return nil, err
	}
	if source == "builtin" || source == "plugin" {
		return nil, errors.New("only your own skills can be improved")
	}
	m := s.meta(name)
	if err := s.snapshot(name, dir, m.Version, "Before improve"); err != nil {
		return nil, err
	}
	var failures []string
	for _, ex := range m.Examples {
		if ex.LastResult != nil && !ex.LastResult.Pass {
			failures = append(failures, fmt.Sprintf("- Request: %s\n  Expected: %s\n  Result: %s", ex.Prompt, ex.Expected, truncate(ex.LastResult.Output, 1500)))
		}
	}
	goal := "Tighten the instructions, add validation steps, and remove ambiguity."
	if len(failures) > 0 {
		goal = "These examples failed evaluation:\n" + strings.Join(failures, "\n") + "\n\nRevise SKILL.md so an agent following it would satisfy every expectation."
	}
	prompt := fmt.Sprintf("Edit the file SKILL.md in the current directory (%s). Keep the YAML frontmatter (name must stay %q). %s Write the improved file to disk; reply with a one-paragraph summary of what changed.", dir, name, goal)
	summary, err := s.runner.RunOnce(ctx, dir, prompt, "accept-edits")
	if err != nil {
		return nil, err
	}
	m.Version = bumpPatch(m.Version)
	m.History = append(m.History, model.SkillVersion{Version: m.Version, At: store.Now(), Summary: "Improved: " + truncate(strings.TrimSpace(summary), 300)})
	if err := s.saveMeta(m); err != nil {
		return nil, err
	}
	return s.load(dir, "mine", name, idFor(m.Kind, name))
}

// Install writes a skill bundle (from the marketplace or a share) into the
// user skills dir with the given kind.
func (s *Service) Install(name, kind, author, version string, files []model.SkillFile, examples []model.SkillExample, listingID string) (*model.Skill, error) {
	name = Slug(name)
	dir := filepath.Join(paths.UserSkillsDir(), name)
	m := s.meta(name)
	if _, err := os.Stat(dir); err == nil {
		if err := s.snapshot(name, dir, m.Version, "Before reinstall"); err != nil {
			return nil, err
		}
		if err := os.RemoveAll(dir); err != nil {
			return nil, err
		}
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	for _, f := range files {
		rel := filepath.Clean(filepath.FromSlash(f.Path))
		if rel == "." || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
			continue
		}
		full := filepath.Join(dir, rel)
		_ = os.MkdirAll(filepath.Dir(full), 0o755)
		if err := os.WriteFile(full, []byte(f.Content), 0o644); err != nil {
			return nil, err
		}
	}
	m.Kind = kind
	m.Author = author
	if version != "" {
		m.Version = version
	}
	m.ListingID = listingID
	m.InstalledVersion = version
	if examples != nil {
		m.Examples = examples
	}
	m.History = append(m.History, model.SkillVersion{Version: m.Version, At: store.Now(), Summary: "Installed"})
	if err := s.saveMeta(m); err != nil {
		return nil, err
	}
	return s.load(dir, "mine", name, idFor(kind, name))
}

func (s *Service) SetShares(id string, shares []model.Share, driveFolderID string) error {
	_, _, name, err := s.Resolve(id)
	if err != nil {
		return err
	}
	m := s.meta(name)
	m.SharedWith = shares
	if driveFolderID != "" {
		m.DriveFolderID = driveFolderID
	}
	return s.saveMeta(m)
}

func (s *Service) Meta(id string) (Meta, error) {
	_, _, name, err := s.Resolve(id)
	if err != nil {
		return Meta{}, err
	}
	return s.meta(name), nil
}

// Installed returns listing ids and versions of marketplace skills.
func (s *Service) Installed() map[string]string {
	out := map[string]string{}
	for _, name := range s.st.ListBlobs(paths.SkillMetaDir()) {
		m := s.meta(name)
		if m.ListingID != "" {
			out[m.ListingID] = m.InstalledVersion
		}
	}
	return out
}

func (s *Service) Uninstall(listingID string) error {
	for _, name := range s.st.ListBlobs(paths.SkillMetaDir()) {
		m := s.meta(name)
		if m.ListingID == listingID {
			return s.Delete(idFor(m.Kind, name))
		}
	}
	return nil
}
