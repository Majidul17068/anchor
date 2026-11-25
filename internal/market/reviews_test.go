package market

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Majidul17068/anchor/internal/model"
	"github.com/Majidul17068/anchor/internal/skills"
	"github.com/Majidul17068/anchor/internal/store"
)

const testIndex = `{"version":1,"repo":"x/y","listings":[
 {"id":"alice/pr-reviewer","name":"PR Reviewer","tagline":"t","description":"d","version":"1.0.0",
  "author":{"id":"alice@example.com","name":"Alice"},"rating":4,"ratingCount":2,"visibility":"public","license":"MIT"},
 {"id":"me/mine","name":"Mine","tagline":"t","description":"d","version":"1.0.0",
  "author":{"id":"me@example.com","name":"Me"},"rating":0,"ratingCount":0,"visibility":"public","license":"MIT"}],
 "reviews":{"alice/pr-reviewer":[{"id":"r1","listingId":"alice/pr-reviewer","author":{"id":"bob@example.com","name":"Bob"},"rating":4,"text":"good","at":"2026-11-01T00:00:00Z"}]}}`

func newTestService(t *testing.T) (*Service, *[]string) {
	t.Helper()
	t.Setenv("ANCHOR_HOME", t.TempDir())
	t.Setenv("GEMINI_DIR", t.TempDir())
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(testIndex)) }))
	t.Cleanup(srv.Close)
	st, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	if err := st.SetSettings(map[string]any{"marketIndexUrl": srv.URL}); err != nil {
		t.Fatal(err)
	}
	var opened []string
	me := func() model.MarketAuthor { return model.MarketAuthor{ID: "me@example.com", Name: "Me"} }
	sk := skills.New(st, nil, func() string { return "Me" })
	return New(st, sk, nil, func(u string) { opened = append(opened, u) }, me, nil), &opened
}

// A rating must show at once: the review is kept on this device, listed
// first and marked pending, and it moves the listing's stars and count. A
// second review replaces the first instead of counting twice.
func TestReviewCountsImmediatelyAndReplaces(t *testing.T) {
	s, opened := newTestService(t)
	ctx := context.Background()

	rev, err := s.Review(ctx, "alice/pr-reviewer", 1, "did not work for me")
	if err != nil {
		t.Fatal(err)
	}
	if !rev.Mine || !rev.Pending {
		t.Fatalf("review flags: %+v", rev)
	}
	if len(*opened) != 1 || !strings.Contains((*opened)[0], "issues/new") {
		t.Fatalf("submission issue not opened: %v", *opened)
	}
	revs, _ := s.Reviews(ctx, "alice/pr-reviewer")
	if len(revs) != 2 || !revs[0].Mine || !revs[0].Pending || revs[0].Rating != 1 || revs[1].Author.Name != "Bob" {
		t.Fatalf("reviews: %+v", revs)
	}
	l, _ := s.Get(ctx, "alice/pr-reviewer")
	if l.RatingCount != 3 || l.Rating != 3 { // (4*2 + 1) / 3
		t.Fatalf("rating %v (%d), want 3 (3)", l.Rating, l.RatingCount)
	}

	if _, err := s.Review(ctx, "alice/pr-reviewer", 4, "fixed after an update"); err != nil {
		t.Fatal(err)
	}
	revs, _ = s.Reviews(ctx, "alice/pr-reviewer")
	l, _ = s.Get(ctx, "alice/pr-reviewer")
	if len(revs) != 2 || revs[0].Rating != 4 || l.RatingCount != 3 || l.Rating != 4 {
		t.Fatalf("after update: %d reviews, rating %v (%d)", len(revs), l.Rating, l.RatingCount)
	}
}

func TestReviewValidation(t *testing.T) {
	s, _ := newTestService(t)
	ctx := context.Background()
	if _, err := s.Review(ctx, "alice/pr-reviewer", 0, "x"); err == nil {
		t.Fatal("0 stars accepted")
	}
	if _, err := s.Review(ctx, "alice/pr-reviewer", 5, "   "); err == nil {
		t.Fatal("empty text accepted")
	}
	if _, err := s.Review(ctx, "me/mine", 5, "great"); err == nil {
		t.Fatal("own listing review accepted")
	}
}
