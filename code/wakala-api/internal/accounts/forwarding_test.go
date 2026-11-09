package accounts

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"wakalaserver/internal/agencies"
)

var routerDatabases atomic.Int64

func sharedRegistryBehindRouter(t *testing.T) (agencies.Registry, *Router, context.Context) {
	t.Helper()
	dsn := fmt.Sprintf("file:wakala_router_forwarding_%d?mode=memory&cache=shared", routerDatabases.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	shared, err := agencies.NewRegistry(db)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	noOwnDatabase := func(context.Context, string) (Connection, bool, error) { return Connection{}, false, nil }
	router := NewRouter(shared, noOwnDatabase, nil, 4)
	return shared, router, WithID(context.Background(), "account-1")
}

func newInstanceThroughRouter(t *testing.T, router *Router, ctx context.Context) string {
	t.Helper()
	inst, err := router.CreateInstance(ctx, "Town hall")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	return inst.ID
}

func TestRouter_ForwardsGroupRoles(t *testing.T) {
	_, router, ctx := sharedRegistryBehindRouter(t)
	instance := newInstanceThroughRouter(t, router, ctx)

	if err := router.GiveGroupRole(ctx, instance, "group-1", "role-1"); err != nil {
		t.Fatalf("GiveGroupRole through the router: %v", err)
	}
	ids, err := router.GroupRoleIDs(ctx, instance, "group-1")
	if err != nil || len(ids) != 1 || ids[0] != "role-1" {
		t.Fatalf("GroupRoleIDs through the router = %v, %v; want [role-1]", ids, err)
	}
	listed, err := router.ListGroupRoles(ctx, instance)
	if err != nil || len(listed) != 1 || listed[0].GroupID != "group-1" || listed[0].AgencyRoleID != "role-1" {
		t.Fatalf("ListGroupRoles through the router = %v, %v", listed, err)
	}
	if _, err := router.RoleIDsThroughGroups(ctx, instance, "nobody"); err != nil {
		t.Fatalf("RoleIDsThroughGroups through the router: %v", err)
	}
	if err := router.TakeGroupRole(ctx, instance, "group-1", "role-1"); err != nil {
		t.Fatalf("TakeGroupRole through the router: %v", err)
	}
	ids, err = router.GroupRoleIDs(ctx, instance, "group-1")
	if err != nil || len(ids) != 0 {
		t.Fatalf("GroupRoleIDs after TakeGroupRole = %v, %v; want none", ids, err)
	}
}

func TestRouter_ForwardsAgencyRoleLinksAndAgentGrants(t *testing.T) {
	_, router, ctx := sharedRegistryBehindRouter(t)
	instance := newInstanceThroughRouter(t, router, ctx)

	if err := router.AddMember(ctx, instance, "resident-1", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	if err := router.SetAgencyRole(ctx, instance, "resident-1", "role-1"); err != nil {
		t.Fatalf("SetAgencyRole through the router: %v", err)
	}
	if got, err := router.AgencyRoleOf(ctx, instance, "resident-1"); err != nil || got != "role-1" {
		t.Fatalf("AgencyRoleOf through the router = %q, %v; want role-1", got, err)
	}
	if err := router.GrantAgentRole(ctx, instance, "agent-1", "role-2"); err != nil {
		t.Fatalf("GrantAgentRole through the router: %v", err)
	}
	if got, err := router.AgencyRoleOf(ctx, instance, "agent-1"); err != nil || got != "role-2" {
		t.Fatalf("AgencyRoleOf for the granted agent = %q, %v; want role-2", got, err)
	}
}

func TestRouter_ForwardsRemovals(t *testing.T) {
	_, router, ctx := sharedRegistryBehindRouter(t)
	instance := newInstanceThroughRouter(t, router, ctx)

	if err := router.AddMember(ctx, instance, "resident-1", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	removal, err := router.RemoveFromAgency(ctx, instance, "resident-1", "owner-1")
	if err != nil || removal.UserID != "resident-1" {
		t.Fatalf("RemoveFromAgency through the router = %v, %v", removal, err)
	}
	removals, err := router.RemovalsFor(ctx, "resident-1")
	if err != nil || len(removals) != 1 {
		t.Fatalf("RemovalsFor through the router = %v, %v; want one", removals, err)
	}
}

func TestRouter_ForwardsApprovals(t *testing.T) {
	_, router, ctx := sharedRegistryBehindRouter(t)
	instance := newInstanceThroughRouter(t, router, ctx)

	if _, err := router.ListPendingInstances(ctx); err != nil {
		t.Fatalf("ListPendingInstances through the router: %v", err)
	}
	_, err := router.DecideApproval(ctx, instance, true, "")
	if errors.Is(err, agencies.ErrInstanceNotFound) {
		t.Fatalf("DecideApproval through the router answered not found for an instance that exists: %v", err)
	}
}

func TestRouter_SharesTheRegistrysEpochs(t *testing.T) {
	shared, router, _ := sharedRegistryBehindRouter(t)
	source, ok := shared.(agencies.EpochSource)
	if !ok || source.Epochs() == nil {
		t.Skip("the shared registry keeps no epochs")
	}
	if router.Epochs() != source.Epochs() {
		t.Fatal("the router must use the shared registry's epochs, or a change in one never reaches the other's caches")
	}
}

func TestRouter_ImplementsEveryOptionalRegistryInterface(t *testing.T) {
	var router any = &Router{}
	if _, ok := router.(agencies.GroupRoles); !ok {
		t.Error("Router drops agencies.GroupRoles")
	}
	if _, ok := router.(agencies.AgencyRoleLinks); !ok {
		t.Error("Router drops agencies.AgencyRoleLinks")
	}
	if _, ok := router.(agencies.AgentGrants); !ok {
		t.Error("Router drops agencies.AgentGrants")
	}
	if _, ok := router.(agencies.RemovalRegistry); !ok {
		t.Error("Router drops agencies.RemovalRegistry")
	}
	if _, ok := router.(agencies.ApprovalRegistry); !ok {
		t.Error("Router drops agencies.ApprovalRegistry")
	}
	if _, ok := router.(agencies.ActorAdopter); !ok {
		t.Error("Router drops agencies.ActorAdopter")
	}
	if _, ok := router.(agencies.EpochSource); !ok {
		t.Error("Router drops agencies.EpochSource")
	}
}
