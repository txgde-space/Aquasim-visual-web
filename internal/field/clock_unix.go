//go:build linux || darwin

package field

import (
	"fmt"
	"syscall"
	"time"
)

func setSystemClock(at time.Time) error {
	tv := syscall.NsecToTimeval(int64(at.Nanosecond()))
	tv.Sec = at.Unix()
	if err := syscall.Settimeofday(&tv); err != nil {
		return fmt.Errorf("设置系统时间失败（Linux 需要 CAP_SYS_TIME/root，macOS 需要管理员权限）: %w", err)
	}
	return nil
}
