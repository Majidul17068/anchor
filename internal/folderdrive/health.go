package folderdrive

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Majidul17068/anchor/internal/osutil"
	"github.com/Majidul17068/anchor/internal/paths"
)

// A Drive for Desktop folder is a network mount in disguise. When the Drive
// client is not running, the folder still exists but every stat, read and
// list hangs for minutes. Everything that touches the folder therefore runs
// under a deadline, and the UI is told whether the client is actually alive.

const (
	// opTimeout bounds one file operation on the synced folder.
	opTimeout = 8 * time.Second
	// probeTimeout bounds a reachability check; detection must stay snappy.
	probeTimeout = 2500 * time.Millisecond
)

// ErrUnreachable means the folder exists but did not answer in time: the
// cloud client that mounts it is not running (or is stuck).
var ErrUnreachable = errors.New("DRIVE_UNREACHABLE: the synced folder is not responding; is Google Drive for Desktop running?")

// bounded runs fn and gives up after d. A goroutine stuck inside a dead
// mount is leaked on purpose: there is no way to interrupt it, and the
// alternative is a frozen app.
func bounded(d time.Duration, fn func() error) error {
	done := make(chan error, 1)
	go func() { done <- fn() }()
	select {
	case err := <-done:
		return err
	case <-time.After(d):
		return ErrUnreachable
	}
}

// boundedCtx is bounded with the shorter of d and the context's deadline.
func boundedCtx(ctx context.Context, d time.Duration, fn func() error) error {
	if dl, ok := ctx.Deadline(); ok {
		if left := time.Until(dl); left < d {
			d = left
		}
	}
	if d <= 0 {
		return ctx.Err()
	}
	return bounded(d, fn)
}

// Reachable reports whether path is a directory that answers promptly.
func Reachable(path string) bool {
	if path == "" {
		return false
	}
	var isDir bool
	err := bounded(probeTimeout, func() error {
		st, err := os.Stat(path)
		if err != nil {
			return err
		}
		isDir = st.IsDir()
		// Stat alone can be served from a cache; a directory read proves the
		// mount is alive.
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = f.Readdirnames(1)
		if errors.Is(err, os.ErrNotExist) {
			return err
		}
		return nil // io.EOF (empty dir) is fine
	})
	return err == nil && isDir
}

// Exists reports whether path exists at all, even if it does not answer.
func Exists(path string) bool {
	var ok bool
	_ = bounded(probeTimeout, func() error {
		_, err := os.Lstat(path)
		ok = err == nil
		return nil
	})
	return ok
}

// ClientRunning reports whether the Google Drive for Desktop client process
// is alive on this machine.
func ClientRunning() bool {
	var out []byte
	var err error
	switch runtime.GOOS {
	case "windows":
		cmd := exec.Command("tasklist", "/FI", "IMAGENAME eq GoogleDriveFS.exe", "/NH")
		osutil.HideWindow(cmd) // no console flash each time health is checked
		out, err = cmd.Output()
		return err == nil && strings.Contains(strings.ToLower(string(out)), "googledrivefs")
	case "darwin":
		out, err = exec.Command("pgrep", "-x", "Google Drive").Output()
		if err == nil && strings.TrimSpace(string(out)) != "" {
			return true
		}
		out, err = exec.Command("pgrep", "-f", "Google Drive.app/Contents/MacOS/Google Drive").Output()
		return err == nil && strings.TrimSpace(string(out)) != ""
	default:
		out, err = exec.Command("pgrep", "-fi", "drivefs|google-drive").Output()
		return err == nil && strings.TrimSpace(string(out)) != ""
	}
}

// AppPath returns where the Drive for Desktop app is installed, or "".
func AppPath() string {
	var candidates []string
	switch runtime.GOOS {
	case "darwin":
		candidates = []string{"/Applications/Google Drive.app", filepath.Join(paths.Home(), "Applications", "Google Drive.app")}
	case "windows":
		for _, base := range []string{os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"), os.Getenv("LOCALAPPDATA")} {
			if base != "" {
				candidates = append(candidates, filepath.Join(base, "Google", "Drive File Stream", "launch.bat"), filepath.Join(base, "Google", "Drive File Stream"))
			}
		}
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}

// AppInstalled reports whether Drive for Desktop is installed here.
func AppInstalled() bool { return AppPath() != "" }

// OpenClient launches Drive for Desktop so its folder comes back to life.
func OpenClient() error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", "-a", "Google Drive").Run()
	case "windows":
		p := AppPath()
		if p == "" {
			return errors.New("Google Drive for Desktop is not installed")
		}
		if !strings.HasSuffix(strings.ToLower(p), ".bat") {
			p = filepath.Join(p, "launch.bat")
		}
		cmd := exec.Command("cmd", "/C", "start", "", p)
		osutil.HideWindow(cmd)
		return cmd.Run()
	default:
		return errors.New("Google Drive for Desktop is not available on Linux; use another synced folder")
	}
}

// Health describes whether a synced folder can be used right now.
type Health struct {
	// Code is "ok", or one of DRIVE_CLIENT_NOT_RUNNING, DRIVE_CLIENT_MISSING,
	// DRIVE_UNREACHABLE, DRIVE_NOT_FOUND.
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Check inspects a synced folder: does it exist, does it answer, and for a
// Google Drive folder, is the client alive.
func Check(path string) Health {
	if path == "" {
		return Health{Code: "DRIVE_NOT_FOUND", Message: "No synced folder is chosen."}
	}
	if Reachable(path) {
		return Health{Code: "ok"}
	}
	isGoogle := KindOf(path) == "google-drive"
	// A Drive mount whose client is down often fails even Lstat on "My
	// Drive" while the mount directory above it is still there.
	exists := Exists(path) || (isGoogle && Exists(filepath.Dir(path)))
	if !exists {
		return Health{Code: "DRIVE_NOT_FOUND", Message: fmt.Sprintf("The folder %s no longer exists.", path)}
	}
	// Google ships Drive for Desktop for macOS and Windows only. On Linux a
	// "Google Drive" folder is some other tool's mount, so advice about
	// installing or starting Google's client would be wrong there.
	if isGoogle && (runtime.GOOS == "darwin" || runtime.GOOS == "windows") {
		if !AppInstalled() {
			return Health{Code: "DRIVE_CLIENT_MISSING", Message: "This Google Drive folder is left over from an earlier install; Google Drive for Desktop itself is not installed any more. Install it and sign in, then click Connect again."}
		}
		if !ClientRunning() {
			return Health{Code: "DRIVE_CLIENT_NOT_RUNNING", Message: "Google Drive for Desktop is installed but not running, so its folder does not respond. Open Google Drive, wait for it to finish signing in, then click Connect again."}
		}
	}
	return Health{Code: "DRIVE_UNREACHABLE", Message: "The synced folder exists but is not responding. Check that its cloud client is running and signed in."}
}

// Error turns an unhealthy state into the error the UI understands.
func (h Health) Error() error {
	if h.Code == "ok" || h.Code == "" {
		return nil
	}
	return errors.New(h.Code + ": " + h.Message)
}
