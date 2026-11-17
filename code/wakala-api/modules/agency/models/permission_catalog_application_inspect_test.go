package models

import (
	"slices"
	"testing"
)

func TestPermissionCatalog_ApplicationInspectCarriesTheInspectAction(t *testing.T) {
	requirePermissionCarries(t, "application.inspect", "forms.submission.inspect")
}

func TestPermissionCatalog_ApplicationInspectIsNamedForTheFormsModule(t *testing.T) {
	p, ok := LookupPermission("application.inspect")
	if !ok || p.Module != "forms" {
		t.Fatalf("application.inspect = %+v (found %v), want module forms", p, ok)
	}
}

func TestPermissionCatalog_ApplicationDecideDoesNotCarryTheInspectAction(t *testing.T) {
	p, ok := LookupPermission("application.decide")
	if !ok {
		t.Fatal("catalogue lacks application.decide")
	}
	if slices.Contains(p.Actions, "forms.submission.inspect") {
		t.Errorf("application.decide carries forms.submission.inspect: %v", p.Actions)
	}
}
