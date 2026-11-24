package http

import (
	"context"
	"fmt"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"github.com/aosanya/mwanachama-backend-agency/models"
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
	accountableID, err := optionalRef(im.roles, "accountable role", wi.AccountableRoleID)
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
	rowRecord, err := optionalRef(im.recordCodes, "record", wi.RowRecord)
	if err != nil {
		return models.WorkItem{}, err
	}
	return models.WorkItem{DraftID: im.draftID,
		WorkflowID:        workflowID,
		Title:             wi.Title,
		Description:       wi.Description,
		Ordinality:        wi.Ordinality,
		Prompt:            wi.Prompt,
		Kind:              wi.Kind,
		RoleID:            roleID,
		AccountableRoleID: accountableID,
		RunWorkflowID:     runID,
		FormName:          wi.FormName,
		Questions:         wi.Questions,
		Tool:              wi.Tool,
		RecipientRoleID:   recipientID,
		TimeLimitMinutes:  wi.TimeLimitMinutes,
		CancelWorkflowID:  cancelID,
		RowRecord:         rowRecord,
		RecordCode:        im.readableCodes.resolveOr(wi.RecordCode),
		RowAction:         wi.RowAction,
		SendBackDecision:  wi.SendBackDecision,
		SendBackReason:    wi.SendBackReason,
	}, nil
}

func (im *importer) applyWorkItems(ctx context.Context, steps []importWorkItem) {
	var linked []importedStep
	waiting := steps
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
	created, err := im.mgr.CreateWorkItem(im.kept.keeping(ctx, wi.Code), row)
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

func (im *importer) standInCode(what, ref string) (string, error) {
	id, err := optionalRef(im.workflows, what, ref)
	if err != nil || id == "" {
		return "", err
	}
	return im.workflowCodes[id], nil
}

func (im *importer) recordRefs(rc importRecord) (models.Record, error) {
	workflowID, ok := im.workflows.resolve(rc.WorkflowID)
	if !ok {
		return models.Record{}, fmt.Errorf("unknown workflow %q", rc.WorkflowID)
	}
	record := models.Record{DraftID: im.draftID, WorkflowID: workflowID}
	var err error
	record.Name = rc.Name
	record.FormName = rc.FormName
	record.ItemName = rc.ItemName
	record.Questions = rc.Questions
	for _, ref := range []struct {
		what string
		from string
		to   *string
	}{
		{"add stand-in workflow", rc.AddReplacedBy, &record.AddReplacedBy},
		{"edit stand-in workflow", rc.EditReplacedBy, &record.EditReplacedBy},
		{"delete stand-in workflow", rc.DeleteReplacedBy, &record.DeleteReplacedBy},
	} {
		if *ref.to, err = im.standInCode(ref.what, ref.from); err != nil {
			return models.Record{}, err
		}
	}
	return record, nil
}

func (im *importer) applyRecords(ctx context.Context, in importRequest) {
	for _, rc := range in.Records {
		record, err := im.recordRefs(rc)
		if err != nil {
			im.fail("record %q: %v", rc.Name, err)
			continue
		}
		record.Code = readableCodeOf(rc.Code)
		created, err := im.mgr.CreateRecord(ctx, record)
		if err != nil {
			im.fail("record %q: %v", rc.Name, err)
			continue
		}
		im.recordCodes.add(rc.ID, rc.Code, created.Identity())
		im.readableCodes.add(rc.ID, rc.Code, created.Code)
		im.counted("records")
	}
}

func (im *importer) applyStepRecords(ctx context.Context, in importRequest) {
	for _, wi := range in.stepsDerivingARecord() {
		workflowID, ok := im.workflows.resolve(wi.WorkflowID)
		if !ok {
			im.fail("work item %q: unknown workflow %q", wi.Title, wi.WorkflowID)
			continue
		}
		roleID, ok := im.roles.resolve(wi.RoleID)
		if !ok {
			im.fail("work item %q: unknown role %q", wi.Title, wi.RoleID)
			continue
		}
		if _, taken := im.recordCodes[wi.RecordCode]; taken || !validRecordCode(wi.RecordCode) {
			im.fail("work item %q: the record code %q cannot be kept; %s", wi.Title, wi.RecordCode, recordCodeRule())
			continue
		}
		created, err := im.mgr.CreateRecord(ctx, models.Record{DraftID: im.draftID, Code: readableCodeOf(wi.RecordCode),
			WorkflowID: workflowID,
			Name:       recordNameOfCode(wi.RecordCode, wi.Title),
			FormName:   wi.FormName,
			Questions:  wi.Questions,
		})
		if err != nil {
			im.fail("work item %q record %q: %v", wi.Title, wi.RecordCode, err)
			continue
		}
		im.recordCodes.add("", wi.RecordCode, created.Identity())
		im.readableCodes.add("", wi.RecordCode, created.Code)
		im.stepRolesAdding[roleID] = append(im.stepRolesAdding[roleID], mwanachamaagency.RecordPermissionCode(created.Code, models.RowActionAdd, mwanachamaagency.RecordFieldStar))
		im.counted("records")
	}
}

func (im *importer) applyWorkflowSubjects(ctx context.Context, in importRequest) {
	for _, w := range in.Workflows {
		if w.SubjectRecord == "" {
			continue
		}
		id, ok := im.workflows.resolve(firstNonEmpty(w.ID, w.Code))
		if !ok {
			continue
		}
		workflow, err := im.mgr.GetWorkflow(ctx, id)
		if err != nil {
			im.fail("workflow %q: %v", w.Name, err)
			continue
		}
		workflow.SubjectRecord = im.recordCodes.resolveOr(w.SubjectRecord)
		if _, err := im.mgr.UpdateWorkflow(ctx, workflow); err != nil {
			im.fail("workflow %q: %v", w.Name, err)
		}
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
