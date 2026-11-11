//go:build windows

package acp

import (
	"os/exec"
	"syscall"
)

// hideWindow prevents a console window from flashing when the CLI starts.
func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
