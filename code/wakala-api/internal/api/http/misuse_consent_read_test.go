package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamacustody "wakalaserver/modules/custody"
	custodymodels "wakalaserver/modules/custody/models"
)

func publishedMechanicsID(t *testing.T, cw consentWalk) string {
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
	return version.ID
}

func TestConsentRead_ResidentReadsTheSheetInForce(t *testing.T) {
	cw := newConsentWalk(t)
	versionID := publishedMechanicsID(t, cw)
	base := "/instances/" + cw.instance + "/custody"

	got := cw.call(t, "GET", base+"/consent/versions/in-force/mechanics/en", nil, cw.resident)
	if got.Code != http.StatusOK {
		t.Fatalf("resident reads the sheet in force: %d %s, want 200", got.Code, got.Body.String())
	}
	if id, _ := decodeObject(t, got)["id"].(string); id != versionID {
		t.Fatalf("sheet in force id = %q, want %q", id, versionID)
	}
}

func TestConsentRead_ResidentSeesOwnConsentStateThroughAgreeAndWithdraw(t *testing.T) {
	cw := newConsentWalk(t)
	publishedMechanicsID(t, cw)
	base := "/instances/" + cw.instance + "/custody"
	status := func() string {
		got := cw.call(t, "GET", base+"/consent/mine", nil, cw.resident)
		if got.Code != http.StatusOK {
			t.Fatalf("resident reads own consent state: %d %s, want 200", got.Code, got.Body.String())
		}
		s, _ := decodeObject(t, got)["status"].(string)
		return s
	}
	if s := status(); s != "none" {
		t.Fatalf("state before agreeing = %q, want none", s)
	}
	if agreed := cw.call(t, "POST", base+"/consent/agree", map[string]any{}, cw.resident); agreed.Code != http.StatusCreated {
		t.Fatalf("agree: %d %s", agreed.Code, agreed.Body.String())
	}
	if s := status(); s != "agreed" {
		t.Fatalf("state after agreeing = %q, want agreed", s)
	}
	if withdrawn := cw.call(t, "POST", base+"/consent/withdraw", map[string]any{}, cw.resident); withdrawn.Code != http.StatusCreated {
		t.Fatalf("withdraw: %d %s", withdrawn.Code, withdrawn.Body.String())
	}
	if s := status(); s != "withdrawn" {
		t.Fatalf("state after withdrawing = %q, want withdrawn", s)
	}
}

func TestConsentRead_EveryOtherCustodyRouteStaysClosedToAResident(t *testing.T) {
	cw := newConsentWalk(t)
	versionID := publishedMechanicsID(t, cw)
	base := "/instances/" + cw.instance + "/custody"
	closed := []struct{ method, path string }{
		{"GET", "/consent/versions/" + versionID},
		{"POST", "/consent/versions"},
		{"POST", "/consent/versions/" + versionID + "/publish"},
		{"GET", "/export-jobs"},
		{"GET", "/custody-log"},
		{"GET", "/custody-log/counts"},
		{"GET", "/structures/" + cw.groupID + "/act-log"},
		{"GET", "/actors/" + cw.actorID + "/export-jobs"},
		{"GET", "/actors/" + cw.actorID + "/contact-reads"},
	}
	for _, c := range closed {
		var body any
		if c.method == "POST" {
			body = map[string]any{}
		}
		got := cw.call(t, c.method, base+c.path, body, cw.resident)
		if got.Code != http.StatusNotFound {
			t.Errorf("resident %s %s: %d %s, want 404", c.method, c.path, got.Code, got.Body.String())
		}
	}
}

func TestConsentRead_AStrangerReadsNeitherTheSheetNorAState(t *testing.T) {
	cw := newConsentWalk(t)
	publishedMechanicsID(t, cw)
	base := "/instances/" + cw.instance + "/custody"
	stranger := cw.cookieFor(t, "not-a-member")
	for _, path := range []string{"/consent/versions/in-force/mechanics/en", "/consent/mine"} {
		got := cw.call(t, "GET", base+path, nil, stranger)
		if got.Code != http.StatusNotFound {
			t.Errorf("stranger GET %s: %d %s, want 404", path, got.Code, got.Body.String())
		}
	}
}
