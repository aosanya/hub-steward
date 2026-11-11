package http

import (
	"context"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"

	"gorm.io/gorm"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func countStatements(t *testing.T, db *gorm.DB) *atomic.Int64 {
	t.Helper()
	var n atomic.Int64
	count := func(*gorm.DB) { n.Add(1) }
	if err := db.Callback().Query().Before("gorm:query").Register("cost:query", count); err != nil {
		t.Fatalf("register query counter: %v", err)
	}
	if err := db.Callback().Row().Before("gorm:row").Register("cost:row", count); err != nil {
		t.Fatalf("register row counter: %v", err)
	}
	if err := db.Callback().Raw().Before("gorm:raw").Register("cost:raw", count); err != nil {
		t.Fatalf("register raw counter: %v", err)
	}
	return &n
}

func residentWithNoRole(t *testing.T, w stepRunWalk) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Neighbour"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	return w.cookieFor(t, actor.ID)
}

func statementsOf(t *testing.T, w stepRunWalk, statements *atomic.Int64, path string, as *http.Cookie) int64 {
	t.Helper()
	statements.Store(0)
	rec := w.call(t, "GET", "/instances/"+w.instance+path, nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s: %d %s", path, rec.Code, rec.Body.String())
	}
	return statements.Load()
}

func TestAResidentWithNoRoleCostsNoMoreOnTheirOpenStepsThanOnTheirRoles(t *testing.T) {
	w := referral(t)
	neighbour := residentWithNoRole(t, w)
	statements := countStatements(t, w.db)

	roles := statementsOf(t, w, statements, "/my-roles", neighbour)
	for _, path := range []string{"/my-open-steps", "/my-open-steps?available=true"} {
		if got := statementsOf(t, w, statements, path, neighbour); got > roles {
			t.Errorf("%s cost %d statements, want at most the %d of my-roles", path, got, roles)
		}
	}
}

func TestAResidentWithNoRoleGetsAnEmptyList(t *testing.T) {
	w := referral(t)
	neighbour := residentWithNoRole(t, w)

	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-open-steps", nil, neighbour)
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Errorf("my-open-steps: %d %s", rec.Code, rec.Body.String())
	}
}
