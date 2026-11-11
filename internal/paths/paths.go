// Package paths resolves the on-disk locations Anchor reads and writes:
// its own data directory and the Antigravity CLI's directories.
package paths

import (
	"os"
	"path/filepath"
	"runtime"
)

// Platform returns the platform id used by the UI: darwin | win32 | linux.
func Platform() string {
	switch runtime.GOOS {
	case "darwin":
		return "darwin"
	case "windows":
		return "win32"
	default:
		return "linux"
	}
}

func Home() string {
	h, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	return h
}

// AnchorDir is Anchor's own data directory (~/.anchor). It can be overridden
// with ANCHOR_HOME for tests and portable installs.
func AnchorDir() string {
	if v := os.Getenv("ANCHOR_HOME"); v != "" {
		return v
	}
	return filepath.Join(Home(), ".anchor")
}

// GeminiDir is the Antigravity CLI's root (~/.gemini).
func GeminiDir() string {
	if v := os.Getenv("GEMINI_DIR"); v != "" {
		return v
	}
	return filepath.Join(Home(), ".gemini")
}

// CLIDataDir is where the CLI stores conversations and logs.
func CLIDataDir() string { return filepath.Join(GeminiDir(), "antigravity-cli") }

// ConfigDir is the CLI's global customization root (~/.gemini/config).
func ConfigDir() string { return filepath.Join(GeminiDir(), "config") }

// UserSkillsDir holds skills created in Anchor or acquired from the
// marketplace; the CLI discovers them globally.
func UserSkillsDir() string { return filepath.Join(ConfigDir(), "skills") }

// UserAgentsDir holds agents created in Anchor.
func UserAgentsDir() string { return filepath.Join(ConfigDir(), "agents") }

func PluginsDir() string { return filepath.Join(ConfigDir(), "plugins") }

func BuiltinSkillsDir() string { return filepath.Join(CLIDataDir(), "builtin", "skills") }

func SummariesDB() string { return filepath.Join(CLIDataDir(), "conversation_summaries.db") }

func GoogleAccountsFile() string { return filepath.Join(GeminiDir(), "google_accounts.json") }

func SessionsDir() string { return filepath.Join(AnchorDir(), "sessions") }
func SkillMetaDir() string { return filepath.Join(AnchorDir(), "skills") }
func SkillVersionsDir() string { return filepath.Join(AnchorDir(), "skill-versions") }
func MarketDir() string { return filepath.Join(AnchorDir(), "market") }
func LogDir() string { return filepath.Join(AnchorDir(), "logs") }

func EnsureDirs() error {
	for _, d := range []string{AnchorDir(), SessionsDir(), SkillMetaDir(), SkillVersionsDir(), MarketDir(), LogDir()} {
		if err := os.MkdirAll(d, 0o700); err != nil {
			return err
		}
	}
	return nil
}
