package engine

import (
	"context"
	"strings"

	"github.com/Majidul17068/anchor/internal/history"
	"github.com/Majidul17068/anchor/internal/model"
)

type SearchFilters struct {
	DeviceID  string `json:"deviceId"`
	AgentID   string `json:"agentId"`
	ProjectID string `json:"projectId"`
	From      string `json:"from"`
	To        string `json:"to"`
	Synced    *bool  `json:"synced"`
}

// Search filters sessions by metadata and matches the query against titles,
// previews, cached transcripts, and the CLI's full-text index.
func (e *Engine) Search(q string, f SearchFilters) ([]model.Session, error) {
	all, err := e.ListSessions()
	if err != nil && len(all) == 0 {
		return nil, err
	}
	q = strings.TrimSpace(strings.ToLower(q))
	ftsHit := map[string]bool{}
	if q != "" {
		ids, _ := history.FullTextIDs(context.Background(), q)
		for _, id := range ids {
			ftsHit[id] = true
		}
	}
	var out []model.Session
	for _, s := range all {
		if f.DeviceID != "" && s.OriginDeviceID != f.DeviceID {
			continue
		}
		if f.AgentID != "" && s.AgentID != f.AgentID {
			continue
		}
		if f.ProjectID != "" && s.ProjectID != f.ProjectID && !hasPath(s.WorkspacePaths, f.ProjectID) {
			continue
		}
		if f.From != "" && s.LastModified < f.From {
			continue
		}
		if f.To != "" && s.CreatedAt > f.To+"T23:59:59Z" {
			continue
		}
		if f.Synced != nil && s.SyncEnabled != *f.Synced {
			continue
		}
		if q != "" {
			if ftsHit[s.ID] || strings.Contains(strings.ToLower(s.Title), q) || strings.Contains(strings.ToLower(s.Preview), q) || e.transcriptContains(s.ID, q) {
				out = append(out, s)
			}
			continue
		}
		out = append(out, s)
	}
	if out == nil {
		out = []model.Session{}
	}
	return out, nil
}

func hasPath(paths []string, p string) bool {
	for _, x := range paths {
		if x == p {
			return true
		}
	}
	return false
}

func (e *Engine) transcriptContains(id, q string) bool {
	for _, st := range e.st.Steps(id) {
		switch st.Kind {
		case "user":
			if strings.Contains(strings.ToLower(st.Text), q) {
				return true
			}
		case "agent":
			if strings.Contains(strings.ToLower(st.Markdown), q) {
				return true
			}
		}
	}
	return false
}

// Projects derives projects from the distinct workspace folders in use.
func (e *Engine) Projects() ([]model.Project, error) {
	all, _ := e.ListSessions()
	seen := map[string]bool{}
	var out []model.Project
	for _, s := range all {
		for _, p := range s.WorkspacePaths {
			if p == "" || seen[p] {
				continue
			}
			seen[p] = true
			name := p
			if i := strings.LastIndexAny(p, `/\`); i >= 0 && i < len(p)-1 {
				name = p[i+1:]
			}
			out = append(out, model.Project{ID: p, Name: name, WorkspacePaths: []string{p}})
		}
	}
	if out == nil {
		out = []model.Project{}
	}
	return out, nil
}
