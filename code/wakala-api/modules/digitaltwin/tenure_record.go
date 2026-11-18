package digitaltwin

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const uuidLength = 36

func (m *twinManager) CreateTenure(ctx context.Context, t Tenure) (Tenure, error) {
	if t.Kind == "" {
		t.Kind = "owner"
	}
	if err := m.tenureFits(ctx, t); err != nil {
		return Tenure{}, err
	}
	t.ID = newID()
	t.CreatedAt = m.now()
	if err := m.insert(ctx, roleTenure, t); err != nil {
		return Tenure{}, err
	}
	return t, nil
}

func (m *twinManager) UpdateTenure(ctx context.Context, t Tenure) (Tenure, error) {
	held, err := m.GetTenure(ctx, t.ID)
	if err != nil {
		return Tenure{}, err
	}
	if t.Kind == "" {
		t.Kind = held.Kind
	}
	t.CreatedAt = held.CreatedAt
	if err := m.tenureFits(ctx, t); err != nil {
		return Tenure{}, err
	}
	if err := m.update(ctx, roleTenure, "id", t.ID, t); err != nil {
		return Tenure{}, err
	}
	return t, nil
}

func (m *twinManager) tenureFits(ctx context.Context, t Tenure) error {
	if err := m.checks(roleTenure, t); err != nil {
		return err
	}
	if _, err := m.GetNode(ctx, t.PlaceID); err != nil {
		if errors.Is(err, ErrNodeNotFound) {
			return fmt.Errorf("%w: place_id %q names no node", ErrInvalid, t.PlaceID)
		}
		return err
	}
	if t.HolderRecordRowID != "" {
		if _, err := uuid.Parse(t.HolderRecordRowID); err != nil || len(t.HolderRecordRowID) != uuidLength {
			return fmt.Errorf("%w: holder_record_row_id %q is not a record row id", ErrInvalid, t.HolderRecordRowID)
		}
	}
	if t.Since != "" && !isDate(t.Since) {
		return fmt.Errorf("%w: since must be RFC3339 or YYYY-MM-DD (%q given)", ErrInvalid, t.Since)
	}
	return nil
}

func (m *twinManager) GetTenure(ctx context.Context, id string) (Tenure, error) {
	var out Tenure
	err := m.take(m.q(ctx, roleTenure).Where("id = ?", id), roleTenure, &out, ErrTenureNotFound)
	return out, err
}

func (m *twinManager) ListTenures(ctx context.Context, filter TenureFilter) ([]Tenure, error) {
	q := m.q(ctx, roleTenure)
	if filter.PlaceID != "" {
		q = q.Where("place_id = ?", filter.PlaceID)
	}
	if filter.Holder != "" {
		q = q.Where("holder = ?", filter.Holder)
	}
	if filter.HolderActorID != "" {
		q = q.Where("holder_actor_id = ?", filter.HolderActorID)
	}
	if len(filter.HolderRecordRowIDs) > 0 {
		q = q.Where("holder_record_row_id IN ?", filter.HolderRecordRowIDs)
	} else if filter.HolderRecordRowID != "" {
		q = q.Where("holder_record_row_id = ?", filter.HolderRecordRowID)
	}
	if filter.Kind != "" {
		q = q.Where("kind = ?", filter.Kind)
	}
	return listOf[Tenure](m, q.Order("created_at").Limit(capped(filter.Limit)), roleTenure)
}

func isDate(s string) bool {
	if _, err := time.Parse(time.RFC3339, s); err == nil {
		return true
	}
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}
