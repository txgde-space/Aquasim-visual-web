//go:build !linux && !darwin && !windows

package field

import (
	"errors"
	"time"
)

func setSystemClock(time.Time) error { return errors.New("此系统暂不支持设置系统时间") }
