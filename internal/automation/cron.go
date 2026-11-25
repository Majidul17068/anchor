package automation

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Majidul17068/anchor/internal/model"
)

// A schedule is kept the way people set it (every hour, daily at 9:00,
// Mondays and Fridays at 17:30) and turned into a standard five-field cron
// expression, which is also what the Antigravity CLI's own automations use.

type field struct {
	any  bool
	vals map[int]bool
}

func (f field) has(v int) bool { return f.any || f.vals[v] }

type cronSpec struct {
	min, hour, dom, month, dow field
}

func parseField(s string, lo, hi int) (field, error) {
	f := field{vals: map[int]bool{}}
	if s == "*" || s == "?" {
		f.any = true
		return f, nil
	}
	for _, part := range strings.Split(s, ",") {
		step := 1
		if i := strings.Index(part, "/"); i >= 0 {
			n, err := strconv.Atoi(part[i+1:])
			if err != nil || n <= 0 {
				return f, fmt.Errorf("bad step in %q", part)
			}
			step, part = n, part[:i]
		}
		a, b := lo, hi
		switch {
		case part == "*":
		case strings.Contains(part, "-"):
			r := strings.SplitN(part, "-", 2)
			var e1, e2 error
			a, e1 = strconv.Atoi(r[0])
			b, e2 = strconv.Atoi(r[1])
			if e1 != nil || e2 != nil {
				return f, fmt.Errorf("bad range %q", part)
			}
		default:
			n, err := strconv.Atoi(part)
			if err != nil {
				return f, fmt.Errorf("bad value %q", part)
			}
			a, b = n, n
			if step > 1 {
				b = hi
			}
		}
		if a < lo || b > hi || a > b {
			return f, fmt.Errorf("%q is outside %d-%d", part, lo, hi)
		}
		for v := a; v <= b; v += step {
			f.vals[v] = true
		}
	}
	return f, nil
}

// parseCron reads "m h dom mon dow". An optional leading CRON_TZ=Zone or
// TZ=Zone (as the CLI writes it) is returned separately.
func parseCron(expr string) (cronSpec, string, error) {
	var c cronSpec
	zone := ""
	fs := strings.Fields(expr)
	if len(fs) > 0 && (strings.HasPrefix(fs[0], "CRON_TZ=") || strings.HasPrefix(fs[0], "TZ=")) {
		zone = fs[0][strings.Index(fs[0], "=")+1:]
		fs = fs[1:]
	}
	if len(fs) != 5 {
		return c, zone, errors.New("a schedule has five parts: minute hour day-of-month month day-of-week")
	}
	var err error
	if c.min, err = parseField(fs[0], 0, 59); err != nil {
		return c, zone, fmt.Errorf("minute: %w", err)
	}
	if c.hour, err = parseField(fs[1], 0, 23); err != nil {
		return c, zone, fmt.Errorf("hour: %w", err)
	}
	if c.dom, err = parseField(fs[2], 1, 31); err != nil {
		return c, zone, fmt.Errorf("day of month: %w", err)
	}
	if c.month, err = parseField(fs[3], 1, 12); err != nil {
		return c, zone, fmt.Errorf("month: %w", err)
	}
	// Sunday may be written 0 or 7.
	if c.dow, err = parseField(strings.ReplaceAll(fs[4], "7", "0"), 0, 6); err != nil {
		return c, zone, fmt.Errorf("day of week: %w", err)
	}
	return c, zone, nil
}

func (c cronSpec) matches(t time.Time) bool {
	if !c.min.has(t.Minute()) || !c.hour.has(t.Hour()) || !c.month.has(int(t.Month())) {
		return false
	}
	// Standard cron: when both day fields are restricted, either may match.
	dom, dow := c.dom.has(t.Day()), c.dow.has(int(t.Weekday()))
	if !c.dom.any && !c.dow.any {
		return dom || dow
	}
	return dom && dow
}

// next returns the first matching minute strictly after t, in t's zone, or
// the zero time if nothing matches within two years.
func (c cronSpec) next(t time.Time) time.Time {
	t = t.Truncate(time.Minute).Add(time.Minute)
	end := t.AddDate(2, 0, 0)
	for t.Before(end) {
		switch {
		case !c.month.has(int(t.Month())):
			t = time.Date(t.Year(), t.Month()+1, 1, 0, 0, 0, 0, t.Location())
		case !c.dayOK(t):
			t = time.Date(t.Year(), t.Month(), t.Day()+1, 0, 0, 0, 0, t.Location())
		case !c.hour.has(t.Hour()):
			t = t.Truncate(time.Hour).Add(time.Hour)
		case !c.min.has(t.Minute()):
			t = t.Add(time.Minute)
		default:
			return t
		}
	}
	return time.Time{}
}

func (c cronSpec) dayOK(t time.Time) bool {
	dom, dow := c.dom.has(t.Day()), c.dow.has(int(t.Weekday()))
	if !c.dom.any && !c.dow.any {
		return dom || dow
	}
	return dom && dow
}

// CronOf turns a schedule into a five-field cron expression.
func CronOf(s model.AutomationSchedule) (string, error) {
	if s.Minute < 0 || s.Minute > 59 || s.Hour < 0 || s.Hour > 23 {
		return "", errors.New("the time is not valid")
	}
	switch s.Kind {
	case "hourly":
		return fmt.Sprintf("%d * * * *", s.Minute), nil
	case "daily":
		return fmt.Sprintf("%d %d * * *", s.Minute, s.Hour), nil
	case "weekly":
		if len(s.Weekdays) == 0 {
			return "", errors.New("choose at least one day of the week")
		}
		var days []string
		for _, d := range s.Weekdays {
			if d < 0 || d > 6 {
				return "", errors.New("a day of the week is not valid")
			}
			days = append(days, strconv.Itoa(d))
		}
		return fmt.Sprintf("%d %d * * %s", s.Minute, s.Hour, strings.Join(days, ",")), nil
	case "custom":
		expr := strings.TrimSpace(s.Cron)
		if _, _, err := parseCron(expr); err != nil {
			return "", err
		}
		return expr, nil
	}
	return "", fmt.Errorf("unknown schedule %q", s.Kind)
}

// zoneOf is the time zone a schedule runs in: its own when set and known,
// else the computer's.
func zoneOf(name string) *time.Location {
	if name != "" {
		if loc, err := time.LoadLocation(name); err == nil {
			return loc
		}
	}
	return time.Local
}

// NextRun is when a schedule next fires after the given moment.
func NextRun(s model.AutomationSchedule, after time.Time) (time.Time, error) {
	expr, err := CronOf(s)
	if err != nil {
		return time.Time{}, err
	}
	c, zone, err := parseCron(expr)
	if err != nil {
		return time.Time{}, err
	}
	if zone == "" {
		zone = s.Timezone
	}
	n := c.next(after.In(zoneOf(zone)))
	if n.IsZero() {
		return n, errors.New("this schedule never runs")
	}
	return n, nil
}

var dayNames = []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}

// Describe says a schedule in words: "Every day at 09:00".
func Describe(s model.AutomationSchedule) string {
	at := fmt.Sprintf("%02d:%02d", s.Hour, s.Minute)
	switch s.Kind {
	case "hourly":
		if s.Minute == 0 {
			return "Every hour, on the hour"
		}
		return fmt.Sprintf("Every hour at %d minutes past", s.Minute)
	case "daily":
		return "Every day at " + at
	case "weekly":
		if len(s.Weekdays) == 7 {
			return "Every day at " + at
		}
		if len(s.Weekdays) == 5 {
			set := map[int]bool{}
			for _, d := range s.Weekdays {
				set[d] = true
			}
			if set[1] && set[2] && set[3] && set[4] && set[5] {
				return "Weekdays at " + at
			}
		}
		var names []string
		for d := 0; d < 7; d++ {
			for _, w := range s.Weekdays {
				if w == d {
					names = append(names, dayNames[d])
				}
			}
		}
		return "Every " + strings.Join(names, ", ") + " at " + at
	case "custom":
		return "Custom schedule: " + strings.TrimSpace(s.Cron)
	}
	return ""
}
