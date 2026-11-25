package automation

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

func at(s string) time.Time {
	t, err := time.ParseInLocation("2006-01-02 15:04", s, time.UTC)
	if err != nil {
		panic(err)
	}
	return t
}

func TestNextRunAndDescribe(t *testing.T) {
	utc := "UTC"
	cases := []struct {
		s     model.AutomationSchedule
		after string
		want  string
		text  string
	}{
		{model.AutomationSchedule{Kind: "hourly", Minute: 15, Timezone: utc}, "2026-11-25 10:15", "2026-11-25 11:15", "Every hour at 15 minutes past"},
		{model.AutomationSchedule{Kind: "hourly", Timezone: utc}, "2026-11-25 10:59", "2026-11-25 11:00", "Every hour, on the hour"},
		{model.AutomationSchedule{Kind: "daily", Hour: 9, Timezone: utc}, "2026-11-25 09:00", "2026-11-26 09:00", "Every day at 09:00"},
		{model.AutomationSchedule{Kind: "daily", Hour: 9, Timezone: utc}, "2026-11-25 08:30", "2026-11-25 09:00", "Every day at 09:00"},
		// 2026-11-25 is a Wednesday (3). Monday and Friday at 17:30.
		{model.AutomationSchedule{Kind: "weekly", Hour: 17, Minute: 30, Weekdays: []int{1, 5}, Timezone: utc}, "2026-11-25 12:00", "2026-11-27 17:30", "Every Monday, Friday at 17:30"},
		{model.AutomationSchedule{Kind: "weekly", Hour: 8, Weekdays: []int{1, 2, 3, 4, 5}, Timezone: utc}, "2026-11-27 09:00", "2026-11-30 08:00", "Weekdays at 08:00"},
		{model.AutomationSchedule{Kind: "custom", Cron: "*/30 * * * *", Timezone: utc}, "2026-11-25 10:01", "2026-11-25 10:30", "Custom schedule: */30 * * * *"},
		{model.AutomationSchedule{Kind: "custom", Cron: "0 0 1 * *", Timezone: utc}, "2026-11-25 10:01", "2026-12-01 00:00", "Custom schedule: 0 0 1 * *"},
		// Year rollover and the CLI's own zone prefix.
		{model.AutomationSchedule{Kind: "custom", Cron: "CRON_TZ=UTC 5 4 1 1 *"}, "2026-11-25 10:01", "2027-01-01 04:05", "Custom schedule: CRON_TZ=UTC 5 4 1 1 *"},
	}
	for _, c := range cases {
		got, err := NextRun(c.s, at(c.after))
		if err != nil {
			t.Errorf("%+v: %v", c.s, err)
			continue
		}
		if !got.Equal(at(c.want)) {
			t.Errorf("%s after %s = %s, want %s", Describe(c.s), c.after, got.UTC().Format("2006-01-02 15:04"), c.want)
		}
		if d := Describe(c.s); d != c.text {
			t.Errorf("Describe = %q, want %q", d, c.text)
		}
	}
}

func TestScheduleInItsOwnTimeZone(t *testing.T) {
	// 09:00 in Dhaka (UTC+6) is 03:00 UTC.
	s := model.AutomationSchedule{Kind: "daily", Hour: 9, Timezone: "Asia/Dhaka"}
	got, err := NextRun(s, at("2026-11-25 00:00"))
	if err != nil || !got.Equal(at("2026-11-25 03:00")) {
		t.Fatalf("got %v %v", got.UTC(), err)
	}
}

func TestBadSchedulesAreRefused(t *testing.T) {
	for _, s := range []model.AutomationSchedule{
		{Kind: "weekly", Hour: 9},
		{Kind: "daily", Hour: 24},
		{Kind: "custom", Cron: "every day"},
		{Kind: "custom", Cron: "61 * * * *"},
		{Kind: "custom", Cron: "0 0 31 2 *"}, // 31 February never comes
		{Kind: "sometimes"},
	} {
		if _, err := NextRun(s, at("2026-11-25 00:00")); err == nil {
			t.Errorf("%+v was accepted", s)
		}
	}
}

type harness struct {
	svc  *Service
	mu   sync.Mutex
	ran  []string
	now  time.Time
	fail bool
	done chan struct{}
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	t.Setenv("ANCHOR_HOME", t.TempDir())
	st, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	h := &harness{now: at("2026-11-25 08:00"), done: make(chan struct{}, 16)}
	h.svc = New(st, func(_ context.Context, a model.Automation) (string, string, error) {
		h.mu.Lock()
		h.ran = append(h.ran, a.Name)
		fail := h.fail
		h.mu.Unlock()
		defer func() { h.done <- struct{}{} }()
		if fail {
			return "sess-1", "", errors.New("quota exhausted")
		}
		return "sess-1", "All good. 3 pull requests open.", nil
	}, nil, nil)
	h.svc.now = func() time.Time { h.mu.Lock(); defer h.mu.Unlock(); return h.now }
	return h
}

func (h *harness) set(s string) { h.mu.Lock(); h.now = at(s); h.mu.Unlock() }

func (h *harness) wait(t *testing.T) {
	t.Helper()
	select {
	case <-h.done:
		time.Sleep(30 * time.Millisecond) // let the run be recorded
	case <-time.After(3 * time.Second):
		t.Fatal("the automation did not run")
	}
}

func (h *harness) count() int { h.mu.Lock(); defer h.mu.Unlock(); return len(h.ran) }

func daily9(name string, catchUp bool) model.Automation {
	return model.Automation{Name: name, Prompt: "check things", Enabled: true, CatchUp: catchUp,
		Schedule: model.AutomationSchedule{Kind: "daily", Hour: 9, Timezone: "UTC"}}
}

// An automation runs when its time comes, once, records the result, and is
// planned for the next day; a disabled one never runs.
func TestRunsWhenDueOnceAndRecords(t *testing.T) {
	h := newHarness(t)
	a, err := h.svc.Save(daily9("Morning check", false))
	if err != nil {
		t.Fatal(err)
	}
	off := daily9("Switched off", false)
	off.Enabled = false
	if _, err := h.svc.Save(off); err != nil {
		t.Fatal(err)
	}
	stop := make(chan struct{})
	defer close(stop)
	go h.svc.worker(stop)

	h.svc.check(false)
	if h.count() != 0 {
		t.Fatal("ran before its time")
	}
	h.set("2026-11-25 09:00")
	h.svc.check(false)
	h.wait(t)
	h.svc.check(false) // same minute again: must not fire twice
	time.Sleep(50 * time.Millisecond)
	if h.count() != 1 {
		t.Fatalf("ran %d times at 09:00, want once", h.count())
	}
	runs := h.svc.Runs(a.ID)
	if len(runs) != 1 || runs[0].Status != "ok" || runs[0].Trigger != "schedule" || runs[0].SessionID != "sess-1" || runs[0].Summary == "" {
		t.Fatalf("run record: %+v", runs)
	}
	got, _ := h.svc.Get(a.ID)
	if got.NextRunAt != "2026-11-26T09:00:00Z" || got.LastRun == nil || got.Running {
		t.Fatalf("after run: next=%s last=%v running=%v", got.NextRunAt, got.LastRun, got.Running)
	}
}

// A run missed while Anchor was closed happens once at start only when the
// automation asks to catch up; several missed days still mean one run.
func TestMissedRunsCatchUpOnceOrNotAtAll(t *testing.T) {
	h := newHarness(t)
	yes, _ := h.svc.Save(daily9("Catches up", true))
	no, _ := h.svc.Save(daily9("Skips missed", false))
	stop := make(chan struct{})
	defer close(stop)
	go h.svc.worker(stop)

	h.set("2026-11-28 14:00") // three mornings later
	h.svc.check(true)
	h.wait(t)
	time.Sleep(60 * time.Millisecond)
	if h.count() != 1 {
		t.Fatalf("%d runs after three missed days, want exactly one", h.count())
	}
	if r := h.svc.Runs(yes.ID); len(r) != 1 || r[0].Trigger != "catch-up" {
		t.Fatalf("catch-up run: %+v", r)
	}
	if r := h.svc.Runs(no.ID); len(r) != 0 {
		t.Fatalf("an automation that does not catch up ran: %+v", r)
	}
	g, _ := h.svc.Get(no.ID)
	if g.NextRunAt != "2026-11-29T09:00:00Z" {
		t.Fatalf("next run not replanned: %s", g.NextRunAt)
	}
}

// Run now works whatever the schedule, a failure is recorded with its
// reason, and editing the schedule never triggers a run by itself.
func TestRunNowFailureAndEditing(t *testing.T) {
	h := newHarness(t)
	a, _ := h.svc.Save(daily9("Manual", false))
	stop := make(chan struct{})
	defer close(stop)
	go h.svc.worker(stop)

	h.mu.Lock()
	h.fail = true
	h.mu.Unlock()
	if err := h.svc.RunNow(a.ID); err != nil {
		t.Fatal(err)
	}
	h.wait(t)
	runs := h.svc.Runs(a.ID)
	if len(runs) != 1 || runs[0].Status != "error" || runs[0].Error != "quota exhausted" || runs[0].Trigger != "manual" {
		t.Fatalf("failed run record: %+v", runs)
	}

	// Moving the time to one already past today must not run it now.
	h.set("2026-11-25 12:00")
	a.Schedule.Hour = 10
	if _, err := h.svc.Save(a); err != nil {
		t.Fatal(err)
	}
	h.svc.check(false)
	time.Sleep(60 * time.Millisecond)
	if h.count() != 1 {
		t.Fatal("editing the schedule triggered a run")
	}

	if _, err := h.svc.Save(model.Automation{Name: "", Prompt: "x", Schedule: model.AutomationSchedule{Kind: "daily"}}); err == nil {
		t.Fatal("an automation without a name was saved")
	}
	if err := h.svc.Delete(a.ID); err != nil || len(h.svc.List()) != 0 {
		t.Fatal("delete failed")
	}
}
