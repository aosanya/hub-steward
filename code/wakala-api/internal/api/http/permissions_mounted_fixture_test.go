package http

import (
	"net/http"
	"os"
	"testing"

	mwanachamacatalog "github.com/aosanya/mwanachama-backend-catalog"
	mwanachamapermissions "github.com/aosanya/mwanachama-backend-permissions"
	"github.com/aosanya/mwanachama-backend-shared/spec"
)

func mountPermissionsAndReports(t *testing.T, deps *Deps) http.Handler {
	t.Helper()
	permRaw, err := os.ReadFile("../../specs/wakala.permissions.json")
	if err != nil {
		t.Fatalf("read permissions spec: %v", err)
	}
	permSpec, err := mwanachamapermissions.ParseSpec(permRaw)
	if err != nil {
		t.Fatalf("parse permissions spec: %v", err)
	}
	permDB := stepRunDB(t)
	if err := mwanachamapermissions.Migrate(permDB, permSpec); err != nil {
		t.Fatalf("migrate permissions: %v", err)
	}
	pm, err := mwanachamapermissions.NewPermissionsManager(permDB, permSpec)
	if err != nil {
		t.Fatalf("NewPermissionsManager: %v", err)
	}

	reportsRaw, err := os.ReadFile("../../specs/wakala.reports.json")
	if err != nil {
		t.Fatalf("read reports spec: %v", err)
	}
	reportsSpec, err := mwanachamacatalog.ParseSpec(reportsRaw)
	if err != nil {
		t.Fatalf("parse reports spec: %v", err)
	}
	reportsDB := stepRunDB(t)
	if err := spec.Migrate(reportsDB, reportsSpec); err != nil {
		t.Fatalf("migrate reports: %v", err)
	}
	reports, err := mwanachamacatalog.NewCatalogManager(reportsDB, reportsSpec)
	if err != nil {
		t.Fatalf("NewCatalogManager: %v", err)
	}

	deps.Permissions = pm
	deps.Reports = reports
	return NewRouter(deps)
}
