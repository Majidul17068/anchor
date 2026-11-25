package osutil

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// Start at login, per user and without administrator rights:
//   macOS    a LaunchAgent in ~/Library/LaunchAgents
//   Windows  a value under HKCU\...\CurrentVersion\Run
//   Linux    a .desktop file in ~/.config/autostart
// The app is started with --background so it stays out of the way.

const autostartID = "com.anchor.desktop"

func home() string {
	h, _ := os.UserHomeDir()
	return h
}

func macAgentPath() string {
	return filepath.Join(home(), "Library", "LaunchAgents", autostartID+".plist")
}

func linuxAutostartPath() string {
	base := os.Getenv("XDG_CONFIG_HOME")
	if base == "" {
		base = filepath.Join(home(), ".config")
	}
	return filepath.Join(base, "autostart", "anchor.desktop")
}

func xmlEscape(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}

// AutostartEnabled reports whether Anchor is set to start at login.
func AutostartEnabled() bool {
	switch runtime.GOOS {
	case "darwin":
		_, err := os.Stat(macAgentPath())
		return err == nil
	case "windows":
		cmd := exec.Command("reg", "query", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", "Anchor")
		HideWindow(cmd)
		return cmd.Run() == nil
	default:
		_, err := os.Stat(linuxAutostartPath())
		return err == nil
	}
}

// SetAutostart switches starting at login on or off for the running
// executable.
func SetAutostart(on bool) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if p, err := filepath.EvalSymlinks(exe); err == nil {
		exe = p
	}
	switch runtime.GOOS {
	case "darwin":
		path := macAgentPath()
		if !on {
			err := os.Remove(path)
			if errors.Is(err, os.ErrNotExist) {
				return nil
			}
			return err
		}
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}
		plist := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>%s</string>
  <key>ProgramArguments</key>
  <array><string>%s</string><string>--background</string></array>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Interactive</string>
</dict>
</plist>
`, autostartID, xmlEscape(exe))
		return os.WriteFile(path, []byte(plist), 0o644)
	case "windows":
		key := `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
		var cmd *exec.Cmd
		if on {
			cmd = exec.Command("reg", "add", key, "/v", "Anchor", "/t", "REG_SZ", "/d", `"`+exe+`" --background`, "/f")
		} else {
			if !AutostartEnabled() {
				return nil
			}
			cmd = exec.Command("reg", "delete", key, "/v", "Anchor", "/f")
		}
		HideWindow(cmd)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("could not change the startup setting: %s", strings.TrimSpace(string(out)))
		}
		return nil
	default:
		path := linuxAutostartPath()
		if !on {
			err := os.Remove(path)
			if errors.Is(err, os.ErrNotExist) {
				return nil
			}
			return err
		}
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}
		entry := "[Desktop Entry]\nType=Application\nName=Anchor\nComment=Runs your automations in the background\nExec=\"" +
			strings.ReplaceAll(exe, `"`, `\"`) + "\" --background\nIcon=anchor\nTerminal=false\nX-GNOME-Autostart-enabled=true\n"
		return os.WriteFile(path, []byte(entry), 0o644)
	}
}
