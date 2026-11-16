package agencies

import (
	"context"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

type fakePermissionSetter struct {
	fakeAgency
	set map[string][]string
}

func (f *fakePermissionSetter) SetRolePermissions(_ context.Context, id string, codes []string) (agencymodels.Role, error) {
	f.set = map[string][]string{id: codes}
	return agencymodels.Role{ID: id, Permissions: codes}, nil
}

func TestSettingARolesPermissionsTellsTheRegistryItChanged(t *testing.T) {
	inner := &fakePermissionSetter{}
	changes := 0
	edits := roleEdits{AgencyManager: inner, changed: func() { changes++ }}

	if _, err := edits.SetRolePermissions(context.Background(), "r1", []string{"task.read"}); err != nil {
		t.Fatal(err)
	}
	if changes != 1 || len(inner.set["r1"]) != 1 {
		t.Fatalf("changes=%d set=%v", changes, inner.set)
	}
}
