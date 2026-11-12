package http

import (
	"slices"
	"testing"

	"wakalaserver/modules/agency/models"
)

func TestResidentConsent_AResidentHoldsTheFourReadAgreeAndWithdrawActionsOnly(t *testing.T) {
	held := []string{"custody.consent_text.read", "custody.consent.mine", "custody.consent.give", "custody.consent.withdraw"}
	refused := []string{"custody.consent_version.list", "custody.consent_text.publish"}

	for _, action := range held {
		if !residentMay(custodyScope, action) {
			t.Errorf("a resident may not %s", action)
		}
		if !slices.Contains(everyResidentAction(), action) {
			t.Errorf("the resident role is not seeded with %s", action)
		}
	}
	for _, action := range refused {
		if residentMay(custodyScope, action) {
			t.Errorf("a resident may %s", action)
		}
	}
}

func TestResidentConsent_EveryCustodyConsentActionIsInThePermissionsCatalog(t *testing.T) {
	var catalogued []string
	for _, permission := range models.PermissionCatalog() {
		catalogued = append(catalogued, permission.Actions...)
	}

	for _, action := range append(slices.Clone(residentCustodyConsentActions), "custody.consent_version.list", "custody.consent_text.publish") {
		if !slices.Contains(catalogued, action) {
			t.Errorf("%s is in no permission of the catalog", action)
		}
	}
}
