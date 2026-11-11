//go:build !windows

package acp

import "os/exec"

func hideWindow(cmd *exec.Cmd) {}
