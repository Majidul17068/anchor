package sync

import (
	"testing"

	"github.com/Majidul17068/anchor/internal/model"
)

func TestMergeStepsDedupesAndOrders(t *testing.T) {
	base := []model.Step{{ID: "a", At: "2026-01-01T00:00:01Z"}, {ID: "b", At: "2026-01-01T00:00:03Z"}}
	extra := []model.Step{{ID: "b", At: "2026-01-01T00:00:03Z"}, {ID: "c", At: "2026-01-01T00:00:02Z"}}
	out := mergeSteps(base, extra)
	if len(out) != 3 {
		t.Fatalf("want 3 steps, got %d", len(out))
	}
	if out[0].ID != "a" || out[1].ID != "c" || out[2].ID != "b" {
		t.Fatalf("wrong order: %v %v %v", out[0].ID, out[1].ID, out[2].ID)
	}
}

func TestFileNames(t *testing.T) {
	if sessionFile("x") != "session-x.json" {
		t.Error("sessionFile")
	}
	n := appendFile("x", "dev1")
	if !isAppendOf(n, "x") || appendDevice(n, "x") != "dev1" {
		t.Errorf("append naming broken: %s", n)
	}
	if isAppendOf("session-x.json", "x") {
		t.Error("canonical file must not be an append file")
	}
}
