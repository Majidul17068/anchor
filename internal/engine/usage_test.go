package engine

import "testing"

const usageJSON = `Fetching...
{"conversation_id":"","status":"SUCCESS","response":"x","command":{"name":"usage","data":{"description":"Within each group, models share a weekly limit and a 5-hour limit.","groups":[{"name":"Gemini Models","description":"Models within this group: Gemini 4 Neon","buckets":[{"id":"gemini-weekly","name":"Weekly Limit Remaining","description":"You have used some of your weekly limit.","window":"weekly","remaining_fraction":0.9349702596664429,"reset_time":"2026-12-01T08:39:38Z"},{"id":"gemini-5h","name":"Five Hour Limit Remaining","window":"5h","remaining_fraction":1,"reset_time":"2026-11-25T14:29:22Z"}]},{"name":"Claude and GPT models","buckets":[{"id":"3p-weekly","name":"Weekly Limit Remaining","window":"weekly","remaining_fraction":1.4,"reset_time":"2026-12-02T09:29:22Z"}]}]}}}`

func TestParseUsage(t *testing.T) {
	u, err := parseUsage(usageJSON)
	if err != nil {
		t.Fatal(err)
	}
	if len(u.Groups) != 2 || len(u.Groups[0].Buckets) != 2 {
		t.Fatalf("groups: %+v", u.Groups)
	}
	b := u.Groups[0].Buckets[0]
	if b.Window != "weekly" || b.RemainingFraction < 0.93 || b.RemainingFraction > 0.94 || b.ResetTime != "2026-12-01T08:39:38Z" {
		t.Fatalf("bucket: %+v", b)
	}
	if u.Groups[1].Buckets[0].RemainingFraction != 1 {
		t.Fatalf("fraction not clamped: %v", u.Groups[1].Buckets[0].RemainingFraction)
	}
}

func TestParseUsageReportsCLIError(t *testing.T) {
	if _, err := parseUsage(`{"status":"ERROR","error":"Authentication required"}`); err == nil || err.Error() != "Authentication required" {
		t.Fatalf("err = %v", err)
	}
	if _, err := parseUsage("no json here"); err == nil {
		t.Fatal("want error")
	}
}
