package http

import (
	"net/http"
	"testing"
)

func TestCrossInstance_OtherAgencyOperatorCannotDoReadThisAgencysData(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	other := w.cookieFor(t, "operator-of-water-board")
	if rec := w.call(t, "POST", "/instances", map[string]any{"name": "Water board"}, other); rec.Code != http.StatusCreated {
		t.Fatalf("other operator creates own instance: %d %s", rec.Code, rec.Body.String())
	}

	for _, route := range []string{"/actor/groups", "/join-requests"} {
		path := "/instances/" + w.instance + route
		if rec := w.call(t, "GET", path, nil, other); rec.Code < 400 {
			t.Fatalf("other agency operator reading %s: %d %s, want refused", path, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "GET", path, nil, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("own operator reading %s: %d %s, want 200", path, rec.Code, rec.Body.String())
		}
	}
}
