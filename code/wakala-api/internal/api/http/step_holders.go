package http

import (
	"context"
	"slices"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type heldStep struct {
	step agencymodels.WorkItem
	role agencymodels.Role
}

func roleHoldsGeneratedStep(recordCode string, questions []agencymodels.StepQuestion, action string, granted []string) bool {
	carries := func(codeAction, field string) bool {
		return slices.Contains(granted, mwanachamaagency.RecordPermissionCode(recordCode, codeAction, field))
	}
	switch action {
	case agencymodels.RowActionDelete:
		return carries(agencymodels.RowActionDelete, "")
	case agencymodels.RowActionEdit:
		return carries(action, mwanachamaagency.RecordFieldStar) || slices.ContainsFunc(questions, func(q agencymodels.StepQuestion) bool {
			return q.Code != "" && carries(action, q.Code)
		})
	case agencymodels.RowActionAdd:
		return holdsAddStep(questions, carries)
	}
	return false
}

func holdsAddStep(questions []agencymodels.StepQuestion, carries func(action, field string) bool) bool {
	if carries(agencymodels.RowActionAdd, mwanachamaagency.RecordFieldStar) {
		return true
	}
	required := slices.DeleteFunc(slices.Clone(questions), func(q agencymodels.StepQuestion) bool { return !q.Required })
	if len(required) == 0 {
		return slices.ContainsFunc(questions, func(q agencymodels.StepQuestion) bool {
			return q.Code != "" && carries(agencymodels.RowActionAdd, q.Code)
		})
	}
	return !slices.ContainsFunc(required, func(q agencymodels.StepQuestion) bool {
		return q.Code == "" || !carries(agencymodels.RowActionAdd, q.Code)
	})
}

func (d *Deps) generatedStepsHeld(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, draftID string, roles []agencymodels.Role, workflows map[string]agencymodels.Workflow) ([]heldStep, error) {
	ctx = withPartitionContext(ctx, instanceID)
	steps, err := m.ListWorkItems(ctx, draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return nil, err
	}
	records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return nil, err
	}
	granted := make(map[string][]string, len(roles))
	for _, role := range roles {
		codes, err := d.agencyRolePermissions(ctx, role.ID)
		if err != nil {
			return nil, err
		}
		granted[role.ID] = codes
	}
	held := []heldStep{}
	for _, step := range steps {
		workflow := workflows[step.WorkflowID]
		if step.Deleted || !workflow.Generated {
			continue
		}
		at := slices.IndexFunc(records, func(r agencymodels.Record) bool { return !r.Deleted && r.Identity() == workflow.GeneratedFor })
		if at < 0 {
			continue
		}
		holder := slices.IndexFunc(roles, func(role agencymodels.Role) bool {
			return roleHoldsGeneratedStep(records[at].Code, records[at].Questions, step.RowAction, granted[role.ID])
		})
		if holder >= 0 {
			held = append(held, heldStep{step: step, role: roles[holder]})
		}
	}
	return held, nil
}

func generatedRecordOfStep(doc agencymodels.AgencyDocument, step agencymodels.DocumentWorkItem) (agencymodels.DocumentRecord, bool) {
	wf := slices.IndexFunc(doc.Workflows, func(w agencymodels.DocumentWorkflow) bool { return w.ID == step.WorkflowID })
	if wf < 0 || !doc.Workflows[wf].Generated {
		return agencymodels.DocumentRecord{}, false
	}
	at := slices.IndexFunc(doc.Records, func(r agencymodels.DocumentRecord) bool {
		return !r.Deleted && r.Identity() == doc.Workflows[wf].GeneratedFor
	})
	if at < 0 {
		return agencymodels.DocumentRecord{}, true
	}
	return doc.Records[at], true
}

func documentRoleHoldsGeneratedStep(keys map[string]bool, role agencymodels.DocumentRole, record agencymodels.DocumentRecord, action string) bool {
	held := keys[role.ID] || (role.Code != "" && keys[role.Code])
	return held && !role.Deleted && roleHoldsGeneratedStep(record.Code, record.Questions, action, role.Permissions)
}
