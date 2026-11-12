package store

import "testing"

func TestDeletedSessionsRoundTrip(t *testing.T) {
	t.Setenv("ANCHOR_HOME", t.TempDir())
	s, err := New()
	if err != nil {
		t.Fatal(err)
	}
	if len(s.DeletedSessions()) != 0 {
		t.Fatal("fresh store should have no tombstones")
	}
	if err := s.MarkDeleted("abc", "2026-11-12T10:00:00Z"); err != nil {
		t.Fatal(err)
	}
	if err := s.MarkDeleted("def", "2026-11-12T11:00:00Z"); err != nil {
		t.Fatal(err)
	}
	got := s.DeletedSessions()
	if got["abc"] != "2026-11-12T10:00:00Z" || got["def"] != "2026-11-12T11:00:00Z" {
		t.Fatalf("got %v", got)
	}
	if err := s.Undelete("abc"); err != nil {
		t.Fatal(err)
	}
	if err := s.Undelete("never-existed"); err != nil {
		t.Fatal(err)
	}
	got = s.DeletedSessions()
	if _, ok := got["abc"]; ok || len(got) != 1 {
		t.Fatalf("after undelete: %v", got)
	}
}
