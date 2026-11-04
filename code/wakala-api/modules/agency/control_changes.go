package mwanachamaagency

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"wakalaserver/modules/agency/models"
)

type publishedControl struct {
	Code         string                 `json:"code"`
	Action       string                 `json:"action"`
	CondField    string                 `json:"cond_field"`
	CondOperator models.ControlOperator `json:"cond_operator"`
	CondValue    string                 `json:"cond_value"`
	OnBreach     models.ControlOnBreach `json:"on_breach"`
	WorkflowID   string                 `json:"workflow_id"`
}

type publishedControls struct {
	Controls  []publishedControl `json:"controls"`
	Workflows []struct {
		ID   string `json:"id"`
		Code string `json:"code"`
	} `json:"workflows"`
}

func (m *agencyManager) ChangedEnforcedControls(ctx context.Context, draftID string) ([]models.Control, error) {
	if err := m.validateOpenDraftID(ctx, draftID); err != nil {
		return nil, err
	}
	published, err := m.productionControls(ctx)
	if err != nil {
		return nil, err
	}
	workflowCodes, err := m.workflowCodesByID(ctx, draftID)
	if err != nil {
		return nil, err
	}
	controls, err := list[models.Control](m, scopeQuery(m.q(ctx, roleControl).Order("created_at"), draftID), roleControl)
	if err != nil {
		return nil, fmt.Errorf("ChangedEnforcedControls: %w", err)
	}
	var changed []models.Control
	for _, c := range controls {
		if !c.Enforced() {
			continue
		}
		before, held := published.byCode[c.Code]
		if !held || !sameEnforcement(before, published.workflowCodes[before.WorkflowID], c, workflowCodes[c.WorkflowID]) {
			changed = append(changed, c)
		}
	}
	return changed, nil
}

type productionDocument struct {
	byCode        map[string]publishedControl
	workflowCodes map[string]string
}

func (m *agencyManager) productionControls(ctx context.Context) (productionDocument, error) {
	out := productionDocument{byCode: map[string]publishedControl{}, workflowCodes: map[string]string{}}
	pub, err := m.GetPublicationForChannel(ctx, models.DefaultChannel)
	if errors.Is(err, ErrPublicationNotFound) {
		return out, nil
	}
	if err != nil {
		return out, fmt.Errorf("ChangedEnforcedControls: %w", err)
	}
	raw, err := json.Marshal(pub.Document)
	if err != nil {
		return out, fmt.Errorf("ChangedEnforcedControls: %w", err)
	}
	var doc publishedControls
	if err := json.Unmarshal(raw, &doc); err != nil {
		return out, fmt.Errorf("ChangedEnforcedControls: %w", err)
	}
	for _, c := range doc.Controls {
		out.byCode[c.Code] = c
	}
	for _, w := range doc.Workflows {
		out.workflowCodes[w.ID] = w.Code
	}
	return out, nil
}

func (m *agencyManager) workflowCodesByID(ctx context.Context, draftID string) (map[string]string, error) {
	workflows, err := m.ListWorkflows(ctx, draftID, WorkflowFilter{})
	if err != nil {
		return nil, fmt.Errorf("ChangedEnforcedControls: %w", err)
	}
	out := make(map[string]string, len(workflows))
	for _, w := range workflows {
		out[w.ID] = w.Code
	}
	return out, nil
}

func sameEnforcement(before publishedControl, beforeWorkflow string, now models.Control, nowWorkflow string) bool {
	return before.Action == now.Action &&
		before.CondField == now.CondField &&
		before.CondOperator == now.CondOperator &&
		before.CondValue == now.CondValue &&
		before.OnBreach == now.OnBreach &&
		beforeWorkflow == nowWorkflow
}
