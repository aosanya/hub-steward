package accounts

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/internal/agencies"
)

type bareRegistry struct{ agencies.Registry }

func routerOverBareRegistry(t *testing.T) (*Router, agencies.Registry) {
	t.Helper()
	real, err := agencies.NewRegistry(memoryDB(t))
	if err != nil {
		t.Fatal(err)
	}
	own := &ownDatabases{t: t, owners: map[string]bool{}}
	return NewRouter(bareRegistry{real}, own.resolve, own.open, 2), real
}

func TestARegistryWithoutApprovalsListsNoPendingHallsAndRefusesEveryDecision(t *testing.T) {
	router, _ := routerOverBareRegistry(t)
	ctx := context.Background()
	pending, err := router.ListPendingInstances(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if pending == nil || len(pending) != 0 {
		t.Errorf("pending = %#v, want an empty non-nil list", pending)
	}
	for _, approve := range []bool{true, false} {
		if _, err := router.DecideApproval(ctx, "any", approve, "note"); !errors.Is(err, agencies.ErrInstanceNotFound) {
			t.Errorf("approve=%v: err = %v, want ErrInstanceNotFound", approve, err)
		}
	}
}

func TestARegistryWithoutGroupRolesRefusesEveryGroupRoleCallAsNotAMember(t *testing.T) {
	router, _ := routerOverBareRegistry(t)
	ctx := context.Background()
	calls := map[string]func() error{
		"give": func() error { return router.GiveGroupRole(ctx, "h", "g", "r") },
		"take": func() error { return router.TakeGroupRole(ctx, "h", "g", "r") },
		"ids": func() error {
			_, err := router.GroupRoleIDs(ctx, "h", "g")
			return err
		},
		"list": func() error {
			_, err := router.ListGroupRoles(ctx, "h")
			return err
		},
		"through": func() error {
			_, err := router.RoleIDsThroughGroups(ctx, "h", "u")
			return err
		},
	}
	for name, call := range calls {
		if err := call(); !errors.Is(err, agencies.ErrNotAMember) {
			t.Errorf("%s: err = %v, want ErrNotAMember", name, err)
		}
	}
}

func TestAdoptingACallerThroughARegistryWithoutAnAdopterStillMakesThemAnActor(t *testing.T) {
	router, real := routerOverBareRegistry(t)
	ctx := context.Background()
	hall, err := real.CreateInstance(ctx, "Hall")
	if err != nil {
		t.Fatal(err)
	}
	if err := router.AdoptCaller(ctx, hall.ID, "newcomer"); err != nil {
		t.Fatal(err)
	}
	directory, err := real.ActorManager(ctx, hall.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := directory.GetActor(ctx, "newcomer"); err != nil {
		t.Errorf("the adopted caller was not made an actor: %v", err)
	}
}

func TestAdoptingACallerIntoAnUnknownHallThroughAnAdopterlessRegistryFails(t *testing.T) {
	router, _ := routerOverBareRegistry(t)
	if err := router.AdoptCaller(context.Background(), "missing", "newcomer"); err == nil {
		t.Error("adopting into an unknown hall was accepted")
	}
}
