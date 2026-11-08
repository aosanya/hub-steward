package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func TestConsentWithdraw_OwnerCannotDoWithdrawForAnotherResident(t *testing.T) {
	w := newStepRunWalk(t, nil)
	ctx := context.Background()

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Resident Wren"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	path := "/instances/" + w.instance + "/custody/consent/withdraw"

	byOwner := w.call(t, "POST", path, map[string]any{"actor_id": actor.ID}, w.owner)
	if byOwner.Code == http.StatusCreated {
		if got, _ := decodeObject(t, byOwner)["actor_id"].(string); got != "test-owner" {
			t.Fatalf("owner naming a resident recorded a withdrawal for %q: %s", got, byOwner.Body.String())
		}
	} else if byOwner.Code < 400 {
		t.Fatalf("owner naming the resident: %d %s", byOwner.Code, byOwner.Body.String())
	}

	own := w.call(t, "POST", path, map[string]any{}, w.owner)
	if own.Code != http.StatusCreated {
		t.Fatalf("owner withdraws own consent: %d %s, want 201", own.Code, own.Body.String())
	}
	if got, _ := decodeObject(t, own)["actor_id"].(string); got != "test-owner" {
		t.Fatalf("owner's withdrawal recorded for %q, want test-owner", got)
	}
}
