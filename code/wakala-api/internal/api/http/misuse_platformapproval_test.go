package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamainsights "wakalaserver/modules/insights"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/session"
)

func TestPlatformApproval_NonPlatformAccountCannotDoApproveAnAgency(t *testing.T) {
	db := stepRunDB(t)
	reg, err := agencies.NewRegistry(db)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	insightSpec, err := mwanachamainsights.SpecFor("test")
	if err != nil {
		t.Fatalf("insights SpecFor: %v", err)
	}
	if err := mwanachamainsights.Provision(db, insightSpec); err != nil {
		t.Fatalf("insights Provision: %v", err)
	}
	insights, err := mwanachamainsights.NewInsightManager(db, insightSpec)
	if err != nil {
		t.Fatalf("NewInsightManager: %v", err)
	}
	deps := &Deps{Registry: reg, Insights: insights, Sessions: session.NewHMACManager([]byte("test-secret"), nil, nil), AdminToken: "test-admin-token", PlatformOwners: []string{"platform-owner"}}
	ApplyCaches(deps)
	w := stepRunWalk{handler: NewRouter(deps), deps: deps}

	owner := w.cookieFor(t, "agency-owner")
	otherOwner := w.cookieFor(t, "other-agency-owner")
	resident := w.cookieFor(t, "agency-resident")
	platform := w.cookieFor(t, "platform-owner")

	created := w.call(t, "POST", "/instances", map[string]any{"name": "Town hall"}, owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("owner creates an agency: %d %s", created.Code, created.Body.String())
	}
	instance, _ := decodeObject(t, created)["id"].(string)
	if rec := w.call(t, "POST", "/instances", map[string]any{"name": "Farmers"}, otherOwner); rec.Code != http.StatusCreated {
		t.Fatalf("other owner creates an agency: %d %s", rec.Code, rec.Body.String())
	}
	if err := reg.AddMember(context.Background(), instance, "agency-resident", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	approve := "/platform/agencies/" + instance + "/approve"
	for name, who := range map[string]*http.Cookie{"the agency's own owner": owner, "another agency's owner": otherOwner, "a resident": resident} {
		if rec := w.call(t, "POST", approve, nil, who); rec.Code < 400 {
			t.Fatalf("%s approving the agency: %d %s, want refused", name, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "GET", "/platform/agencies/pending", nil, who); rec.Code < 400 {
			t.Fatalf("%s listing pending agencies: %d %s, want refused", name, rec.Code, rec.Body.String())
		}
	}

	if rec := w.call(t, "POST", approve, nil, platform); rec.Code != http.StatusOK {
		t.Fatalf("platform owner approving the agency: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", approve, nil, platform); rec.Code != http.StatusConflict {
		t.Fatalf("platform owner approving the agency again: %d %s, want 409", rec.Code, rec.Body.String())
	}
}
