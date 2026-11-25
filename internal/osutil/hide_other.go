//go:build !windows

package osutil

import "os/exec"

// HideWindow keeps a helper process from opening a console window. Only
// Windows opens one.
func HideWindow(cmd *exec.Cmd) {}
