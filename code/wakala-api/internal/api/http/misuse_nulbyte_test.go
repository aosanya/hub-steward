package http

import (
	"net/http"
	"testing"
)

func TestRequestBody_OwnerCannotDoStoreANulByteInAGroupName(t *testing.T) {
	w := newStepRunWalk(t, nil)
	groups := "/instances/" + w.instance + "/actor/groups"

	if rec := w.call(t, "POST", groups, map[string]any{"name": "Kertváros körzet"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner creates an ordinary group: %d %s", rec.Code, rec.Body.String())
	}
	rec := w.call(t, "POST", groups, map[string]any{"name": "Kert\u0000város"}, w.owner)
	if rec.Code < 400 || rec.Code >= 500 {
		t.Fatalf("owner naming a group with a NUL byte: %d %s, want a 4xx refusal", rec.Code, rec.Body.String())
	}
}
