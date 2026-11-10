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

var coverDatabases atomic.Int64

func memoryDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:wakala_router_cover_%d?mode=memory&cache=shared", coverDatabases.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

type ownDatabases struct {
	t          *testing.T
	owners     map[string]bool
	resolved   atomic.Int32
	opened     atomic.Int32
	resolveErr error
	openErr    error
}

func (o *ownDatabases) resolve(_ context.Context, accountID string) (Connection, bool, error) {
	o.resolved.Add(1)
	return Connection{Kind: KindLocal, DSN: accountID}, o.owners[accountID], o.resolveErr
}

func (o *ownDatabases) open(_ context.Context, _ Connection) (*gorm.DB, error) {
	o.opened.Add(1)
	if o.openErr != nil {
		return nil, o.openErr
	}
	return memoryDB(o.t), nil
}

func routerWith(t *testing.T, owners ...string) (*Router, *ownDatabases) {
	t.Helper()
	shared, err := agencies.NewRegistry(memoryDB(t))
	if err != nil {
		t.Fatal(err)
	}
	own := &ownDatabases{t: t, owners: map[string]bool{}}
	for _, o := range owners {
		own.owners[o] = true
	}
	return NewRouter(shared, own.resolve, own.open, 2), own
}

func TestACallerWithoutAnAccountIsServedBySharedDatabase(t *testing.T) {
	router, own := routerWith(t)
	if _, err := router.CreateInstance(context.Background(), "Shared hall"); err != nil {
		t.Fatal(err)
	}
	listed, err := router.ListInstances(context.Background())
	if err != nil || len(listed) != 1 || listed[0].Name != "Shared hall" {
		t.Errorf("listed %v err %v", listed, err)
	}
	if own.resolved.Load() != 0 {
		t.Error("no account, so nothing to resolve")
	}
}

func TestAccountWithItsOwnDatabaseDoesNotSeeTheSharedInstancesAndTheOtherWayRound(t *testing.T) {
	router, _ := routerWith(t, "acct-own")
	shared := WithID(context.Background(), "acct-shared")
	own := WithID(context.Background(), "acct-own")
	if _, err := router.CreateInstance(shared, "In shared"); err != nil {
		t.Fatal(err)
	}
	made, err := router.CreateInstance(own, "In own")
	if err != nil {
		t.Fatal(err)
	}
	ownList, _ := router.ListInstances(own)
	sharedList, _ := router.ListInstances(shared)
	if len(ownList) != 1 || ownList[0].Name != "In own" || len(sharedList) != 1 || sharedList[0].Name != "In shared" {
		t.Errorf("own %v shared %v", ownList, sharedList)
	}
	if _, err := router.GetInstance(shared, made.ID); !errors.Is(err, agencies.ErrInstanceNotFound) {
		t.Errorf("the shared side found the account's own instance: %v", err)
	}
	got, err := router.GetInstance(own, made.ID)
	if err != nil || got.Name != "In own" {
		t.Errorf("own get = %v %v", got, err)
	}
}

func TestAnAccountsDatabaseIsOpenedOnceAndReused(t *testing.T) {
	router, own := routerWith(t, "a")
	ctx := WithID(context.Background(), "a")
	for i := 0; i < 3; i++ {
		if _, err := router.ListInstances(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if own.opened.Load() != 1 {
		t.Errorf("opened %d times, want 1", own.opened.Load())
	}
}

func TestTheOldestIdleDatabaseIsClosedWhenThePoolIsFull(t *testing.T) {
	router, own := routerWith(t, "a", "b", "c")
	for _, id := range []string{"a", "b", "c"} {
		if _, err := router.ListInstances(WithID(context.Background(), id)); err != nil {
			t.Fatal(err)
		}
	}
	if own.opened.Load() != 3 {
		t.Fatalf("opened %d", own.opened.Load())
	}
	if _, err := router.ListInstances(WithID(context.Background(), "c")); err != nil {
		t.Fatal(err)
	}
	if own.opened.Load() != 3 {
		t.Errorf("the newest account was reopened: opened %d", own.opened.Load())
	}
	if _, err := router.ListInstances(WithID(context.Background(), "a")); err != nil {
		t.Fatal(err)
	}
	if own.opened.Load() != 4 {
		t.Errorf("the evicted oldest account must reopen: opened %d", own.opened.Load())
	}
}

func TestForgetClosesTheAccountsDatabaseAndAsksAgainWhereItLives(t *testing.T) {
	router, own := routerWith(t, "a")
	ctx := WithID(context.Background(), "a")
	if _, err := router.ListInstances(ctx); err != nil {
		t.Fatal(err)
	}
	resolvedBefore := own.resolved.Load()
	router.Forget("a")
	delete(own.owners, "a")
	if _, err := router.ListInstances(ctx); err != nil {
		t.Fatal(err)
	}
	if own.resolved.Load() <= resolvedBefore {
		t.Error("after Forget the router must ask the resolver again")
	}
	if own.opened.Load() != 1 {
		t.Errorf("an account that lost its database must not reopen one: opened %d", own.opened.Load())
	}
}

func TestResolutionIsCachedUntilTheAccountIsForgotten(t *testing.T) {
	router, own := routerWith(t)
	ctx := WithID(context.Background(), "plain")
	for i := 0; i < 3; i++ {
		if _, err := router.ListInstances(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if own.resolved.Load() != 1 {
		t.Errorf("resolved %d times, want 1", own.resolved.Load())
	}
	router.Forget("plain")
	if _, err := router.ListInstances(ctx); err != nil {
		t.Fatal(err)
	}
	if own.resolved.Load() != 2 {
		t.Errorf("resolved %d times after Forget, want 2", own.resolved.Load())
	}
}

func TestResolveAndOpenFailuresReachTheCaller(t *testing.T) {
	boom := errors.New("down")
	router, own := routerWith(t, "a")
	own.resolveErr = boom
	if _, err := router.ListInstances(WithID(context.Background(), "a")); !errors.Is(err, boom) {
		t.Errorf("resolve err = %v", err)
	}
	router, own = routerWith(t, "a")
	own.openErr = boom
	if _, err := router.ListInstances(WithID(context.Background(), "a")); !errors.Is(err, boom) {
		t.Errorf("open err = %v", err)
	}
}

func TestOnlyOwnersAndAgentsAreOperatorsWhileResidentsAreStillMembers(t *testing.T) {
	router, _ := routerWith(t, "own")
	ctx := WithID(context.Background(), "own")
	made, err := router.CreateInstance(ctx, "Own hall")
	if err != nil {
		t.Fatal(err)
	}
	if err := router.AddMember(ctx, made.ID, "resident", agencies.RoleResident); err != nil {
		t.Fatal(err)
	}
	if err := router.AddMember(ctx, made.ID, "bot", agencies.RoleAgent); err != nil {
		t.Fatal(err)
	}
	if role, err := router.RoleOf(ctx, made.ID, "resident"); err != nil || role != agencies.RoleResident {
		t.Errorf("RoleOf = %q %v", role, err)
	}
	if ok, _ := router.IsMember(ctx, made.ID, "resident"); ok {
		t.Error("a resident is not an operator of the agency")
	}
	if ok, _ := router.IsMember(ctx, made.ID, "bot"); !ok {
		t.Error("an agent operates the agency")
	}
	if mine, _ := router.InstancesFor(ctx, "resident"); len(mine) != 0 {
		t.Errorf("InstancesFor a resident = %v", mine)
	}
	if mine, _ := router.InstancesFor(ctx, "bot"); len(mine) != 1 || mine[0].ID != made.ID {
		t.Errorf("InstancesFor an agent = %v", mine)
	}
	if memberships, err := router.MembershipsFor(ctx, "resident"); err != nil || len(memberships) != 1 || memberships[0].Role != agencies.RoleResident {
		t.Errorf("MembershipsFor = %v %v", memberships, err)
	}
	members, err := router.Members(ctx, made.ID)
	if err != nil || len(members) != 2 {
		t.Errorf("members = %v %v", members, err)
	}
	if err := router.RemoveMember(ctx, made.ID, "bot"); err != nil {
		t.Fatal(err)
	}
	if ok, _ := router.IsMember(ctx, made.ID, "bot"); ok {
		t.Error("bot is still an operator after RemoveMember")
	}
}

func TestRenameAndKindAndJoinModeChangeTheInstanceInPlace(t *testing.T) {
	router, _ := routerWith(t)
	ctx := WithID(context.Background(), "x")
	made, err := router.CreateInstance(ctx, "Old name")
	if err != nil {
		t.Fatal(err)
	}
	renamed, err := router.RenameInstance(ctx, made.ID, "New name")
	if err != nil || renamed.Name != "New name" {
		t.Errorf("rename = %v %v", renamed, err)
	}
	kinded, err := router.SetKind(ctx, made.ID, "farmers")
	if err != nil || kinded.Kind != "farmers" {
		t.Errorf("kind = %v %v", kinded, err)
	}
	moded, err := router.SetJoinMode(ctx, made.ID, agencies.JoinOpen)
	if err != nil || moded.JoinMode != agencies.JoinOpen {
		t.Errorf("join mode = %v %v", moded, err)
	}
}
