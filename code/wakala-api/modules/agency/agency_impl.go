package mwanachamaagency

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) CreateAgency(ctx context.Context, a models.Agency) (models.Agency, error) {
	a.ID = newID()
	a.Deleted = false
	a.CreatedAt = models.NowRFC3339()
	a.LastUpdated = a.CreatedAt
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		_, err := m.findAgency(ctx, tx)
		if err == nil {
			return ErrAgencyExists
		}
		if !errors.Is(err, ErrAgencyNotFound) {
			return err
		}
		return m.insertRow(ctx, tx, roleAgency, a)
	})
	if err != nil {
		return models.Agency{}, fmt.Errorf("CreateAgency: %w", err)
	}
	return a, nil
}

func (m *agencyManager) GetAgency(ctx context.Context) (models.Agency, error) {
	return m.findAgency(ctx, m.db)
}

func (m *agencyManager) UpdateAgency(ctx context.Context, a models.Agency) (models.Agency, error) {
	var out models.Agency
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findAgency(ctx, tx)
		if err != nil {
			return err
		}
		existing.Name = a.Name
		existing.Description = a.Description
		existing.LastUpdated = models.NowRFC3339()

		if err := m.writeUpdate(ctx, tx, roleAgency, existing.ID, existing, ErrAgencyNotFound,
			"enabled", "default_failure_pipeline_budget", "inactivity_timeout_seconds",
			"event_flows", "deleted"); err != nil {
			return err
		}
		out = existing
		return nil
	})
	if err != nil {
		return models.Agency{}, fmt.Errorf("UpdateAgency: %w", err)
	}
	return out, nil
}

func (m *agencyManager) findAgency(ctx context.Context, tx *gorm.DB) (models.Agency, error) {
	var a models.Agency
	q := tx.WithContext(ctx).Table(m.table(roleAgency)).Order("created_at")
	if err := m.take(q, roleAgency, &a, ErrAgencyNotFound); err != nil {
		return models.Agency{}, err
	}
	return a, nil
}
