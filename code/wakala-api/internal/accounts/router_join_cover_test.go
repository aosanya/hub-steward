package accounts

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/internal/agencies"
)

func accountHall(t *testing.T, router *Router, account, name, mode string) (context.Context, agencies.Instance) {
	t.Helper()
	ctx := WithID(context.Background(), account)
	made, err := router.CreateInstance(ctx, name)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := router.SetJoinMode(ctx, made.ID, mode); err != nil {
		t.Fatal(err)
	}
	return ctx, made
}

func TestJoiningAnOpenHallThroughTheRouterMakesAResidentAndLeavingRemovesThem(t *testing.T) {
	router, _ := routerWith(t, "own")
	ctx, hall := accountHall(t, router, "own", "Open hall", agencies.JoinOpen)

	outcome, err := router.Join(ctx, hall.ID, "visitor", "")
	if err != nil || outcome.Status != agencies.JoinedNow || outcome.Role != agencies.RoleResident {
		t.Fatalf("join = %+v %v", outcome, err)
	}
	again, err := router.Join(ctx, hall.ID, "visitor", "")
	if err != nil || again.Status != agencies.AlreadyAMember || again.Role != agencies.RoleResident {
		t.Errorf("second join = %+v %v", again, err)
	}
	if err := router.Leave(ctx, hall.ID, "visitor"); err != nil {
		t.Fatal(err)
	}
	if err := router.Leave(ctx, hall.ID, "visitor"); !errors.Is(err, agencies.ErrNothingToLeave) {
		t.Errorf("leaving twice = %v", err)
	}
}

func TestAnOperatorCannotLeaveAsAResident(t *testing.T) {
	router, _ := routerWith(t, "own")
	ctx, hall := accountHall(t, router, "own", "Hall", agencies.JoinOpen)
	if err := router.AddMember(ctx, hall.ID, "boss", agencies.RoleOwner); err != nil {
		t.Fatal(err)
	}
	if err := router.Leave(ctx, hall.ID, "boss"); !errors.Is(err, agencies.ErrOperatorCannotLeave) {
		t.Errorf("an owner leaving = %v", err)
	}
}

func TestAConfirmedHallHoldsARequestUntilDecidedAndARefusedPersonAppeals(t *testing.T) {
	router, _ := routerWith(t, "own")
	ctx, hall := accountHall(t, router, "own", "Closed hall", agencies.JoinConfirmed)

	outcome, err := router.Join(ctx, hall.ID, "asker", "please let me in")
	if err != nil || outcome.Status != agencies.JoinRequested || outcome.Appeal {
		t.Fatalf("first request = %+v %v", outcome, err)
	}
	if pending, _ := router.HasPendingJoinRequest(ctx, hall.ID, "asker"); !pending {
		t.Error("the request should be pending")
	}
	requests, err := router.JoinRequests(ctx, hall.ID)
	if err != nil || len(requests) != 1 || requests[0].UserID != "asker" || requests[0].Message != "please let me in" {
		t.Fatalf("requests = %+v %v", requests, err)
	}

	if err := router.DecideJoinRequest(ctx, hall.ID, "asker", false); err != nil {
		t.Fatal(err)
	}
	if pending, _ := router.HasPendingJoinRequest(ctx, hall.ID, "asker"); pending {
		t.Error("a refused request is no longer pending")
	}
	if err := router.DecideJoinRequest(ctx, hall.ID, "asker", false); !errors.Is(err, agencies.ErrJoinRequestNotFound) {
		t.Errorf("deciding a refused request again = %v", err)
	}
	appeal, err := router.Join(ctx, hall.ID, "asker", "I ask again")
	if err != nil || appeal.Status != agencies.JoinRequested || !appeal.Appeal {
		t.Fatalf("appeal = %+v %v", appeal, err)
	}
	if err := router.DecideJoinRequest(ctx, hall.ID, "asker", true); err != nil {
		t.Fatal(err)
	}
	if role, _ := router.RoleOf(ctx, hall.ID, "asker"); role != agencies.RoleResident {
		t.Errorf("an approved request makes a resident, got %q", role)
	}
	if err := router.DecideJoinRequest(ctx, hall.ID, "nobody", true); !errors.Is(err, agencies.ErrJoinRequestNotFound) {
		t.Errorf("approving a request nobody made = %v", err)
	}
}

func TestJoinRefusalsReachTheCallerThroughTheRouter(t *testing.T) {
	router, _ := routerWith(t, "own")
	ctx, hall := accountHall(t, router, "own", "Hall", agencies.JoinConfirmed)
	if _, err := router.Join(ctx, hall.ID, "", ""); err == nil {
		t.Error("joining with no caller was accepted")
	}
	if _, err := router.Join(ctx, "missing", "someone", ""); !errors.Is(err, agencies.ErrInstanceNotFound) {
		t.Errorf("joining an unknown hall = %v", err)
	}
	long := make([]rune, agencies.MaxJoinMessageLength+1)
	for i := range long {
		long[i] = 'x'
	}
	if _, err := router.Join(ctx, hall.ID, "talker", string(long)); !errors.Is(err, agencies.ErrJoinMessageTooLong) {
		t.Errorf("an over-long message = %v", err)
	}
	if _, err := router.SetJoinMode(ctx, hall.ID, "whenever"); !errors.Is(err, agencies.ErrInvalidJoinMode) {
		t.Errorf("an unknown join mode = %v", err)
	}
}

func TestAdmittingAResidentIsIdempotentAndKeepsAnOperatorsRole(t *testing.T) {
	router, _ := routerWith(t, "own")
	ctx, hall := accountHall(t, router, "own", "Hall", agencies.JoinConfirmed)
	role, err := router.AdmitResident(ctx, hall.ID, "guest")
	if err != nil || role != agencies.RoleResident {
		t.Fatalf("admit = %q %v", role, err)
	}
	if role, err = router.AdmitResident(ctx, hall.ID, "guest"); err != nil || role != agencies.RoleResident {
		t.Errorf("admit twice = %q %v", role, err)
	}
	if err := router.AddMember(ctx, hall.ID, "boss", agencies.RoleOwner); err != nil {
		t.Fatal(err)
	}
	if role, err = router.AdmitResident(ctx, hall.ID, "boss"); err != nil || role != agencies.RoleOwner {
		t.Errorf("admitting an owner = %q %v", role, err)
	}
	if _, err := router.AdmitResident(ctx, "missing", "guest"); !errors.Is(err, agencies.ErrInstanceNotFound) {
		t.Errorf("admitting into an unknown hall = %v", err)
	}
	if _, err := router.AdmitResident(ctx, hall.ID, " "); err == nil {
		t.Error("admitting a blank person was accepted")
	}
}

func TestJoinRequestsOfOneAccountAreNotSeenByAnother(t *testing.T) {
	router, _ := routerWith(t, "own")
	ownCtx, hall := accountHall(t, router, "own", "Own hall", agencies.JoinConfirmed)
	if _, err := router.Join(ownCtx, hall.ID, "asker", ""); err != nil {
		t.Fatal(err)
	}
	shared := WithID(context.Background(), "someone-else")
	if pending, _ := router.HasPendingJoinRequest(shared, hall.ID, "asker"); pending {
		t.Error("the shared side saw a request held in the account's own database")
	}
}

func TestAnAdoptedCallerBecomesAnActorOfTheAccountsOwnHallOnly(t *testing.T) {
	router, _ := routerWith(t, "own")
	ctx, hall := accountHall(t, router, "own", "Hall", agencies.JoinOpen)
	if err := router.AdoptCaller(ctx, hall.ID, "newcomer"); err != nil {
		t.Fatal(err)
	}
	directory, err := router.ActorManager(ctx, hall.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := directory.EnsureActor(ctx, "newcomer"); err != nil {
		t.Errorf("the adopted caller is not an actor: %v", err)
	}
	if err := router.AdoptCaller(ctx, "missing", "newcomer"); err == nil {
		t.Error("adopting into an unknown hall was accepted")
	}
}

func TestADirectorySearchOnlyListsHallsMadeListedInTheCallersOwnDatabase(t *testing.T) {
	router, _ := routerWith(t, "own")
	ctx, hall := accountHall(t, router, "own", "Findable bakery guild", agencies.JoinOpen)
	if found, err := router.SearchDirectory(ctx, "bakery"); err != nil || len(found) != 0 {
		t.Fatalf("an unlisted hall was found: %v %v", found, err)
	}
	listed := true
	changed, err := router.SetListing(ctx, hall.ID, agencies.ListingChange{Listed: &listed})
	if err != nil || !changed.Listed {
		t.Fatalf("listing = %+v %v", changed, err)
	}
	found, err := router.SearchDirectory(ctx, "bakery")
	if err != nil || len(found) != 1 || found[0].ID != hall.ID {
		t.Errorf("found = %+v %v", found, err)
	}
	other := WithID(context.Background(), "shared-account")
	if found, _ := router.SearchDirectory(other, "bakery"); len(found) != 0 {
		t.Errorf("another account's directory showed %v", found)
	}
}
