package sync

import (
	"testing"
	"time"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/store"
)

func TestMergeStepsDedupesAndOrders(t *testing.T) {
	base := []model.Step{{ID: "a", At: "2026-01-01T00:00:01Z"}, {ID: "b", At: "2026-01-01T00:00:03Z"}}
	extra := []model.Step{{ID: "b", At: "2026-01-01T00:00:03Z"}, {ID: "c", At: "2026-01-01T00:00:02Z"}}
	out := mergeSteps(base, extra)
	if len(out) != 3 || out[0].ID != "a" || out[1].ID != "c" || out[2].ID != "b" {
		t.Fatalf("unexpected merge: %+v", out)
	}
}

func TestFileNamesReadWellInDrive(t *testing.T) {
	if got := sessionName("Fix the login: part 2/3?", "334ed7c0-a335-44ec"); got != "Fix the login- part 2-3- (334ed7c0).json" {
		t.Fatalf("got %q", got)
	}
	if got := sessionName("", "abc"); got != "Session (abc).json" {
		t.Fatalf("got %q", got)
	}
	if got := appendName("Notes", "334ed7c0-a335", "dev-1234567890"); got != "Notes (334ed7c0) - from dev-1234.json" {
		t.Fatalf("got %q", got)
	}
	long := safeTitle(string(make([]rune, 200)))
	if len(long) > 80 {
		t.Fatalf("title not capped: %d", len(long))
	}
}

func TestCreatedAtFallsBackSensibly(t *testing.T) {
	m := &store.SessionMeta{Session: model.Session{CreatedAt: "2026-03-04T05:06:07Z"}}
	if got := createdAt(m); !got.Equal(time.Date(2026, 3, 4, 5, 6, 7, 0, time.UTC)) {
		t.Fatalf("got %v", got)
	}
	m = &store.SessionMeta{Session: model.Session{CreatedAt: "garbage", LastModified: "2026-03-05T00:00:00Z"}}
	if got := createdAt(m); got.Day() != 5 {
		t.Fatalf("got %v", got)
	}
	if d := time.Since(createdAt(&store.SessionMeta{})); d > time.Minute {
		t.Fatal("no dates should mean now")
	}
}
