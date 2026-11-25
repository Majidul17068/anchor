// Package automation runs tasks on a schedule: at each due time Anchor
// starts a fresh conversation with the automation's prompt, nobody at the
// keyboard, and keeps what happened as a normal session plus a line in the
// automation's run history.
//
// Anchor is the scheduler. The Antigravity CLI has automations of its own
// (sidecar.json files), but it only runs them once they are switched on in
// Google's dashboard and offers other programs no way to do that or to see
// the results; the same file format is used for import and export so the two
// stay interchangeable.
//
// Runs happen while Anchor is running. A run missed while it was closed is
// made up once at the next start when the automation asks for that.
package automation

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/paths"
	"github.com/Majidul17068/anchor/internal/store"
)

const (
	maxRunsKept = 60               // per automation
	runTimeout  = 30 * time.Minute // one run
	tick        = 20 * time.Second
	// A run more than this late is not "due now" but "missed" (the computer
	// slept, Anchor was closed); it runs only if the automation catches up.
	lateGrace = 3 * time.Minute
)

// Runner starts a conversation, sends the prompt and waits for the answer.
type Runner func(ctx context.Context, a model.Automation) (sessionID, summary string, err error)

type state struct {
	Automations []model.Automation               `json:"automations"`
	Runs        map[string][]model.AutomationRun `json:"runs"`
	// Due is, per automation, the time its next run is scheduled for. Kept
	// on disk so a run missed while Anchor was closed is noticed at start.
	Due map[string]string `json:"due"`
}

type Service struct {
	st   *store.Store
	run  Runner
	emit func(string, any)
	logf func(string, ...any)
	now  func() time.Time

	mu      sync.Mutex
	running map[string]bool
	stop    chan struct{}
	// queue runs one automation at a time: unattended work should not pile
	// up against the account's limits.
	queue chan job
}

type job struct {
	id      string
	trigger string
}

func New(st *store.Store, run Runner, emit func(string, any), logf func(string, ...any)) *Service {
	if logf == nil {
		logf = func(string, ...any) {}
	}
	if emit == nil {
		emit = func(string, any) {}
	}
	return &Service{st: st, run: run, emit: emit, logf: logf, now: time.Now, running: map[string]bool{}, queue: make(chan job, 64)}
}

func dir() string { return filepath.Join(paths.AnchorDir(), "automations") }

func (s *Service) load() state {
	var st state
	_ = s.st.ReadBlob(dir(), "automations", &st)
	if st.Automations == nil {
		st.Automations = []model.Automation{}
	}
	if st.Runs == nil {
		st.Runs = map[string][]model.AutomationRun{}
	}
	if st.Due == nil {
		st.Due = map[string]string{}
	}
	return st
}

func (s *Service) save(st state) error { return s.st.WriteBlob(dir(), "automations", st) }

func (s *Service) changed() { s.emit("automations:changed", nil) }

// decorate fills the fields the UI shows but the file does not store.
func (s *Service) decorate(a model.Automation, st state) model.Automation {
	a.ScheduleText = Describe(a.Schedule)
	if a.Schedule.Weekdays == nil {
		a.Schedule.Weekdays = []int{}
	}
	if a.Enabled {
		if n, err := NextRun(a.Schedule, s.now()); err == nil {
			a.NextRunAt = n.UTC().Format(time.RFC3339)
		}
	}
	s.mu.Lock()
	a.Running = s.running[a.ID]
	s.mu.Unlock()
	if runs := st.Runs[a.ID]; len(runs) > 0 {
		r := runs[0]
		a.LastRun = &r
	}
	return a
}

// List returns the automations, enabled first, then by name.
func (s *Service) List() []model.Automation {
	st := s.load()
	out := make([]model.Automation, 0, len(st.Automations))
	for _, a := range st.Automations {
		out = append(out, s.decorate(a, st))
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Enabled != out[j].Enabled {
			return out[i].Enabled
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out
}

func (s *Service) Get(id string) (model.Automation, error) {
	st := s.load()
	for _, a := range st.Automations {
		if a.ID == id {
			return s.decorate(a, st), nil
		}
	}
	return model.Automation{}, errors.New("automation not found")
}

// Runs returns an automation's history, newest first.
func (s *Service) Runs(id string) []model.AutomationRun {
	runs := s.load().Runs[id]
	if runs == nil {
		runs = []model.AutomationRun{}
	}
	return runs
}

func validate(a *model.Automation) error {
	a.Name = strings.TrimSpace(a.Name)
	a.Prompt = strings.TrimSpace(a.Prompt)
	if a.Name == "" {
		return errors.New("give the automation a name")
	}
	if a.Prompt == "" {
		return errors.New("say what the automation should do")
	}
	switch a.Access {
	case "read", "edit", "full":
	case "":
		a.Access = "read"
	default:
		return errors.New("unknown access level")
	}
	if a.Schedule.Weekdays == nil {
		a.Schedule.Weekdays = []int{}
	}
	if _, err := CronOf(a.Schedule); err != nil {
		return err
	}
	if _, err := NextRun(a.Schedule, time.Now()); err != nil {
		return err
	}
	if a.Workspace != "" {
		if fi, err := os.Stat(a.Workspace); err != nil || !fi.IsDir() {
			return errors.New("the folder " + a.Workspace + " does not exist")
		}
	}
	return nil
}

// Save creates an automation (empty ID) or updates one.
func (s *Service) Save(in model.Automation) (model.Automation, error) {
	if err := validate(&in); err != nil {
		return model.Automation{}, err
	}
	st := s.load()
	now := store.Now()
	in.ScheduleText, in.NextRunAt, in.Running, in.LastRun = "", "", false, nil
	found := false
	for i := range st.Automations {
		if st.Automations[i].ID == in.ID && in.ID != "" {
			in.CreatedAt, in.UpdatedAt = st.Automations[i].CreatedAt, now
			st.Automations[i] = in
			found = true
		}
	}
	if !found {
		in.ID = "auto_" + strings.ReplaceAll(uuid.NewString(), "-", "")[:10]
		in.CreatedAt, in.UpdatedAt = now, now
		st.Automations = append(st.Automations, in)
	}
	// The schedule may have changed: plan from now, never run a "missed"
	// time that only exists because of the edit.
	s.plan(&st, in, s.now())
	if err := s.save(st); err != nil {
		return model.Automation{}, err
	}
	s.changed()
	return s.decorate(in, st), nil
}

// SetEnabled switches an automation on or off.
func (s *Service) SetEnabled(id string, on bool) (model.Automation, error) {
	st := s.load()
	for i := range st.Automations {
		if st.Automations[i].ID == id {
			st.Automations[i].Enabled = on
			st.Automations[i].UpdatedAt = store.Now()
			s.plan(&st, st.Automations[i], s.now())
			if err := s.save(st); err != nil {
				return model.Automation{}, err
			}
			s.changed()
			return s.decorate(st.Automations[i], st), nil
		}
	}
	return model.Automation{}, errors.New("automation not found")
}

// Delete removes an automation and its history. Conversations its runs
// produced stay in the session list.
func (s *Service) Delete(id string) error {
	st := s.load()
	keep := st.Automations[:0]
	for _, a := range st.Automations {
		if a.ID != id {
			keep = append(keep, a)
		}
	}
	st.Automations = keep
	delete(st.Runs, id)
	delete(st.Due, id)
	if err := s.save(st); err != nil {
		return err
	}
	s.changed()
	return nil
}

// plan records when a is next due, counted from after.
func (s *Service) plan(st *state, a model.Automation, after time.Time) {
	if !a.Enabled {
		delete(st.Due, a.ID)
		return
	}
	if n, err := NextRun(a.Schedule, after); err == nil {
		st.Due[a.ID] = n.UTC().Format(time.RFC3339)
	} else {
		delete(st.Due, a.ID)
	}
}

// RunNow queues a run at once, whatever the schedule says.
func (s *Service) RunNow(id string) error {
	if _, err := s.Get(id); err != nil {
		return err
	}
	s.mu.Lock()
	busy := s.running[id]
	s.mu.Unlock()
	if busy {
		return errors.New("this automation is already running")
	}
	return s.enqueue(id, "manual")
}

func (s *Service) enqueue(id, trigger string) error {
	s.mu.Lock()
	if s.running[id] {
		s.mu.Unlock()
		return nil
	}
	s.running[id] = true
	s.mu.Unlock()
	select {
	case s.queue <- job{id, trigger}:
		s.changed()
		return nil
	default:
		s.mu.Lock()
		delete(s.running, id)
		s.mu.Unlock()
		return errors.New("too many automations are waiting to run")
	}
}

// Start begins scheduling. It is safe to call once.
func (s *Service) Start() {
	s.mu.Lock()
	if s.stop != nil {
		s.mu.Unlock()
		return
	}
	s.stop = make(chan struct{})
	stop := s.stop
	s.mu.Unlock()
	go s.worker(stop)
	go func() {
		// Runs left "running" by a crash or a forced quit never finished.
		s.closeStaleRuns()
		s.check(true)
		t := time.NewTicker(tick)
		defer t.Stop()
		for {
			select {
			case <-stop:
				return
			case <-t.C:
				s.check(false)
			}
		}
	}()
}

func (s *Service) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.stop != nil {
		close(s.stop)
		s.stop = nil
	}
}

func (s *Service) closeStaleRuns() {
	st := s.load()
	dirty := false
	for id, runs := range st.Runs {
		for i := range runs {
			if runs[i].Status == "running" {
				runs[i].Status, runs[i].Error, runs[i].FinishedAt = "error", "Anchor closed before this run finished", store.Now()
				dirty = true
			}
		}
		st.Runs[id] = runs
	}
	if dirty {
		_ = s.save(st)
	}
}

// check queues every automation whose time has come. startup is true for
// the first pass after launch, where "late" means "missed while closed".
func (s *Service) check(startup bool) {
	st := s.load()
	now := s.now()
	dirty := false
	for _, a := range st.Automations {
		if !a.Enabled {
			continue
		}
		dueStr, ok := st.Due[a.ID]
		if !ok {
			s.plan(&st, a, now)
			dirty = true
			continue
		}
		due, err := time.Parse(time.RFC3339, dueStr)
		if err != nil {
			s.plan(&st, a, now)
			dirty = true
			continue
		}
		if now.Before(due) {
			continue
		}
		late := now.Sub(due) > lateGrace
		trigger := "schedule"
		switch {
		case !late:
		case a.CatchUp:
			trigger = "catch-up"
		default:
			trigger = "" // missed, and the automation does not catch up
		}
		// Plan the next one first, so a slow run never fires twice.
		s.plan(&st, a, now)
		dirty = true
		if trigger != "" {
			if err := s.enqueue(a.ID, trigger); err != nil {
				s.logf("automation %s: %v", a.Name, err)
			}
		}
	}
	if dirty {
		_ = s.save(st)
		s.changed()
	}
	_ = startup
}

func (s *Service) worker(stop chan struct{}) {
	for {
		select {
		case <-stop:
			return
		case j := <-s.queue:
			s.execute(j)
		}
	}
}

func firstLines(text string, max int) string {
	text = strings.TrimSpace(text)
	if len(text) <= max {
		return text
	}
	cut := text[:max]
	if i := strings.LastIndexAny(cut, " \n"); i > max/2 {
		cut = cut[:i]
	}
	return strings.TrimSpace(cut) + "…"
}

func (s *Service) execute(j job) {
	defer func() {
		s.mu.Lock()
		delete(s.running, j.id)
		s.mu.Unlock()
		s.changed()
	}()
	a, err := s.Get(j.id)
	if err != nil {
		return // deleted while waiting
	}
	run := model.AutomationRun{ID: "run_" + strings.ReplaceAll(uuid.NewString(), "-", "")[:10], AutomationID: a.ID,
		Trigger: j.trigger, StartedAt: store.Now(), Status: "running"}
	s.record(run)

	ctx, cancel := context.WithTimeout(context.Background(), runTimeout)
	sessionID, summary, err := s.run(ctx, a)
	cancel()

	run.FinishedAt, run.SessionID, run.Summary = store.Now(), sessionID, firstLines(summary, 400)
	if err != nil {
		run.Status, run.Error = "error", err.Error()
		s.logf("automation %s: %v", a.Name, err)
	} else {
		run.Status = "ok"
	}
	s.record(run)
	s.emit("automations:run", run)
}

// record adds a run to the history or updates it.
func (s *Service) record(run model.AutomationRun) {
	st := s.load()
	runs := st.Runs[run.AutomationID]
	found := false
	for i := range runs {
		if runs[i].ID == run.ID {
			runs[i] = run
			found = true
		}
	}
	if !found {
		runs = append([]model.AutomationRun{run}, runs...)
	}
	if len(runs) > maxRunsKept {
		runs = runs[:maxRunsKept]
	}
	st.Runs[run.AutomationID] = runs
	_ = s.save(st)
	s.changed()
}
