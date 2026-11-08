package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func TestActorRead_ResidentCannotDoReadAnotherResidentsRecord(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	ctx := context.Background()
	base := "/instances/" + w.instance + "/actor"

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}

	alpha, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Resident Alpha"})
	if err != nil {
		t.Fatalf("CreateActor alpha: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, alpha.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember alpha: %v", err)
	}
	beta, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Resident Beta"})
	if err != nil {
		t.Fatalf("CreateActor beta: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, beta.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember beta: %v", err)
	}

	target := base + "/actors/" + beta.ID
	betaCookie := w.cookieFor(t, beta.ID)
	if rec := w.call(t, "GET", base+"/actors/mine", nil, betaCookie); rec.Code != http.StatusOK {
		t.Fatalf("beta reads own actor via mine: %d %s, want 200", rec.Code, rec.Body.String())
	}

	alphaCookie := w.cookieFor(t, alpha.ID)
	if rec := w.call(t, "GET", target, nil, alphaCookie); rec.Code < 400 {
		t.Fatalf("alpha reading beta's actor record: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", target, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("operator reading the actor record: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
