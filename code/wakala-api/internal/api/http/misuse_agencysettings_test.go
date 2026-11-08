package http

import (
	"net/http"
	"testing"
)

func TestAgencySettings_ResidentCannotDoRenameTheAgency(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	path := "/instances/" + w.instance + "/agency"

	if rec := w.call(t, "PATCH", path, map[string]any{"name": "Taken over", "description": "by a resident"}, w.people["Volunteer"]); rec.Code < 400 {
		t.Fatalf("resident renaming the agency: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", path, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner reads the agency: %d %s", rec.Code, rec.Body.String())
	} else if name, _ := decodeObject(t, rec)["name"].(string); name == "Taken over" {
		t.Fatalf("agency name changed by the resident: %s", rec.Body.String())
	}

	if rec := w.call(t, "PATCH", path, map[string]any{"name": "Health program office", "description": "Referrals"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner renaming the agency: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
