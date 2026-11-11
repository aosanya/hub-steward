package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func TestResidentCorrectsOwnAttributesButNotAnotherResidents(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	ctx := context.Background()
	base := "/instances/" + w.instance + "/actor"

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	enrol := func(name string) mwanachamaactor.Actor {
		a, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
		if err != nil {
			t.Fatalf("CreateActor %s: %v", name, err)
		}
		if err := w.deps.Registry.AddMember(ctx, w.instance, a.ID, agencies.RoleResident); err != nil {
			t.Fatalf("AddMember %s: %v", name, err)
		}
		return a
	}
	alpha := enrol("Resident Alpha")
	beta := enrol("Resident Beta")
	alphaCookie := w.cookieFor(t, alpha.ID)
	own := map[string]any{"attributes": map[string]any{"phone": "+36300000001"}}

	if rec := w.call(t, "PATCH", base+"/actors/mine/attributes", own, alphaCookie); rec.Code != http.StatusOK {
		t.Fatalf("alpha corrects own attributes: %d %s, want 200", rec.Code, rec.Body.String())
	}

	others := map[string]any{"attributes": map[string]any{"phone": "+36300000002"}}
	if rec := w.call(t, "PATCH", base+"/actors/"+beta.ID+"/attributes", others, alphaCookie); rec.Code < 400 {
		t.Fatalf("alpha changes beta's attributes: %d %s, want refused", rec.Code, rec.Body.String())
	}
}
