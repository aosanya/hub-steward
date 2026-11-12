package mwanachamapermissions

import (
	"context"
	"errors"
	"testing"
	"time"
)

func roleWith(t *testing.T, m PermissionsManager, code string, actions ...string) {
	t.Helper()
	newRole(t, m, code)
	if _, err := m.SetActions(context.Background(), code, actions); err != nil {
		t.Fatal(err)
	}
}

func mayDo(t *testing.T, m PermissionsManager, subject, partition, scope, action string) bool {
	t.Helper()
	ok, err := m.MayPerformIn(context.Background(), subject, partition, scope, action)
	if err != nil {
		t.Fatal(err)
	}
	return ok
}

func TestCreateGrantRefusals(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "owner", "a.read")
	future := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	past := time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)
	cases := map[string]struct {
		g    Grant
		want error
	}{
		"no subject":       {Grant{Scope: "*", RoleCode: "owner"}, ErrInvalidGrant},
		"no scope":         {Grant{Subject: "u", RoleCode: "owner"}, ErrInvalidGrant},
		"no role":          {Grant{Subject: "u", Scope: "*"}, ErrInvalidGrant},
		"bad scope":        {Grant{Subject: "u", Scope: "nowhere", RoleCode: "owner"}, ErrInvalidScope},
		"bad record scope": {Grant{Subject: "u", Scope: "record:x", RoleCode: "owner"}, ErrInvalidScope},
		"bad partition":    {Grant{Subject: "u", Scope: "*", Partition: "-x", RoleCode: "owner"}, ErrInvalidPartition},
		"end unparseable":  {Grant{Subject: "u", Scope: "*", RoleCode: "owner", EndsAt: "tomorrow"}, ErrInvalidEnd},
		"end in the past":  {Grant{Subject: "u", Scope: "*", RoleCode: "owner", EndsAt: past}, ErrInvalidEnd},
		"unknown role":     {Grant{Subject: "u", Scope: "*", RoleCode: "ghost", EndsAt: future}, ErrRoleNotFound},
	}
	for name, c := range cases {
		if _, err := m.CreateGrant(ctx, c.g); !errors.Is(err, c.want) {
			t.Errorf("%s: want %v, got %v", name, c.want, err)
		}
	}
}

func TestCreateGrantToRetiredRoleIsRefused(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "owner")
	if err := m.DeleteRole(ctx, "owner"); err != nil {
		t.Fatal(err)
	}
	if _, err := m.CreateGrant(ctx, Grant{Subject: "u", Scope: "*", RoleCode: "owner"}); !errors.Is(err, ErrRoleRetired) {
		t.Fatalf("want ErrRoleRetired, got %v", err)
	}
}

func TestCreateGrantDuplicateIsRefusedUntilWithdrawn(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "owner", "a.read")
	g := Grant{Subject: "u", Scope: "module:x", RoleCode: "owner", GrantedBy: "admin"}
	first, err := m.CreateGrant(ctx, g)
	if err != nil || first.GrantedAt == "" || first.Deleted {
		t.Fatalf("first grant: %+v %v", first, err)
	}
	if _, err := m.CreateGrant(ctx, g); !errors.Is(err, ErrDuplicateGrant) {
		t.Fatalf("want ErrDuplicateGrant, got %v", err)
	}
	if err := m.WithdrawGrant(ctx, "u", "module:x", "owner"); err != nil {
		t.Fatal(err)
	}
	if mayDo(t, m, "u", "", "module:x", "a.read") {
		t.Fatal("a withdrawn grant permits nothing")
	}
	g.GrantedBy = "second-admin"
	if _, err := m.CreateGrant(ctx, g); err != nil {
		t.Fatalf("regranting after withdrawal: %v", err)
	}
	list, _ := m.ListGrants(ctx, GrantFilter{Subject: "u"})
	if len(list) != 1 || list[0].GrantedBy != "second-admin" || list[0].Deleted {
		t.Fatalf("reinstated grant carries the new grantor: %+v", list)
	}
	if !mayDo(t, m, "u", "", "module:x", "a.read") {
		t.Fatal("reinstated grant permits again")
	}
}

func TestWithdrawGrantUnknownIsNotFoundAndRepeatIsQuiet(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "owner", "a.read")
	if err := m.WithdrawGrant(ctx, "u", "*", "owner"); !errors.Is(err, ErrGrantNotFound) {
		t.Fatalf("want ErrGrantNotFound, got %v", err)
	}
	if _, err := m.CreateGrant(ctx, Grant{Subject: "u", Scope: "*", RoleCode: "owner"}); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := m.WithdrawGrant(ctx, "u", "*", "owner"); err != nil {
			t.Fatalf("withdraw %d: %v", i, err)
		}
	}
}

func TestMayPerformScopeEverywhereAndExactScope(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "reader", "a.read")
	roleWith(t, m, "admin", "a.admin")
	if _, err := m.CreateGrant(ctx, Grant{Subject: "u", Scope: "module:x", RoleCode: "reader"}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.CreateGrant(ctx, Grant{Subject: "u", Scope: "*", RoleCode: "admin"}); err != nil {
		t.Fatal(err)
	}
	if !mayDo(t, m, "u", "", "module:x", "a.read") {
		t.Error("exact scope grant must permit")
	}
	if mayDo(t, m, "u", "", "module:y", "a.read") {
		t.Error("another scope must not inherit the grant")
	}
	if !mayDo(t, m, "u", "", "module:y", "a.admin") {
		t.Error("an everywhere grant covers every scope")
	}
	if mayDo(t, m, "other", "", "module:x", "a.read") {
		t.Error("another subject must not be permitted")
	}
	if mayDo(t, m, "u", "", "module:x", "a.unlisted") {
		t.Error("an action no role lists is not permitted")
	}
}

func TestMayPerformGuards(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	if ok, err := m.MayPerform(ctx, "", "*", "a.read"); ok || err != nil {
		t.Errorf("blank subject: %v %v", ok, err)
	}
	if ok, err := m.MayPerform(ctx, "u", "", "a.read"); ok || err != nil {
		t.Errorf("blank scope: %v %v", ok, err)
	}
	if _, err := m.MayPerform(ctx, "u", "*", "bad"); !errors.Is(err, ErrInvalidAction) {
		t.Errorf("malformed action: want ErrInvalidAction, got %v", err)
	}
	if _, err := m.MayPerformIn(ctx, "u", "-bad", "*", "a.read"); !errors.Is(err, ErrInvalidPartition) {
		t.Errorf("malformed partition: want ErrInvalidPartition, got %v", err)
	}
}

func TestMayPerformPartitionedGrantStaysInItsPartition(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "reader", "a.read")
	roleWith(t, m, "admin", "a.admin")
	if _, err := m.CreateGrant(ctx, Grant{Subject: "u", Scope: "*", Partition: "p1", RoleCode: "reader"}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.CreateGrant(ctx, Grant{Subject: "u", Scope: "*", RoleCode: "admin"}); err != nil {
		t.Fatal(err)
	}
	if !mayDo(t, m, "u", "p1", "module:x", "a.read") {
		t.Error("partition grant permits inside its partition")
	}
	if mayDo(t, m, "u", "p2", "module:x", "a.read") {
		t.Error("partition grant must not leak into another partition")
	}
	if mayDo(t, m, "u", "", "module:x", "a.read") {
		t.Error("partition grant must not leak outside every partition")
	}
	if !mayDo(t, m, "u", "p2", "module:x", "a.admin") {
		t.Error("a grant naming no partition applies in every partition")
	}
}

func TestMayPerformIgnoresRetiredRoleAndExpiredGrant(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "reader", "a.read")
	if _, err := m.CreateGrant(ctx, Grant{Subject: "u", Scope: "*", RoleCode: "reader"}); err != nil {
		t.Fatal(err)
	}
	if !mayDo(t, m, "u", "", "module:x", "a.read") {
		t.Fatal("setup grant must permit")
	}
	if err := m.DeleteRole(ctx, "reader"); err != nil {
		t.Fatal(err)
	}
	if mayDo(t, m, "u", "", "module:x", "a.read") {
		t.Fatal("a retired role permits nothing")
	}
	list, _ := m.ListGrants(ctx, GrantFilter{Subject: "u"})
	if len(list) != 1 {
		t.Fatalf("the grant naming a retired role is kept: %+v", list)
	}
}

func TestGrantWithFutureEndIsListedAndNormalised(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "reader", "a.read")
	end := time.Now().Add(2 * time.Hour).In(time.FixedZone("x", 3*3600)).Format(time.RFC3339)
	g, err := m.CreateGrant(ctx, Grant{Subject: "u", Scope: "*", RoleCode: "reader", EndsAt: end})
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := time.Parse(endLayout, g.EndsAt)
	if err != nil || parsed.Location() != time.UTC {
		t.Fatalf("end must be stored as a UTC instant: %q %v", g.EndsAt, err)
	}
	if !mayDo(t, m, "u", "", "module:x", "a.read") {
		t.Fatal("a grant that has not ended permits")
	}
	list, _ := m.ListGrants(ctx, GrantFilter{})
	if len(list) != 1 || list[0].EndsAt != g.EndsAt {
		t.Fatalf("listed: %+v", list)
	}
}

func TestListGrantsFiltersAndOrder(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "reader", "a.read")
	roleWith(t, m, "admin", "a.admin")
	for _, g := range []Grant{
		{Subject: "zed", Scope: "module:b", RoleCode: "reader"},
		{Subject: "amy", Scope: "module:b", RoleCode: "reader"},
		{Subject: "amy", Scope: "module:a", RoleCode: "admin", Partition: "p1"},
		{Subject: "amy", Scope: "module:a", RoleCode: "reader"},
	} {
		if _, err := m.CreateGrant(ctx, g); err != nil {
			t.Fatal(err)
		}
	}
	all, _ := m.ListGrants(ctx, GrantFilter{})
	order := []string{}
	for _, g := range all {
		order = append(order, g.Subject+"|"+g.Scope+"|"+g.RoleCode)
	}
	want := []string{"amy|module:a|admin", "amy|module:a|reader", "amy|module:b|reader", "zed|module:b|reader"}
	if !sameStrings(order, want) {
		t.Fatalf("order by subject, scope, role: %v", order)
	}
	for name, c := range map[string]struct {
		f GrantFilter
		n int
	}{
		"subject":   {GrantFilter{Subject: "amy"}, 3},
		"scope":     {GrantFilter{Scope: "module:b"}, 2},
		"partition": {GrantFilter{Partition: "p1"}, 1},
		"role":      {GrantFilter{RoleCode: "admin"}, 1},
		"combined":  {GrantFilter{Subject: "amy", Scope: "module:b"}, 1},
		"nothing":   {GrantFilter{Subject: "nobody"}, 0},
	} {
		got, err := m.ListGrants(ctx, c.f)
		if err != nil || len(got) != c.n {
			t.Errorf("%s: want %d got %d %v", name, c.n, len(got), err)
		}
	}
}

func TestWithdrawGrantInTargetsOnlyThatPartition(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "reader", "a.read")
	for _, p := range []string{"", "p1"} {
		if _, err := m.CreateGrant(ctx, Grant{Subject: "u", Scope: "*", Partition: p, RoleCode: "reader"}); err != nil {
			t.Fatal(err)
		}
	}
	if err := m.WithdrawGrantIn(ctx, "u", "p1", "*", "reader"); err != nil {
		t.Fatal(err)
	}
	list, _ := m.ListGrants(ctx, GrantFilter{Subject: "u"})
	if len(list) != 1 || list[0].Partition != "" {
		t.Fatalf("only the p1 grant goes: %+v", list)
	}
}

func TestActionsForCombinesScopeAndEverywhereDistinctSorted(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "one", "z.last", "a.first")
	roleWith(t, m, "two", "a.first", "m.mid")
	roleWith(t, m, "elsewhere", "x.other")
	roleWith(t, m, "partitioned", "p.only")
	for _, g := range []Grant{
		{Subject: "u", Scope: "module:x", RoleCode: "one"},
		{Subject: "u", Scope: "*", RoleCode: "two"},
		{Subject: "u", Scope: "module:y", RoleCode: "elsewhere"},
		{Subject: "u", Scope: "module:x", Partition: "p1", RoleCode: "partitioned"},
	} {
		if _, err := m.CreateGrant(ctx, g); err != nil {
			t.Fatal(err)
		}
	}
	got, err := m.ActionsFor(ctx, "u", "module:x")
	if err != nil || !sameStrings(got, []string{"a.first", "m.mid", "z.last"}) {
		t.Fatalf("actions for module:x: %v %v", got, err)
	}
	any, err := m.ActionsAnywhere(ctx, "u")
	if err != nil || !sameStrings(any, []string{"a.first", "m.mid", "p.only", "x.other", "z.last"}) {
		t.Fatalf("actions anywhere: %v %v", any, err)
	}
	if got, _ := m.ActionsFor(ctx, "", "module:x"); got != nil {
		t.Errorf("blank subject: %v", got)
	}
	if got, _ := m.ActionsFor(ctx, "u", ""); got != nil {
		t.Errorf("blank scope: %v", got)
	}
	if got, _ := m.ActionsAnywhere(ctx, ""); got != nil {
		t.Errorf("blank subject anywhere: %v", got)
	}
}

func TestAccessOfListsLinesInPartitionAndUnpartitioned(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	roleWith(t, m, "reader", "b.read", "a.read")
	roleWith(t, m, "other", "c.read")
	for _, g := range []Grant{
		{Subject: "u", Scope: "module:x", Partition: "p1", RoleCode: "reader", GrantedBy: "admin"},
		{Subject: "u", Scope: "*", RoleCode: "other"},
		{Subject: "u", Scope: "module:x", Partition: "p2", RoleCode: "other"},
	} {
		if _, err := m.CreateGrant(ctx, g); err != nil {
			t.Fatal(err)
		}
	}
	lines, err := m.AccessOf(ctx, "u", "p1")
	if err != nil {
		t.Fatal(err)
	}
	actions := []string{}
	for _, l := range lines {
		actions = append(actions, l.Action)
	}
	if !sameStrings(actions, []string{"a.read", "b.read", "c.read"}) {
		t.Fatalf("lines in action order, p2 excluded: %+v", lines)
	}
	first := lines[0]
	if first.RoleCode != "reader" || first.RoleName != "Name of reader" || first.Scope != "module:x" ||
		first.Partition != "p1" || first.GrantedBy != "admin" || first.GrantedAt == "" {
		t.Fatalf("line detail: %+v", first)
	}
	if lines[2].Partition != "" || lines[2].GrantedBy != "" {
		t.Fatalf("unpartitioned, ungranted line: %+v", lines[2])
	}
}

func TestAccessOfGuards(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	if _, err := m.AccessOf(ctx, "u", ""); !errors.Is(err, ErrInvalidPartition) {
		t.Errorf("blank partition: want ErrInvalidPartition, got %v", err)
	}
	if _, err := m.AccessOf(ctx, "u", "-x"); !errors.Is(err, ErrInvalidPartition) {
		t.Errorf("bad partition: want ErrInvalidPartition, got %v", err)
	}
	lines, err := m.AccessOf(ctx, "", "p1")
	if err != nil || lines == nil || len(lines) != 0 {
		t.Errorf("blank subject is an empty non-nil list: %v %v", lines, err)
	}
	lines, err = m.AccessOf(ctx, "nobody", "p1")
	if err != nil || lines == nil || len(lines) != 0 {
		t.Errorf("no grants is an empty non-nil list: %v %v", lines, err)
	}
}
