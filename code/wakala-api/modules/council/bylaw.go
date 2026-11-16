package mwanachamacouncil

import (
	"context"
	"fmt"
	"strings"

	"wakalaserver/modules/council/models"
	"wakalaserver/modules/shared/specstore"
)

const roleBylaw = "bylaw"

const (
	firstBylawYear = 1000
	lastBylawYear  = 9999
)

type Bylaw = models.Bylaw

type BylawFilter struct {
	InstanceID string `query:"instance_id"`
	Year       int64  `query:"year"`
}

type BylawKey struct {
	InstanceID string `query:"instance_id"`
	ID         string `query:"id"`
}

func (m *councilManager) CreateBylaw(ctx context.Context, in models.Bylaw) (models.Bylaw, error) {
	in.ID = ""
	in.CreatedAt = ""
	in.Title = strings.TrimSpace(in.Title)
	in.Text = strings.TrimSpace(in.Text)
	if err := check(m.st.Object(roleBylaw), in); err != nil {
		return models.Bylaw{}, fmt.Errorf("%w: %s", ErrInvalidBylaw, err)
	}
	if in.Year < firstBylawYear || in.Year > lastBylawYear {
		return models.Bylaw{}, fmt.Errorf("%w: year must be a four-digit year", ErrInvalidBylaw)
	}
	in.ID = newID()
	in.CreatedAt = formatTime(m.clock())

	if err := m.st.Insert(ctx, roleBylaw, in); err != nil {
		return models.Bylaw{}, fmt.Errorf("CreateBylaw: %w", err)
	}
	return in, nil
}

func (m *councilManager) ListBylaws(ctx context.Context, filter BylawFilter) ([]models.Bylaw, error) {
	if filter.InstanceID == "" {
		return nil, fmt.Errorf("%w: instance_id is required", ErrInvalidBylaw)
	}
	q := m.st.Query(ctx, roleBylaw).Where("instance_id = ?", filter.InstanceID)
	if filter.Year != 0 {
		q = q.Where("year = ?", filter.Year)
	}
	out, err := specstore.List[models.Bylaw](m.st, q.Order("year asc").Order("title asc").Order("created_at asc"), roleBylaw)
	if err != nil {
		return nil, fmt.Errorf("ListBylaws: %w", err)
	}
	return out, nil
}

func (m *councilManager) GetBylaw(ctx context.Context, key BylawKey) (models.Bylaw, error) {
	if key.InstanceID == "" {
		return models.Bylaw{}, fmt.Errorf("%w: instance_id is required", ErrInvalidBylaw)
	}
	if key.ID == "" {
		return models.Bylaw{}, fmt.Errorf("%w: the bylaw id is required", ErrInvalidBylaw)
	}
	var out models.Bylaw
	q := m.st.Query(ctx, roleBylaw).Where("id = ? AND instance_id = ?", key.ID, key.InstanceID)
	if err := m.st.Take(q, roleBylaw, &out, ErrBylawNotFound); err != nil {
		if err == ErrBylawNotFound {
			return models.Bylaw{}, err
		}
		return models.Bylaw{}, fmt.Errorf("GetBylaw: %w", err)
	}
	return out, nil
}
