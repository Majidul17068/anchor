// Package cli finds, inspects, and installs the Antigravity CLI (`agy`).
package cli

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
)

const (
	installScriptUnix    = "https://antigravity.google/cli/install.sh"
	installScriptWindows = "https://antigravity.google/cli/install.ps1"
)

type Locator struct {
	override string // path chosen by the user ("Locate binary")
}

func NewLocator(override string) *Locator { return &Locator{override: override} }

func (l *Locator) SetOverride(p string) { l.override = p }

func binaryName() string {
	if runtime.GOOS == "windows" {
		return "agy.exe"
	}
	return "agy"
}

// candidates lists the places the official installers put the binary.
func (l *Locator) candidates() []string {
	home := paths.Home()
	var c []string
	if l.override != "" {
		c = append(c, l.override)
	}
	if p, err := exec.LookPath("agy"); err == nil {
		c = append(c, p)
	}
	c = append(c,
		filepath.Join(home, ".local", "bin", binaryName()),
		filepath.Join(paths.GeminiDir(), "bin", binaryName()),
	)
	if runtime.GOOS == "windows" {
		if lad := os.Getenv("LOCALAPPDATA"); lad != "" {
			c = append(c, filepath.Join(lad, "agy", "bin", "agy.exe"))
		}
	}
	if runtime.GOOS == "darwin" {
		c = append(c, "/opt/homebrew/bin/agy", "/usr/local/bin/agy")
	}
	return c
}

// Find returns the first existing executable path.
func (l *Locator) Find() (string, bool) {
	for _, p := range l.candidates() {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p, true
		}
	}
	return "", false
}

func Version(path string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, path, "--version")
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(strings.Split(string(out), "\n")[0])
}

func (l *Locator) Status() model.CliStatus {
	p, ok := l.Find()
	if !ok {
		return model.CliStatus{Installed: false}
	}
	return model.CliStatus{Installed: true, Path: p, Version: Version(p)}
}

// Run executes agy with args and returns stdout.
func Run(ctx context.Context, path string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, path, args...)
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			return string(out), fmt.Errorf("agy %s: %s", strings.Join(args, " "), strings.TrimSpace(string(ee.Stderr)))
		}
		return string(out), err
	}
	return string(out), nil
}

// Install runs Google's official installer for this platform and streams
// progress. The binary is downloaded from Google at install time; Anchor
// never bundles it.
func (l *Locator) Install(ctx context.Context, progress func(model.InstallProgress)) (string, error) {
	report := func(phase string, pct int, msg string) {
		if progress != nil {
			progress(model.InstallProgress{Phase: phase, Percent: pct, Message: msg})
		}
	}
	report("download", 5, "Contacting antigravity.google…")

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.CommandContext(ctx, "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
			fmt.Sprintf("[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; irm %s | iex", installScriptWindows))
	default:
		shell := "bash"
		if _, err := exec.LookPath(shell); err != nil {
			shell = "sh"
		}
		cmd = exec.CommandContext(ctx, shell, "-c", fmt.Sprintf("curl -fsSL %s | %s", installScriptUnix, shell))
	}
	hideWindow(cmd)
	cmd.Env = append(os.Environ(), "CI=1", "NONINTERACTIVE=1")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	cmd.Stderr = cmd.Stdout
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("could not start installer: %w", err)
	}
	sc := bufio.NewScanner(stdout)
	pct := 10
	var lastLines []string
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		lastLines = append(lastLines, line)
		if len(lastLines) > 20 {
			lastLines = lastLines[1:]
		}
		if pct < 85 {
			pct += 3
		}
		phase := "download"
		lower := strings.ToLower(line)
		if strings.Contains(lower, "install") || strings.Contains(lower, "extract") {
			phase = "install"
		}
		report(phase, pct, line)
	}
	if err := cmd.Wait(); err != nil {
		return "", fmt.Errorf("installer failed: %v\n%s", err, strings.Join(lastLines, "\n"))
	}
	report("verify", 92, "Verifying the Antigravity CLI…")
	l.override = ""
	p, ok := l.Find()
	if !ok {
		return "", errors.New("installer finished but agy was not found; restart Anchor or locate the binary manually")
	}
	v := Version(p)
	report("done", 100, "Antigravity CLI "+v+" is ready")
	return p, nil
}
