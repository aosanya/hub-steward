package http

import (
	"context"
	"strings"
	"testing"
)

const formsListTool = "forms_form_list"

func residentFormsListWalk(t *testing.T) groupRoleWalk {
	t.Helper()
	w := newGroupRoleWalk(t)
	runsModules(t, w.instance, "forms")
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		if roleID == w.roles["Reader"] {
			return []string{"report.publish"}, nil
		}
		return nil, nil
	}
	return w
}

func TestResidentForms_AResidentHoldingReportPublishListsForms(t *testing.T) {
	w := residentFormsListWalk(t)
	id, _ := w.resident(t, "Mayor", "Council")
	w.giveRole(t, "Council", "Reader")
	out := w.lookup(t, id, formsListTool)
	if out.IsError {
		t.Fatalf("%s: a resident holding report.publish got %q", formsListTool, toolErrorText(out))
	}
}

func TestResidentForms_AResidentWithNoRoleIsRefusedByPermissionNotAsAStranger(t *testing.T) {
	w := residentFormsListWalk(t)
	id, _ := w.resident(t, "Amina", "Support")
	out := w.lookup(t, id, formsListTool)
	text := toolErrorText(out)
	if !out.IsError {
		t.Fatalf("%s: a resident with no role was admitted", formsListTool)
	}
	if strings.Contains(text, instanceNotFoundText) {
		t.Errorf("%s: a resident is told %q, want a refusal by permission", formsListTool, text)
	}
	if !strings.Contains(text, "report.publish") && !strings.Contains(text, "form.manage") {
		t.Errorf("%s: refusal %q names neither report.publish nor form.manage", formsListTool, text)
	}
}

func TestResidentForms_ANonMemberStillGetsInstanceNotFound(t *testing.T) {
	w := residentFormsListWalk(t)
	out := w.lookup(t, "a-stranger", formsListTool)
	if !out.IsError || !strings.Contains(toolErrorText(out), instanceNotFoundText) {
		t.Errorf("%s: a non-member got %q (error %v), want %q", formsListTool, toolErrorText(out), out.IsError, instanceNotFoundText)
	}
}
