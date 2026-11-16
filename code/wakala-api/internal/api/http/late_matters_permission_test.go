package http

import (
	"slices"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

const lateMattersCode = "late_matters.read"

const listOverdueAction = "catalog.raised_item.list_overdue"

func TestTheLateMattersPermissionIsInTheCatalogWithTheOverdueListAction(t *testing.T) {
	permission, ok := agencymodels.LookupPermission(lateMattersCode)
	if !ok {
		t.Fatalf("permission %q is not in the catalog", lateMattersCode)
	}
	if !slices.Contains(permission.Actions, listOverdueAction) {
		t.Errorf("permission %q grants %q, want %q among them", lateMattersCode, permission.Actions, listOverdueAction)
	}
}
