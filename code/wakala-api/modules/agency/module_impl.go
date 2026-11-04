package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) CreateModule(ctx context.Context, mod models.Module) (models.Module, error) {
	if err := m.validateOpenDraftID(ctx, mod.DraftID); err != nil {
		return models.Module{}, err
	}
	if mod.Code == "" {
		return models.Module{}, ErrInvalidModule
	}
	mod.ID = newID()
	mod.Deleted = false
	mod.CreatedAt = models.NowRFC3339()
	mod.LastUpdated = mod.CreatedAt

	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := scopeQuery(tx.Table(m.table(roleModule)), mod.DraftID).
			Where("code = ?", mod.Code).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrDuplicateModule
		}
		return duplicateOr(m.copyRow(ctx, tx, roleModule, mod), ErrDuplicateModule)
	})
	if err != nil {
		return models.Module{}, fmt.Errorf("CreateModule: %w", err)
	}
	return m.GetModule(ctx, mod.ID)
}

func (m *agencyManager) GetModule(ctx context.Context, id string) (models.Module, error) {
	mod, err := m.findModule(ctx, m.db, id)
	if err != nil {
		return models.Module{}, err
	}
	siblings, err := m.effectiveModules(ctx, mod.DraftID)
	if err != nil {
		return models.Module{}, fmt.Errorf("GetModule: %w", err)
	}
	for _, effective := range siblings {
		if effective.ID == mod.ID {
			return withEffectiveMounts(effective), nil
		}
	}
	return withEffectiveMounts(mod), nil
}

func (m *agencyManager) ListModules(ctx context.Context, draftID string, filter ModuleFilter) ([]models.Module, error) {
	q := scopeQuery(m.q(ctx, roleModule), draftID)
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "name", filter.Name)
	q = likeFilter(q, "description", filter.Description)

	modules, err := list[models.Module](m, q, roleModule)
	if err != nil {
		return nil, fmt.Errorf("ListModules: %w", err)
	}
	effective, err := m.effectiveModules(ctx, draftID)
	if err != nil {
		return nil, fmt.Errorf("ListModules: %w", err)
	}
	byID := make(map[string]models.Module, len(effective))
	for _, mod := range effective {
		byID[mod.ID] = mod
	}

	out := make([]models.Module, 0, len(modules))
	for _, mod := range modules {
		mod = byID[mod.ID]
		if filter.Enabled != nil && mod.Enabled != *filter.Enabled {
			continue
		}
		out = append(out, withEffectiveMounts(mod))
	}
	return out, nil
}

func (m *agencyManager) SetModuleEnabled(ctx context.Context, draftID, id string, enabled bool) (models.Module, error) {
	current, err := m.findModule(ctx, m.db, id)
	if err != nil {
		return models.Module{}, fmt.Errorf("SetModuleEnabled: %w", err)
	}
	if current.DraftID != draftID {
		return models.Module{}, fmt.Errorf("SetModuleEnabled: %w", ErrModuleNotFound)
	}
	if err := m.validateOpenDraftID(ctx, current.DraftID); err != nil {
		return models.Module{}, fmt.Errorf("SetModuleEnabled: %w", err)
	}
	err = m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		mod, err := m.findModule(ctx, tx, id)
		if err != nil {
			return err
		}
		if mod.Locked && !enabled {
			return ErrModuleLocked
		}
		mod.Enabled = enabled
		mod.LastUpdated = models.NowRFC3339()
		return m.writeUpdate(ctx, tx, roleModule, id, mod, ErrModuleNotFound, "draft_id", "code", "created_at")
	})
	if err != nil {
		return models.Module{}, fmt.Errorf("SetModuleEnabled: %w", err)
	}
	return m.GetModule(ctx, id)
}

func (m *agencyManager) effectiveModules(ctx context.Context, draftID string) ([]models.Module, error) {
	modules, err := list[models.Module](m, scopeQuery(m.q(ctx, roleModule), draftID), roleModule)
	if err != nil {
		return nil, err
	}
	kinds, err := m.draftStepKinds(ctx, m.db, draftID)
	if err != nil {
		return nil, err
	}
	return withEffectiveEnabled(modules, kinds), nil
}

func (m *agencyManager) draftStepKinds(ctx context.Context, tx *gorm.DB, draftID string) (map[models.StepKind]bool, error) {
	var raw []string
	if err := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkItem)), draftID).
		Where("deleted = ?", false).Distinct("kind").Pluck("kind", &raw).Error; err != nil {
		return nil, err
	}
	kinds := make(map[models.StepKind]bool, len(raw))
	for _, kind := range raw {
		kinds[models.StepKind(kind)] = true
	}
	return kinds, nil
}

func withEffectiveEnabled(modules []models.Module, kinds map[models.StepKind]bool) []models.Module {
	needed := models.ModulesNeededBySteps(kinds)
	direct := make(map[string]bool, len(modules))
	for _, mod := range modules {
		direct[mod.Code] = mod.Locked || mod.Enabled || needed[mod.Code]
	}
	closed := models.WithRequiredModules(direct)
	out := make([]models.Module, 0, len(modules))
	for _, mod := range modules {
		mod.Explicit = mod.Enabled
		mod.NeededBySteps = needed[mod.Code]
		mod.Enabled = mod.Locked || closed[mod.Code]
		out = append(out, mod)
	}
	return out
}

func (m *agencyManager) findModule(ctx context.Context, tx *gorm.DB, id string) (models.Module, error) {
	var mod models.Module
	if err := m.find(ctx, tx, roleModule, id, &mod, ErrModuleNotFound); err != nil {
		return models.Module{}, err
	}
	return mod, nil
}
