package field

import (
	"fmt"
	"syscall"
	"time"
	"unsafe"
)

func setSystemClock(at time.Time) error {
	at = at.UTC()
	st := struct{ Year, Month, Weekday, Day, Hour, Minute, Second, Milliseconds uint16 }{uint16(at.Year()), uint16(at.Month()), uint16(at.Weekday()), uint16(at.Day()), uint16(at.Hour()), uint16(at.Minute()), uint16(at.Second()), uint16(at.Nanosecond() / 1e6)}
	r, _, err := syscall.NewLazyDLL("kernel32.dll").NewProc("SetSystemTime").Call(uintptr(unsafe.Pointer(&st)))
	if r == 0 {
		return fmt.Errorf("设置系统时间失败（需要系统时间权限）: %w", err)
	}
	return nil
}
