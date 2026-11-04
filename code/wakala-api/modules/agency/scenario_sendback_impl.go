package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func usageKey(kind, code string) string { return kind + ":" + code }

func (m *agencyManager) scenarioDrafts(ctx context.Context, tx *gorm.DB, draftID string) ([]string, error) {
	if draftID != "" {
		return []string{draftID}, nil
	}
	var drafts []string
	err := tx.WithContext(ctx).Table(m.table(roleScenario)).Distinct("draft_id").Pluck("draft_id", &drafts).Error
	return drafts, err
}

func (m *agencyManager) sendBack(ctx context.Context, tx *gorm.DB, draftID string, keys ...string) error {
	changed := make(map[string]bool, len(keys))
	for _, k := range keys {
		changed[k] = true
	}
	drafts, err := m.scenarioDrafts(ctx, tx, draftID)
	if err != nil {
		return fmt.Errorf("sendBack: %w", err)
	}
	for _, d := range drafts {
		if err := m.sendBackInDraft(ctx, tx, d, changed); err != nil {
			return fmt.Errorf("sendBack: %w", err)
		}
	}
	return nil
}

func (m *agencyManager) sendBackInDraft(ctx context.Context, tx *gorm.DB, draftID string, changed map[string]bool) error {
	scenarios, err := list[models.Scenario](m, scopeQuery(tx.WithContext(ctx).Table(m.table(roleScenario)), draftID).
		Where("result <> ?", string(models.ScenarioNotRun)), roleScenario)
	if err != nil || len(scenarios) == 0 {
		return err
	}
	uses, err := m.scenarioUses(ctx, tx, draftID, scenarios)
	if err != nil {
		return err
	}
	var affected []string
	for _, s := range scenarios {
		for key := range uses[s.ID] {
			if changed[key] {
				affected = append(affected, s.ID)
				break
			}
		}
	}
	if len(affected) == 0 {
		return nil
	}
	return tx.WithContext(ctx).Table(m.table(roleScenario)).Where("id IN ?", affected).
		Updates(map[string]any{"result": string(models.ScenarioNotRun), "last_updated": models.NowRFC3339()}).Error
}

func (m *agencyManager) scenarioUses(ctx context.Context, tx *gorm.DB, draftID string, scenarios []models.Scenario) (map[string]map[string]bool, error) {
	scoped := func(role string) *gorm.DB { return scopeQuery(tx.WithContext(ctx).Table(m.table(role)), draftID) }
	workflows, err := list[models.Workflow](m, scoped(roleWorkflow), roleWorkflow)
	if err != nil {
		return nil, err
	}
	steps, err := list[models.WorkItem](m, scoped(roleWorkItem), roleWorkItem)
	if err != nil {
		return nil, err
	}
	roles, err := list[models.Role](m, scoped(roleRole), roleRole)
	if err != nil {
		return nil, err
	}
	actors, err := list[models.ScenarioActor](m, scoped(roleScenarioActor), roleScenarioActor)
	if err != nil {
		return nil, err
	}
	attachments, err := list[models.RuleAttachment](m, tx.WithContext(ctx).Table(m.table(roleRuleAttachment)), roleRuleAttachment)
	if err != nil {
		return nil, err
	}

	workflowCode := make(map[string]string, len(workflows))
	for _, w := range workflows {
		workflowCode[w.ID] = w.Code
	}
	roleCode := make(map[string]string, len(roles))
	for _, r := range roles {
		roleCode[r.ID] = r.Code
	}
	stepsOf := make(map[string][]models.WorkItem)
	for _, st := range steps {
		stepsOf[st.WorkflowID] = append(stepsOf[st.WorkflowID], st)
	}
	actorRoles := make(map[string][]string)
	for _, a := range actors {
		actorRoles[a.ScenarioID] = append(actorRoles[a.ScenarioID], a.RoleID)
	}
	rulesOn := make(map[string][]string)
	for _, a := range attachments {
		k := usageKey(string(a.TargetType), a.TargetCode)
		rulesOn[k] = append(rulesOn[k], a.RuleCode)
	}

	out := make(map[string]map[string]bool, len(scenarios))
	for _, s := range scenarios {
		keys := map[string]bool{}
		seen := map[string]bool{}
		queue := []string{s.WorkflowID}
		for len(queue) > 0 {
			id := queue[0]
			queue = queue[1:]
			if seen[id] {
				continue
			}
			seen[id] = true
			if code := workflowCode[id]; code != "" {
				keys[usageKey("workflow", code)] = true
			}
			for _, st := range stepsOf[id] {
				if st.Code != "" {
					keys[usageKey("work_item", st.Code)] = true
				}
				if code := roleCode[st.RoleID]; code != "" {
					keys[usageKey("role", code)] = true
				}
				if st.RunWorkflowID != "" {
					queue = append(queue, st.RunWorkflowID)
				}
				if st.CancelWorkflowID != "" {
					queue = append(queue, st.CancelWorkflowID)
				}
			}
		}
		for _, roleID := range actorRoles[s.ID] {
			if code := roleCode[roleID]; code != "" {
				keys[usageKey("role", code)] = true
			}
		}
		for key := range keys {
			for _, rule := range rulesOn[key] {
				keys[usageKey("rule", rule)] = true
			}
		}
		out[s.ID] = keys
	}
	return out, nil
}

func (m *agencyManager) workflowKey(ctx context.Context, tx *gorm.DB, workflowID string) string {
	var w models.Workflow
	if err := m.find(ctx, tx, roleWorkflow, workflowID, &w, ErrWorkflowNotFound); err != nil || w.Code == "" {
		return ""
	}
	return usageKey("workflow", w.Code)
}

func (m *agencyManager) stepKeys(ctx context.Context, tx *gorm.DB, wi models.WorkItem, otherWorkflowIDs ...string) []string {
	keys := []string{usageKey("work_item", wi.Code)}
	for _, id := range append([]string{wi.WorkflowID}, otherWorkflowIDs...) {
		if key := m.workflowKey(ctx, tx, id); key != "" {
			keys = append(keys, key)
		}
	}
	return keys
}

func (s *issueScan) checkScenarios() error {
	scenarios, err := list[models.Scenario](s.m, s.scoped(roleScenario).Order("created_at"), roleScenario)
	if err != nil {
		return err
	}
	exists := map[string]bool{}
	held, err := list[models.Workflow](s.m, s.scoped(roleWorkflow), roleWorkflow)
	if err != nil {
		return err
	}
	for _, w := range held {
		exists[w.ID] = true
	}
	for _, sc := range scenarios {
		switch {
		case !exists[sc.WorkflowID]:
			s.add(models.IssueSeverityError, "scenario", sc.ID,
				"Scenario %q mirrors a Workflow that does not exist (%s) and cannot pass", sc.Name, sc.Result.Label())
		case sc.Result != models.ScenarioPassed:
			s.add(models.IssueSeverityError, "scenario", sc.ID,
				"Scenario %q has not passed on this draft (%s)", sc.Name, sc.Result.Label())
		}
	}
	return nil
}
