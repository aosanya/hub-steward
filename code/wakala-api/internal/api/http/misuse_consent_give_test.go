package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/session"
	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamacustody "wakalaserver/modules/custody"
	custodymodels "wakalaserver/modules/custody/models"
	mwanachamainsights "wakalaserver/modules/insights"
)

func TestConsentGive_ResidentAgreesThenFormAnswerIsNoLongerRefusedForConsent(t *testing.T) {
	db := stepRunDB(t)
	var registry agencies.Registry
	reg, err := agencies.NewRegistry(db, agencies.StartingApproved(),
		agencies.WithConsentRequired(ConsentRequired(func() agencies.Registry { return registry })),
		agencies.WithModuleMounted(ModuleMounted(func() agencies.Registry { return registry })),
	)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	registry = reg
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
	deps := &Deps{Registry: reg, Insights: insights, Sessions: session.NewHMACManager([]byte("test-secret"), nil, nil), AdminToken: "test-admin-token"}
	ApplyCaches(deps)
	w := stepRunWalk{handler: NewRouter(deps), deps: deps, roles: map[string]string{}, steps: map[string]string{}, people: map[string]*http.Cookie{}}
	w.owner = w.cookieFor(t, "test-owner")
	created := w.call(t, "POST", "/instances", map[string]any{"name": "Ward"}, w.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create instance: %d %s", created.Code, created.Body.String())
	}
	w.instance, _ = decodeObject(t, created)["id"].(string)
	cacheMountedSet(t, w.instance, mountedSet{modules: map[string]bool{"custody": true, "forms": true}})

	ctx := context.Background()
	um, err := reg.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Resident Wren"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := reg.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	resident := w.cookieFor(t, actor.ID)

	cm, err := reg.CustodyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("CustodyManager: %v", err)
	}
	version, err := cm.CreateConsentVersion(ctx, mwanachamacustody.ConsentVersionInput{Scope: custodymodels.ScopeMechanics, Version: "v1", Language: custodymodels.LanguageEnglish})
	if err != nil {
		t.Fatalf("CreateConsentVersion: %v", err)
	}
	if _, err := cm.PublishConsentVersion(ctx, version.ID, "test-owner"); err != nil {
		t.Fatalf("PublishConsentVersion: %v", err)
	}

	answer := func() *httptest.ResponseRecorder {
		return w.call(t, "POST", "/instances/"+w.instance+"/forms/forms/no-such-form/answers",
			map[string]any{"answers": []map[string]any{{"question_id": "q", "value_text": "synthetic"}}}, resident)
	}
	before := answer()
	if before.Code != http.StatusForbidden || !strings.Contains(before.Body.String(), "consent") {
		t.Fatalf("answer before consent: %d %s, want the consent refusal", before.Code, before.Body.String())
	}

	agreed := w.call(t, "POST", "/instances/"+w.instance+"/custody/consent/agree", map[string]any{}, resident)
	if agreed.Code != http.StatusCreated {
		t.Fatalf("resident agrees: %d %s, want 201", agreed.Code, agreed.Body.String())
	}
	if got, _ := decodeObject(t, agreed)["actor_id"].(string); got != actor.ID {
		t.Fatalf("consent recorded for %q, want the resident %q", got, actor.ID)
	}

	after := answer()
	if strings.Contains(after.Body.String(), "consent") {
		t.Fatalf("answer after consent still refused for consent: %d %s", after.Code, after.Body.String())
	}

	operatorRead := w.call(t, "POST", "/instances/"+w.instance+"/custody/consent/versions", map[string]any{"scope": "mechanics", "version": "v2", "language": "en"}, resident)
	if operatorRead.Code != http.StatusNotFound {
		t.Fatalf("resident drafting a consent version: %d %s, want 404 as before", operatorRead.Code, operatorRead.Body.String())
	}

	withdrawn := w.call(t, "POST", "/instances/"+w.instance+"/custody/consent/withdraw", map[string]any{}, resident)
	if withdrawn.Code != http.StatusCreated {
		t.Fatalf("resident withdraws: %d %s, want 201", withdrawn.Code, withdrawn.Body.String())
	}
}
