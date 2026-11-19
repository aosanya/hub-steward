package http

import (
	"strings"
	"testing"
)

var otherTwinReads = []struct{ tool, action, permission string }{
	{"digitaltwin_tenure_list", "digitaltwin.tenure.list", "digitaltwin.view"},
	{"digitaltwin_land_use_list", "digitaltwin.land_use.list", "digitaltwin.view"},
}

func TestAddressRead_EverySeatedAgentMayListAddressesAndNothingElseOfTheTwin(t *testing.T) {
	if !everySeatedAgentMay(addressListAction) {
		t.Errorf("a seated agent may not %s", addressListAction)
	}
	for _, c := range otherTwinReads {
		if everySeatedAgentMay(c.action) {
			t.Errorf("every seated agent may %s", c.action)
		}
	}
	for _, action := range []string{"digitaltwin.address.create", "digitaltwin.address.update"} {
		if everySeatedAgentMay(action) {
			t.Errorf("every seated agent may %s", action)
		}
	}
}

func TestAddressRead_ASeatWithNoTwinRightStillSeesTheTwinModule(t *testing.T) {
	visible := seatedModuleVisibility([]string{"mount.list"})
	if !visible("digitaltwin") {
		t.Errorf("a seat holding only mount.list cannot see the digitaltwin module, so its step's address question has no tool")
	}
}

func TestAddressRead_AResidentWithNoRoleReadsAddressesButNotHoldingsOrLandUse(t *testing.T) {
	w := residentLookupWalk(t)
	id, _ := w.resident(t, "Amina", "Support")
	if out := w.lookup(t, id, "digitaltwin_address_list"); out.IsError {
		t.Errorf("digitaltwin_address_list: a resident with no role got %q", toolErrorText(out))
	}
	for _, c := range otherTwinReads {
		out := w.lookup(t, id, c.tool)
		text := toolErrorText(out)
		if !out.IsError {
			t.Errorf("%s: a resident with no role was admitted", c.tool)
			continue
		}
		if !strings.Contains(text, c.permission) && !strings.Contains(text, c.action) {
			t.Errorf("%s: refusal %q names neither %q nor %q", c.tool, text, c.permission, c.action)
		}
	}
}

func TestAddressRead_ANonMemberStillGetsInstanceNotFoundForAddresses(t *testing.T) {
	w := residentLookupWalk(t)
	out := w.lookup(t, "a-stranger", "digitaltwin_address_list")
	if !out.IsError || !strings.Contains(toolErrorText(out), instanceNotFoundText) {
		t.Errorf("a non-member got %q (error %v), want %q", toolErrorText(out), out.IsError, instanceNotFoundText)
	}
}
