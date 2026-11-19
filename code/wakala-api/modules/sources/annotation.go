package sources

import (
	"context"
	"fmt"

	"github.com/aosanya/mwanachama-backend-shared/specstore"
)

func (m *sourceManager) CreateAnnotation(ctx context.Context, in Annotation) (Annotation, error) {
	if err := m.checks(roleAnnotation, in, ErrInvalidAnnotation); err != nil {
		return Annotation{}, err
	}
	if _, err := m.GetSource(ctx, in.SourceID); err != nil {
		return Annotation{}, err
	}
	in.ID = newID()
	in.CreatedAt = m.now()

	if err := m.st.Insert(ctx, roleAnnotation, in); err != nil {
		return Annotation{}, fmt.Errorf("CreateAnnotation: %w", err)
	}
	return in, nil
}

func (m *sourceManager) GetAnnotation(ctx context.Context, annotationID string) (Annotation, error) {
	var out Annotation
	q := m.st.Query(ctx, roleAnnotation).Where("id = ?", annotationID)
	if err := m.st.Take(q, roleAnnotation, &out, ErrAnnotationNotFound); err != nil {
		return Annotation{}, err
	}
	return out, nil
}

func (m *sourceManager) ListAnnotations(ctx context.Context, filter AnnotationFilter) ([]Annotation, error) {
	q := m.st.Query(ctx, roleAnnotation)
	if filter.SourceID != "" {
		q = q.Where("source_id = ?", filter.SourceID)
	}
	if filter.TargetModule != "" {
		q = q.Where("target_module = ?", filter.TargetModule)
	}
	if filter.TargetID != "" {
		q = q.Where("target_id = ?", filter.TargetID)
	}
	out, err := specstore.List[Annotation](m.st, q.Order("created_at asc"), roleAnnotation)
	if err != nil {
		return nil, fmt.Errorf("ListAnnotations: %w", err)
	}
	return out, nil
}

func (m *sourceManager) DeleteAnnotation(ctx context.Context, annotationID string) error {
	if _, err := m.GetAnnotation(ctx, annotationID); err != nil {
		return err
	}
	return m.st.Query(ctx, roleAnnotation).Where("id = ?", annotationID).Delete(nil).Error
}
