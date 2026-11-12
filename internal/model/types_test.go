package model

import (
	"encoding/json"
	"strings"
	"testing"
)

// A step_update must carry only the fields it changes. The UI spreads the
// patch over the existing step, so a serialised kind: "" or id: "" would
// erase the step's identity and the transcript would drop it.
func TestStepUpdatePatchCarriesOnlyChangedFields(t *testing.T) {
	ev := ChatEvent{Type: "step_update", ID: "step_a1", Patch: StepPatch{"streaming": false}}
	b, err := json.Marshal(ev)
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	for _, forbidden := range []string{`"kind"`, `"at"`, `"markdown"`, `"text"`} {
		if strings.Contains(s, forbidden) {
			t.Fatalf("patch leaked %s: %s", forbidden, s)
		}
	}
	if !strings.Contains(s, `"patch":{"streaming":false}`) {
		t.Fatalf("unexpected encoding: %s", s)
	}
}
