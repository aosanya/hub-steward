package http

import (
	"context"
	"errors"
	"slices"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	actormodels "wakalaserver/modules/actor/models"
	mwanachamacomm "wakalaserver/modules/comm"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/notifyrules"
)

type decisionManager struct {
	mwanachamaactor.UserManager
	request    mwanachamaactor.GroupJoinRequest
	failure    error
	decisions  []mwanachamaactor.JoinDecision
	listErr    error
	seats      []mwanachamaactor.ActorRoleAssignment
	leaders    map[string]bool
	invitation mwanachamaactor.GroupInvitation
}

func (d decisionManager) ApproveJoinRequest(context.Context, string, string) (mwanachamaactor.GroupJoinRequest, error) {
	return d.request, d.failure
}

func (d decisionManager) OperatorApproveJoinRequest(context.Context, string, string) (mwanachamaactor.GroupJoinRequest, error) {
	return d.request, d.failure
}

func (d decisionManager) DeclineJoinRequest(context.Context, string, string, bool, string) (mwanachamaactor.GroupJoinRequest, error) {
	return d.request, d.failure
}

func (d decisionManager) OperatorDeclineJoinRequest(context.Context, string, string, bool, string) (mwanachamaactor.GroupJoinRequest, error) {
	return d.request, d.failure
}

func (d decisionManager) ListJoinDecisions(context.Context, string) ([]mwanachamaactor.JoinDecision, error) {
	return d.decisions, d.listErr
}

func (d decisionManager) InviteToGroup(context.Context, string, string, string, string, string) (mwanachamaactor.GroupInvitation, error) {
	return d.invitation, d.failure
}

func (d decisionManager) ListRoleAssignmentsForGroup(context.Context, string, bool) ([]mwanachamaactor.ActorRoleAssignment, error) {
	return d.seats, d.listErr
}

func (d decisionManager) IsGroupLeader(_ context.Context, _ string, actorID string) (bool, error) {
	return d.leaders[actorID], nil
}

type countingRooms struct{ opened *int }

func (c countingRooms) CommManager(context.Context, string) (*mwanachamacomm.CommManager, error) {
	*c.opened++
	return nil, errors.New("no rooms in this test")
}

type staffRoster []agencies.Member

func (s staffRoster) Members(context.Context, string) ([]agencies.Member, error) { return s, nil }

type failingRoster struct{}

func (failingRoster) Members(context.Context, string) ([]agencies.Member, error) {
	return nil, errors.New("down")
}

func announcer(d decisionManager, opened *int) joinDecisionsAnnounced {
	return joinDecisionsAnnounced{UserManager: d, rooms: countingRooms{opened}, instanceID: "i1"}
}

func askedBy(actor string) mwanachamaactor.GroupJoinRequest {
	return mwanachamaactor.GroupJoinRequest{ID: "r1", GroupID: "g1", ActorID: actor}
}

func TestAnApprovalTellsTheApplicant(t *testing.T) {
	for name, approve := range map[string]func(joinDecisionsAnnounced) error{
		"agency": func(m joinDecisionsAnnounced) error {
			_, err := m.ApproveJoinRequest(context.Background(), "r1", "boss")
			return err
		},
		"operator": func(m joinDecisionsAnnounced) error {
			_, err := m.OperatorApproveJoinRequest(context.Background(), "r1", "boss")
			return err
		},
	} {
		opened := 0
		if err := approve(announcer(decisionManager{request: askedBy("ann")}, &opened)); err != nil || opened != 1 {
			t.Fatalf("%s: one person is told of an approval, got %d told, %v", name, opened, err)
		}
	}
}

func TestAFailedApprovalTellsNobody(t *testing.T) {
	opened := 0
	boom := errors.New("refused")
	_, err := announcer(decisionManager{failure: boom}, &opened).ApproveJoinRequest(context.Background(), "r1", "boss")
	if !errors.Is(err, boom) || opened != 0 {
		t.Fatalf("a failed approval must tell nobody and return the error, got %d %v", opened, err)
	}
}

func TestASilentDeclineTellsNobody(t *testing.T) {
	for name, decline := range map[string]func(joinDecisionsAnnounced, bool) error{
		"agency": func(m joinDecisionsAnnounced, silent bool) error {
			_, err := m.DeclineJoinRequest(context.Background(), "r1", "boss", silent, "")
			return err
		},
		"operator": func(m joinDecisionsAnnounced, silent bool) error {
			_, err := m.OperatorDeclineJoinRequest(context.Background(), "r1", "boss", silent, "")
			return err
		},
	} {
		d := decisionManager{request: askedBy("ann"), decisions: []mwanachamaactor.JoinDecision{{ID: "d1", State: actormodels.JoinRequestDeclined}}}
		opened := 0
		if err := decline(announcer(d, &opened), true); err != nil || opened != 0 {
			t.Fatalf("%s: a silent decline tells nobody, got %d %v", name, opened, err)
		}
		if err := decline(announcer(d, &opened), false); err != nil || opened != 1 {
			t.Fatalf("%s: a told decline tells the applicant, got %d %v", name, opened, err)
		}
	}
}

func TestADeclineWithNoToldDecisionTellsNobodyAndStillSucceeds(t *testing.T) {
	cases := map[string]decisionManager{
		"only silent decisions": {request: askedBy("ann"), decisions: []mwanachamaactor.JoinDecision{{ID: "d1", State: actormodels.JoinRequestDeclined, Silent: true}}},
		"only approvals":        {request: askedBy("ann"), decisions: []mwanachamaactor.JoinDecision{{ID: "d1", State: actormodels.JoinRequestApproved}}},
		"the list fails":        {request: askedBy("ann"), listErr: errors.New("down")},
	}
	for name, d := range cases {
		opened := 0
		if _, err := announcer(d, &opened).DeclineJoinRequest(context.Background(), "r1", "boss", false, "no room"); err != nil || opened != 0 {
			t.Fatalf("%s: got %d told, %v", name, opened, err)
		}
	}
}

func TestAFailedDeclineTellsNobody(t *testing.T) {
	opened := 0
	_, err := announcer(decisionManager{failure: errors.New("refused")}, &opened).DeclineJoinRequest(context.Background(), "r1", "boss", false, "")
	if err == nil || opened != 0 {
		t.Fatalf("got %d %v", opened, err)
	}
}

func TestToldDeclineIsTheLatestNonSilentOne(t *testing.T) {
	m := announcer(decisionManager{decisions: []mwanachamaactor.JoinDecision{
		{ID: "old", State: actormodels.JoinRequestDeclined},
		{ID: "new", State: actormodels.JoinRequestDeclined},
		{ID: "quiet", State: actormodels.JoinRequestDeclined, Silent: true},
	}}, new(int))
	got, err := m.toldDeclineOf(context.Background(), "r1")
	if err != nil || got.ID != "new" {
		t.Fatalf("the latest told decline is named, got %+v %v", got, err)
	}
}

func TestAnInvitationTellsTheInvitedPerson(t *testing.T) {
	opened := 0
	m := announcer(decisionManager{invitation: mwanachamaactor.GroupInvitation{ID: "inv", GroupID: "g1", ActorID: "bob"}}, &opened)
	if _, err := m.InviteToGroup(context.Background(), "g1", "bob", "", "boss", ""); err != nil || opened != 1 {
		t.Fatalf("got %d told, %v", opened, err)
	}
	opened = 0
	failing := announcer(decisionManager{failure: errors.New("no")}, &opened)
	if _, err := failing.InviteToGroup(context.Background(), "g1", "bob", "", "boss", ""); err == nil || opened != 0 {
		t.Fatalf("a failed invitation tells nobody, got %d %v", opened, err)
	}
}

func TestNoRoomsMeansNobodyIsRaised(t *testing.T) {
	m := joinDecisionsAnnounced{UserManager: decisionManager{request: askedBy("ann")}, instanceID: "i1"}
	if _, err := m.ApproveJoinRequest(context.Background(), "r1", "boss"); err != nil {
		t.Fatalf("an approval does not need rooms, got %v", err)
	}
	if err := m.raise(context.Background(), "ann", "group", "g1", "x"); err != nil {
		t.Fatalf("with no rooms there is nothing to raise, got %v", err)
	}
}

func TestTheDefaultRuleTellsOnlyTheApplicant(t *testing.T) {
	m := joinDecisionsAnnounced{UserManager: decisionManager{}, instanceID: "i1"}
	if got := m.toldOfADecision(context.Background(), notifyrules.JoinApproved, askedBy("ann")); !slices.Equal(got, []string{"ann"}) {
		t.Fatalf("got %v", got)
	}
}

func TestARuleThatNamesLeadersAndStaffReachesThemWithoutRepeating(t *testing.T) {
	store, err := notifyrules.NewStore(stepRunDB(t))
	if err != nil {
		t.Fatal(err)
	}
	rule := notifyrules.Rule{Event: notifyrules.JoinApproved, Mutable: true,
		Told: []notifyrules.Audience{notifyrules.Subject, notifyrules.GroupLeaders}, Fallback: []notifyrules.Audience{notifyrules.Owners, notifyrules.Agents}}
	if _, err := store.Put(context.Background(), "i1", rule); err != nil {
		t.Fatal(err)
	}
	d := decisionManager{
		seats:   []mwanachamaactor.ActorRoleAssignment{{ActorID: "lee"}, {ActorID: "ann"}, {ActorID: "lee"}, {ActorID: "tom"}},
		leaders: map[string]bool{"lee": true, "ann": true},
	}
	m := joinDecisionsAnnounced{UserManager: d, instanceID: "i1", rules: store,
		agency: staffRoster{{UserID: "own", Role: agencies.RoleOwner}, {UserID: "ag", Role: agencies.RoleAgent}, {UserID: "res", Role: agencies.RoleResident}}}
	got := m.toldOf(context.Background(), notifyrules.JoinApproved, "ann", "g1")
	if !slices.Equal(got, []string{"ann", "lee"}) {
		t.Fatalf("the applicant then the other leader, once each, got %v", got)
	}
	roster := notifyrules.Roster{}
	m.addAgencyStaff(context.Background(), roster)
	if !slices.Equal(roster[notifyrules.Owners], []string{"own"}) || !slices.Equal(roster[notifyrules.Agents], []string{"ag"}) {
		t.Fatalf("owners and agents are read from the agency, residents are not, got %v", roster)
	}
}

func TestAnUnreadableRuleFallsBackToItsDefault(t *testing.T) {
	db := stepRunDB(t)
	store, err := notifyrules.NewStore(db)
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	sqlDB.Close()
	m := joinDecisionsAnnounced{instanceID: "i1", rules: store}
	rule := m.ruleFor(context.Background(), notifyrules.JoinDeclined)
	if rule.Event != notifyrules.JoinDeclined || !slices.Equal(rule.Told, []notifyrules.Audience{notifyrules.Subject}) {
		t.Fatalf("an unreadable store gives the default rule, got %+v", rule)
	}
}

func TestStaffAndLeaderLookupsFailQuietly(t *testing.T) {
	roster := notifyrules.Roster{}
	joinDecisionsAnnounced{agency: failingRoster{}}.addAgencyStaff(context.Background(), roster)
	joinDecisionsAnnounced{}.addAgencyStaff(context.Background(), roster)
	joinDecisionsAnnounced{UserManager: decisionManager{listErr: errors.New("down")}}.addGroupLeaders(context.Background(), roster, "ann", "g1")
	if len(roster) != 0 {
		t.Fatalf("a failed read adds nobody, got %v", roster)
	}
}

func TestNamesAudienceAndNamesAgencyStaffLookInBothLists(t *testing.T) {
	rule := notifyrules.Rule{Told: []notifyrules.Audience{notifyrules.Subject}, Fallback: []notifyrules.Audience{notifyrules.GroupLeaders}}
	if !namesAudience(rule, notifyrules.GroupLeaders) || namesAudience(rule, notifyrules.Owners) {
		t.Fatal("the fallback list counts")
	}
	if namesAgencyStaff(rule) {
		t.Fatal("neither list names staff")
	}
	rule.Fallback = []notifyrules.Audience{notifyrules.Agents}
	if !namesAgencyStaff(rule) {
		t.Fatal("agents are staff")
	}
}
