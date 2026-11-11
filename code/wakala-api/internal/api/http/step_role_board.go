package http

import (
	"context"
	"fmt"
	"slices"

	agencymodels "wakalaserver/modules/agency/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"

	"wakalaserver/internal/agencies"
)

type stepRoleBoard struct {
	mwanachamataskmanager.TaskManager
	reg        agencies.Registry
	instanceID string
}

func (b stepRoleBoard) BeginWorkflowRunStep(ctx context.Context, runID, stepCode string, limitMinutes int, cancelWorkflowCode string) (mwanachamataskmanager.WorkflowRun, error) {
	run, err := b.TaskManager.GetWorkflowRun(ctx, runID)
	if err != nil {
		return mwanachamataskmanager.WorkflowRun{}, err
	}
	if err := b.requireRoleOfStep(ctx, run, stepCode); err != nil {
		return mwanachamataskmanager.WorkflowRun{}, err
	}
	return b.TaskManager.BeginWorkflowRunStep(ctx, runID, stepCode, limitMinutes, cancelWorkflowCode)
}

func (b stepRoleBoard) requireRoleOfStep(ctx context.Context, run mwanachamataskmanager.WorkflowRun, stepCode string) error {
	if run.WorkflowVersion < 1 {
		return nil
	}
	m, err := b.reg.AgencyManager(ctx, b.instanceID)
	if err != nil {
		return err
	}
	publication, err := m.GetPublication(ctx, run.WorkflowVersion)
	if err != nil {
		return nil
	}
	doc := publication.Document
	step, found := publishedStepOf(doc, run.WorkflowCode, stepCode)
	if !found || step.RoleID == "" {
		return nil
	}
	keys, err := heldRoleKeys(ctx, b.reg, b.instanceID, m)
	if err != nil {
		return err
	}
	if keys[step.RoleID] {
		return nil
	}
	at := slices.IndexFunc(doc.Roles, func(r agencymodels.DocumentRole) bool { return r.ID == step.RoleID })
	if at >= 0 && doc.Roles[at].Code != "" && keys[doc.Roles[at].Code] {
		return nil
	}
	return fmt.Errorf("%w: step %s", mwanachamataskmanager.ErrStepRoleNotHeld, stepCode)
}

func publishedStepOf(doc agencymodels.AgencyDocument, workflowCode, stepCode string) (agencymodels.DocumentWorkItem, bool) {
	wf := slices.IndexFunc(doc.Workflows, func(w agencymodels.DocumentWorkflow) bool { return w.Code == workflowCode })
	if wf < 0 {
		return agencymodels.DocumentWorkItem{}, false
	}
	at := slices.IndexFunc(doc.WorkItems, func(s agencymodels.DocumentWorkItem) bool {
		return s.Code == stepCode && s.WorkflowID == doc.Workflows[wf].ID
	})
	if at < 0 {
		return agencymodels.DocumentWorkItem{}, false
	}
	return doc.WorkItems[at], true
}
