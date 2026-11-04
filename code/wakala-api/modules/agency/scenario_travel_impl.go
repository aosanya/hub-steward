package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

type scenarioRemap struct {
	workflows map[string]string
	roles     map[string]string
	steps     map[string]string
}

func (m *agencyManager) forkScenarios(ctx context.Context, tx *gorm.DB, sourceDraft, newDraft, now string, remap scenarioRemap) error {
	scenarios, err := list[models.Scenario](m, scopeQuery(tx.WithContext(ctx).Table(m.table(roleScenario)), sourceDraft).Order("created_at"), roleScenario)
	if err != nil {
		return fmt.Errorf("CreateDraft: %w", err)
	}
	for _, s := range scenarios {
		old := s.ID
		copied := models.Scenario{
			ID: newID(), DraftID: newDraft, Name: s.Name, Summary: s.Summary,
			WorkflowID: mapped(remap.workflows, s.WorkflowID), Result: models.ScenarioNotRun,
			CreatedAt: now, LastUpdated: now, Thens: remapThens(s.Thens, remap.steps),
		}
		if err := m.insertRow(ctx, tx, roleScenario, copied); err != nil {
			return fmt.Errorf("CreateDraft: %w", err)
		}
		actors, err := m.storedActors(ctx, tx, old)
		if err != nil {
			return fmt.Errorf("CreateDraft: %w", err)
		}
		for _, a := range actors {
			a.ID, a.ScenarioID, a.DraftID, a.CreatedAt, a.LastUpdated = newID(), copied.ID, newDraft, now, now
			a.RoleID = mapped(remap.roles, a.RoleID)
			if err := m.insertRow(ctx, tx, roleScenarioActor, a); err != nil {
				return fmt.Errorf("CreateDraft: %w", err)
			}
		}
		inputs, err := m.storedInputs(ctx, tx, old)
		if err != nil {
			return fmt.Errorf("CreateDraft: %w", err)
		}
		for _, in := range inputs {
			in.ID, in.ScenarioID, in.DraftID, in.CreatedAt, in.LastUpdated = newID(), copied.ID, newDraft, now, now
			in.StepID = mapped(remap.steps, in.StepID)
			if err := m.insertRow(ctx, tx, roleScenarioInput, in); err != nil {
				return fmt.Errorf("CreateDraft: %w", err)
			}
		}
	}
	return nil
}

func remapThens(thens []models.ScenarioThen, steps map[string]string) []models.ScenarioThen {
	var out []models.ScenarioThen
	for _, t := range thens {
		if to, ok := steps[t.StepID]; ok {
			out = append(out, models.ScenarioThen{StepID: to, Then: t.Then})
		}
	}
	return out
}

func mapped(ids map[string]string, id string) string {
	if to, ok := ids[id]; ok {
		return to
	}
	return id
}

func (m *agencyManager) scenarioDocuments(ctx context.Context, tx *gorm.DB, draftID string) ([]models.DocumentScenario, error) {
	scenarios, err := list[models.Scenario](m, scopeQuery(tx.WithContext(ctx).Table(m.table(roleScenario)), draftID).Order("created_at"), roleScenario)
	if err != nil {
		return nil, err
	}
	var out []models.DocumentScenario
	for _, s := range scenarios {
		doc := models.DocumentScenario{ID: s.ID, Name: s.Name, Summary: s.Summary, WorkflowID: s.WorkflowID, Thens: s.Thens}
		actors, err := m.storedActors(ctx, tx, s.ID)
		if err != nil {
			return nil, err
		}
		for _, a := range actors {
			doc.Actors = append(doc.Actors, models.DocumentScenarioActor{Name: a.Name, RoleID: a.RoleID})
		}
		inputs, err := m.storedInputs(ctx, tx, s.ID)
		if err != nil {
			return nil, err
		}
		for _, in := range inputs {
			doc.Inputs = append(doc.Inputs, models.DocumentScenarioInput{StepID: in.StepID, Field: in.Field, Value: in.Value})
		}
		out = append(out, doc)
	}
	return out, nil
}

func (m *agencyManager) applyScenarioDocuments(ctx context.Context, tx *gorm.DB, draftID string, docs []models.DocumentScenario, now string, remap scenarioRemap) error {
	for i, d := range docs {
		workflowID, ok := remap.workflows[d.WorkflowID]
		if !ok {
			return fmt.Errorf("%w: scenario %d %q mirrors workflow %q, which the document does not hold", ErrInvalidScenario, i+1, d.Name, d.WorkflowID)
		}
		row := models.Scenario{
			ID: newID(), DraftID: draftID, Name: d.Name, Summary: d.Summary, WorkflowID: workflowID,
			Result: models.ScenarioNotRun, CreatedAt: now, LastUpdated: now, Thens: remapThens(d.Thens, remap.steps),
		}
		if err := m.insertRow(ctx, tx, roleScenario, row); err != nil {
			return err
		}
		for n, a := range d.Actors {
			actor := models.ScenarioActor{
				ID: newID(), ScenarioID: row.ID, DraftID: draftID, Name: a.Name, Kind: models.ActorKindRole,
				RoleID: mapped(remap.roles, a.RoleID), Ordinality: n + 1, CreatedAt: now, LastUpdated: now,
			}
			if err := m.insertRow(ctx, tx, roleScenarioActor, actor); err != nil {
				return err
			}
		}
		for _, in := range d.Inputs {
			input := models.ScenarioInput{
				ID: newID(), ScenarioID: row.ID, DraftID: draftID, StepID: mapped(remap.steps, in.StepID),
				Field: in.Field, Value: in.Value, CreatedAt: now, LastUpdated: now,
			}
			if err := m.insertRow(ctx, tx, roleScenarioInput, input); err != nil {
				return err
			}
		}
	}
	return nil
}
