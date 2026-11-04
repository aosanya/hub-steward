package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

type issueScan struct {
	ctx     context.Context
	m       *agencyManager
	tx      *gorm.DB
	draftID string
	groups  map[string]bool
	now     string
	found   []models.Issue
}

func (m *agencyManager) scanIssues(ctx context.Context, tx *gorm.DB, draftID string, groups map[string]bool) ([]models.Issue, error) {
	s := issueScan{ctx: ctx, m: m, tx: tx, draftID: draftID, groups: groups, now: models.NowRFC3339()}
	for _, check := range []func() error{
		s.checkStructure,
		s.checkRoleAssignments,
		s.checkWorkflowObjectives,
		s.checkWorkItems,
		s.checkStepLinks,
		s.checkRecords,
		s.checkRiskPathways,
		s.checkEventFlowSteps,
		s.checkAttachments,
		s.checkModuleSettings,
		s.checkPermissions,
		s.checkControls,
		s.checkConsequenceHazards,
		s.checkBowties,
		s.checkScenarios,
	} {
		if err := check(); err != nil {
			return nil, fmt.Errorf("scanIssues: %w", err)
		}
	}
	return s.found, nil
}

func (s *issueScan) scoped(role string) *gorm.DB {
	return scopeQuery(s.tx.WithContext(s.ctx).Table(s.m.table(role)), s.draftID)
}

func (s *issueScan) add(sev models.IssueSeverity, entityType, entityID, format string, args ...any) {
	s.found = append(s.found, models.Issue{
		ID:         newID(),
		DraftID:    s.draftID,
		Severity:   sev,
		Message:    fmt.Sprintf(format, args...),
		EntityType: entityType,
		EntityID:   entityID,
		CreatedAt:  s.now,
	})
}

func (s *issueScan) codeSet(role string) (map[string]bool, error) {
	var codes []string
	if err := s.scoped(role).Pluck("code", &codes).Error; err != nil {
		return nil, err
	}
	set := make(map[string]bool, len(codes))
	for _, c := range codes {
		set[c] = true
	}
	return set, nil
}

func (s *issueScan) checkStructure() error {
	goals, err := list[models.Goal](s.m, s.scoped(roleGoal), roleGoal)
	if err != nil {
		return err
	}
	objectives, err := list[models.Objective](s.m, s.scoped(roleObjective), roleObjective)
	if err != nil {
		return err
	}

	if len(goals) == 0 {
		s.add(models.IssueSeverityError, "agency", "", "The Agency has no Goals")
	}
	goalsWithObjective := make(map[string]bool, len(objectives))
	for _, o := range objectives {
		goalsWithObjective[o.GoalID] = true
	}
	for _, g := range goals {
		if !goalsWithObjective[g.ID] {
			s.add(models.IssueSeverityError, "goal", g.ID, "Goal %s %q has no Objectives", g.Code, g.Title)
		}
	}
	return nil
}

func (s *issueScan) checkRoleAssignments() error {
	roles, err := list[models.Role](s.m, s.scoped(roleRole), roleRole)
	if err != nil {
		return err
	}
	workItems, err := list[models.WorkItem](s.m, s.scoped(roleWorkItem), roleWorkItem)
	if err != nil {
		return err
	}
	assignments, err := list[models.RoleAssignment](s.m, s.scoped(roleRoleAssignment), roleRoleAssignment)
	if err != nil {
		return err
	}

	roleIDs := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleIDs[r.ID] = true
	}
	workItemIDs := make(map[string]bool, len(workItems))
	for _, w := range workItems {
		workItemIDs[w.ID] = true
	}

	for _, a := range assignments {
		if !a.Label.Valid() {
			s.add(models.IssueSeverityError, "role_assignment", a.ID,
				"Role assignment %s has label %s, which is not responsible, accountable, consulted or informed", a.ID, QuoteIfUnsafe(string(a.Label)))
		}
		if !roleIDs[a.RoleID] {
			s.add(models.IssueSeverityError, "role_assignment", a.ID,
				"Role assignment %s refers to Role %s, which does not exist", a.ID, QuoteIfUnsafe(a.RoleID))
		}
		if !workItemIDs[a.WorkItemID] {
			s.add(models.IssueSeverityError, "role_assignment", a.ID,
				"Role assignment %s refers to Work item %s, which does not exist", a.ID, QuoteIfUnsafe(a.WorkItemID))
		}
	}
	return nil
}

func (s *issueScan) checkWorkflowObjectives() error {
	workflows, err := list[models.Workflow](s.m, s.scoped(roleWorkflow), roleWorkflow)
	if err != nil {
		return err
	}
	objectives, err := list[models.Objective](s.m, s.scoped(roleObjective), roleObjective)
	if err != nil {
		return err
	}
	links, err := list[models.WorkflowObjective](s.m, s.scoped(roleWorkflowObjective), roleWorkflowObjective)
	if err != nil {
		return err
	}

	workflowIDs := make(map[string]bool, len(workflows))
	for _, w := range workflows {
		workflowIDs[w.ID] = true
	}
	objectiveIDs := make(map[string]bool, len(objectives))
	for _, o := range objectives {
		objectiveIDs[o.ID] = true
	}

	workflowsWithObjective := make(map[string]bool, len(links))
	for _, l := range links {
		workflowsWithObjective[l.WorkflowID] = true
		if !workflowIDs[l.WorkflowID] {
			s.add(models.IssueSeverityError, "workflow_objective", l.ID,
				"Workflow objective %s refers to Workflow %s, which does not exist", l.ID, QuoteIfUnsafe(l.WorkflowID))
		}
		if !objectiveIDs[l.ObjectiveID] {
			s.add(models.IssueSeverityError, "workflow_objective", l.ID,
				"Workflow objective %s refers to Objective %s, which does not exist", l.ID, QuoteIfUnsafe(l.ObjectiveID))
		}
	}
	for _, w := range workflows {
		if !workflowsWithObjective[w.ID] {
			s.add(models.IssueSeverityError, "workflow", w.ID, "Workflow %s %q has no Objective", w.Code, w.Name)
		}
	}
	return nil
}

func (s *issueScan) checkWorkItems() error {
	workflows, err := list[models.Workflow](s.m, s.scoped(roleWorkflow), roleWorkflow)
	if err != nil {
		return err
	}
	workItems, err := list[models.WorkItem](s.m, s.scoped(roleWorkItem), roleWorkItem)
	if err != nil {
		return err
	}

	roles, err := list[models.Role](s.m, s.scoped(roleRole), roleRole)
	if err != nil {
		return err
	}
	roleIDs := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleIDs[r.ID] = true
	}
	if err := s.addGroupIDs(roleIDs); err != nil {
		return err
	}
	workflowIDs := make(map[string]bool, len(workflows))
	for _, w := range workflows {
		workflowIDs[w.ID] = true
	}

	workflowsWithItem := make(map[string]bool, len(workItems))
	chatWorkflows := map[string]bool{}
	for _, w := range workItems {
		workflowsWithItem[w.WorkflowID] = true
		if w.RoleID != "" && !roleIDs[w.RoleID] {
			s.add(models.IssueSeverityError, "work_item", w.ID,
				"Work item %s %q is acted on by Role %s, which does not exist", w.Code, w.Title, QuoteIfUnsafe(w.RoleID))
		}
		if w.RunWorkflowID != "" && !workflowIDs[w.RunWorkflowID] {
			s.add(models.IssueSeverityError, "work_item", w.ID,
				"Work item %s %q runs Workflow %s, which does not exist", w.Code, w.Title, QuoteIfUnsafe(w.RunWorkflowID))
		}
		if w.CancelWorkflowID != "" && !workflowIDs[w.CancelWorkflowID] {
			s.add(models.IssueSeverityError, "work_item", w.ID,
				"Work item %s %q cancels with Workflow %s, which does not exist", w.Code, w.Title, QuoteIfUnsafe(w.CancelWorkflowID))
		}
		if w.Kind == models.StepKindChat {
			chatWorkflows[w.WorkflowID] = true
			s.checkChatStep(w, roleIDs, workflowIDs)
		}
	}
	for _, w := range workflows {
		if !workflowsWithItem[w.ID] {
			s.add(models.IssueSeverityError, "workflow", w.ID, "Workflow %s %q has no Work Items", w.Code, w.Name)
		}
		if w.IsChat() && !chatWorkflows[w.ID] {
			s.add(models.IssueSeverityError, "workflow", w.ID, "Workflow %s %q opens in a chat but has no chat step", w.Code, w.Name)
		}
	}
	return nil
}

func (s *issueScan) checkChatStep(w models.WorkItem, roleIDs, workflowIDs map[string]bool) {
	if w.RoleID == "" {
		s.add(models.IssueSeverityError, "work_item", w.ID, "Work item %s %q is a chat step that names no role that opens it", w.Code, w.Title)
	}
	switch {
	case w.AgentRoleID == "":
		s.add(models.IssueSeverityError, "work_item", w.ID, "Work item %s %q is a chat step that names no agent to chat with", w.Code, w.Title)
	case !roleIDs[w.AgentRoleID]:
		s.add(models.IssueSeverityError, "work_item", w.ID,
			"Work item %s %q chats with Role %s, which does not exist", w.Code, w.Title, QuoteIfUnsafe(w.AgentRoleID))
	}
	if strings.TrimSpace(w.Topic) == "" {
		s.add(models.IssueSeverityError, "work_item", w.ID, "Work item %s %q is a chat step that names no topic", w.Code, w.Title)
	}
	for _, id := range w.StartWorkflowIDs {
		if !workflowIDs[id] {
			s.add(models.IssueSeverityError, "work_item", w.ID,
				"Work item %s %q may start Workflow %s, which does not exist", w.Code, w.Title, QuoteIfUnsafe(id))
		}
	}
}

func (s *issueScan) checkEventFlowSteps() error {
	workflowCodes, err := s.codeSet(roleWorkflow)
	if err != nil {
		return err
	}
	steps, err := list[models.EventFlowStep](s.m, s.scoped(roleEventFlowStep), roleEventFlowStep)
	if err != nil {
		return err
	}
	for _, step := range steps {
		if step.WorkflowCode == "" || workflowCodes[step.WorkflowCode] {
			continue
		}
		s.add(models.IssueSeverityError, "event_flow_step", step.ID,
			"Event flow step %s %q refers to Workflow code %q, which does not exist", step.Code, step.Name, step.WorkflowCode)
	}
	return nil
}

func (s *issueScan) checkAttachments() error {
	codesByType := make(map[models.TargetType]map[string]bool, 5)
	for _, t := range []models.TargetType{
		models.TargetTypeRole, models.TargetTypeGoal, models.TargetTypeObjective,
		models.TargetTypeWorkflow, models.TargetTypeWorkItem,
	} {
		role, _, ok := s.m.targetRole(t)
		if !ok {
			continue
		}
		codes, err := s.codeSet(role)
		if err != nil {
			return err
		}
		codesByType[t] = codes
	}

	valueCodes, err := s.codeSet(roleValue)
	if err != nil {
		return err
	}
	ruleCodes, err := s.codeSet(roleRule)
	if err != nil {
		return err
	}

	valueAttachments, err := list[models.ValueAttachment](s.m,
		s.tx.WithContext(s.ctx).Table(s.m.table(roleValueAttachment)), roleValueAttachment)
	if err != nil {
		return err
	}
	for _, a := range valueAttachments {
		if !valueCodes[a.ValueCode] {
			s.add(models.IssueSeverityError, "value_attachment", a.ID,
				"Attachment to %s %s names Value %s, which does not exist", a.TargetType, a.TargetCode, a.ValueCode)
			continue
		}
		if codesByType[a.TargetType][a.TargetCode] {
			continue
		}
		s.add(models.IssueSeverityError, "value_attachment", a.ID,
			"Value %s is attached to %s %s, which does not exist", QuoteIfUnsafe(a.ValueCode), a.TargetType, QuoteIfUnsafe(a.TargetCode))
	}

	ruleAttachments, err := list[models.RuleAttachment](s.m,
		s.tx.WithContext(s.ctx).Table(s.m.table(roleRuleAttachment)), roleRuleAttachment)
	if err != nil {
		return err
	}
	for _, a := range ruleAttachments {
		if !ruleCodes[a.RuleCode] {
			s.add(models.IssueSeverityError, "rule_attachment", a.ID,
				"Attachment to %s %s names Rule %s, which does not exist", a.TargetType, a.TargetCode, a.RuleCode)
			continue
		}
		if codesByType[a.TargetType][a.TargetCode] {
			continue
		}
		s.add(models.IssueSeverityError, "rule_attachment", a.ID,
			"Rule %s is attached to %s %s, which does not exist", QuoteIfUnsafe(a.RuleCode), a.TargetType, QuoteIfUnsafe(a.TargetCode))
	}
	return nil
}

func (m *agencyManager) ListIssues(ctx context.Context, draftID string, filter IssueFilter) ([]models.Issue, error) {
	groups, err := m.groupIDs(ctx)
	if err != nil {
		return nil, err
	}
	err = m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := m.findDraft(ctx, tx, draftID); err != nil {
			return err
		}
		_, err := m.rescanIssues(ctx, tx, draftID, groups)
		return err
	})
	if err != nil {
		return nil, err
	}

	q := scopeQuery(m.q(ctx, roleIssue), draftID).Order("created_at")
	q = likeFilter(q, "message", filter.Message)
	q = eqFilter(q, "severity", filter.Severity)
	q = eqFilter(q, "entity_type", filter.EntityType)

	out, err := list[models.Issue](m, q, roleIssue)
	if err != nil {
		return nil, fmt.Errorf("ListIssues: %w", err)
	}
	return out, nil
}

func (m *agencyManager) rescanIssues(ctx context.Context, tx *gorm.DB, draftID string, groups map[string]bool) ([]models.Issue, error) {
	if err := m.deleteWhere(ctx, tx, roleIssue, "draft_id = ?", draftID); err != nil {
		return nil, fmt.Errorf("rescanIssues: %w", err)
	}
	found, err := m.scanIssues(ctx, tx, draftID, groups)
	if err != nil {
		return nil, err
	}
	for _, issue := range found {
		if err := m.copyRow(ctx, tx, roleIssue, issue); err != nil {
			return nil, fmt.Errorf("rescanIssues: %w", err)
		}
	}
	return found, nil
}

func (s *issueScan) checkPermissions() error {
	roles, err := list[models.Role](s.m, s.scoped(roleRole), roleRole)
	if err != nil {
		return err
	}
	for _, r := range roles {
		for _, code := range r.Permissions {
			permission, known := models.LookupPermission(code)
			switch {
			case !known:
				s.add(models.IssueSeverityError, "role", r.ID, "Role %s %q declares unknown permission %q", r.Code, r.Name, code)
			case permission.Locked:
				s.add(models.IssueSeverityError, "role", r.ID, "Role %s %q declares permission %q, which is locked to owners", r.Code, r.Name, code)
			}
		}
	}
	return nil
}

func (s *issueScan) checkRiskPathways() error {
	risks, err := list[models.Risk](s.m, s.scoped(roleRisk), roleRisk)
	if err != nil {
		return err
	}
	pathways, err := list[models.RiskPathway](s.m, s.scoped(roleRiskPathway), roleRiskPathway)
	if err != nil {
		return err
	}
	riskIDs := make(map[string]bool, len(risks))
	for _, r := range risks {
		riskIDs[r.ID] = true
	}
	for _, p := range pathways {
		if !riskIDs[p.RiskID] {
			s.add(models.IssueSeverityError, "risk_pathway", p.ID,
				"Risk pathway %s refers to Risk %s, which does not exist", p.Code, QuoteIfUnsafe(p.RiskID))
		}
	}
	return nil
}
