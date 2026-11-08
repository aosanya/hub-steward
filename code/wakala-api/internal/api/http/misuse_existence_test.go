package http

import (
	"net/http"
	"testing"
)

func TestRecordExistence_StrangerCannotDoTellRealFromRandomGroup(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	path := "/instances/" + w.instance + "/actor/groups"

	groups := w.call(t, "GET", path, nil, w.owner)
	if groups.Code != http.StatusOK {
		t.Fatalf("owner lists groups: %d %s", groups.Code, groups.Body.String())
	}
	list := decodeObjects(t, groups)
	if len(list) == 0 {
		t.Fatalf("no group to look up")
	}
	realID, _ := list[0]["id"].(string)

	real := getWithHeaders(w, path+"/"+realID, "", nil)
	random := getWithHeaders(w, path+"/00000000-0000-4000-8000-00000000beef", "", nil)
	if real.Code < 400 {
		t.Fatalf("stranger reading a real group: %d %s, want refused", real.Code, real.Body.String())
	}
	if real.Code != random.Code || real.Body.String() != random.Body.String() {
		t.Fatalf("stranger sees a difference: real %d %q, random %d %q", real.Code, real.Body.String(), random.Code, random.Body.String())
	}

	if rec := w.call(t, "GET", path+"/"+realID, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("member reading the real group: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
