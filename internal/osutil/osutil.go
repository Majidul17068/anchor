// Package osutil holds the few things that differ between macOS, Windows
// and Linux and are needed in more than one place: file URIs, opening a
// folder in the system file manager, and keeping helper processes from
// flashing a console window on Windows.
package osutil

import (
	"errors"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// FileURI turns a local path into a valid file URI on every platform.
// "file://" + path is wrong on Windows (file://C:/x reads "C:" as a host)
// and leaves spaces unescaped everywhere.
func FileURI(path string) string {
	p := filepath.ToSlash(path)
	if filepath.VolumeName(path) != "" || (len(p) >= 2 && p[1] == ':') {
		p = "/" + p // C:/Users/x -> /C:/Users/x
	}
	return (&url.URL{Scheme: "file", Path: p}).String()
}

// PathFromFileURI is the inverse of FileURI; ok is false for anything that
// is not a file URI.
func PathFromFileURI(uri string) (string, bool) {
	u, err := url.Parse(uri)
	if err != nil || u.Scheme != "file" {
		return "", false
	}
	p := u.Path
	if u.Host != "" && len(u.Host) == 2 && u.Host[1] == ':' { // file://C:/x written by older code
		p = u.Host + p
	}
	// /C:/Users/x -> C:/Users/x
	if len(p) >= 3 && p[0] == '/' && p[2] == ':' {
		p = p[1:]
	}
	if p == "" {
		return "", false
	}
	return filepath.FromSlash(p), true
}

// OpenPath shows a file or folder in the system's file manager (Finder,
// Explorer, or whatever xdg-open is set to). The desktop shell's own "open
// URL" refuses file: URLs, so folders need this.
func OpenPath(path string) error {
	if _, err := os.Stat(path); err != nil {
		return err
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", path)
	case "windows":
		// explorer exits non-zero even on success; start it and move on.
		cmd = exec.Command("explorer", filepath.Clean(path))
		HideWindow(cmd)
		return cmd.Start()
	default:
		opener, err := exec.LookPath("xdg-open")
		if err != nil {
			return errors.New("xdg-open is not installed; open " + path + " in your file manager")
		}
		cmd = exec.Command(opener, path)
	}
	HideWindow(cmd)
	return cmd.Start()
}

// Base returns the last element of a path written with either separator,
// for paths that may come from another operating system (synced sessions).
func Base(path string) string {
	p := strings.TrimRight(strings.ReplaceAll(path, "\\", "/"), "/")
	if i := strings.LastIndex(p, "/"); i >= 0 {
		return p[i+1:]
	}
	return p
}
