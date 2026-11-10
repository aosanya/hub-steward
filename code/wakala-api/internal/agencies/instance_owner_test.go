package agencies

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var ownerLookupDatabases atomic.Int64

func registryWithMembers(t *testing.T, members map[string]string) (*registry, string) {
	t.Helper()
	dsn := fmt.Sprintf("file:wakala_instance_owner_%d?mode=memory&cache=shared", ownerLookupDatabases.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	built, err := NewRegistry(db)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	reg := built.(*registry)
	ctx := context.Background()
	instance, err := reg.CreateInstance(ctx, "Town hall")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	for user, role := range members {
		if err := reg.AddMember(ctx, instance.ID, user, role); err != nil {
			t.Fatalf("AddMember %s: %v", user, err)
		}
	}
	return reg, instance.ID
}

func TestInstanceOwnerLookupIsTrueOnlyForTheOwner(t *testing.T) {
	reg, instance := registryWithMembers(t, map[string]string{
		"boss":   RoleOwner,
		"helper": RoleAgent,
	})
	isOwner := reg.ownerIn(instance)
	ctx := context.Background()
	cases := []struct {
		caller string
		want   bool
	}{
		{"boss", true},
		{"helper", false},
		{"stranger", false},
		{"", false},
	}
	for _, c := range cases {
		got, err := isOwner(ctx, c.caller)
		if err != nil {
			t.Fatalf("owner lookup for %q: %v", c.caller, err)
		}
		if got != c.want {
			t.Errorf("owner lookup for %q = %v, want %v", c.caller, got, c.want)
		}
	}
}

func TestInstanceOwnerLookupDoesNotCrossInstances(t *testing.T) {
	reg, first := registryWithMembers(t, map[string]string{"boss": RoleOwner})
	second, err := reg.CreateInstance(context.Background(), "Other hall")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	got, err := reg.ownerIn(second.ID)(context.Background(), "boss")
	if err != nil {
		t.Fatalf("owner lookup: %v", err)
	}
	if got {
		t.Errorf("the owner of %s was read as owner of %s", first, second.ID)
	}
}
