package skills

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
)

// Adapting skills from GitHub.
//
// Three shapes of repository are handled, in this order:
//
//  1. A plugin (Claude Code's .claude-plugin/plugin.json, or the CLI's own
//     plugin.json): handed to `agy plugin install`, which converts commands,
//     hooks and agents, then post-processed by AdaptPlugin so the skills it
//     leaves outside skills/ are loaded and its agents parse.
//  2. Loose skills: every folder holding a SKILL.md is installed as an
//     acquired skill.
//  3. Anything else: the README becomes a SKILL.md so the repository is still
//     usable as reference material.
//
// Only public repositories are reachable: the archive is fetched anonymously
// from codeload.github.com, no git required.

const (
	// Decompressed bytes we are willing to extract before calling the
	// archive hostile.
	maxArchiveBytes = 512 << 20
	maxEntryBytes   = 32 << 20
	maxBundleFiles  = 2000
	maxSynthDocs    = 50
)

type GitHubRef struct {
	Owner  string
	Repo   string
	Ref    string // branch, tag or commit; "" = default branch
	Subdir string // path inside the repository; "" = root
}

func (r GitHubRef) String() string {
	s := "github.com/" + r.Owner + "/" + r.Repo
	if r.Ref != "" {
		s += "@" + r.Ref
	}
	if r.Subdir != "" {
		s += "/" + r.Subdir
	}
	return s
}

var ghNameRe = regexp.MustCompile(`^[A-Za-z0-9_.-]+$`)

// ParseGitHubRef accepts the forms people actually paste:
//
//	owner/repo
//	github.com/owner/repo
//	https://github.com/owner/repo(.git)
//	https://github.com/owner/repo/tree/<ref>/<path/inside>
//	git@github.com:owner/repo.git
//
// A branch name containing "/" cannot be told apart from the path that
// follows it in a /tree/ URL; the first segment is taken as the ref.
func ParseGitHubRef(in string) (GitHubRef, error) {
	s := strings.TrimSpace(in)
	if s == "" {
		return GitHubRef{}, errors.New("enter a GitHub repository")
	}
	if strings.HasPrefix(s, "git@github.com:") {
		s = "https://github.com/" + strings.TrimPrefix(s, "git@github.com:")
	}
	if strings.HasPrefix(strings.ToLower(s), "github.com/") {
		s = "https://" + s
	}
	var segs []string
	if strings.Contains(s, "://") {
		u, err := url.Parse(s)
		if err != nil {
			return GitHubRef{}, fmt.Errorf("not a valid URL: %w", err)
		}
		if !strings.EqualFold(u.Host, "github.com") && !strings.EqualFold(u.Host, "www.github.com") {
			return GitHubRef{}, errors.New("only github.com repositories can be imported")
		}
		segs = strings.Split(strings.Trim(u.Path, "/"), "/")
	} else {
		segs = strings.Split(strings.Trim(s, "/"), "/")
	}
	if len(segs) < 2 || segs[0] == "" || segs[1] == "" {
		return GitHubRef{}, errors.New("expected owner/repo")
	}
	ref := GitHubRef{Owner: segs[0], Repo: strings.TrimSuffix(segs[1], ".git")}
	if !ghNameRe.MatchString(ref.Owner) || !ghNameRe.MatchString(ref.Repo) {
		return GitHubRef{}, errors.New("owner and repository names may only contain letters, digits, '.', '_' and '-'")
	}
	rest := segs[2:]
	if len(rest) >= 2 && (rest[0] == "tree" || rest[0] == "blob") {
		ref.Ref = rest[1]
		if len(rest) > 2 {
			ref.Subdir = path.Clean(strings.Join(rest[2:], "/"))
		}
	} else if len(rest) > 0 && rest[0] != "" {
		return GitHubRef{}, errors.New("use the repository URL, or a /tree/<branch>/<folder> URL for one folder")
	}
	if ref.Subdir == "." {
		ref.Subdir = ""
	}
	if strings.HasPrefix(ref.Subdir, "..") {
		return GitHubRef{}, errors.New("invalid path inside repository")
	}
	return ref, nil
}

// extractTarball writes a GitHub source archive into dest, dropping the
// "<repo>-<sha>/" prefix. Only regular files are written; symlinks and hard
// links are never followed, paths that escape dest are rejected, and the
// executable bit is kept so hook scripts still run.
func extractTarball(r io.Reader, dest string) error {
	gz, err := gzip.NewReader(r)
	if err != nil {
		return fmt.Errorf("not a gzip archive: %w", err)
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	var total int64
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("reading archive: %w", err)
		}
		total += hdr.Size
		if total > maxArchiveBytes {
			return errors.New("repository is too large to import")
		}
		if hdr.Typeflag != tar.TypeReg || hdr.Size > maxEntryBytes {
			continue
		}
		rel := stripRoot(hdr.Name)
		if rel == "" {
			continue
		}
		full := filepath.Join(dest, filepath.FromSlash(rel))
		if !strings.HasPrefix(full, filepath.Clean(dest)+string(filepath.Separator)) {
			continue
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			return err
		}
		mode := os.FileMode(hdr.Mode) & 0o777
		if mode == 0 {
			mode = 0o644
		}
		mode |= 0o600
		f, err := os.OpenFile(full, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
		if err != nil {
			return err
		}
		_, err = io.Copy(f, io.LimitReader(tr, maxEntryBytes))
		f.Close()
		if err != nil {
			return err
		}
	}
}

// readTextFiles walks an extracted repository and returns its UTF-8 files
// under maxFileBytes, keyed by slash path relative to root. Hidden, vendored
// and build folders are skipped.
func readTextFiles(root, subdir string) (map[string]string, error) {
	files := map[string]string{}
	err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(root, p)
		rel = filepath.ToSlash(rel)
		if rel == "." {
			return nil
		}
		if skipPath(rel) {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if d.IsDir() || d.Type()&fs.ModeSymlink != 0 {
			return nil
		}
		if !insideSubdir(rel, subdir) {
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
		files[rel] = string(b)
		return nil
	})
	return files, err
}

// bundle is one importable skill found in a repository.
type bundle struct {
	Dir   string // relative to the repository root; "" for the root itself
	Files []model.SkillFile
}

// bundlesFromFiles groups text files by the folders that hold a SKILL.md. If
// none exists, `readme` carries the README text (if any) so the caller can
// synthesise a skill, and `docs` the other markdown files under the subtree.
func bundlesFromFiles(files map[string]string, subdir string) (bundles []bundle, readme string, docs []model.SkillFile) {
	// Skill folders, outermost first so nested ones can be excluded.
	var dirs []string
	for p := range files {
		if strings.EqualFold(path.Base(p), "SKILL.md") {
			dirs = append(dirs, path.Dir(p))
		}
	}
	sort.Strings(dirs)
	isBundle := map[string]bool{}
	for _, d := range dirs {
		isBundle[d] = true
	}

	for _, d := range dirs {
		var list []model.SkillFile
		for p, content := range files {
			if !within(p, d) {
				continue
			}
			relInside := p
			if d != "." {
				relInside = strings.TrimPrefix(p, d+"/")
			}
			if owner := bundleOwner(path.Dir(p), isBundle); owner != d {
				continue // belongs to a nested skill
			}
			if strings.EqualFold(relInside, "SKILL.md") {
				relInside = "SKILL.md"
			}
			list = append(list, model.SkillFile{Path: relInside, Content: content})
		}
		sort.Slice(list, func(i, j int) bool {
			if list[i].Path == "SKILL.md" {
				return true
			}
			if list[j].Path == "SKILL.md" {
				return false
			}
			return list[i].Path < list[j].Path
		})
		if len(list) > maxBundleFiles {
			list = list[:maxBundleFiles]
		}
		dir := d
		if dir == "." {
			dir = ""
		}
		bundles = append(bundles, bundle{Dir: dir, Files: list})
	}
	if len(bundles) > 0 {
		return bundles, "", nil
	}

	// Nothing declared itself a skill: hand back the README and markdown.
	root := subdir
	if root == "" {
		root = "."
	}
	var mdPaths []string
	for p := range files {
		if strings.EqualFold(path.Ext(p), ".md") {
			mdPaths = append(mdPaths, p)
		}
	}
	sort.Strings(mdPaths)
	for _, p := range mdPaths {
		base := strings.ToLower(path.Base(p))
		if readme == "" && path.Dir(p) == root && strings.HasPrefix(base, "readme") {
			readme = files[p]
			continue
		}
		if len(docs) < maxSynthDocs {
			rel := p
			if root != "." {
				rel = strings.TrimPrefix(p, root+"/")
			}
			docs = append(docs, model.SkillFile{Path: rel, Content: files[p]})
		}
	}
	return nil, readme, docs
}

// stripRoot drops the "<repo>-<sha>/" prefix GitHub puts on every entry and
// rejects anything that would escape the extraction root.
func stripRoot(name string) string {
	name = strings.TrimPrefix(name, "./")
	i := strings.Index(name, "/")
	if i < 0 {
		return ""
	}
	rel := path.Clean(name[i+1:])
	if rel == "." || strings.HasPrefix(rel, "../") || rel == ".." || path.IsAbs(rel) {
		return ""
	}
	return rel
}

func insideSubdir(rel, subdir string) bool {
	if subdir == "" {
		return true
	}
	return rel == subdir || strings.HasPrefix(rel, subdir+"/")
}

func within(p, dir string) bool {
	if dir == "." {
		return true
	}
	return strings.HasPrefix(p, dir+"/")
}

// bundleOwner returns the nearest ancestor (or the dir itself) that is a
// skill folder, or "" if none.
func bundleOwner(dir string, isBundle map[string]bool) string {
	for {
		if isBundle[dir] {
			return dir
		}
		if dir == "." || dir == "" {
			return ""
		}
		dir = path.Dir(dir)
	}
}

func skipPath(rel string) bool {
	for _, seg := range strings.Split(rel, "/") {
		switch {
		case seg == ".git", seg == "node_modules", seg == "__pycache__", seg == "vendor", seg == "dist", seg == "build":
			return true
		case strings.HasPrefix(seg, ".") && seg != ".":
			return true
		}
	}
	return false
}

// synthesiseSkill turns a README into a SKILL.md so a repository with no
// skill definition still imports as one.
func synthesiseSkill(name, origin, readme string, docs []model.SkillFile) []model.SkillFile {
	desc := firstParagraph(readme)
	if desc == "" {
		desc = "Imported from " + origin
	}
	fm := Frontmatter{Name: name, Description: desc}
	body := strings.TrimSpace(readme)
	if body == "" {
		body = "# " + name + "\n\nImported from " + origin + "."
	}
	body += "\n\n<!-- Imported from " + origin + " by Anchor. The repository had no SKILL.md; this file was built from its README. -->\n"
	out := []model.SkillFile{{Path: "SKILL.md", Content: RenderFrontmatter(fm, body)}}
	return append(out, docs...)
}

// firstParagraph returns the first prose paragraph of a markdown document,
// skipping headings, badges and HTML, capped for a one-line description.
func firstParagraph(md string) string {
	var cur []string
	for _, line := range strings.Split(strings.ReplaceAll(md, "\r\n", "\n"), "\n") {
		t := strings.TrimSpace(line)
		if t == "" {
			if len(cur) > 0 {
				break
			}
			continue
		}
		if strings.HasPrefix(t, "#") || strings.HasPrefix(t, "<") || strings.HasPrefix(t, "[![") || strings.HasPrefix(t, "![") || strings.HasPrefix(t, "---") || strings.HasPrefix(t, "```") {
			if len(cur) > 0 {
				break
			}
			continue
		}
		cur = append(cur, t)
	}
	s := strings.Join(cur, " ")
	if len(s) > 220 {
		s = s[:217] + "..."
	}
	return s
}

// SetPluginInstaller wires the CLI's `plugin install` in; without it, plugin
// repositories fall back to loose-skill import.
func (s *Service) SetPluginInstaller(f PluginInstaller) { s.pluginInstall = f }

// ImportResult is what one GitHub import produced.
type ImportResult struct {
	Skills []*model.Skill
	// Plugin is set when the repository was installed as a plugin.
	Plugin string
	Adapt  AdaptReport
}

// ImportFromGitHub downloads a public repository and installs what it holds:
// a plugin through the CLI, or loose skills under ~/.gemini/config/skills.
func (s *Service) ImportFromGitHub(ctx context.Context, input string) (*ImportResult, error) {
	ref, err := ParseGitHubRef(input)
	if err != nil {
		return nil, err
	}
	// No overall client timeout: a large repository can take minutes to
	// stream, and the caller's ctx already bounds the whole import. The
	// header timeout still catches a server that never answers.
	client := &http.Client{Transport: &http.Transport{ResponseHeaderTimeout: 30 * time.Second, Proxy: http.ProxyFromEnvironment}}

	refs := []string{ref.Ref}
	if ref.Ref == "" {
		if def := defaultBranch(ctx, client, ref); def != "" {
			refs = []string{def}
		} else {
			refs = []string{"main", "master"}
		}
	}
	var body io.ReadCloser
	var lastErr error
	for _, r := range refs {
		u := fmt.Sprintf("https://codeload.github.com/%s/%s/tar.gz/%s", url.PathEscape(ref.Owner), url.PathEscape(ref.Repo), url.PathEscape(r))
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		req.Header.Set("User-Agent", "anchor-desktop")
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			lastErr = fmt.Errorf("GitHub returned %s for %s@%s (is the repository public?)", resp.Status, ref.Owner+"/"+ref.Repo, r)
			continue
		}
		body = resp.Body
		ref.Ref = r
		break
	}
	if body == nil {
		if lastErr == nil {
			lastErr = errors.New("could not download the repository")
		}
		return nil, lastErr
	}
	defer body.Close()

	// The CLI's installer wants a directory, and a plugin keeps hook scripts
	// and assets that are not text, so everything is extracted to disk.
	tmp, err := os.MkdirTemp("", "anchor-adapt-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmp)
	if err := extractTarball(io.LimitReader(body, 256<<20), tmp); err != nil {
		return nil, err
	}
	origin := ref.String()
	root := tmp
	if ref.Subdir != "" {
		root = filepath.Join(tmp, filepath.FromSlash(ref.Subdir))
	}

	if s.pluginInstall != nil && IsPluginSource(root) {
		return s.importPlugin(root, origin)
	}

	files, err := readTextFiles(tmp, ref.Subdir)
	if err != nil {
		return nil, err
	}
	bundles, readme, docs := bundlesFromFiles(files, ref.Subdir)
	if len(bundles) == 0 {
		if readme == "" && len(docs) == 0 {
			return nil, fmt.Errorf("%s has no plugin manifest, no SKILL.md and no README to build one from", origin)
		}
		name := ref.Repo
		if ref.Subdir != "" {
			name = path.Base(ref.Subdir)
		}
		bundles = []bundle{{Dir: ref.Subdir, Files: synthesiseSkill(name, origin, readme, docs)}}
	}

	res := &ImportResult{}
	for _, b := range bundles {
		var fm Frontmatter
		for _, f := range b.Files {
			if f.Path == "SKILL.md" {
				fm, _ = ParseFrontmatter(f.Content)
				break
			}
		}
		name := fm.Name
		if name == "" {
			if b.Dir == "" {
				name = ref.Repo
			} else {
				name = path.Base(b.Dir)
			}
		}
		author := fm.Author
		if author == "" {
			author = ref.Owner
		}
		sk, err := s.Install(name, "acquired", author, fm.Version, b.Files, nil, "")
		if err != nil {
			return res, fmt.Errorf("installing %q: %w", name, err)
		}
		m := s.meta(Slug(name))
		m.Origin = origin
		if b.Dir != "" {
			m.Origin = origin + "/" + b.Dir
		}
		_ = s.saveMeta(m)
		res.Skills = append(res.Skills, sk)
	}
	return res, nil
}

func (s *Service) importPlugin(src, origin string) (*ImportResult, error) {
	installed, err := s.pluginInstall(src)
	if err != nil {
		return nil, fmt.Errorf("agy plugin install: %w", err)
	}
	if installed != "" && !dirExists(installed) {
		// The reported path did not parse cleanly; the directory is named
		// after the plugin, so fall back to that.
		installed = ""
	}
	if installed == "" {
		// The installer did not say where; derive it from the manifest name.
		name := readClaudeManifest(src).Name
		if name == "" {
			var m struct {
				Name string `json:"name"`
			}
			if b, err := os.ReadFile(filepath.Join(src, "plugin.json")); err == nil {
				_ = json.Unmarshal(b, &m)
			}
			name = m.Name
		}
		if name == "" {
			return nil, errors.New("the CLI installed the plugin but did not report where")
		}
		installed = filepath.Join(paths.PluginsDir(), name)
		if !dirExists(installed) {
			return nil, fmt.Errorf("the CLI installed the plugin but %s does not exist", installed)
		}
	}
	rep, err := AdaptPlugin(installed, src)
	if err != nil {
		return nil, err
	}
	pluginName := filepath.Base(installed)
	res := &ImportResult{Plugin: pluginName, Adapt: rep}
	all, err := s.List()
	if err != nil {
		return res, err
	}
	prefix := idPlugin(pluginName, "")
	for i := range all {
		if all[i].Source == "plugin" && strings.HasPrefix(all[i].ID, prefix) {
			sk := all[i]
			res.Skills = append(res.Skills, &sk)
		}
	}
	_ = origin
	return res, nil
}

func dirExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}

func defaultBranch(ctx context.Context, client *http.Client, ref GitHubRef) string {
	u := fmt.Sprintf("https://api.github.com/repos/%s/%s", url.PathEscape(ref.Owner), url.PathEscape(ref.Repo))
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	req.Header.Set("User-Agent", "anchor-desktop")
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "" // rate-limited or private; fall back to guessing
	}
	var v struct {
		DefaultBranch string `json:"default_branch"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&v); err != nil {
		return ""
	}
	return v.DefaultBranch
}
