package http

import (
	"net/http"
	"testing"
)

func TestAFormIsClosedThroughTheMountByTheSessionNotTheBody(t *testing.T) {
	cw := newConsentWalk(t)
	formID, _ := openFormForGroup(t, cw)
	closed := cw.call(t, "POST", "/instances/"+cw.instance+"/forms/forms/"+formID+"/close", map[string]any{"closed_by": "forged-clerk"}, cw.owner)
	if closed.Code != http.StatusOK {
		t.Fatalf("close form: %d %s, want 200", closed.Code, closed.Body.String())
	}
	if by, _ := decodeObject(t, closed)["closed_by"].(string); by != "test-owner" {
		t.Errorf("the form names %q as who closed it; want the session's test-owner, never the body's forged-clerk", by)
	}
}
