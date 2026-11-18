package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
)

type residentReadWalk struct {
	designAgentWalk
	residentID string
}

func newResidentReadWalk(t *testing.T) residentReadWalk {
	t.Helper()
	w := residentReadWalk{designAgentWalk: newDesignAgentWalk(t)}
	um, err := w.deps.Registry.ActorManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	resident, err := um.CreateActor(context.Background(), mwanachamaactor.Actor{DisplayName: "Nagy Erzsebet"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	w.residentID = resident.ID
	return w
}

func (w residentReadWalk) listPath() string { return w.base + "/actor/actors" }

func (w residentReadWalk) pagePath() string { return w.base + "/actor/actors/" + w.residentID }

func TestResidentRead_SeatHoldingTheOlderPermissionsIsRefusedTheListAndThePage(t *testing.T) {
	w := newResidentReadWalk(t)
	givesTheRole(t, w.designAgentWalk, "member.read", "member.view")
	if rec := w.call(t, "GET", w.listPath(), nil, w.agent); !isRefusal(rec) {
		t.Errorf("a seat holding member.read and member.view listing the residents: %d %s, want a refusal", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", w.pagePath(), nil, w.agent); !isRefusal(rec) {
		t.Errorf("a seat holding member.read and member.view opening a resident's page: %d %s, want a refusal", rec.Code, rec.Body.String())
	}
}

func TestResidentRead_SeatHoldingTheBillPermissionsIsRefusedTheListAndThePage(t *testing.T) {
	w := newResidentReadWalk(t)
	givesTheRole(t, w.designAgentWalk, "accounting.view", "accounting.manage")
	if rec := w.call(t, "GET", w.listPath(), nil, w.agent); !isRefusal(rec) {
		t.Errorf("a seat holding the accounting permissions listing the residents: %d %s, want a refusal", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", w.pagePath(), nil, w.agent); !isRefusal(rec) {
		t.Errorf("a seat holding the accounting permissions opening a resident's page: %d %s, want a refusal", rec.Code, rec.Body.String())
	}
}

func TestResidentRead_SeatHoldingResidentReadOpensTheListAndThePage(t *testing.T) {
	w := newResidentReadWalk(t)
	givesTheRole(t, w.designAgentWalk, "resident.read")
	if rec := w.call(t, "GET", w.listPath(), nil, w.agent); rec.Code != http.StatusOK {
		t.Errorf("a seat holding resident.read listing the residents: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", w.pagePath(), nil, w.agent); rec.Code != http.StatusOK {
		t.Errorf("a seat holding resident.read opening a resident's page: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
