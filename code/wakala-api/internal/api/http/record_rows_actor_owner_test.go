package http

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
)

func (b businessRegisterWalk) residentWithoutAnAccount(t *testing.T, name string) string {
	t.Helper()
	um, err := b.deps.Registry.ActorManager(context.Background(), b.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	a, err := um.CreateActor(context.Background(), mwanachamaactor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor %s: %v", name, err)
	}
	return a.ID
}

func TestLiveRecordRowsActorOwner_AResidentWithoutAnAccountCanBeNamedAsTheOwner(t *testing.T) {
	b := businessRegister(t)
	resident := b.residentWithoutAnAccount(t, "Owner Gamma")

	b.addBusiness(t, "Gamma Florist", resident, "front desk", "", "")

	expectBusinesses(t, "the resident's businesses", b.businessesOverHTTP(t, b.owner, url.Values{"answer_actor_id": {resident}}), "Gamma Florist")
}

func TestLiveRecordRowsActorOwner_AnIdThatIsNoPersonOfTheAgencyIsStillRefused(t *testing.T) {
	b := businessRegister(t)
	body := map[string]any{"answers": map[string]string{"Business": "Ghost Bakery", "Owner": "no-such-person", "Contact": "front desk"}}

	rec := b.call(t, "POST", "/instances/"+b.instance+"/live-records/"+b.register+"/rows", body, b.owner)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("naming an unknown id: %d %s, want 400", rec.Code, rec.Body.String())
	}
}
