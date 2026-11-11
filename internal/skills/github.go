package skills

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Majidul17068/anchor/internal/model"
)

// Importing skills from GitHub.
//
// A skill is any folder holding a SKILL.md, which is also how the Antigravity
// CLI discovers them. A repository may hold one skill at its root, many under
// subfolders (anthropics/skills style), or none at all; in the last case the
// README becomes the SKILL.md so that "any kind of GitHub repo" yields
// something the CLI can load. Only public repositories are reachable: the
// archive is fetched anonymously from codeload.github.com, no git required.

const (
	// Decompressed bytes we are willing to walk before calling the archive
	// hostile. Text files beyond maxFileBytes are skipped, not read.
	maxArchiveBytes = 512 << 20
	maxBundleFiles  = 200
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

// bundle is one importable skill found in an archive.
type bundle struct {
	Dir   string // relative to the repository root; "" for the root itself
	Files []model.SkillFile
}

// bundlesFromTarball walks a GitHub source archive and returns every folder
// that holds a SKILL.md. If none exists, `readme` carries the README text
// (if any) so the caller can synthesise a skill, and `docs` the other
// markdown files under the subtree.
func bundlesFromTarball(r io.Reader, subdir string) (bundles []bundle, readme string, docs []model.SkillFile, err error) {
	gz, err := gzip.NewReader(r)
	if err != nil {
		return nil, "", nil, fmt.Errorf("not a gzip archive: %w", err)
	}
	defer gz.Close()
	tr := tar.NewReader(gz)

	files := map[string]string{}
	var total int64
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, "", nil, fmt.Errorf("reading archive: %w", err)
		}
		total += hdr.Size
		if total > maxArchiveBytes {
			return nil, "", nil, errors.New("repository is too large to import")
		}
		if hdr.Typeflag != tar.TypeReg {
			continue // directories, symlinks, hard links: never followed
		}
		rel := stripRoot(hdr.Name)
		if rel == "" || !insideSubdir(rel, subdir) || skipPath(rel) {
			continue
		}
		if hdr.Size > maxFileBytes {
			continue
		}
		b, err := io.ReadAll(io.LimitReader(tr, maxFileBytes+1))
		if err != nil {
			return nil, "", nil, err
		}
		if !utf8.Valid(b) {
			continue
		}
		files[rel] = string(b)
	}

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
		return bundles, "", nil, nil
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
	return nil, readme, docs, nil
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
	flush := func() string { return strings.Join(cur, " ") }
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
	s := flush()
	if len(s) > 220 {
		s = s[:217] + "..."
	}
	return s
}

// ImportFromGitHub downloads a public repository and installs every skill it
// holds under ~/.gemini/config/skills as "acquired" skills.
func (s *Service) ImportFromGitHub(ctx context.Context, input string) ([]*model.Skill, error) {
	ref, err := ParseGitHubRef(input)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 3 * time.Minute}

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

	bundles, readme, docs, err := bundlesFromTarball(io.LimitReader(body, 256<<20), ref.Subdir)
	if err != nil {
		return nil, err
	}
	origin := ref.String()

	if len(bundles) == 0 {
		if readme == "" && len(docs) == 0 {
			return nil, fmt.Errorf("%s has no SKILL.md and no README to build one from", origin)
		}
		name := ref.Repo
		if ref.Subdir != "" {
			name = path.Base(ref.Subdir)
		}
		bundles = []bundle{{Dir: ref.Subdir, Files: synthesiseSkill(name, origin, readme, docs)}}
	}

	var out []*model.Skill
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
			return out, fmt.Errorf("installing %q: %w", name, err)
		}
		m := s.meta(Slug(name))
		m.Origin = origin
		if b.Dir != "" {
			m.Origin = origin + "/" + b.Dir
		}
		_ = s.saveMeta(m)
		out = append(out, sk)
	}
	return out, nil
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
