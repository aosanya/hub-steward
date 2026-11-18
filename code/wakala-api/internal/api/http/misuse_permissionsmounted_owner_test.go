package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func TestPermissionsMounted_OwnerCanStillUseFormsAndReports(t *testing.T) {
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	w.handler = mountPermissionsAndReports(t, w.deps)

	otherOwner := w.cookieFor(t, "test-other-owner")
	rec := w.call(t, "POST", "/instances", map[string]any{"name": "Other program"}, otherOwner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create other instance: %d %s", rec.Code, rec.Body.String())
	}
	otherInstance, _ := decodeObject(t, rec)["id"].(string)
	um, err := w.deps.Registry.ActorManager(ctx, otherInstance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	stranger, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "resident-elsewhere-eve"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, otherInstance, stranger.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	outsider := w.cookieFor(t, stranger.ID)

	forms := "/instances/" + w.instance + "/forms/forms"
	entry := map[string]any{"name": "t", "doc": `{"body":"x"}`, "visibility": "pending"}

	if rec := w.call(t, "GET", forms, nil, outsider); rec.Code < 400 {
		t.Errorf("resident of another agency listing this agency's forms: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", "/reports/entries/outsider-entry", entry, outsider); rec.Code < 400 {
		t.Errorf("resident of another agency writing a report entry: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", forms, nil, w.owner); rec.Code != http.StatusOK {
		t.Errorf("agency owner listing forms with permissions mounted: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", "/reports/entries/owner-entry", entry, w.owner); rec.Code >= 300 {
		t.Errorf("agency owner writing a report entry with permissions mounted: %d %s, want 2xx", rec.Code, rec.Body.String())
	}
}
