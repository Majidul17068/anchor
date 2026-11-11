//go:build e2e

package skills

// End-to-end check against the network and the installed Antigravity CLI:
//
//	go test ./internal/skills/ -tags e2e -run TestE2E -v
//
// It adapts a real Claude Code plugin repository and then asks the CLI's
// validator what it loaded. Not part of the normal test run.

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Majidul17068/anchor/internal/paths"
	"github.com/Majidul17068/anchor/internal/store"
)

func TestE2EAdaptClaudePluginRepo(t *testing.T) {
	agy, err := exec.LookPath("agy")
	if err != nil {
		t.Skip("agy not installed")
	}
	st, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	s := New(st, nil, func() string { return "me" })
	s.SetPluginInstaller(func(dir string) (string, error) {
		out, err := exec.Command(agy, "plugin", "install", dir).CombinedOutput()
		t.Logf("agy plugin install:\n%s", out)
		if err != nil {
			return "", err
		}
		return PluginDirFromInstallOutput(string(out)), nil
	})

	res, err := s.ImportFromGitHub(context.Background(), "https://github.com/imbad0202/academic-research-skills")
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("plugin=%s linked=%v fixedAgents=%v notes=%v skills=%d", res.Plugin, res.Adapt.LinkedSkills, res.Adapt.FixedAgents, res.Adapt.Notes, len(res.Skills))
	if res.Plugin != "academic-research-skills" {
		t.Fatalf("plugin = %q", res.Plugin)
	}
	var names []string
	for _, sk := range res.Skills {
		names = append(names, sk.Name)
	}
	for _, want := range []string{"academic-paper", "deep-research", "sr-screener"} {
		found := false
		for _, n := range names {
			if n == want {
				found = true
			}
		}
		if !found {
			t.Errorf("skill %q missing from Anchor's list: %v", want, names)
		}
	}

	// Ask the CLI itself.
	dir := filepath.Join(paths.PluginsDir(), res.Plugin)
	out, _ := exec.Command(agy, "plugin", "validate", dir, "--json").CombinedOutput()
	js := string(out)
	if i := strings.LastIndex(js, "\n}"); i > 0 {
		js = js[:i+2]
	}
	var v struct {
		Components struct {
			Skills int `json:"skills"`
			Agents int `json:"agents"`
		} `json:"components"`
		Findings []struct {
			Severity string `json:"severity"`
			Message  string `json:"message"`
		} `json:"findings"`
	}
	if err := json.Unmarshal([]byte(js), &v); err != nil {
		t.Fatalf("validate output: %v\n%s", err, out)
	}
	t.Logf("CLI sees skills=%d agents=%d", v.Components.Skills, v.Components.Agents)
	for _, f := range v.Findings {
		if f.Severity == "error" {
			t.Errorf("CLI error after adapt: %s", f.Message)
		}
	}
	if v.Components.Skills < 21 { // 16 converted commands + 5 real skills
		t.Errorf("CLI loads %d skills, want >= 21", v.Components.Skills)
	}
	if v.Components.Agents < 4 {
		t.Errorf("CLI loads %d agents, want 4", v.Components.Agents)
	}
	_ = os.Stderr
}
