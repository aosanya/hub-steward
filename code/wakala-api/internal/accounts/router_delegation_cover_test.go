package accounts

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestEveryRegistryCallFailsWithTheLookupErrorWhenTheAccountCannotBeResolved(t *testing.T) {
	boom := errors.New("lookup down")
	router, own := routerWith(t, "a")
	own.resolveErr = boom
	ctx := WithID(context.Background(), "a")

	calls := map[string]func() error{
		"CreateInstance":        func() error { _, err := router.CreateInstance(ctx, "x"); return err },
		"GetInstance":           func() error { _, err := router.GetInstance(ctx, "i"); return err },
		"ListInstances":         func() error { _, err := router.ListInstances(ctx); return err },
		"AgencyManager":         func() error { _, err := router.AgencyManager(ctx, "i"); return err },
		"LedgerRepository":      func() error { _, err := router.LedgerRepository(ctx, "i"); return err },
		"TaskManager":           func() error { _, err := router.TaskManager(ctx, "i"); return err },
		"CatalogManager":        func() error { _, err := router.CatalogManager(ctx, "i", "m"); return err },
		"GitManager":            func() error { _, err := router.GitManager(ctx, "i"); return err },
		"SourceManager":         func() error { _, err := router.SourceManager(ctx, "i"); return err },
		"AssetManager":          func() error { _, err := router.AssetManager(ctx, "i"); return err },
		"ActorManager":          func() error { _, err := router.ActorManager(ctx, "i"); return err },
		"FormManager":           func() error { _, err := router.FormManager(ctx, "i"); return err },
		"IssuingFormManager":    func() error { _, err := router.IssuingFormManager(ctx, "i"); return err },
		"CommManager":           func() error { _, err := router.CommManager(ctx, "i"); return err },
		"OpenGeneralThread":     func() error { return router.OpenGeneralThread(ctx, "i", "s", "c") },
		"GeneralThreadID":       func() error { _, err := router.GeneralThreadID(ctx, "i", "s", "c"); return err },
		"AddMember":             func() error { return router.AddMember(ctx, "i", "u", "owner") },
		"RemoveMember":          func() error { return router.RemoveMember(ctx, "i", "u") },
		"IsMember":              func() error { _, err := router.IsMember(ctx, "i", "u"); return err },
		"InstancesFor":          func() error { _, err := router.InstancesFor(ctx, "u"); return err },
		"Members":               func() error { _, err := router.Members(ctx, "i"); return err },
		"RoleOf":                func() error { _, err := router.RoleOf(ctx, "i", "u"); return err },
		"MembershipsFor":        func() error { _, err := router.MembershipsFor(ctx, "u"); return err },
		"SetJoinMode":           func() error { _, err := router.SetJoinMode(ctx, "i", "open"); return err },
		"RenameInstance":        func() error { _, err := router.RenameInstance(ctx, "i", "n"); return err },
		"SetKind":               func() error { _, err := router.SetKind(ctx, "i", "k"); return err },
		"Join":                  func() error { _, err := router.Join(ctx, "i", "u", "hi"); return err },
		"Leave":                 func() error { return router.Leave(ctx, "i", "u") },
		"JoinRequests":          func() error { _, err := router.JoinRequests(ctx, "i"); return err },
		"DecideJoinRequest":     func() error { return router.DecideJoinRequest(ctx, "i", "u", true) },
		"HasPendingJoinRequest": func() error { _, err := router.HasPendingJoinRequest(ctx, "i", "u"); return err },
		"AdmitResident":         func() error { _, err := router.AdmitResident(ctx, "i", "u"); return err },
		"SetListing":            func() error { _, err := router.SetListing(ctx, "i", agencies.ListingChange{}); return err },
		"SearchDirectory":       func() error { _, err := router.SearchDirectory(ctx, "q"); return err },
		"Approvals":             func() error { _, err := router.Approvals(ctx, "i"); return err },
		"CustodyManager":        func() error { _, err := router.CustodyManager(ctx, "i"); return err },
		"TwinManager":           func() error { _, err := router.TwinManager(ctx, "i"); return err },
		"PostManager":           func() error { _, err := router.PostManager(ctx, "i"); return err },
		"PollManager":           func() error { _, err := router.PollManager(ctx, "i"); return err },
		"RiskManager":           func() error { _, err := router.RiskManager(ctx, "i"); return err },
		"MarketManager":         func() error { _, err := router.MarketManager(ctx, "i", "m"); return err },
		"TestCopy":              func() error { _, err := router.TestCopy(ctx, "i"); return err },
		"RemoveFromAgency":      func() error { _, err := router.RemoveFromAgency(ctx, "i", "u", "by"); return err },
		"RemovalsFor":           func() error { _, err := router.RemovalsFor(ctx, "u"); return err },
		"SetAgencyRole":         func() error { return router.SetAgencyRole(ctx, "i", "u", "r") },
		"GrantAgentRole":        func() error { return router.GrantAgentRole(ctx, "i", "u", "r") },
		"AgencyRoleOf":          func() error { _, err := router.AgencyRoleOf(ctx, "i", "u"); return err },
		"AdoptCaller":           func() error { return router.AdoptCaller(ctx, "i", "u") },
	}
	for name, call := range calls {
		if err := call(); !errors.Is(err, boom) {
			t.Errorf("%s: err = %v, want the lookup error", name, err)
		}
	}
}

func TestMembershipLivesInTheAccountsOwnDatabaseAndIsInvisibleFromTheSharedOne(t *testing.T) {
	router, _ := routerWith(t, "own")
	own := WithID(context.Background(), "own")
	shared := WithID(context.Background(), "someone-else")

	made, err := router.CreateInstance(own, "Own hall")
	if err != nil {
		t.Fatal(err)
	}
	if err := router.AddMember(own, made.ID, "alice", agencies.RoleOwner); err != nil {
		t.Fatal(err)
	}
	if ok, err := router.IsMember(own, made.ID, "alice"); err != nil || !ok {
		t.Errorf("own IsMember = %v %v, want true", ok, err)
	}
	members, err := router.Members(own, made.ID)
	if err != nil || len(members) == 0 {
		t.Errorf("own Members = %v %v", members, err)
	}
	if role, err := router.RoleOf(own, made.ID, "alice"); err != nil || role != agencies.RoleOwner {
		t.Errorf("RoleOf = %q %v, want owner", role, err)
	}
	if mine, err := router.InstancesFor(own, "alice"); err != nil || len(mine) != 1 || mine[0].ID != made.ID {
		t.Errorf("InstancesFor in own = %v %v", mine, err)
	}
	if ok, _ := router.IsMember(shared, made.ID, "alice"); ok {
		t.Error("the shared database must not know the account's own members")
	}
	if elsewhere, err := router.InstancesFor(shared, "alice"); err != nil || len(elsewhere) != 0 {
		t.Errorf("InstancesFor in shared = %v %v, want none", elsewhere, err)
	}

	if err := router.RemoveMember(own, made.ID, "alice"); err != nil {
		t.Fatal(err)
	}
	if ok, _ := router.IsMember(own, made.ID, "alice"); ok {
		t.Error("alice is still a member after RemoveMember")
	}
}
