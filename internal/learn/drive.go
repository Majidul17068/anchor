package learn

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"github.com/Majidul17068/anchor/internal/drive"
	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

// What Anchor learned travels with the user: one file, "Anchor knowledge.json",
// at the top of the Anchor folder in their Google Drive (beside the dated
// session folders, not inside them). It holds the standing instructions and
// every suggestion with its decision; a skill or agent the user approved is
// carried inside its suggestion and re-created on their other devices.
//
// Every device both reads and writes the file. Merging is by item, so two
// devices never undo each other:
//   - suggestions are united by id; a decision beats a draft, the later
//     decision beats the earlier;
//   - the standing instructions are taken from whichever device changed
//     them last.

const (
	kindKnowledge = "knowledge"
	knowledgeName = "Anchor knowledge.json"
)

// Store is the part of Google Drive this needs (both Drive backends have it).
type Store interface {
	Connected() bool
	RootFolder(ctx context.Context) (string, error)
	PutIn(ctx context.Context, parentID, name string, props map[string]string, content []byte) (drive.File, error)
	ListKind(ctx context.Context, kind string) ([]drive.File, error)
	Get(ctx context.Context, id string) ([]byte, error)
}

type knowledge struct {
	Version     int                `json:"version"`
	UpdatedAt   string             `json:"updatedAt"`
	Device      string             `json:"device,omitempty"`
	Rules       string             `json:"rules"`
	RulesAt     string             `json:"rulesAt,omitempty"`
	ForgottenAt string             `json:"forgottenAt,omitempty"`
	Suggestions []model.Suggestion `json:"suggestions"`
}

// afterForget drops what the user erased ("Forget everything learned").
func afterForget(list []model.Suggestion, forgottenAt string) []model.Suggestion {
	out := []model.Suggestion{}
	for _, s := range list {
		if forgottenAt == "" || s.CreatedAt > forgottenAt {
			out = append(out, s)
		}
	}
	return out
}

// fingerprint ignores who wrote the file and when, so an unchanged
// knowledge base is never uploaded again.
func (k knowledge) fingerprint() string {
	c := k
	c.UpdatedAt, c.Device = "", ""
	c.Suggestions = append([]model.Suggestion(nil), k.Suggestions...)
	sort.Slice(c.Suggestions, func(i, j int) bool { return c.Suggestions[i].ID < c.Suggestions[j].ID })
	b, _ := json.Marshal(c)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// better reports whether a should replace b for the same suggestion.
func better(a, b model.Suggestion) bool {
	ad, bd := a.Status != model.SuggestionDraft, b.Status != model.SuggestionDraft
	if ad != bd {
		return ad
	}
	return a.DecidedAt > b.DecidedAt
}

// mergeSuggestions unites two lists by id, then folds duplicates of the
// same idea (two devices studied the same history and both proposed it).
func mergeSuggestions(local, remote []model.Suggestion) []model.Suggestion {
	byID := map[string]model.Suggestion{}
	var order []string
	add := func(s model.Suggestion) {
		cur, ok := byID[s.ID]
		if !ok {
			order = append(order, s.ID)
			byID[s.ID] = s
			return
		}
		if better(s, cur) {
			byID[s.ID] = s
		}
	}
	for _, s := range local {
		add(s)
	}
	for _, s := range remote {
		add(s)
	}
	seen := map[string]string{} // kind|title -> id kept
	out := []model.Suggestion{}
	for _, id := range order {
		s := byID[id]
		key := s.Kind + "|" + norm(s.Title)
		if keptID, dup := seen[key]; dup {
			for i := range out {
				if out[i].ID == keptID && better(s, out[i]) {
					out[i] = s
					seen[key] = s.ID
				}
			}
			continue
		}
		seen[key] = s.ID
		out = append(out, s)
	}
	return out
}

func (s *Service) localRules() (text, at string) {
	set := s.st.Settings()
	text, _ = set["agentRules"].(string)
	at, _ = set["agentRulesAt"].(string)
	return text, at
}

// materialise creates, on this device, the skills and agents the user
// approved elsewhere. Each is created once: deleting it here later is
// respected.
func (s *Service) materialise(st *state) {
	if st.Applied == nil {
		st.Applied = map[string]bool{}
	}
	var haveSkills, haveAgents []string
	if s.hooks.Existing != nil {
		haveSkills, haveAgents = s.hooks.Existing()
	}
	has := func(list []string, name string) bool {
		for _, n := range list {
			if norm(n) == norm(name) {
				return true
			}
		}
		return false
	}
	for _, sg := range st.Suggestions {
		if sg.Status != model.SuggestionAccepted || st.Applied[sg.ID] || sg.Name == "" || sg.Body == "" {
			continue
		}
		switch sg.Kind {
		case model.SuggestionSkill:
			if s.hooks.SaveSkill != nil && !has(haveSkills, sg.Name) {
				if _, err := s.hooks.SaveSkill(sg.Name, sg.Description, sg.Body); err != nil {
					s.logf("learn: create skill %s from Drive: %v", sg.Name, err)
					continue
				}
			}
		case model.SuggestionAgent:
			if s.hooks.SaveAgent != nil && !has(haveAgents, sg.Name) {
				if _, err := s.hooks.SaveAgent(sg.Name, sg.Description, sg.Body, sg.Tools); err != nil {
					s.logf("learn: create agent %s from Drive: %v", sg.Name, err)
					continue
				}
			}
		default:
			continue
		}
		st.Applied[sg.ID] = true
	}
}

// SyncDrive exchanges the knowledge base with Google Drive: it folds in
// what other devices learned or decided, applies it here, and uploads the
// result when Drive is behind. It is safe to call often; with nothing new
// on either side it costs one listing.
func (s *Service) SyncDrive(ctx context.Context, d Store) error {
	if d == nil || !d.Connected() {
		return nil
	}
	s.driveMu.Lock()
	defer s.driveMu.Unlock()

	files, err := d.ListKind(ctx, kindKnowledge)
	if err != nil {
		return err
	}
	var remote knowledge
	var remoteFile *drive.File
	for i := range files {
		if remoteFile == nil || files[i].Modified > remoteFile.Modified {
			remoteFile = &files[i]
		}
	}
	st := s.load()
	rules, rulesAt := s.localRules()
	if remoteFile != nil {
		// Unchanged since we last looked, and nothing changed here: done.
		local := knowledge{Version: 1, Rules: rules, RulesAt: rulesAt, ForgottenAt: st.ForgottenAt, Suggestions: st.Suggestions}
		if remoteFile.ID == st.DriveFileID && remoteFile.Modified == st.DriveModified && local.fingerprint() == st.DriveFingerprint {
			return nil
		}
		b, err := d.Get(ctx, remoteFile.ID)
		if err != nil {
			return err
		}
		if err := json.Unmarshal(b, &remote); err != nil {
			return errors.New("the knowledge file on Drive could not be read")
		}
	}

	// Instructions: the device that changed them last wins. A device that
	// never recorded a time (older version) yields to one that did.
	if remoteFile != nil && remote.RulesAt > rulesAt && strings.TrimSpace(remote.Rules) != strings.TrimSpace(rules) {
		if s.hooks.SetRulesAt != nil {
			if err := s.hooks.SetRulesAt(remote.Rules, remote.RulesAt); err != nil {
				return err
			}
			rules, rulesAt = remote.Rules, remote.RulesAt
		}
	} else if remoteFile != nil && remote.RulesAt > rulesAt {
		rulesAt = remote.RulesAt // same text; adopt the time
	}

	// The user may have decided on drafts while Drive was being read: start
	// from the state as it is now, not as it was before the network calls.
	st = s.load()
	if remote.ForgottenAt > st.ForgottenAt {
		st.ForgottenAt = remote.ForgottenAt
	}
	merged := afterForget(mergeSuggestions(st.Suggestions, remote.Suggestions), st.ForgottenAt)
	before := knowledge{Suggestions: st.Suggestions}.fingerprint()
	st.Suggestions = merged
	s.materialise(&st)
	out := knowledge{Version: 1, UpdatedAt: store.Now(), Device: s.st.Device().Name, Rules: rules, RulesAt: rulesAt,
		ForgottenAt: st.ForgottenAt, Suggestions: merged}
	fp := out.fingerprint()

	if remoteFile == nil || remote.fingerprint() != fp {
		root, err := d.RootFolder(ctx)
		if err != nil {
			return err
		}
		b, _ := json.MarshalIndent(out, "", "  ")
		f, err := d.PutIn(ctx, root, knowledgeName, map[string]string{drive.PropKind: kindKnowledge}, b)
		if err != nil {
			return err
		}
		st.DriveFileID, st.DriveModified = f.ID, f.Modified
	} else {
		st.DriveFileID, st.DriveModified = remoteFile.ID, remoteFile.Modified
	}
	st.DriveFingerprint = fp
	st.DriveSyncedAt = store.Now()
	// load() again would lose nothing: decisions made during the exchange
	// are merged on the next pass, which the changed fingerprint triggers.
	if err := s.save(st); err != nil {
		return err
	}
	if before != (knowledge{Suggestions: merged}).fingerprint() {
		s.emit("learn:status", s.Status())
	}
	return nil
}
