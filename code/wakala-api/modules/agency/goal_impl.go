package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) CreateGoal(ctx context.Context, g models.Goal) (models.Goal, error) {
	if err := m.validateOpenDraftID(ctx, g.DraftID); err != nil {
		return models.Goal{}, err
	}
	g.ID = newID()
	g.Deleted = false
	g.CreatedAt = models.NowRFC3339()
	g.LastUpdated = g.CreatedAt

	err := m.createWithCode(ctx, roleGoal, "goal", "G", func(code string) any {
		g.Code = code
		return g
	})
	if err != nil {
		return models.Goal{}, fmt.Errorf("CreateGoal: %w", err)
	}
	return g, nil
}

func (m *agencyManager) GetGoal(ctx context.Context, id string) (models.Goal, error) {
	return m.findGoal(ctx, m.db, id)
}

func (m *agencyManager) ListGoals(ctx context.Context, draftID string, filter GoalFilter) ([]models.Goal, error) {
	q := scopeQuery(m.q(ctx, roleGoal).Order("ordinality"), draftID)
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "title", filter.Title)
	q = likeFilter(q, "description", filter.Description)

	out, err := list[models.Goal](m, q, roleGoal)
	if err != nil {
		return nil, fmt.Errorf("ListGoals: %w", err)
	}
	return out, nil
}

func (m *agencyManager) UpdateGoal(ctx context.Context, g models.Goal) (models.Goal, error) {
	var out models.Goal
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findGoal(ctx, tx, g.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		g.Code = existing.Code
		g.DraftID = existing.DraftID
		g.CreatedAt = existing.CreatedAt
		g.LastUpdated = models.NowRFC3339()

		if err := m.writeUpdate(ctx, tx, roleGoal, g.ID, g, ErrGoalNotFound); err != nil {
			return err
		}
		out = g
		return nil
	})
	if err != nil {
		return models.Goal{}, fmt.Errorf("UpdateGoal: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteGoal(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findGoal(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}

		objectivesOfGoal := "objective_id in (select id from " + m.table(roleObjective) + " where draft_id = ? and goal_id = ?)"
		for _, role := range []string{roleWorkflowObjective, roleMeasure} {
			if err := m.deleteInDraft(ctx, tx, role, existing.DraftID, objectivesOfGoal, existing.DraftID, id); err != nil {
				return err
			}
		}
		if err := m.deleteInDraft(ctx, tx, roleObjective, existing.DraftID, "goal_id = ?", id); err != nil {
			return err
		}
		return m.deleteWhere(ctx, tx, roleGoal, "id = ?", id)
	})
	if err != nil {
		return fmt.Errorf("DeleteGoal: %w", err)
	}
	return nil
}

func (m *agencyManager) findGoal(ctx context.Context, tx *gorm.DB, id string) (models.Goal, error) {
	var g models.Goal
	if err := m.find(ctx, tx, roleGoal, id, &g, ErrGoalNotFound); err != nil {
		return models.Goal{}, err
	}
	return g, nil
}
