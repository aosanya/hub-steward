package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func ControlStrengthOf(ctx context.Context, mgr AgencyManager, draftID string, c models.Control) (models.ControlStrength, error) {
	for {
		switch m := mgr.(type) {
		case *agencyManager:
			return m.controlStrengthOf(ctx, draftID, c)
		case interface{ Unwrap() AgencyManager }:
			mgr = m.Unwrap()
		default:
			return "", fmt.Errorf("ControlStrengthOf: unsupported manager %T", mgr)
		}
	}
}

func (m *agencyManager) controlStrengthOf(ctx context.Context, draftID string, c models.Control) (models.ControlStrength, error) {
	if !c.Enforced() {
		return models.StrengthAdvisory, nil
	}
	covered, err := m.controlCovered(ctx, m.db, draftID, c.Code)
	if err != nil {
		return "", err
	}
	if covered {
		return models.StrengthTested, nil
	}
	return models.StrengthEnforced, nil
}

func (m *agencyManager) controlCovered(ctx context.Context, tx *gorm.DB, draftID, controlCode string) (bool, error) {
	var workflowCodes []string
	err := scopeQuery(tx.WithContext(ctx).Table(m.table(roleControlAttachment)), draftID).
		Where("control_code = ? AND target_type = ?", controlCode, string(models.TargetTypeWorkflow)).
		Pluck("target_code", &workflowCodes).Error
	if err != nil || len(workflowCodes) == 0 {
		return false, err
	}
	var workflowIDs []string
	err = scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflow)), draftID).
		Where("code IN ?", workflowCodes).
		Pluck("id", &workflowIDs).Error
	if err != nil || len(workflowIDs) == 0 {
		return false, err
	}
	var passed int64
	err = scopeQuery(tx.WithContext(ctx).Table(m.table(roleScenario)), draftID).
		Where("workflow_id IN ? AND result = ?", workflowIDs, string(models.ScenarioPassed)).
		Count(&passed).Error
	return passed > 0, err
}
