package models

import (
	"slices"
	"testing"
)

const (
	personRaisedItemsCode   = "person_raised_items.read"
	personRaisedItemsAction = "catalog.raised_item.list_of_person"
	personSendsAction       = "forms.submission.list_of_person"
)

func holdersOf(action string) []string {
	var codes []string
	for _, p := range PermissionCatalog() {
		if slices.Contains(p.Actions, action) {
			codes = append(codes, p.Code)
		}
	}
	return codes
}

func TestPermissionCatalog_PersonRaisedItemsReadCarriesExactlyTheListOfPersonAction(t *testing.T) {
	requirePermissionCarries(t, personRaisedItemsCode, personRaisedItemsAction)
	p, _ := LookupPermission(personRaisedItemsCode)
	if !slices.Equal(p.Actions, []string{personRaisedItemsAction}) {
		t.Errorf("%s actions = %v, want only %s", personRaisedItemsCode, p.Actions, personRaisedItemsAction)
	}
}

func TestPermissionCatalog_PersonRaisedItemsReadIsNamedForTheFormsModule(t *testing.T) {
	p, ok := LookupPermission(personRaisedItemsCode)
	if !ok {
		t.Fatalf("catalogue lacks %s", personRaisedItemsCode)
	}
	if p.Module != "forms" || p.Locked {
		t.Errorf("%s = %+v, want module forms and not locked", personRaisedItemsCode, p)
	}
	if p.Name != "See the wishes and issues one resident raised" {
		t.Errorf("%s name = %q, want the wishes and issues of one resident", personRaisedItemsCode, p.Name)
	}
}

func TestPermissionCatalog_OnlyPersonRaisedItemsReadCarriesTheListOfPersonAction(t *testing.T) {
	if got := holdersOf(personRaisedItemsAction); !slices.Equal(got, []string{personRaisedItemsCode}) {
		t.Errorf("permissions carrying %s = %v, want only %s", personRaisedItemsAction, got, personRaisedItemsCode)
	}
}

func TestPermissionCatalog_FormResultsCarriesThePersonSendsAction(t *testing.T) {
	requirePermissionCarries(t, "form.results", personSendsAction)
}

func TestPermissionCatalog_OnlyFormResultsCarriesThePersonSendsAction(t *testing.T) {
	if got := holdersOf(personSendsAction); !slices.Equal(got, []string{"form.results"}) {
		t.Errorf("permissions carrying %s = %v, want only form.results", personSendsAction, got)
	}
}
