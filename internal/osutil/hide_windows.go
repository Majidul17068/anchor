//go:build windows

package osutil

import (
	"os/exec"
	"syscall"
)

// HideWindow keeps a helper process from opening a console window.
func HideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
