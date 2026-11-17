package agencies

import (
	"context"
	"errors"
	"slices"
	"testing"

	"wakalaserver/internal/authz"
)

func TestGiveGroupRoleRefusesABlankInstanceGroupOrRole(t *testing.T) {
	r := approvalRegistry(t)
	ctx := context.Background()
	cases := [][3]string{{"", "g", "role"}, {"i", "  ", "role"}, {"i", "g", "\t"}}
	for _, c := range cases {
		if err := r.GiveGroupRole(ctx, c[0], c[1], c[2]); !errors.Is(err, ErrGroupRoleInvalid) {
			t.Errorf("GiveGroupRole%v = %v, want ErrGroupRoleInvalid", c, err)
		}
	}
	if rows, _ := r.ListGroupRoles(ctx, "i"); len(rows) != 0 {
		t.Errorf("a refused give stored %d rows", len(rows))
	}
}

func TestTakeGroupRoleRefusesABlankInstanceGroupOrRole(t *testing.T) {
	r := approvalRegistry(t)
	if err := r.TakeGroupRole(context.Background(), "i", "", "role"); !errors.Is(err, ErrGroupRoleInvalid) {
		t.Errorf("TakeGroupRole with a blank group = %v, want ErrGroupRoleInvalid", err)
	}
}

func TestGiveGroupRoleTrimsItsArgumentsAndGivingTwiceKeepsOneRow(t *testing.T) {
	r := approvalRegistry(t)
	ctx := context.Background()
	for i := 0; i < 2; i++ {
		if err := r.GiveGroupRole(ctx, " i ", " g ", " role-a "); err != nil {
			t.Fatalf("give %d: %v", i, err)
		}
	}
	ids, err := r.GroupRoleIDs(ctx, "i", "g")
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(ids, []string{"role-a"}) {
		t.Errorf("GroupRoleIDs = %v, want [role-a]", ids)
	}
}

func TestGroupRoleIDsAreSortedAndNeverNil(t *testing.T) {
	r := approvalRegistry(t)
	ctx := context.Background()
	for _, id := range []string{"role-c", "role-a", "role-b"} {
		if err := r.GiveGroupRole(ctx, "i", "g", id); err != nil {
			t.Fatal(err)
		}
	}
	ids, _ := r.GroupRoleIDs(ctx, "i", "g")
	if !slices.Equal(ids, []string{"role-a", "role-b", "role-c"}) {
		t.Errorf("GroupRoleIDs = %v, want sorted", ids)
	}
	none, err := r.GroupRoleIDs(ctx, "i", "other-group")
	if err != nil || none == nil || len(none) != 0 {
		t.Errorf("a group with no role = %v, %v; want an empty non-nil list", none, err)
	}
	blank, err := r.GroupRoleIDs(ctx, "", "g")
	if err != nil || blank == nil || len(blank) != 0 {
		t.Errorf("a blank instance = %v, %v; want an empty non-nil list", blank, err)
	}
}

func TestTakeGroupRoleRemovesOnlyThatRoleFromThatGroupAndInstance(t *testing.T) {
	r := approvalRegistry(t)
	ctx := context.Background()
	for _, row := range [][3]string{{"i", "g", "a"}, {"i", "g", "b"}, {"i", "h", "a"}, {"j", "g", "a"}} {
		if err := r.GiveGroupRole(ctx, row[0], row[1], row[2]); err != nil {
			t.Fatal(err)
		}
	}
	if err := r.TakeGroupRole(ctx, "i", "g", "a"); err != nil {
		t.Fatal(err)
	}
	if err := r.TakeGroupRole(ctx, "i", "g", "never-given"); err != nil {
		t.Errorf("taking a role never given should be a no-op, got %v", err)
	}
	left, _ := r.GroupRoleIDs(ctx, "i", "g")
	if !slices.Equal(left, []string{"b"}) {
		t.Errorf("group g holds %v, want [b]", left)
	}
	if other, _ := r.GroupRoleIDs(ctx, "i", "h"); !slices.Equal(other, []string{"a"}) {
		t.Errorf("group h lost its role: %v", other)
	}
	if other, _ := r.GroupRoleIDs(ctx, "j", "g"); !slices.Equal(other, []string{"a"}) {
		t.Errorf("instance j lost its role: %v", other)
	}
}

func TestListGroupRolesIsPerInstanceOrderedByGroupThenRole(t *testing.T) {
	r := approvalRegistry(t)
	ctx := context.Background()
	for _, row := range [][3]string{{"i", "g2", "a"}, {"i", "g1", "z"}, {"i", "g1", "b"}, {"j", "g0", "a"}} {
		if err := r.GiveGroupRole(ctx, row[0], row[1], row[2]); err != nil {
			t.Fatal(err)
		}
	}
	rows, err := r.ListGroupRoles(ctx, "i")
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, row := range rows {
		if row.InstanceID != "i" || row.CreatedAt.IsZero() {
			t.Errorf("unexpected row %+v", row)
		}
		got = append(got, row.GroupID+"/"+row.AgencyRoleID)
	}
	if want := []string{"g1/b", "g1/z", "g2/a"}; !slices.Equal(got, want) {
		t.Errorf("ListGroupRoles = %v, want %v", got, want)
	}
	if empty, err := r.ListGroupRoles(ctx, "nobody"); err != nil || empty == nil || len(empty) != 0 {
		t.Errorf("an instance with no rows = %v, %v; want an empty non-nil list", empty, err)
	}
}

func TestGivingAndTakingAGroupRoleMarksTheTenantChanged(t *testing.T) {
	epochs := authz.NewEpochs()
	r := approvalRegistry(t, WithEpochs(epochs))
	ctx := context.Background()
	stamp := epochs.Stamp()
	if err := r.GiveGroupRole(ctx, "i", "g", "a"); err != nil {
		t.Fatal(err)
	}
	if !epochs.Changed(stamp, authz.TenantKey("i")) {
		t.Error("giving a role did not mark tenant i changed")
	}
	if epochs.Changed(stamp, authz.TenantKey("j")) {
		t.Error("giving a role marked an unrelated tenant changed")
	}
	stamp = epochs.Stamp()
	if err := r.TakeGroupRole(ctx, "i", "g", "a"); err != nil {
		t.Fatal(err)
	}
	if !epochs.Changed(stamp, authz.TenantKey("i")) {
		t.Error("taking a role did not mark tenant i changed")
	}
}

func TestWithEpochsIgnoresNilAndIsReadBackByEpochs(t *testing.T) {
	supplied := authz.NewEpochs()
	if got := approvalRegistry(t, WithEpochs(supplied)).Epochs(); got != supplied {
		t.Error("Epochs() is not the supplied tracker")
	}
	if approvalRegistry(t, WithEpochs(nil)).Epochs() == nil {
		t.Error("a nil tracker left the registry without one")
	}
}
