package mwanachamaagency

import (
	"context"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func validateStepLinks(wi models.WorkItem) error {
	if strings.ContainsAny(wi.RecipientRoleID, ", \t\r\n;") {
		return invalidStep("a step goes to one role, got %q", wi.RecipientRoleID)
	}
	if wi.RecipientRoleID != "" && wi.Kind != models.StepKindSendForm && wi.Kind != models.StepKindNotify {
		return invalidStep("only a send_form or notify step goes to a recipient")
	}
	if wi.SentStepID != "" && wi.Kind != models.StepKindYesNo && wi.Kind != models.StepKindRoute {
		return invalidStep("only a yes_no or route step works from a sent form")
	}
	if wi.Kind != models.StepKindRoute {
		if len(wi.Routes) > 0 || wi.OtherwiseStepID != "" {
			return invalidStep("only a route step has routes or an otherwise")
		}
		return nil
	}
	if len(wi.Routes) > 0 && wi.SentStepID == "" {
		return invalidStep("a route step with routes names the sent form whose answers it sorts")
	}
	for i, r := range wi.Routes {
		if err := validateRoute(i+1, r); err != nil {
			return err
		}
	}
	return nil
}

func validateRoute(number int, r models.StepRoute) error {
	if !r.Match.Valid() {
		return invalidStep("route %d matches %q, which is neither all nor any", number, r.Match)
	}
	if r.GoToStep == "" {
		return invalidStep("route %d goes to no step", number)
	}
	if len(r.Rules) == 0 {
		return invalidStep("route %d has no rule", number)
	}
	for i, rule := range r.Rules {
		if strings.TrimSpace(rule.Question) == "" {
			return invalidStep("route %d rule %d names no question", number, i+1)
		}
		if !rule.Operator.Valid() {
			return invalidStep("route %d rule %d: operator %q is not one of %v", number, i+1, rule.Operator, models.RouteOperators())
		}
		if strings.TrimSpace(rule.Value) == "" {
			return invalidStep("route %d rule %d has no value", number, i+1)
		}
		if _, err := strconv.ParseFloat(strings.TrimSpace(rule.Value), 64); rule.Operator.Numeric() && err != nil {
			return invalidStep("route %d rule %d compares with %q, which is not a number", number, i+1, rule.Value)
		}
	}
	return nil
}

func (m *agencyManager) stepOfDraft(ctx context.Context, tx *gorm.DB, draftID, id string) (models.WorkItem, error) {
	var s models.WorkItem
	q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkItem)), draftID).Where("id = ?", id)
	if err := m.take(q, roleWorkItem, &s, ErrWorkItemNotFound); err != nil {
		return models.WorkItem{}, err
	}
	return s, nil
}

func (m *agencyManager) siblingStep(ctx context.Context, tx *gorm.DB, wi models.WorkItem, id, what string) (models.WorkItem, error) {
	s, err := m.stepOfDraft(ctx, tx, wi.DraftID, id)
	if err != nil {
		return models.WorkItem{}, err
	}
	if s.WorkflowID != wi.WorkflowID {
		return models.WorkItem{}, invalidStep("%s is a step of another workflow", what)
	}
	if wi.ID != "" && s.ID == wi.ID {
		return models.WorkItem{}, invalidStep("%s is the step itself", what)
	}
	return s, nil
}

func (m *agencyManager) validateStepLinkReferences(ctx context.Context, tx *gorm.DB, wi models.WorkItem) error {
	if wi.RecipientRoleID != "" {
		if err := m.actorOfDraft(ctx, tx, wi.DraftID, wi.RecipientRoleID); err != nil {
			return err
		}
	}
	if wi.SentStepID == "" {
		return nil
	}
	sent, err := m.siblingStep(ctx, tx, wi, wi.SentStepID, "the sent form")
	if err != nil {
		return err
	}
	if sent.Kind != models.StepKindSendForm {
		return invalidStep("step %q sends no form, so it has no answers to work from", sent.Title)
	}
	if wi.Kind != models.StepKindRoute {
		return nil
	}
	asked := make(map[string]bool, len(sent.Questions))
	for _, q := range sent.Questions {
		asked[q.Prompt] = true
	}
	for i, r := range wi.Routes {
		for j, rule := range r.Rules {
			if !asked[rule.Question] {
				return invalidStep("route %d rule %d asks %q, which the form %q does not", i+1, j+1, rule.Question, sent.FormName)
			}
		}
		if _, err := m.siblingStep(ctx, tx, wi, r.GoToStep, "the step route "+strconv.Itoa(i+1)+" goes to"); err != nil {
			return err
		}
	}
	if wi.OtherwiseStepID != "" {
		if _, err := m.siblingStep(ctx, tx, wi, wi.OtherwiseStepID, "the otherwise step"); err != nil {
			return err
		}
	}
	return nil
}
