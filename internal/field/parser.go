package field

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

// Framer handles fragmented CRLF/LF records without unbounded serial input growth.
type Framer struct {
	pending  []byte
	dropping bool
}

func (f *Framer) Feed(data []byte) (lines []string, overflow bool) {
	for _, b := range data {
		if b == '\r' || b == '\n' {
			if !f.dropping && len(f.pending) > 0 {
				lines = append(lines, string(f.pending))
			}
			f.pending = f.pending[:0]
			f.dropping = false
		} else if !f.dropping {
			if len(f.pending) >= 4096 {
				f.pending = f.pending[:0]
				f.dropping = true
				overflow = true
			} else {
				f.pending = append(f.pending, b)
			}
		}
	}
	return
}

type GPSUpdate struct {
	Kind                                 string
	FixValid                             *bool
	FixQuality                           *int
	Satellites                           *int
	Latitude, Longitude, AltitudeM, HDOP *float64
	Time                                 *time.Time
	TimeValid                            *bool
}

func ptr[T any](v T) *T { return &v }
func coordinate(raw, hemi string, latitude bool) (float64, error) {
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return 0, errors.New("无效经纬度")
	}
	degrees := math.Floor(value / 100)
	minutes := value - degrees*100
	limit := 180.0
	if latitude {
		limit = 90
	}
	if minutes >= 60 || degrees > limit || (degrees == limit && minutes > 0) {
		return 0, errors.New("经纬度越界")
	}
	positive, negative := "E", "W"
	if latitude {
		positive, negative = "N", "S"
	}
	if hemi != positive && hemi != negative {
		return 0, errors.New("无效经纬度方向")
	}
	value = degrees + minutes/60
	if hemi == negative {
		value = -value
	}
	return value, nil
}
func dateTime(clock string, year, month, day int) (time.Time, error) {
	if len(clock) < 6 {
		return time.Time{}, errors.New("无效 UTC 时间")
	}
	for _, digit := range clock[:6] {
		if digit < '0' || digit > '9' {
			return time.Time{}, errors.New("无效 UTC 时间")
		}
	}
	h, _ := strconv.Atoi(clock[:2])
	m, _ := strconv.Atoi(clock[2:4])
	s, _ := strconv.Atoi(clock[4:6])
	if h > 23 || m > 59 || s >= 60 {
		return time.Time{}, errors.New("无效 UTC 时间（闰秒需独立处理）")
	}
	ns := 0
	if len(clock) > 6 {
		if clock[6] != '.' || len(clock) < 8 || len(clock) > 16 {
			return time.Time{}, errors.New("无效 UTC 小数秒")
		}
		fraction := clock[7:]
		for _, digit := range fraction {
			if digit < '0' || digit > '9' {
				return time.Time{}, errors.New("无效 UTC 小数秒")
			}
		}
		ns, _ = strconv.Atoi(fraction + strings.Repeat("0", 9-len(fraction)))
	}
	t := time.Date(year, time.Month(month), day, h, m, s, ns, time.UTC)
	if t.Year() != year || int(t.Month()) != month || t.Day() != day {
		return time.Time{}, errors.New("无效 UTC 日期")
	}
	return t, nil
}
func optionalFloat(s string) *float64 {
	v, e := strconv.ParseFloat(s, 64)
	if e != nil || math.IsNaN(v) || math.IsInf(v, 0) {
		return nil
	}
	return &v
}
func ParseGPS(line string) (*GPSUpdate, error) {
	line = strings.TrimSpace(line)
	if !strings.HasPrefix(line, "$") {
		return nil, nil
	}
	star := strings.LastIndexByte(line, '*')
	if star < 1 || len(line) != star+3 {
		return nil, errors.New("NMEA 缺少校验和")
	}
	want, err := strconv.ParseUint(line[star+1:], 16, 8)
	if err != nil {
		return nil, errors.New("NMEA 校验和格式错误")
	}
	var got byte
	for i := 1; i < star; i++ {
		got ^= line[i]
	}
	if got != byte(want) {
		return nil, errors.New("NMEA 校验失败")
	}
	fields := strings.Split(line[1:star], ",")
	if len(fields[0]) != 5 {
		return nil, nil
	}
	kind := fields[0][2:]
	u := &GPSUpdate{Kind: kind}
	switch kind {
	case "RMC":
		if len(fields) < 10 {
			return nil, errors.New("RMC 字段不足")
		}
		if fields[2] != "A" && fields[2] != "V" {
			return nil, errors.New("RMC 状态无效")
		}
		valid := fields[2] == "A"
		u.FixValid = &valid
		u.TimeValid = ptr(false)
		if !valid {
			return u, nil
		}
		if len(fields[9]) != 6 {
			return nil, errors.New("RMC 日期无效")
		}
		day, e1 := strconv.Atoi(fields[9][:2])
		month, e2 := strconv.Atoi(fields[9][2:4])
		year, e3 := strconv.Atoi(fields[9][4:])
		if e1 != nil || e2 != nil || e3 != nil {
			return nil, errors.New("RMC 日期无效")
		}
		if year >= 80 {
			year += 1900
		} else {
			year += 2000
		}
		t, err := dateTime(fields[1], year, month, day)
		if err != nil {
			return nil, err
		}
		lat, err := coordinate(fields[3], fields[4], true)
		if err != nil {
			return nil, err
		}
		lon, err := coordinate(fields[5], fields[6], false)
		if err != nil {
			return nil, err
		}
		u.Latitude = &lat
		u.Longitude = &lon
		u.Time = &t
		u.TimeValid = ptr(true)
	case "GGA":
		if len(fields) < 11 {
			return nil, errors.New("GGA 字段不足")
		}
		q, e := strconv.Atoi(fields[6])
		if e != nil || q < 0 || q > 8 {
			return nil, errors.New("GGA 定位质量无效")
		}
		u.FixQuality = &q
		u.FixValid = ptr(q > 0)
		if n, e := strconv.Atoi(fields[7]); e == nil && n >= 0 && n <= 999 {
			u.Satellites = &n
		}
		if q > 0 {
			lat, e := coordinate(fields[2], fields[3], true)
			if e != nil {
				return nil, e
			}
			lon, e := coordinate(fields[4], fields[5], false)
			if e != nil {
				return nil, e
			}
			u.Latitude = &lat
			u.Longitude = &lon
		}
		u.HDOP = optionalFloat(fields[8])
		if fields[10] == "M" {
			u.AltitudeM = optionalFloat(fields[9])
		}
		// GGA has no date: never invent UTC from the host clock.
	case "ZDA":
		if len(fields) < 5 {
			return nil, errors.New("ZDA 字段不足")
		}
		d, e1 := strconv.Atoi(fields[2])
		m, e2 := strconv.Atoi(fields[3])
		y, e3 := strconv.Atoi(fields[4])
		if e1 != nil || e2 != nil || e3 != nil {
			return nil, errors.New("ZDA 日期无效")
		}
		t, e := dateTime(fields[1], y, m, d)
		if e != nil {
			return nil, e
		}
		u.Time = &t
		u.TimeValid = ptr(true)
	default:
		return nil, nil
	}
	return u, nil
}

// GPS_Time_Sync reads a plain Unix-seconds response from !T?. No lock or
// precision status is present in that protocol, so neither is inferred here.
func ParseAtomic(line string) (time.Time, error) {
	value := strings.TrimSpace(line)
	if value == "" {
		return time.Time{}, errors.New("原子钟响应为空")
	}
	for _, c := range value {
		if c < '0' || c > '9' {
			return time.Time{}, errors.New("原子钟响应不是 Unix 秒时间戳")
		}
	}
	seconds, e := strconv.ParseInt(value, 10, 64)
	if e != nil || seconds < 0 || seconds > 253402300799 {
		return time.Time{}, errors.New("原子钟时间戳越界")
	}
	return time.Unix(seconds, 0).UTC(), nil
}
func AtomicSetCommand(t time.Time) string { return fmt.Sprintf("!TA%d\r\n", t.Unix()) }
