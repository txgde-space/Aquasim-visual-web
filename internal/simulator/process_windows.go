//go:build windows

package simulator

import "os/exec"

// Windows CommandContext terminates the native process on timeout.
func configureProcess(cmd *exec.Cmd) {}
