package http

import (
	"context"
	"fmt"

	"wakalaserver/modules/agency/models"
)

type importedStep struct {
	created models.WorkItem
	source  importWorkItem
}

func optionalRef(m refMap, what, ref string) (string, error) {
	if ref == "" {
		return "", nil
	}
	id, ok := m.resolve(ref)
	if !ok {
		return "", fmt.Errorf("unknown %s %q", what, ref)
	}
	return id, nil
}

func (im *importer) stepRefs(wi importWorkItem) (models.WorkItem, error) {
	workflowID, ok := im.workflows.resolve(wi.WorkflowID)
	if !ok {
		return models.WorkItem{}, fmt.Errorf("unknown workflow %q", wi.WorkflowID)
	}
	roleID, err := optionalRef(im.roles, "role", wi.RoleID)
	if err != nil {
		return models.WorkItem{}, err
	}
	recipientID, err := optionalRef(im.roles, "recipient role", wi.RecipientRoleID)
	if err != nil {
		return models.WorkItem{}, err
	}
	runID, err := optionalRef(im.workflows, "run workflow", wi.RunWorkflowID)
	if err != nil {
		return models.WorkItem{}, err
	}
	cancelID, err := optionalRef(im.workflows, "cancel workflow", wi.CancelWorkflowID)
	if err != nil {
		return models.WorkItem{}, err
	}
	return models.WorkItem{DraftID: im.draftID,
		WorkflowID:       workflowID,
		Title:            wi.Title,
		Description:      wi.Description,
		Ordinality:       wi.Ordinality,
		Prompt:           wi.Prompt,
		Kind:             wi.Kind,
		RoleID:           roleID,
		RunWorkflowID:    runID,
		FormName:         wi.FormName,
		Questions:        wi.Questions,
		Tool:             wi.Tool,
		RecipientRoleID:  recipientID,
		TimeLimitMinutes: wi.TimeLimitMinutes,
		CancelWorkflowID: cancelID,
	}, nil
}

func (im *importer) applyWorkItems(ctx context.Context, in importRequest) {
	var linked []importedStep
	waiting := in.WorkItems
	for len(waiting) > 0 {
		var deferred []importWorkItem
		for _, wi := range waiting {
			if wi.SentStepID != "" {
				if _, ok := im.workItems.resolve(wi.SentStepID); !ok {
					deferred = append(deferred, wi)
					continue
				}
			}
			if step, ok := im.createStep(ctx, wi); ok && (len(wi.Routes) > 0 || wi.OtherwiseStepID != "") {
				linked = append(linked, importedStep{created: step, source: wi})
			}
		}
		if len(deferred) == len(waiting) {
			for _, wi := range deferred {
				im.fail("work item %q: unknown sent step %q", wi.Title, wi.SentStepID)
			}
			break
		}
		waiting = deferred
	}
	for _, s := range linked {
		im.linkRoutes(ctx, s)
	}
}

func (im *importer) createStep(ctx context.Context, wi importWorkItem) (models.WorkItem, bool) {
	row, err := im.stepRefs(wi)
	if err != nil {
		im.fail("work item %q: %v", wi.Title, err)
		return models.WorkItem{}, false
	}
	if row.SentStepID, err = optionalRef(im.workItems, "sent step", wi.SentStepID); err != nil {
		im.fail("work item %q: %v", wi.Title, err)
		return models.WorkItem{}, false
	}
	created, err := im.mgr.CreateWorkItem(ctx, row)
	if err != nil {
		im.fail("work item %q: %v", wi.Title, err)
		return models.WorkItem{}, false
	}
	im.workItems.add(wi.ID, wi.Code, created.ID)
	im.counted("work_items")
	return created, true
}

func (im *importer) linkRoutes(ctx context.Context, s importedStep) {
	step := s.created
	for _, r := range s.source.Routes {
		goTo, err := optionalRef(im.workItems, "route target step", r.GoToStep)
		if err != nil {
			im.fail("work item %q: %v", s.source.Title, err)
			return
		}
		r.GoToStep = goTo
		step.Routes = append(step.Routes, r)
	}
	otherwise, err := optionalRef(im.workItems, "otherwise step", s.source.OtherwiseStepID)
	if err != nil {
		im.fail("work item %q: %v", s.source.Title, err)
		return
	}
	step.OtherwiseStepID = otherwise
	if _, err := im.mgr.UpdateWorkItem(ctx, step); err != nil {
		im.fail("work item %q routes: %v", s.source.Title, err)
	}
}

func (im *importer) applyRecords(ctx context.Context, in importRequest) {
	for _, rc := range in.Records {
		workflowID, ok := im.workflows.resolve(rc.WorkflowID)
		if !ok {
			im.fail("record %q: unknown workflow %q", rc.Name, rc.WorkflowID)
			continue
		}
		roleID, ok := im.roles.resolve(rc.RoleID)
		if !ok {
			im.fail("record %q: unknown role %q", rc.Name, rc.RoleID)
			continue
		}
		if _, err := im.mgr.CreateRecord(ctx, models.Record{DraftID: im.draftID,
			WorkflowID: workflowID,
			Name:       rc.Name,
			RoleID:     roleID,
			FormName:   rc.FormName,
			Questions:  rc.Questions,
		}); err != nil {
			im.fail("record %q: %v", rc.Name, err)
			continue
		}
		im.counted("records")
	}
}

type workflowObjectivePair struct {
	workflowRef  string
	objectiveRef string
}

func (in importRequest) workflowObjectivePairs() []workflowObjectivePair {
	var pairs []workflowObjectivePair
	for _, wo := range in.WorkflowObjectives {
		pairs = append(pairs, workflowObjectivePair{wo.WorkflowID, wo.ObjectiveID})
	}
	for _, wi := range in.WorkItems {
		if wi.ObjectiveID != "" {
			pairs = append(pairs, workflowObjectivePair{wi.WorkflowID, wi.ObjectiveID})
		}
	}
	return pairs
}

func (im *importer) applyWorkflowObjectives(ctx context.Context, in importRequest) {
	linked := map[[2]string]bool{}
	for _, p := range in.workflowObjectivePairs() {
		workflowID, ok := im.workflows.resolve(p.workflowRef)
		if !ok {
			continue
		}
		objectiveID, ok := im.objectives.resolve(p.objectiveRef)
		if !ok {
			im.fail("workflow objective: unknown objective %q", p.objectiveRef)
			continue
		}
		key := [2]string{workflowID, objectiveID}
		if linked[key] {
			continue
		}
		linked[key] = true
		if _, err := im.mgr.CreateWorkflowObjective(ctx, models.WorkflowObjective{DraftID: im.draftID,
			WorkflowID:  workflowID,
			ObjectiveID: objectiveID,
		}); err != nil {
			im.fail("workflow objective %s on %s: %v", p.objectiveRef, p.workflowRef, err)
			continue
		}
		im.counted("workflow_objectives")
	}
}
