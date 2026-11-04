package mwanachamaagency

import (
	"context"
	"fmt"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) CreateThreat(ctx context.Context, p models.Threat) (models.Threat, error) {
	out, err := m.createPart(ctx, threatKind, models.Hazard(p))
	if err != nil {
		return models.Threat{}, fmt.Errorf("CreateThreat: %w", err)
	}
	return models.Threat(out), nil
}

func (m *agencyManager) GetThreat(ctx context.Context, id string) (models.Threat, error) {
	out, err := m.findPart(ctx, m.db, threatKind, id)
	if err != nil {
		return models.Threat{}, err
	}
	return models.Threat(out), nil
}

func (m *agencyManager) ListThreats(ctx context.Context, draftID string, filter LibraryPartFilter) ([]models.Threat, error) {
	rows, err := m.listParts(ctx, threatKind, draftID, filter)
	if err != nil {
		return nil, fmt.Errorf("ListThreats: %w", err)
	}
	out := make([]models.Threat, len(rows))
	for i, r := range rows {
		out[i] = models.Threat(r)
	}
	return out, nil
}

func (m *agencyManager) UpdateThreat(ctx context.Context, p models.Threat) (models.Threat, error) {
	out, err := m.updatePart(ctx, threatKind, models.Hazard(p))
	if err != nil {
		return models.Threat{}, fmt.Errorf("UpdateThreat: %w", err)
	}
	return models.Threat(out), nil
}

func (m *agencyManager) DeleteThreat(ctx context.Context, id string) error {
	if err := m.deletePart(ctx, threatKind, id); err != nil {
		return fmt.Errorf("DeleteThreat: %w", err)
	}
	return nil
}
