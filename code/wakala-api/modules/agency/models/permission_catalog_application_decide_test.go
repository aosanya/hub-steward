package models

import "testing"

func TestPermissionCatalog_ApplicationDecideCarriesTheDecideAction(t *testing.T) {
	requirePermissionCarries(t, "application.decide", "forms.submission.decide")
}

func TestPermissionCatalog_ApplicationDecideIsNamedForTheFormsModule(t *testing.T) {
	p, ok := LookupPermission("application.decide")
	if !ok || p.Module != "forms" {
		t.Fatalf("application.decide = %+v (found %v), want module forms", p, ok)
	}
}
