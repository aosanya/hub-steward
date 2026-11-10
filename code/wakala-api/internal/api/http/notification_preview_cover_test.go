package http

import (
	"context"
	"errors"
	"slices"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	permissions "wakalaserver/modules/permissions"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/notifyrules"
)

type previewDirectory struct {
	mwanachamaactor.UserManager
	groupErr error
	placed   []mwanachamaactor.ActorGroupAssignment
	placeErr error
	leaders  map[string]bool
	leadErr  error
}

func (d previewDirectory) GetGroup(context.Context, string) (mwanachamaactor.Group, error) {
	return mwanachamaactor.Group{}, d.groupErr
}

func (d previewDirectory) ListActorsForGroup(context.Context, string) ([]mwanachamaactor.ActorGroupAssignment, error) {
	return d.placed, d.placeErr
}

func (d previewDirectory) IsGroupLeader(_ context.Context, _ string, actorID string) (bool, error) {
	return d.leaders[actorID], d.leadErr
}

type previewRegistry struct {
	agencies.Registry
	members    []agencies.Member
	membersErr error
	directory  mwanachamaactor.UserManager
	dirErr     error
}

func (r previewRegistry) Members(context.Context, string) ([]agencies.Member, error) {
	return r.members, r.membersErr
}

func (r previewRegistry) ActorManager(context.Context, string) (mwanachamaactor.UserManager, error) {
	return r.directory, r.dirErr
}

func placedIn(ids ...string) []mwanachamaactor.ActorGroupAssignment {
	out := make([]mwanachamaactor.ActorGroupAssignment, len(ids))
	for i, id := range ids {
		out[i] = mwanachamaactor.ActorGroupAssignment{ActorID: id}
	}
	return out
}

func TestPreviewRosterSortsPeopleIntoTheirAudiences(t *testing.T) {
	reg := previewRegistry{
		members:   []agencies.Member{{UserID: "own", Role: agencies.RoleOwner}, {UserID: "ag", Role: agencies.RoleAgent}, {UserID: "res", Role: agencies.RoleResident}},
		directory: previewDirectory{placed: placedIn("lee", "ann"), leaders: map[string]bool{"lee": true}},
	}
	roster, err := previewRoster(context.Background(), reg, "i1", "g1")
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(roster[notifyrules.Owners], []string{"own"}) || !slices.Equal(roster[notifyrules.Agents], []string{"ag"}) ||
		!slices.Equal(roster[notifyrules.Group], []string{"lee", "ann"}) || !slices.Equal(roster[notifyrules.GroupLeaders], []string{"lee"}) {
		t.Fatalf("got %v", roster)
	}
}

func TestPreviewRosterReturnsTheFirstFailure(t *testing.T) {
	boom := errors.New("down")
	cases := map[string]previewRegistry{
		"members":   {membersErr: boom},
		"directory": {dirErr: boom},
		"group":     {directory: previewDirectory{groupErr: boom}},
		"placed":    {directory: previewDirectory{placeErr: boom}},
		"leader":    {directory: previewDirectory{placed: placedIn("ann"), leadErr: boom}},
	}
	for name, reg := range cases {
		if _, err := previewRoster(context.Background(), reg, "i1", "g1"); !errors.Is(err, boom) {
			t.Errorf("%s: want the failure, got %v", name, err)
		}
	}
	missing := previewRegistry{directory: previewDirectory{groupErr: mwanachamaactor.ErrGroupNotFound}}
	if _, err := previewRoster(context.Background(), missing, "i1", "g1"); !errors.Is(err, mwanachamaactor.ErrGroupNotFound) {
		t.Fatalf("an unknown group must stay recognisable, got %v", err)
	}
}

func TestADraftRuleIsCheckedNotStored(t *testing.T) {
	draft := &notificationRuleBody{Told: []notifyrules.Audience{notifyrules.Subject}, Mutable: true}
	rule, err := ruleToPreview(context.Background(), nil, "i1", notifyrules.JoinApproved, draft)
	if err != nil || rule.Event != notifyrules.JoinApproved || !slices.Equal(rule.Told, draft.Told) {
		t.Fatalf("got %+v %v", rule, err)
	}
	refused := &notificationRuleBody{Told: []notifyrules.Audience{notifyrules.Thread}, Mutable: true}
	if _, err := ruleToPreview(context.Background(), nil, "i1", notifyrules.JoinApproved, refused); !errors.Is(err, notifyrules.ErrAudienceRefused) {
		t.Fatalf("an audience the event cannot name is refused, got %v", err)
	}
	if _, err := ruleToPreview(context.Background(), nil, "i1", "no_such_event", draft); err == nil {
		t.Fatal("an unknown event is refused")
	}
}

func TestNoDraftPreviewsTheStoredRule(t *testing.T) {
	store, err := notifyrules.NewStore(stepRunDB(t))
	if err != nil {
		t.Fatal(err)
	}
	rule, err := ruleToPreview(context.Background(), store, "i1", notifyrules.Invited, nil)
	if err != nil || !slices.Equal(rule.Told, []notifyrules.Audience{notifyrules.Subject}) {
		t.Fatalf("with nothing stored the default shows, got %+v %v", rule, err)
	}
}

func TestOnlySubjectAndThreadAreNamedAtRaise(t *testing.T) {
	rule := notifyrules.Rule{
		Told:     []notifyrules.Audience{notifyrules.Subject, notifyrules.GroupLeaders},
		Fallback: []notifyrules.Audience{notifyrules.Thread, notifyrules.Owners},
	}
	if got := namedAtRaise(rule); !slices.Equal(got, []notifyrules.Audience{notifyrules.Subject, notifyrules.Thread}) {
		t.Fatalf("got %v", got)
	}
	if got := namedAtRaise(notifyrules.Rule{}); got == nil || len(got) != 0 {
		t.Fatalf("a rule naming nobody gives an empty list that encodes as [], got %#v", got)
	}
}

func TestRecordGrantNamesAreStable(t *testing.T) {
	if got := recordIdentity("forms", "case", "c1"); got != "forms/case/c1" {
		t.Fatalf("got %q", got)
	}
	if got := recordScope("forms", "case", "c1"); got != "record:forms/case/c1" {
		t.Fatalf("got %q", got)
	}
}

func TestNoPermissionsManagerMeansNoRecordGrants(t *testing.T) {
	if RecordGrants(nil) != nil {
		t.Fatal("without a permissions manager there is no grant lookup")
	}
	d := &Deps{}
	ctx := accounts.WithID(context.Background(), "ann")
	if d.mayOnRecord(ctx, "forms", "case", "c1", "read") {
		t.Fatal("without permissions nobody may act on a record")
	}
	ended, err := d.endRecordGrants(ctx, "forms", "case", "c1")
	if err != nil || ended != nil {
		t.Fatalf("nothing to end, got %v %v", ended, err)
	}
	d.tellRecordAccessEnded(ctx, "forms/case/c1", []permissions.Grant{{Subject: "ann", Partition: "i1"}})
}

func TestRecordGrantLookupRefusesBlankPeopleAndRecords(t *testing.T) {
	grants := RecordGrants(blankOnlyPermissions{})
	for _, c := range []struct{ actor, id string }{{"", "c1"}, {"ann", ""}} {
		ok, err := grants(context.Background(), "i1", c.actor, "forms", "case", c.id, "read")
		if ok || err != nil {
			t.Fatalf("blank %+v must be no grant without asking, got %v %v", c, ok, err)
		}
	}
	d := &Deps{Permissions: blankOnlyPermissions{}}
	if d.mayOnRecord(context.Background(), "forms", "case", "c1", "read") {
		t.Fatal("an anonymous caller may not act on a record")
	}
	if d.mayOnRecord(accounts.WithID(context.Background(), "ann"), "forms", "case", "", "read") {
		t.Fatal("a blank record id is never allowed")
	}
	if ended, err := d.endRecordGrants(context.Background(), "forms", "case", ""); ended != nil || err != nil {
		t.Fatalf("a blank record id ends nothing, got %v %v", ended, err)
	}
}

type blankOnlyPermissions struct{ permissions.PermissionsManager }
