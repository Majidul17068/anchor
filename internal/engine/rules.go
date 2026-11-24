package engine

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/Majidul17068/anchor/internal/paths"
)

// Standing instructions ("hard rules") the user sets in Anchor are written
// into the Antigravity CLI's global rules file, ~/.gemini/GEMINI.md, which
// the CLI loads for every session on this machine, in Anchor and in the
// terminal alike. Anchor owns only the block between the markers; anything
// the user wrote in that file outside the block is preserved.
//
// (The CLI also accepts a per-session system-prompt append over ACP via
// _meta.antigravity.systemPrompt.append; the rules file was chosen so the
// instructions hold in terminal sessions too.)

const (
	rulesStart = "<!-- anchor:rules:start -->"
	rulesEnd   = "<!-- anchor:rules:end -->"
)

func globalRulesFile() string { return filepath.Join(paths.GeminiDir(), "GEMINI.md") }

// RenderRulesBlock builds the managed block for the given author and rules.
// An empty rules string yields an empty block (the block is removed).
func RenderRulesBlock(author, rules string) string {
	rules = strings.TrimSpace(rules)
	if rules == "" {
		return ""
	}
	var b strings.Builder
	b.WriteString(rulesStart + "\n")
	b.WriteString("# Standing instructions")
	if author = strings.TrimSpace(author); author != "" {
		b.WriteString(" from " + author)
	}
	b.WriteString("\n\nThese rules were set in Anchor and apply to every conversation. Follow them unless the user explicitly says otherwise in a message.\n\n")
	b.WriteString(rules + "\n")
	b.WriteString(rulesEnd + "\n")
	return b.String()
}

// ReplaceRulesBlock returns content with Anchor's block replaced (or
// appended, or removed when block is empty).
func ReplaceRulesBlock(content, block string) string {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	start := strings.Index(content, rulesStart)
	end := strings.Index(content, rulesEnd)
	var before, after string
	if start >= 0 && end > start {
		before = content[:start]
		after = content[end+len(rulesEnd):]
		after = strings.TrimLeft(after, "\n")
	} else {
		before = content
	}
	before = strings.TrimRight(before, "\n")
	var out strings.Builder
	if before != "" {
		out.WriteString(before + "\n\n")
	}
	if block != "" {
		out.WriteString(block)
		if after != "" {
			out.WriteString("\n")
		}
	}
	out.WriteString(after)
	res := out.String()
	if strings.TrimSpace(res) == "" {
		return ""
	}
	if !strings.HasSuffix(res, "\n") {
		res += "\n"
	}
	return res
}

// WriteGlobalRules stores the user's standing instructions in the CLI's
// global rules file.
func WriteGlobalRules(author, rules string) error {
	path := globalRulesFile()
	existing, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	updated := ReplaceRulesBlock(string(existing), RenderRulesBlock(author, rules))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(updated), 0o644)
}

// ReadGlobalRules returns the rules currently in Anchor's block, if any.
func ReadGlobalRules() string {
	b, err := os.ReadFile(globalRulesFile())
	if err != nil {
		return ""
	}
	content := strings.ReplaceAll(string(b), "\r\n", "\n")
	start := strings.Index(content, rulesStart)
	end := strings.Index(content, rulesEnd)
	if start < 0 || end <= start {
		return ""
	}
	block := content[start+len(rulesStart) : end]
	// Drop the heading and the fixed sentence; keep what the user wrote.
	lines := strings.Split(strings.TrimSpace(block), "\n")
	var keep []string
	skipped := 0
	for _, l := range lines {
		if skipped < 2 && (strings.HasPrefix(l, "# Standing instructions") || strings.HasPrefix(l, "These rules were set in Anchor")) {
			skipped++
			continue
		}
		keep = append(keep, l)
	}
	return strings.TrimSpace(strings.Join(keep, "\n"))
}
