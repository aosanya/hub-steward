package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

func TestRiskRegister_ReadOnlyAgentCannotDoCreateOrEditARisk(t *testing.T) {
	w := newStepRunWalk(t, nil)
	perms := map[string][]string{
		"role-analyst": {},
		"role-reader":  {"risk.read"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		p, ok := perms[roleID]
		if !ok {
			return nil, errors.New("unknown role")
		}
		return p, nil
	}
	path := "/instances/" + w.instance
	agent := func(subject, roleID string) *http.Cookie {
		c := w.cookieFor(t, subject)
		if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("owner adds agent %s: %d %s", subject, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": roleID}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("owner links %s to %s: %d %s", subject, roleID, rec.Code, rec.Body.String())
		}
		return c
	}
	analyst := agent("agent-analyst", "role-analyst")
	reader := agent("agent-reader", "role-reader")

	risks := path + "/risks/risks"
	risk := map[string]any{"title": "Bridge flooding", "top_event": "River floods the footbridge"}

	created := w.call(t, "POST", risks, risk, w.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("owner opening a risk: %d %s, want 201", created.Code, created.Body.String())
	}
	riskID, _ := decodeObject(t, created)["id"].(string)
	if riskID == "" {
		t.Fatalf("risk id from create: %s", created.Body.String())
	}

	if rec := w.call(t, "POST", risks, risk, analyst); rec.Code != http.StatusForbidden {
		t.Fatalf("agent without permissions opening a risk: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", risks+"/"+riskID, nil, analyst); rec.Code != http.StatusForbidden {
		t.Fatalf("agent without permissions reading a risk: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", risks, risk, reader); rec.Code != http.StatusForbidden {
		t.Fatalf("read-only agent opening a risk: %d %s, want 403", rec.Code, rec.Body.String())
	}
	edit := map[string]any{"title": "Bridge washed away", "top_event": "River carries the footbridge off"}
	if rec := w.call(t, "PUT", risks+"/"+riskID, edit, reader); rec.Code != http.StatusForbidden {
		t.Fatalf("read-only agent editing a risk: %d %s, want 403", rec.Code, rec.Body.String())
	}

	rec := w.call(t, "GET", risks+"/"+riskID, nil, reader)
	if rec.Code != http.StatusOK {
		t.Fatalf("read-only agent reading the risk: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if title, _ := decodeObject(t, rec)["title"].(string); title != "Bridge flooding" {
		t.Fatalf("risk title after the refused edit: %q, want unchanged", title)
	}
}
