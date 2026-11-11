package http

import (
	"context"
	"errors"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	actormodels "wakalaserver/modules/actor/models"

	"wakalaserver/internal/accounts"
)

type declinesStub struct {
	mwanachamaactor.UserManager
	held    []mwanachamaactor.GroupJoinRequest
	one     mwanachamaactor.GroupJoinRequest
	byCode  mwanachamaactor.GroupByCode
	failure error
}

func (s declinesStub) ListJoinRequestsForActor(context.Context, string) ([]mwanachamaactor.GroupJoinRequest, error) {
	return s.held, s.failure
}

func (s declinesStub) GetJoinRequest(context.Context, string) (mwanachamaactor.GroupJoinRequest, error) {
	return s.one, s.failure
}

func (s declinesStub) FindGroupByCode(context.Context, string, string) (mwanachamaactor.GroupByCode, error) {
	return s.byCode, s.failure
}

func silentDecline() mwanachamaactor.GroupJoinRequest {
	return mwanachamaactor.GroupJoinRequest{
		ID: "r1", ActorID: "me", State: actormodels.JoinRequestDeclined, Silent: true,
		DecidedBy: "boss", DecidedAt: "2026-11-01", AskedAt: "2026-10-30", RequestedAt: "2026-10-29", LastUpdated: "2026-11-01",
	}
}

func TestApplicantSeesASilentDeclineAsUnderReview(t *testing.T) {
	seen := asTheApplicantSeesIt(silentDecline())
	if seen.State != joinRequestUnderReview || seen.Silent || seen.DecidedBy != "" || seen.DecidedAt != "" {
		t.Fatalf("a silent decline must read as under review with no decider, got %+v", seen)
	}
	if seen.LastUpdated != "2026-10-30" {
		t.Fatalf("the last update must fall back to when it was asked, got %q", seen.LastUpdated)
	}
}

func TestApplicantSeesAnOpenDeclineAsDeclined(t *testing.T) {
	open := silentDecline()
	open.Silent = false
	if got := asTheApplicantSeesIt(open); got.State != actormodels.JoinRequestDeclined || got.DecidedBy != "boss" {
		t.Fatalf("a decline the applicant was told about must stay declined, got %+v", got)
	}
	pending := mwanachamaactor.GroupJoinRequest{State: actormodels.JoinRequestPending, Silent: true}
	if got := asTheApplicantSeesIt(pending); got.State != actormodels.JoinRequestPending {
		t.Fatalf("a pending request must not change, got %+v", got)
	}
}

func TestLastAskedFallsBackToRequestedAt(t *testing.T) {
	if got := lastAsked(mwanachamaactor.GroupJoinRequest{RequestedAt: "2026-10-29"}); got != "2026-10-29" {
		t.Fatalf("with no asked time the requested time stands in, got %q", got)
	}
	if got := lastAsked(mwanachamaactor.GroupJoinRequest{AskedAt: "2026-10-30", RequestedAt: "2026-10-29"}); got != "2026-10-30" {
		t.Fatalf("the asked time wins, got %q", got)
	}
}

func TestApplicantListHidesSilentDeclines(t *testing.T) {
	m := quietDeclinesUnseen{declinesStub{held: []mwanachamaactor.GroupJoinRequest{silentDecline()}}}
	got, err := m.ListJoinRequestsForActor(context.Background(), "me")
	if err != nil || len(got) != 1 || got[0].State != joinRequestUnderReview {
		t.Fatalf("the applicant's list must show under review, got %+v, %v", got, err)
	}
	boom := errors.New("down")
	if _, err := (quietDeclinesUnseen{declinesStub{failure: boom}}).ListJoinRequestsForActor(context.Background(), "me"); !errors.Is(err, boom) {
		t.Fatalf("a store failure must reach the caller, got %v", err)
	}
}

func TestOneRequestIsHiddenOnlyFromItsApplicant(t *testing.T) {
	m := quietDeclinesUnseen{declinesStub{one: silentDecline()}}
	own, err := m.GetJoinRequest(accounts.WithID(context.Background(), "me"), "r1")
	if err != nil || own.State != joinRequestUnderReview {
		t.Fatalf("the applicant must see under review, got %+v, %v", own, err)
	}
	other, err := m.GetJoinRequest(accounts.WithID(context.Background(), "boss"), "r1")
	if err != nil || other.State != actormodels.JoinRequestDeclined || !other.Silent {
		t.Fatalf("a decider must still see the decline, got %+v, %v", other, err)
	}
	boom := errors.New("gone")
	if _, err := (quietDeclinesUnseen{declinesStub{failure: boom}}).GetJoinRequest(context.Background(), "r1"); !errors.Is(err, boom) {
		t.Fatalf("a store failure must reach the caller, got %v", err)
	}
}

func TestGroupByCodeShowsASilentDeclineAsRequested(t *testing.T) {
	req := silentDecline()
	m := quietDeclinesUnseen{declinesStub{byCode: mwanachamaactor.GroupByCode{State: actormodels.CallerDeclined, Request: &req}}}
	found, err := m.FindGroupByCode(context.Background(), "abc", "me")
	if err != nil || found.State != actormodels.CallerRequested || found.Request.State != joinRequestUnderReview {
		t.Fatalf("a silent decline must read as requested and under review, got %+v, %v", found, err)
	}
	if req.State != actormodels.JoinRequestDeclined {
		t.Fatalf("the stored request must not be rewritten, got %+v", req)
	}
}

func sameRequestWithoutDecider(got, in *mwanachamaactor.GroupJoinRequest) bool {
	if got == nil || in == nil {
		return got == in
	}
	return *got == withoutDecider(*in)
}

func TestGroupByCodeLeavesOtherStatesAlone(t *testing.T) {
	open := silentDecline()
	open.Silent = false
	cases := map[string]mwanachamaactor.GroupByCode{
		"declined and told": {State: actormodels.CallerDeclined, Request: &open},
		"no request":        {State: actormodels.CallerDeclined},
		"member":            {State: actormodels.CallerIsMember},
	}
	for name, in := range cases {
		got, err := (quietDeclinesUnseen{declinesStub{byCode: in}}).FindGroupByCode(context.Background(), "abc", "me")
		if err != nil || got.State != in.State || !sameRequestWithoutDecider(got.Request, in.Request) {
			t.Fatalf("%s: must pass through unchanged but for the decider, got %+v, %v", name, got, err)
		}
	}
	boom := errors.New("down")
	if _, err := (quietDeclinesUnseen{declinesStub{failure: boom}}).FindGroupByCode(context.Background(), "abc", "me"); !errors.Is(err, boom) {
		t.Fatalf("a store failure must reach the caller, got %v", err)
	}
}
