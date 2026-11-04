package mwanachamaagency

import (
	"wakalaserver/modules/agency/models"
)

func (s *issueScan) checkStepLinks() error {
	steps, err := list[models.WorkItem](s.m, s.scoped(roleWorkItem), roleWorkItem)
	if err != nil {
		return err
	}
	roleIDs, err := s.idSet(roleRole)
	if err != nil {
		return err
	}
	if err := s.addGroupIDs(roleIDs); err != nil {
		return err
	}
	stepWorkflow := make(map[string]string, len(steps))
	for _, w := range steps {
		stepWorkflow[w.ID] = w.WorkflowID
	}

	for _, w := range steps {
		if w.RecipientRoleID != "" && !roleIDs[w.RecipientRoleID] {
			s.add(models.IssueSeverityError, "work_item", w.ID,
				"Work item %s %q goes to Role %s, which does not exist", w.Code, w.Title, w.RecipientRoleID)
		}
		if w.Kind == models.StepKindRoute && w.SentStepID == "" {
			s.add(models.IssueSeverityError, "work_item", w.ID,
				"Route step %s %q names no sent form whose answers it sorts", w.Code, w.Title)
		}
		if w.Kind == models.StepKindRoute && len(w.Routes) == 0 {
			s.add(models.IssueSeverityError, "work_item", w.ID,
				"Route step %s %q has no route", w.Code, w.Title)
		}
		s.checkStepTarget(w, w.SentStepID, "reads the form sent by", stepWorkflow)
		for _, r := range w.Routes {
			s.checkStepTarget(w, r.GoToStep, "routes to", stepWorkflow)
		}
		s.checkStepTarget(w, w.OtherwiseStepID, "otherwise goes to", stepWorkflow)
	}
	return nil
}

func (s *issueScan) checkStepTarget(w models.WorkItem, target, verb string, stepWorkflow map[string]string) {
	if target == "" {
		return
	}
	workflowID, exists := stepWorkflow[target]
	if !exists {
		s.add(models.IssueSeverityError, "work_item", w.ID,
			"Work item %s %q %s Step %s, which does not exist", w.Code, w.Title, verb, target)
		return
	}
	if workflowID != w.WorkflowID {
		s.add(models.IssueSeverityError, "work_item", w.ID,
			"Work item %s %q %s Step %s, which belongs to another workflow", w.Code, w.Title, verb, target)
	}
}

func (s *issueScan) checkRecords() error {
	records, err := list[models.Record](s.m, s.scoped(roleRecord), roleRecord)
	if err != nil {
		return err
	}
	roleIDs, err := s.idSet(roleRole)
	if err != nil {
		return err
	}
	if err := s.addGroupIDs(roleIDs); err != nil {
		return err
	}
	workflowIDs, err := s.idSet(roleWorkflow)
	if err != nil {
		return err
	}
	for _, r := range records {
		if !roleIDs[r.RoleID] {
			s.add(models.IssueSeverityError, "record", r.ID,
				"Record %s %q adds rows as Role %s, which does not exist", r.Code, r.Name, r.RoleID)
		}
		if r.ViewerRoleID != "" && !roleIDs[r.ViewerRoleID] {
			s.add(models.IssueSeverityError, "record", r.ID,
				"Record %s %q is seen by Role %s, which does not exist", r.Code, r.Name, r.ViewerRoleID)
		}
		if !workflowIDs[r.WorkflowID] {
			s.add(models.IssueSeverityError, "record", r.ID,
				"Record %s %q belongs to Workflow %s, which does not exist", r.Code, r.Name, r.WorkflowID)
		}
	}
	return nil
}

func (s *issueScan) idSet(role string) (map[string]bool, error) {
	var ids []string
	if err := s.scoped(role).Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	set := make(map[string]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	return set, nil
}
