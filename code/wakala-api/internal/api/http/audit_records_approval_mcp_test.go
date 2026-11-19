package http

import (
	"context"
	"encoding/json"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	formsmodels "wakalaserver/modules/forms/models"
)

type mayorApprovalWalk struct {
	designAgentWalk
	approverID string
}

func newMayorApprovalWalk(t *testing.T) mayorApprovalWalk {
	t.Helper()
	w := newDesignAgentWalk(t)
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	mayor, err := um.EnsureActor(ctx, "test-owner")
	if err != nil {
		t.Fatalf("EnsureActor: %v", err)
	}
	group, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: "Zöldhalom tanács"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	kind, err := um.CreateRoleKind(ctx, mwanachamaactor.RoleKind{Name: "Polgármester", ApprovesAboveLimit: true})
	if err != nil {
		t.Fatalf("CreateRoleKind: %v", err)
	}
	limit := 500000
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: mayor.ID, GroupID: group.ID, KindID: kind.ID, ApprovalLimit: &limit}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
	fm, err := w.deps.Registry.FormManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("FormManager: %v", err)
	}
	fm.UseApprovalRequired(true)
	return mayorApprovalWalk{designAgentWalk: w, approverID: mayor.ID}
}

func (w mayorApprovalWalk) submittedPayment(t *testing.T, title string, amount int) string {
	t.Helper()
	ctx := context.Background()
	um, _ := w.deps.Registry.ActorManager(ctx, w.instance)
	group, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: "Zöldhalom hivatal " + title})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	fm, err := w.deps.Registry.FormManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("FormManager: %v", err)
	}
	form, err := fm.Create(ctx, formsmodels.Form{
		Title: title, ClosesAt: "2099-01-01T00:00:00Z", OriginatorChapterID: group.ID, CreatedBy: "clerk-1",
		Audience: formsmodels.AudienceMember, CollectionMode: formsmodels.CollectionSelf, Amount: amount,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := fm.Submit(ctx, form.ID, "clerk-1"); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	return form.ID
}

func (w mayorApprovalWalk) approve(t *testing.T, formID string) formsmodels.Form {
	t.Helper()
	out := w.mcpCall(t, "test-owner", "forms_approval_approve", map[string]any{"instance_id": w.instance, "form_id": formID})
	if out.IsError {
		t.Fatalf("the mayor approving: %s", toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var form formsmodels.Form
	if err := json.Unmarshal(encoded, &form); err != nil {
		t.Fatalf("decode %s: %v", encoded, err)
	}
	return form
}

func TestAuditRecords_ApprovingAPaymentAboveTheLimitNamesTheLimitAndFlagsThePayment(t *testing.T) {
	w := newMayorApprovalWalk(t)
	formID := w.submittedPayment(t, "Roof repair at the school", 900000)

	form := w.approve(t, formID)

	if !form.OverLimit || form.LimitInForce != 500000 {
		t.Fatalf("payment = over %v limit %d, want the flag and 500000", form.OverLimit, form.LimitInForce)
	}
	entries := w.auditEntries(t)
	if len(entries) != 1 {
		t.Fatalf("one approval left %d audit entries, want exactly 1: %+v", len(entries), entries)
	}
	if entries[0].Action != "approved a form over its limit of 500 000 Ft" || entries[0].Subject != formID {
		t.Errorf("entry = %+v, want the flag worded with the limit, on the form", entries[0])
	}
}

func TestAuditRecords_ApprovingAPaymentWithinTheLimitCarriesNoFlag(t *testing.T) {
	w := newMayorApprovalWalk(t)
	formID := w.submittedPayment(t, "Bench for the square", 400000)

	form := w.approve(t, formID)

	if form.OverLimit || form.LimitInForce != 0 {
		t.Fatalf("payment = over %v limit %d, want no flag", form.OverLimit, form.LimitInForce)
	}
	entries := w.auditEntries(t)
	if len(entries) != 1 || entries[0].Action != "approved a form" || entries[0].Subject != formID {
		t.Fatalf("entries = %+v, want one plain approval on the form", entries)
	}
}
