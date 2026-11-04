package sources

import (
	"context"
	"fmt"
	"strings"

	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/sources/models"
)

func (m *sourceManager) Verify(ctx context.Context, in Verification) (Verification, error) {
	if strings.TrimSpace(in.VerifiedBy) == "" {
		return Verification{}, ErrUnverifiedCaller
	}
	if err := m.checks(roleVerification, in, ErrInvalidVerification); err != nil {
		return Verification{}, err
	}
	if err := m.subjectExists(ctx, in.SubjectRole, in.SubjectID); err != nil {
		return Verification{}, err
	}

	profile, err := m.profileOf(ctx, in.VerifiedBy)
	if err != nil {
		return Verification{}, fmt.Errorf("Verify: %w", err)
	}
	in.VerifierName = profile.Name
	in.VerifierRole = profile.Role
	in.ID = newID()
	in.CreatedAt = m.now()

	if err := m.st.Insert(ctx, roleVerification, in); err != nil {
		return Verification{}, fmt.Errorf("Verify: %w", err)
	}
	return in, nil
}

func (m *sourceManager) ListVerifications(ctx context.Context, filter VerificationFilter) ([]Verification, error) {
	q := m.st.Query(ctx, roleVerification)
	if filter.SubjectRole != "" {
		q = q.Where("subject_role = ?", filter.SubjectRole)
	}
	if filter.SubjectID != "" {
		q = q.Where("subject_id = ?", filter.SubjectID)
	}
	out, err := specstore.List[Verification](m.st, q.Order("created_at desc"), roleVerification)
	if err != nil {
		return nil, fmt.Errorf("ListVerifications: %w", err)
	}
	return out, nil
}

func (m *sourceManager) standing(ctx context.Context, subjectRole, subjectID string) (*Verification, error) {
	held, err := m.ListVerifications(ctx, VerificationFilter{SubjectRole: subjectRole, SubjectID: subjectID})
	if err != nil || len(held) == 0 {
		return nil, err
	}
	return &held[0], nil
}

func (m *sourceManager) subjectExists(ctx context.Context, subjectRole, subjectID string) error {
	switch subjectRole {
	case models.SubjectSource:
		_, err := m.GetSource(ctx, subjectID)
		return err
	case models.SubjectAnnotation:
		_, err := m.GetAnnotation(ctx, subjectID)
		return err
	}
	return fmt.Errorf("%w: subject_role %q", ErrInvalidVerification, subjectRole)
}

func (m *sourceManager) profileOf(ctx context.Context, actorID string) (Profile, error) {
	if m.profiles == nil {
		return Profile{}, nil
	}
	return m.profiles(ctx, actorID)
}
