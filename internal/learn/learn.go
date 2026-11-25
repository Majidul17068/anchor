// Package learn studies how the user works and proposes improvements: edits
// to their standing instructions for corrections they keep repeating, and
// draft skills or agents for work they keep doing. Nothing it proposes takes
// effect until the user approves it; a rejection is remembered so the same
// idea is not proposed again.
//
// The analysis is one throwaway agent turn over a digest of the user's own
// messages from recent conversations on this device. It never reads the
// agent's replies or tool output, and nothing leaves the machine except that
// single prompt to the model the user already talks to.
package learn

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
	"github.com/Majidul17068/anchor/internal/store"
)

const (
	maxSessions      = 40    // most recent conversations studied
	maxPerMessage    = 700   // characters kept of one user message
	maxDigestChars   = 48000 // whole digest
	lookback         = 45 * 24 * time.Hour
	minUserMessages  = 6 // below this there is nothing to learn from
	maxSuggestions   = 8
	autoInterval     = 24 * time.Hour
	blobName         = "suggestions"
	maxRememberedOld = 200
)

// Runner runs one agent turn and returns its text (engine.RunOnce).
type Runner func(ctx context.Context, cwd, prompt, mode string) (string, error)

// Hooks are what approving a suggestion does, provided by the app.
type Hooks struct {
	// Rules returns the standing instructions in force.
	Rules func() string
	// SetRules replaces them.
	SetRules func(text string) error
	// SaveSkill / SaveAgent create the item and return its id.
	SaveSkill func(name, description, body string) (string, error)
	SaveAgent func(name, description, instructions string, tools []string) (string, error)
	// Existing lists what the user already has, so it is not proposed again.
	Existing func() (skills, agents []string)
}

type state struct {
	Suggestions []model.Suggestion `json:"suggestions"`
	LastRunAt   string             `json:"lastRunAt,omitempty"`
	LastError   string             `json:"lastError,omitempty"`
	// StudiedUntil is the newest user message the last run saw; an automatic
	// run is skipped when nothing newer exists.
	StudiedUntil string `json:"studiedUntil,omitempty"`
}

type Service struct {
	st    *store.Store
	run   Runner
	hooks Hooks
	emit  func(string, any)
	logf  func(string, ...any)

	mu      sync.Mutex
	running bool
}

func New(st *store.Store, run Runner, hooks Hooks, emit func(string, any), logf func(string, ...any)) *Service {
	if logf == nil {
		logf = func(string, ...any) {}
	}
	if emit == nil {
		emit = func(string, any) {}
	}
	return &Service{st: st, run: run, hooks: hooks, emit: emit, logf: logf}
}

func dir() string { return paths.AnchorDir() + string(os.PathSeparator) + "learn" }

func (s *Service) load() state {
	var st state
	_ = s.st.ReadBlob(dir(), blobName, &st)
	if st.Suggestions == nil {
		st.Suggestions = []model.Suggestion{}
	}
	return st
}

func (s *Service) save(st state) error { return s.st.WriteBlob(dir(), blobName, st) }

// Enabled reports whether the user switched learning on.
func (s *Service) Enabled() bool {
	v, _ := s.st.Settings()["learnEnabled"].(bool)
	return v
}

// Status is what the UI shows about the feature.
func (s *Service) Status() model.LearnStatus {
	st := s.load()
	s.mu.Lock()
	running := s.running
	s.mu.Unlock()
	out := model.LearnStatus{Enabled: s.Enabled(), Running: running, LastRunAt: st.LastRunAt, LastError: st.LastError}
	for _, sg := range st.Suggestions {
		if sg.Status == model.SuggestionDraft {
			out.Drafts++
		}
	}
	return out
}

// List returns suggestions, drafts first, newest first.
func (s *Service) List() []model.Suggestion {
	list := s.load().Suggestions
	rank := map[string]int{model.SuggestionDraft: 0, model.SuggestionAccepted: 1, model.SuggestionRejected: 2}
	sort.SliceStable(list, func(i, j int) bool {
		if rank[list[i].Status] != rank[list[j].Status] {
			return rank[list[i].Status] < rank[list[j].Status]
		}
		return list[i].CreatedAt > list[j].CreatedAt
	})
	return list
}

// ---------------------------------------------------------------------------
// digest
// ---------------------------------------------------------------------------

type digest struct {
	text     string
	messages int
	sessions int
	newest   string
}

func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	for n > 0 && !utf8.RuneStart(s[n]) {
		n--
	}
	return s[:n] + " …"
}

// buildDigest collects the user's own messages from recent conversations.
// Scratch sessions (agent tests, skill evaluation) are skipped.
func (s *Service) buildDigest() digest {
	var d digest
	var b strings.Builder
	cutoff := time.Now().Add(-lookback).UTC().Format(time.RFC3339)
	metas := s.st.ListSessions() // newest first
	for _, m := range metas {
		if d.sessions >= maxSessions || b.Len() >= maxDigestChars {
			break
		}
		if m.LastModified < cutoff || strings.HasPrefix(m.Title, "Test · ") || strings.HasPrefix(m.ID, "transient-") {
			continue
		}
		var msgs []string
		for _, st := range s.st.Steps(m.ID) {
			if st.Kind != "user" || strings.TrimSpace(st.Text) == "" {
				continue
			}
			msgs = append(msgs, clip(st.Text, maxPerMessage))
			if st.At > d.newest {
				d.newest = st.At
			}
		}
		if len(msgs) == 0 {
			continue
		}
		d.sessions++
		day := m.LastModified
		if len(day) >= 10 {
			day = day[:10]
		}
		fmt.Fprintf(&b, "\n## Conversation %d: %q (%s", d.sessions, clip(m.Title, 80), day)
		if len(m.WorkspacePaths) > 0 {
			fmt.Fprintf(&b, ", folder %q", lastSegment(m.WorkspacePaths[0]))
		}
		b.WriteString(")\n")
		for i, msg := range msgs {
			if b.Len() >= maxDigestChars {
				break
			}
			fmt.Fprintf(&b, "%d. %s\n", i+1, strings.ReplaceAll(msg, "\n", "\n   "))
			d.messages++
		}
	}
	d.text = b.String()
	return d
}

func lastSegment(p string) string {
	p = strings.TrimRight(strings.ReplaceAll(p, "\\", "/"), "/")
	if i := strings.LastIndex(p, "/"); i >= 0 {
		return p[i+1:]
	}
	return p
}

// ---------------------------------------------------------------------------
// the analysis turn
// ---------------------------------------------------------------------------

type proposal struct {
	Kind         string   `json:"kind"`
	Title        string   `json:"title"`
	Reason       string   `json:"reason"`
	Evidence     []string `json:"evidence"`
	Occurrences  int      `json:"occurrences"`
	Rule         string   `json:"rule"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Body         string   `json:"body"`
	Instructions string   `json:"instructions"`
	Tools        []string `json:"tools"`
}

func (s *Service) prompt(d digest, st state) string {
	rules := ""
	if s.hooks.Rules != nil {
		rules = strings.TrimSpace(s.hooks.Rules())
	}
	if rules == "" {
		rules = "(none yet)"
	}
	var skills, agents []string
	if s.hooks.Existing != nil {
		skills, agents = s.hooks.Existing()
	}
	var declined []string
	for _, sg := range st.Suggestions {
		if sg.Status != model.SuggestionDraft {
			declined = append(declined, "- ["+sg.Kind+"] "+sg.Title)
		}
	}
	for _, sg := range st.Suggestions {
		if sg.Status == model.SuggestionDraft {
			declined = append(declined, "- ["+sg.Kind+"] "+sg.Title+" (already waiting for review)")
		}
	}
	list := func(xs []string) string {
		if len(xs) == 0 {
			return "(none)"
		}
		return strings.Join(xs, ", ")
	}
	none := func(xs []string) string {
		if len(xs) == 0 {
			return "(none)"
		}
		return strings.Join(xs, "\n")
	}
	return `You are reviewing how one person works with their coding agent, to propose improvements they will review before anything changes. Do not use any tools, do not read or write files, do not ask questions. Reply with one JSON object and nothing else.

Below are only this person's own messages from their recent conversations.

Look for two things:

1. RULES: preferences or corrections they state more than once (tone, language, format, tools to use or avoid, steps to always or never take). Propose a standing instruction for each, written as one clear imperative sentence addressed to the agent. Only when it appears in at least 2 separate messages and is not already covered by their current instructions.

2. REPEATED WORK: the same kind of task requested in at least 3 separate messages. Propose a SKILL when it is a procedure the agent should follow (steps, checks, output format), or an AGENT when it is a role with its own behaviour and tools. Write it so it would work for anyone: no personal names, client or company names, email addresses, absolute paths, hostnames, tokens or keys. Use placeholders where a specific value belongs.

Be strict. Most histories justify few suggestions; an empty list is a good answer when nothing clearly repeats. Never invent a pattern. At most ` + fmt.Sprint(maxSuggestions) + ` suggestions, strongest first.

Their current standing instructions:
"""
` + rules + `
"""

Skills they already have: ` + list(skills) + `
Agents they already have: ` + list(agents) + `

Already proposed before; do not propose these or close variants again:
` + none(declined) + `

Reply with exactly this JSON shape:
{"suggestions":[
 {"kind":"rule","title":"short label","reason":"one sentence: what you saw and how often","occurrences":3,"evidence":["short quote","short quote"],"rule":"The instruction itself."},
 {"kind":"skill","title":"short label","reason":"...","occurrences":4,"evidence":["..."],"name":"kebab-case-name","description":"When to use this skill, one sentence.","body":"Markdown instructions for the agent: when it applies, the steps, what the output looks like."},
 {"kind":"agent","title":"short label","reason":"...","occurrences":3,"evidence":["..."],"name":"kebab-case-name","description":"What this agent is for, one sentence.","instructions":"Markdown instructions describing how this agent behaves.","tools":["view_file","grep_search"]}
]}
Agent tools may only come from: view_file, write_to_file, replace_file_content, grep_search, find_by_name, list_dir, run_command, browser, web_search. Evidence quotes are at most 120 characters each, at most 3 per suggestion.

# Their messages
` + d.text
}

// extractJSON finds the JSON object in the agent's reply, with or without
// a code fence around it.
func extractJSON(reply string) (string, error) {
	start := strings.Index(reply, "{")
	end := strings.LastIndex(reply, "}")
	if start < 0 || end <= start {
		return "", errors.New("the agent did not answer with suggestions")
	}
	return reply[start : end+1], nil
}

func norm(s string) string {
	return strings.Join(strings.Fields(strings.ToLower(s)), " ")
}

var allowedTools = map[string]bool{"view_file": true, "write_to_file": true, "replace_file_content": true, "grep_search": true,
	"find_by_name": true, "list_dir": true, "run_command": true, "browser": true, "web_search": true}

// toSuggestion validates one proposal; ok is false when it is unusable.
func toSuggestion(p proposal, now string) (model.Suggestion, bool) {
	sg := model.Suggestion{ID: "sg_" + strings.ReplaceAll(uuid.NewString(), "-", "")[:10], Kind: p.Kind, Title: clip(p.Title, 90),
		Reason: clip(p.Reason, 400), Occurrences: p.Occurrences, Status: model.SuggestionDraft, CreatedAt: now, Evidence: []string{}}
	for i, e := range p.Evidence {
		if i >= 3 {
			break
		}
		if e = clip(e, 160); e != "" {
			sg.Evidence = append(sg.Evidence, e)
		}
	}
	switch p.Kind {
	case model.SuggestionRule:
		sg.Rule = strings.TrimSpace(p.Rule)
		if sg.Rule == "" || p.Occurrences < 2 {
			return sg, false
		}
	case model.SuggestionSkill:
		sg.Name, sg.Description, sg.Body = strings.TrimSpace(p.Name), strings.TrimSpace(p.Description), strings.TrimSpace(p.Body)
		if sg.Name == "" || sg.Body == "" || p.Occurrences < 3 {
			return sg, false
		}
	case model.SuggestionAgent:
		sg.Name, sg.Description, sg.Body = strings.TrimSpace(p.Name), strings.TrimSpace(p.Description), strings.TrimSpace(p.Instructions)
		if sg.Name == "" || sg.Body == "" || p.Occurrences < 3 {
			return sg, false
		}
		sg.Tools = []string{}
		for _, t := range p.Tools {
			if allowedTools[t] {
				sg.Tools = append(sg.Tools, t)
			}
		}
	default:
		return sg, false
	}
	if sg.Title == "" {
		sg.Title = sg.Name
	}
	return sg, sg.Title != ""
}

// ErrNothingNew means an automatic run found no messages since the last one.
var ErrNothingNew = errors.New("nothing new to learn from since the last run")

// Run studies recent conversations and adds new drafts. manual runs ignore
// the "nothing new" check. It returns how many drafts were added.
func (s *Service) Run(ctx context.Context, manual bool) (int, error) {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return 0, errors.New("already studying your recent work")
	}
	s.running = true
	s.mu.Unlock()
	s.emit("learn:status", s.Status())
	added, err := s.runLocked(ctx, manual)
	s.mu.Lock()
	s.running = false
	s.mu.Unlock()
	st := s.load()
	if err != nil && !errors.Is(err, ErrNothingNew) {
		st.LastError = err.Error()
		_ = s.save(st)
	}
	s.emit("learn:status", s.Status())
	return added, err
}

func (s *Service) runLocked(ctx context.Context, manual bool) (int, error) {
	st := s.load()
	d := s.buildDigest()
	if d.messages < minUserMessages {
		return 0, fmt.Errorf("not enough history yet: %d of your messages found, at least %d are needed", d.messages, minUserMessages)
	}
	if !manual && d.newest != "" && d.newest <= st.StudiedUntil {
		return 0, ErrNothingNew
	}
	// A neutral folder: the turn must not pick up a project's own rules.
	cwd, err := os.MkdirTemp("", "anchor-learn-")
	if err != nil {
		return 0, err
	}
	defer os.RemoveAll(cwd)
	reply, err := s.run(ctx, cwd, s.prompt(d, st), "default")
	if err != nil {
		return 0, err
	}
	raw, err := extractJSON(reply)
	if err != nil {
		return 0, err
	}
	var parsed struct {
		Suggestions []proposal `json:"suggestions"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return 0, errors.New("the agent's suggestions could not be read")
	}
	st = s.load() // the user may have acted on drafts meanwhile
	seen := map[string]bool{}
	for _, sg := range st.Suggestions {
		seen[sg.Kind+"|"+norm(sg.Title)] = true
		if sg.Name != "" {
			seen[sg.Kind+"|name|"+norm(sg.Name)] = true
		}
	}
	var haveSkills, haveAgents []string
	if s.hooks.Existing != nil {
		haveSkills, haveAgents = s.hooks.Existing()
	}
	for _, n := range haveSkills {
		seen[model.SuggestionSkill+"|name|"+norm(n)] = true
	}
	for _, n := range haveAgents {
		seen[model.SuggestionAgent+"|name|"+norm(n)] = true
	}
	now := store.Now()
	added := 0
	for _, p := range parsed.Suggestions {
		if added >= maxSuggestions {
			break
		}
		sg, ok := toSuggestion(p, now)
		if !ok || seen[sg.Kind+"|"+norm(sg.Title)] || (sg.Name != "" && seen[sg.Kind+"|name|"+norm(sg.Name)]) {
			continue
		}
		seen[sg.Kind+"|"+norm(sg.Title)] = true
		st.Suggestions = append(st.Suggestions, sg)
		added++
	}
	st.LastRunAt, st.LastError, st.StudiedUntil = now, "", d.newest
	// Old decisions are kept as memory, but not without bound.
	if extra := len(st.Suggestions) - maxRememberedOld; extra > 0 {
		kept := st.Suggestions[:0]
		for _, sg := range st.Suggestions {
			if extra > 0 && sg.Status != model.SuggestionDraft {
				extra--
				continue
			}
			kept = append(kept, sg)
		}
		st.Suggestions = kept
	}
	return added, s.save(st)
}

// AutoDue reports whether a daily automatic run should start now.
func (s *Service) AutoDue() bool {
	if !s.Enabled() {
		return false
	}
	if auto, ok := s.st.Settings()["learnAuto"].(bool); ok && !auto {
		return false
	}
	st := s.load()
	if st.LastRunAt == "" {
		return true
	}
	t, err := time.Parse(time.RFC3339, st.LastRunAt)
	return err != nil || time.Since(t) >= autoInterval
}

// ---------------------------------------------------------------------------
// the user's decisions
// ---------------------------------------------------------------------------

func (s *Service) find(st *state, id string) (*model.Suggestion, error) {
	for i := range st.Suggestions {
		if st.Suggestions[i].ID == id {
			return &st.Suggestions[i], nil
		}
	}
	return nil, errors.New("suggestion not found")
}

// Edit is what the user may change on a draft before approving it.
type Edit struct {
	Title       *string   `json:"title,omitempty"`
	Rule        *string   `json:"rule,omitempty"`
	Name        *string   `json:"name,omitempty"`
	Description *string   `json:"description,omitempty"`
	Body        *string   `json:"body,omitempty"`
	Tools       *[]string `json:"tools,omitempty"`
}

func apply(sg *model.Suggestion, e Edit) {
	set := func(dst *string, v *string) {
		if v != nil {
			*dst = strings.TrimSpace(*v)
		}
	}
	set(&sg.Title, e.Title)
	set(&sg.Rule, e.Rule)
	set(&sg.Name, e.Name)
	set(&sg.Description, e.Description)
	set(&sg.Body, e.Body)
	if e.Tools != nil {
		sg.Tools = *e.Tools
	}
}

// Update saves edits to a draft.
func (s *Service) Update(id string, e Edit) (model.Suggestion, error) {
	st := s.load()
	sg, err := s.find(&st, id)
	if err != nil {
		return model.Suggestion{}, err
	}
	if sg.Status != model.SuggestionDraft {
		return *sg, errors.New("only drafts can be edited")
	}
	apply(sg, e)
	return *sg, s.save(st)
}

// Accept puts a draft into effect: a rule is appended to the standing
// instructions, a skill or agent is created among the user's own. The
// returned suggestion carries the id of what was created.
func (s *Service) Accept(id string, e Edit) (model.Suggestion, error) {
	st := s.load()
	sg, err := s.find(&st, id)
	if err != nil {
		return model.Suggestion{}, err
	}
	if sg.Status != model.SuggestionDraft {
		return *sg, errors.New("this suggestion was already decided")
	}
	apply(sg, e)
	switch sg.Kind {
	case model.SuggestionRule:
		if sg.Rule == "" {
			return *sg, errors.New("the instruction is empty")
		}
		if s.hooks.Rules == nil || s.hooks.SetRules == nil {
			return *sg, errors.New("standing instructions are not available")
		}
		cur := strings.TrimRight(s.hooks.Rules(), "\n ")
		line := "- " + strings.TrimPrefix(strings.TrimSpace(sg.Rule), "- ")
		if !strings.Contains(norm(cur), norm(sg.Rule)) {
			if cur != "" {
				cur += "\n"
			}
			if err := s.hooks.SetRules(cur + line + "\n"); err != nil {
				return *sg, err
			}
		}
	case model.SuggestionSkill:
		if sg.Name == "" || sg.Body == "" {
			return *sg, errors.New("the skill needs a name and instructions")
		}
		created, err := s.hooks.SaveSkill(sg.Name, sg.Description, sg.Body)
		if err != nil {
			return *sg, err
		}
		sg.CreatedID = created
	case model.SuggestionAgent:
		if sg.Name == "" || sg.Body == "" {
			return *sg, errors.New("the agent needs a name and instructions")
		}
		created, err := s.hooks.SaveAgent(sg.Name, sg.Description, sg.Body, sg.Tools)
		if err != nil {
			return *sg, err
		}
		sg.CreatedID = created
	}
	sg.Status, sg.DecidedAt = model.SuggestionAccepted, store.Now()
	out := *sg
	if err := s.save(st); err != nil {
		return out, err
	}
	s.emit("learn:status", s.Status())
	return out, nil
}

// Reject dismisses a draft; it is remembered so it is not proposed again.
func (s *Service) Reject(id string) error {
	st := s.load()
	sg, err := s.find(&st, id)
	if err != nil {
		return err
	}
	if sg.Status == model.SuggestionDraft {
		sg.Status, sg.DecidedAt = model.SuggestionRejected, store.Now()
	}
	if err := s.save(st); err != nil {
		return err
	}
	s.emit("learn:status", s.Status())
	return nil
}

// Forget erases everything learned: drafts, decisions and run history.
func (s *Service) Forget() error {
	if err := s.save(state{Suggestions: []model.Suggestion{}}); err != nil {
		return err
	}
	s.emit("learn:status", s.Status())
	return nil
}
