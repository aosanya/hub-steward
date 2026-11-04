package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) CreateEventFlowStep(ctx context.Context, s models.EventFlowStep) (models.EventFlowStep, error) {
	if err := m.validateOpenDraftID(ctx, s.DraftID); err != nil {
		return models.EventFlowStep{}, err
	}
	s.ID = newID()
	s.Deleted = false
	s.CreatedAt = models.NowRFC3339()
	s.LastUpdated = s.CreatedAt

	if err := m.insert(ctx, roleEventFlowStep, s); err != nil {
		return models.EventFlowStep{}, fmt.Errorf("CreateEventFlowStep: %w", err)
	}
	return s, nil
}

func (m *agencyManager) LookupFlowStep(ctx context.Context, draftID string, lookup models.EventFlowStepLookup) (models.EventFlowStep, error) {
	q := scopeQuery(m.q(ctx, roleEventFlowStep), draftID)
	var key string
	switch {
	case lookup.HandlerCode != "":
		key = fmt.Sprintf("handler_code %q", lookup.HandlerCode)
		q = q.Where("handler_code = ?", lookup.HandlerCode)
	case lookup.TriggerTopic != "" && lookup.Consumer != "":
		key = fmt.Sprintf("trigger_topic %q and consumer %q", lookup.TriggerTopic, lookup.Consumer)
		q = q.Where("trigger_topic = ? AND consumer = ?", lookup.TriggerTopic, lookup.Consumer)
	case lookup.Code != "":
		var step models.EventFlowStep
		if err := m.take(q.Where("code = ?", lookup.Code), roleEventFlowStep, &step, ErrEventFlowStepNotFound); err != nil {
			return models.EventFlowStep{}, err
		}
		return step, nil
	default:
		return models.EventFlowStep{}, ErrInvalidLookup
	}

	matches, err := list[models.EventFlowStep](m, q.Order("workflow_code, ordinality, step"), roleEventFlowStep)
	if err != nil {
		return models.EventFlowStep{}, fmt.Errorf("LookupFlowStep: %w", err)
	}
	switch len(matches) {
	case 0:
		return models.EventFlowStep{}, ErrEventFlowStepNotFound
	case 1:
		return matches[0], nil
	}
	return models.EventFlowStep{}, fmt.Errorf("%w: %s matches %d steps (%s); look one up by code", ErrAmbiguousLookup, key, len(matches), describeSteps(matches))
}

func describeSteps(steps []models.EventFlowStep) string {
	parts := make([]string, len(steps))
	for i, s := range steps {
		parts[i] = fmt.Sprintf("%s %q", s.ID, s.Name)
	}
	return strings.Join(parts, ", ")
}

func (m *agencyManager) ListEventFlowSteps(ctx context.Context, draftID, workflowCode string, filter EventFlowStepFilter) ([]models.EventFlowStep, error) {
	q := scopeQuery(m.q(ctx, roleEventFlowStep), draftID).Order("workflow_code, ordinality, step")
	if workflowCode != "" {
		q = q.Where("workflow_code = ?", workflowCode)
	}
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "name", filter.Name)
	q = likeFilter(q, "description", filter.Description)

	out, err := list[models.EventFlowStep](m, q, roleEventFlowStep)
	if err != nil {
		return nil, fmt.Errorf("ListEventFlowSteps: %w", err)
	}
	return out, nil
}
