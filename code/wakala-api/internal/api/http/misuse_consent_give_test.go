package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gorm.io/gorm"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/session"
	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamacustody "wakalaserver/modules/custody"
	custodymodels "wakalaserver/modules/custody/models"
	mwanachamainsights "wakalaserver/modules/insights"
)

type consentWalk struct {
	stepRunWalk
	reg      agencies.Registry
	actorID  string
	groupID  string
	resident *http.Cookie
}

func newConsentWalk(t *testing.T) consentWalk {
	t.Helper()
	return newConsentWalkOn(t, stepRunDB(t))
}

func newConsentWalkOn(t *testing.T, db *gorm.DB) consentWalk {
	t.Helper()
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
	group, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: "Ward group"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	groupID := group.ID
	if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: groupID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	resident := w.cookieFor(t, actor.ID)

	return consentWalk{stepRunWalk: w, reg: reg, actorID: actor.ID, groupID: groupID, resident: resident}
}

func TestConsentGive_ResidentAgreesThenFormAnswerIsNoLongerRefusedForConsent(t *testing.T) {
	cw := newConsentWalk(t)
	w, reg, resident := cw.stepRunWalk, cw.reg, cw.resident
	ctx := context.Background()
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
	if got, _ := decodeObject(t, agreed)["actor_id"].(string); got != cw.actorID {
		t.Fatalf("consent recorded for %q, want the resident %q", got, cw.actorID)
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

func publishMechanicsConsent(t *testing.T, cw consentWalk) {
	t.Helper()
	ctx := context.Background()
	cm, err := cw.reg.CustodyManager(ctx, cw.instance)
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
}

func openFormForGroup(t *testing.T, cw consentWalk) (formID, questionID string) {
	t.Helper()
	return openFormForGroupLocked(t, cw, false)
}

func openFormForGroupLocked(t *testing.T, cw consentWalk, lockedAfterSend bool) (formID, questionID string) {
	t.Helper()
	base := "/instances/" + cw.instance + "/forms/forms"
	created := cw.call(t, "POST", base, map[string]any{
		"title": "Ward consultation", "closes_at": "2099-01-01T00:00:00Z", "originator_chapter_id": cw.groupID,
		"audience": "member", "collection_mode": "self", "locked_after_send": lockedAfterSend,
	}, cw.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create form: %d %s", created.Code, created.Body.String())
	}
	formID, _ = decodeObject(t, created)["id"].(string)
	question := cw.call(t, "POST", base+"/"+formID+"/questions", map[string]any{"prompt": "Your view", "answer_type": "free_text"}, cw.owner)
	if question.Code != http.StatusCreated {
		t.Fatalf("add question: %d %s", question.Code, question.Body.String())
	}
	asked, _ := decodeObject(t, question)["question"].(map[string]any)
	questionID, _ = asked["id"].(string)
	target := cw.call(t, "POST", base+"/"+formID+"/targets", map[string]any{"chapter_id": cw.groupID}, cw.owner)
	if target.Code != http.StatusCreated {
		t.Fatalf("add target: %d %s", target.Code, target.Body.String())
	}
	published := cw.call(t, "POST", base+"/"+formID+"/publish", map[string]any{}, cw.owner)
	if published.Code != http.StatusOK && published.Code != http.StatusCreated {
		t.Fatalf("publish form: %d %s", published.Code, published.Body.String())
	}
	return formID, questionID
}

func TestConsentGive_ResidentAnswersARealFormOnlyAfterAgreeing(t *testing.T) {
	cw := newConsentWalk(t)
	publishMechanicsConsent(t, cw)
	formID, questionID := openFormForGroup(t, cw)
	path := "/instances/" + cw.instance + "/forms/forms/" + formID + "/answers"
	body := map[string]any{"answers": []map[string]any{{"question_id": questionID, "value_text": "synthetic"}}}

	before := cw.call(t, "POST", path, body, cw.resident)
	if before.Code != http.StatusForbidden || !strings.Contains(before.Body.String(), "consent") {
		t.Fatalf("answer before consent: %d %s, want the consent refusal", before.Code, before.Body.String())
	}
	agreed := cw.call(t, "POST", "/instances/"+cw.instance+"/custody/consent/agree", map[string]any{}, cw.resident)
	if agreed.Code != http.StatusCreated {
		t.Fatalf("resident agrees: %d %s, want 201", agreed.Code, agreed.Body.String())
	}
	after := cw.call(t, "POST", path, body, cw.resident)
	if after.Code != http.StatusOK {
		t.Fatalf("answer after consent: %d %s, want 200", after.Code, after.Body.String())
	}
	mine := cw.call(t, "GET", path+"/mine", nil, cw.resident)
	if mine.Code != http.StatusOK || !strings.Contains(mine.Body.String(), "synthetic") {
		t.Fatalf("the answer did not land: %d %s", mine.Code, mine.Body.String())
	}
}
