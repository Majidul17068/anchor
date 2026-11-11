// Package agents reads and writes Antigravity agent definitions: markdown
// files with YAML frontmatter, discovered from ~/.gemini/config/agents and
// plugin folders. Anchor-only fields live under an `anchor:` key.
package agents

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/Majidul17068/anchor/internal/cli"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
	"github.com/Majidul17068/anchor/internal/skills"
)

type anchorFields struct {
	Model      string   `yaml:"model,omitempty"`
	Effort     string   `yaml:"effort,omitempty"`
	Skills     []string `yaml:"skills,omitempty"`
	MCPServers []string `yaml:"mcpServers,omitempty"`
}

type frontmatter struct {
	Name                   string        `yaml:"name"`
	Description            string        `yaml:"description"`
	Tools                  []string      `yaml:"tools,omitempty"`
	MainAgent              bool          `yaml:"mainAgent"`
	Subagent               bool          `yaml:"subagent"`
	CommandExecutionPolicy string        `yaml:"commandExecutionPolicy,omitempty"`
	Anchor                 *anchorFields `yaml:"anchor,omitempty"`
}

// DefaultTools are the CLI tool names an agent may be restricted to.
var DefaultTools = []string{"view_file", "write_to_file", "replace_file_content", "grep_search", "find_by_name", "list_dir", "run_command", "browser", "web_search"}

type Service struct {
	loc *cli.Locator
}

func New(loc *cli.Locator) *Service { return &Service{loc: loc} }

func parse(content string) (frontmatter, string) {
	var fm frontmatter
	c := strings.ReplaceAll(content, "\r\n", "\n")
	if !strings.HasPrefix(c, "---\n") {
		return fm, c
	}
	end := strings.Index(c[4:], "\n---")
	if end < 0 {
		return fm, c
	}
	_ = yaml.Unmarshal([]byte(c[4:4+end]), &fm)
	body := strings.TrimPrefix(c[4+end+4:], "\n")
	return fm, body
}

func render(fm frontmatter, body string) string {
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

func fromFile(path, source, id string) (*model.Agent, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	fm, body := parse(string(b))
	name := fm.Name
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(path), ".md")
	}
	a := &model.Agent{ID: id, Name: name, Description: strings.TrimSpace(fm.Description), Source: source, Instructions: body,
		ModelID: "gemini-4-argon", Effort: "medium", Tools: fm.Tools, SkillIDs: []string{}, MCPServers: []string{}}
	if a.Tools == nil {
		a.Tools = []string{}
	}
	if fm.Anchor != nil {
		if fm.Anchor.Model != "" {
			a.ModelID = fm.Anchor.Model
		}
		if fm.Anchor.Effort != "" {
			a.Effort = model.Effort(fm.Anchor.Effort)
		}
		if fm.Anchor.Skills != nil {
			a.SkillIDs = fm.Anchor.Skills
		}
		if fm.Anchor.MCPServers != nil {
			a.MCPServers = fm.Anchor.MCPServers
		}
	}
	return a, nil
}

func (s *Service) List() ([]model.Agent, error) {
	var out []model.Agent
	seen := map[string]bool{}
	entries, _ := os.ReadDir(paths.UserAgentsDir())
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		if a, err := fromFile(filepath.Join(paths.UserAgentsDir(), e.Name()), "mine", "mine:"+strings.TrimSuffix(e.Name(), ".md")); err == nil {
			out = append(out, *a)
			seen[a.Name] = true
		}
	}
	plugins, _ := os.ReadDir(paths.PluginsDir())
	for _, p := range plugins {
		if !p.IsDir() {
			continue
		}
		dir := filepath.Join(paths.PluginsDir(), p.Name(), "agents")
		files, _ := os.ReadDir(dir)
		for _, f := range files {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".md") {
				continue
			}
			if a, err := fromFile(filepath.Join(dir, f.Name()), "plugin", "plugin:"+p.Name()+"/"+strings.TrimSuffix(f.Name(), ".md")); err == nil {
				out = append(out, *a)
				seen[a.Name] = true
			}
		}
	}
	// Anything the CLI lists that we did not find on disk is builtin.
	if bin, ok := s.loc.Find(); ok {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if txt, err := cli.Run(ctx, bin, "agents"); err == nil {
			for _, line := range strings.Split(txt, "\n") {
				fields := strings.Fields(line)
				if len(fields) == 0 {
					continue
				}
				name := fields[0]
				if seen[name] || strings.HasPrefix(name, "Available") || strings.HasPrefix(name, "Fetching") || strings.HasPrefix(name, "-") {
					continue
				}
				out = append(out, model.Agent{ID: "builtin:" + name, Name: name, Description: "Built-in Antigravity agent", Source: "builtin",
					ModelID: "gemini-4-argon", Effort: "medium", Tools: []string{}, SkillIDs: []string{}, MCPServers: []string{}})
				seen[name] = true
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		rank := map[string]int{"mine": 0, "shared": 1, "plugin": 2, "builtin": 3}
		if rank[out[i].Source] != rank[out[j].Source] {
			return rank[out[i].Source] < rank[out[j].Source]
		}
		return out[i].Name < out[j].Name
	})
	if out == nil {
		out = []model.Agent{}
	}
	return out, nil
}

func (s *Service) Get(id string) (*model.Agent, error) {
	list, err := s.List()
	if err != nil {
		return nil, err
	}
	for _, a := range list {
		if a.ID == id {
			return &a, nil
		}
	}
	return nil, errors.New("agent not found: " + id)
}

type SaveInput struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Instructions string   `json:"instructions"`
	ModelID      string   `json:"modelId"`
	Effort       string   `json:"effort"`
	Tools        []string `json:"tools"`
	SkillIDs     []string `json:"skillIds"`
	MCPServers   []string `json:"mcpServers"`
}

func (s *Service) Save(in SaveInput) (*model.Agent, error) {
	if in.ID != "" && !strings.HasPrefix(in.ID, "mine:") {
		return nil, errors.New("builtin and plugin agents are read-only; create a copy instead")
	}
	name := skills.Slug(in.Name)
	if in.ID != "" {
		name = strings.TrimPrefix(in.ID, "mine:")
	}
	if err := os.MkdirAll(paths.UserAgentsDir(), 0o755); err != nil {
		return nil, err
	}
	tools := in.Tools
	if tools == nil {
		tools = []string{}
	}
	fm := frontmatter{Name: name, Description: strings.TrimSpace(in.Description), Tools: tools, MainAgent: true, Subagent: true, CommandExecutionPolicy: "ask",
		Anchor: &anchorFields{Model: in.ModelID, Effort: in.Effort, Skills: in.SkillIDs, MCPServers: in.MCPServers}}
	body := strings.TrimSpace(in.Instructions)
	if body == "" {
		body = fmt.Sprintf("# %s\n\nDescribe how this agent should behave.", in.Name)
	}
	path := filepath.Join(paths.UserAgentsDir(), name+".md")
	if err := os.WriteFile(path, []byte(render(fm, body)), 0o644); err != nil {
		return nil, err
	}
	return fromFile(path, "mine", "mine:"+name)
}

func (s *Service) Delete(id string) error {
	if !strings.HasPrefix(id, "mine:") {
		return errors.New("only your own agents can be deleted")
	}
	err := os.Remove(filepath.Join(paths.UserAgentsDir(), strings.TrimPrefix(id, "mine:")+".md"))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
