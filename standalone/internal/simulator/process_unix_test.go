//go:build !windows

package simulator

import (
	"context"
	"testing"
	"time"
)

func TestProcessGroupDeadline(t *testing.T) {
	start := time.Now()
	_, e := command(context.Background(), t.TempDir(), 100*time.Millisecond, "/bin/sh", "-c", "sleep 30 & wait")
	if e == nil || time.Since(start) > 3*time.Second {
		t.Fatalf("deadline did not release process group: %v %s", e, time.Since(start))
	}
}
