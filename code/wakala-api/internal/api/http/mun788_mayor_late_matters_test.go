package http

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

const lateMattersCode = "late_matters.read"

const listOverdueAction = "catalog.raised_item.list_overdue"

type roleGrant struct {
	Code        string   `json:"code"`
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"`
}

func municipalityRoleGrant(t *testing.T, code string) roleGrant {
	t.Helper()
	path := filepath.Join("..", "..", "..", "..", "..", "demo", "municipality.en.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	var file struct {
		Roles []roleGrant `json:"roles"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatalf("decode %s: %v", path, err)
	}
	for _, r := range file.Roles {
		if r.Code == code {
			return r
		}
	}
	t.Fatalf("%s has no role %s", path, code)
	return roleGrant{}
}

func TestTheMayorHoldsTheLateMattersPermissionBesideRiskRead(t *testing.T) {
	mayor := municipalityRoleGrant(t, "R-1")
	if mayor.Name != "Mayor / council chair" {
		t.Fatalf("R-1 is %q, want Mayor / council chair", mayor.Name)
	}
	for _, want := range []string{"risk.read", lateMattersCode} {
		if !slices.Contains(mayor.Permissions, want) {
			t.Errorf("Mayor / council chair holds %q, want %q among them", mayor.Permissions, want)
		}
	}
}

func TestTheLateMattersPermissionIsInTheCatalogWithTheOverdueListAction(t *testing.T) {
	permission, ok := agencymodels.LookupPermission(lateMattersCode)
	if !ok {
		t.Fatalf("permission %q is not in the catalog", lateMattersCode)
	}
	if !slices.Contains(permission.Actions, listOverdueAction) {
		t.Errorf("permission %q grants %q, want %q among them", lateMattersCode, permission.Actions, listOverdueAction)
	}
}
