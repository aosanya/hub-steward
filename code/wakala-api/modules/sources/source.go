package sources

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/specstore"
	"wakalaserver/modules/sources/models"
)

func (m *sourceManager) CreateSource(ctx context.Context, in Source) (Source, error) {
	if err := m.checks(roleSource, in, ErrInvalidSource); err != nil {
		return Source{}, err
	}
	in.ID = newID()
	in.CreatedAt = m.now()
	in.UpdatedAt = in.CreatedAt

	if err := m.st.Insert(ctx, roleSource, in); err != nil {
		return Source{}, fmt.Errorf("CreateSource: %w", err)
	}
	return in, nil
}

func (m *sourceManager) GetSource(ctx context.Context, sourceID string) (Source, error) {
	var out Source
	q := m.st.Query(ctx, roleSource).Where("id = ?", sourceID)
	if err := m.st.Take(q, roleSource, &out, ErrSourceNotFound); err != nil {
		return Source{}, err
	}
	return out, nil
}

func (m *sourceManager) ListSources(ctx context.Context, filter SourceFilter) ([]Source, error) {
	q := m.st.Query(ctx, roleSource)
	if filter.Kind != "" {
		q = q.Where("kind = ?", filter.Kind)
	}
	out, err := specstore.List[Source](m.st, q.Order("created_at desc"), roleSource)
	if err != nil {
		return nil, fmt.Errorf("ListSources: %w", err)
	}
	return out, nil
}

func (m *sourceManager) UpdateSource(ctx context.Context, in Source) (Source, error) {
	held, err := m.GetSource(ctx, in.ID)
	if err != nil {
		return Source{}, err
	}

	held.Title = in.Title
	held.Kind = in.Kind
	held.Citation = in.Citation
	held.Locator = in.Locator
	held.ContentRef = in.ContentRef
	held.IssuedOn = in.IssuedOn
	held.Properties = in.Properties
	held.UpdatedAt = m.now()

	if err := m.checks(roleSource, held, ErrInvalidSource); err != nil {
		return Source{}, err
	}
	if err := m.update(ctx, roleSource, held.ID, held); err != nil {
		return Source{}, fmt.Errorf("UpdateSource: %w", err)
	}
	return held, nil
}

func (m *sourceManager) DeleteSource(ctx context.Context, sourceID string) error {
	if _, err := m.GetSource(ctx, sourceID); err != nil {
		return err
	}
	var annotations int64
	if err := m.st.Query(ctx, roleAnnotation).Where("source_id = ?", sourceID).Count(&annotations).Error; err != nil {
		return fmt.Errorf("DeleteSource: %w", err)
	}
	if annotations > 0 {
		return fmt.Errorf("%w: %d annotation(s) rest on it", ErrSourceInUse, annotations)
	}
	err := m.st.Query(ctx, roleSource).Transaction(func(tx *gorm.DB) error {
		if err := tx.Table(m.st.Table(roleChunk)).Where("source_id = ?", sourceID).Delete(nil).Error; err != nil {
			return err
		}
		if err := tx.Table(m.st.Table(roleVerification)).Where("subject_role = ? AND subject_id = ?", models.SubjectSource, sourceID).Delete(nil).Error; err != nil {
			return err
		}
		return tx.Table(m.st.Table(roleSource)).Where("id = ?", sourceID).Delete(nil).Error
	})
	if err != nil {
		return fmt.Errorf("DeleteSource: %w", err)
	}
	return nil
}
