package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func invalidMeasure(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidMeasure, fmt.Sprintf(format, args...))
}

func (m *agencyManager) SetMeasure(ctx context.Context, in models.Measure) (models.Measure, error) {
	var out models.Measure
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		objective, err := m.findObjective(ctx, tx, in.ObjectiveID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, objective.DraftID); err != nil {
			return err
		}
		in.Name = strings.TrimSpace(in.Name)
		in.Target = strings.TrimSpace(in.Target)
		if in.Name == "" {
			return invalidMeasure("a measure has a name")
		}
		if in.Target == "" {
			return invalidMeasure("the measure %q has a target", in.Name)
		}
		written, err := m.writeMeasure(ctx, tx, objective, in)
		if err != nil {
			return err
		}
		out = written
		return nil
	})
	if err != nil {
		return models.Measure{}, fmt.Errorf("SetMeasure: %w", err)
	}
	return out, nil
}

func (m *agencyManager) writeMeasure(ctx context.Context, tx *gorm.DB, objective models.Objective, in models.Measure) (models.Measure, error) {
	held, err := list[models.Measure](m, scopeQuery(tx.WithContext(ctx).Table(m.table(roleMeasure)), objective.DraftID).
		Where("objective_id = ? AND LOWER(name) = ?", objective.ID, strings.ToLower(in.Name)), roleMeasure)
	if err != nil {
		return models.Measure{}, err
	}
	now := models.NowRFC3339()
	if len(held) > 0 {
		row := held[0]
		row.Name, row.Target, row.Unit, row.Status, row.LastUpdated = in.Name, in.Target, strings.TrimSpace(in.Unit), strings.TrimSpace(in.Status), now
		if err := m.writeUpdate(ctx, tx, roleMeasure, row.ID, row, ErrObjectiveNotFound, "draft_id", "objective_id"); err != nil {
			return models.Measure{}, err
		}
		return row, nil
	}
	row := models.Measure{
		ID: newID(), DraftID: objective.DraftID, ObjectiveID: objective.ID, Name: in.Name, Target: in.Target,
		Unit: strings.TrimSpace(in.Unit), Status: strings.TrimSpace(in.Status), CreatedAt: now, LastUpdated: now,
	}
	if err := m.insertRow(ctx, tx, roleMeasure, row); err != nil {
		return models.Measure{}, err
	}
	return row, nil
}

func (m *agencyManager) ListMeasures(ctx context.Context, draftID string, filter MeasureFilter) ([]models.Measure, error) {
	q := scopeQuery(m.q(ctx, roleMeasure).Order("created_at"), draftID)
	q = eqFilter(q, "objective_id", filter.ObjectiveID)

	out, err := list[models.Measure](m, q, roleMeasure)
	if err != nil {
		return nil, fmt.Errorf("ListMeasures: %w", err)
	}
	return out, nil
}
