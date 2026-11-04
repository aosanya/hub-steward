package mwanachamaagency

import (
	"context"
	"fmt"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) CreateHazard(ctx context.Context, p models.Hazard) (models.Hazard, error) {
	out, err := m.createPart(ctx, hazardKind, models.Hazard(p))
	if err != nil {
		return models.Hazard{}, fmt.Errorf("CreateHazard: %w", err)
	}
	return models.Hazard(out), nil
}

func (m *agencyManager) GetHazard(ctx context.Context, id string) (models.Hazard, error) {
	out, err := m.findPart(ctx, m.db, hazardKind, id)
	if err != nil {
		return models.Hazard{}, err
	}
	return models.Hazard(out), nil
}

func (m *agencyManager) ListHazards(ctx context.Context, draftID string, filter LibraryPartFilter) ([]models.Hazard, error) {
	rows, err := m.listParts(ctx, hazardKind, draftID, filter)
	if err != nil {
		return nil, fmt.Errorf("ListHazards: %w", err)
	}
	out := make([]models.Hazard, len(rows))
	for i, r := range rows {
		out[i] = models.Hazard(r)
	}
	return out, nil
}

func (m *agencyManager) UpdateHazard(ctx context.Context, p models.Hazard) (models.Hazard, error) {
	out, err := m.updatePart(ctx, hazardKind, models.Hazard(p))
	if err != nil {
		return models.Hazard{}, fmt.Errorf("UpdateHazard: %w", err)
	}
	return models.Hazard(out), nil
}

func (m *agencyManager) DeleteHazard(ctx context.Context, id string) error {
	if err := m.deletePart(ctx, hazardKind, id); err != nil {
		return fmt.Errorf("DeleteHazard: %w", err)
	}
	return nil
}
