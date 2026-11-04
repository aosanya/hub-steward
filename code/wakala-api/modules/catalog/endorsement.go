package mwanachamacatalog

import (
	"context"

	"gorm.io/gorm/clause"
)

func (m *catalogManager) countsEndorsements() bool {
	_, counted := m.st.Spec().ByRole(roleEndorsement)
	return counted
}

func (m *catalogManager) Endorse(ctx context.Context, subjectID, holderID string) (int, error) {
	if !m.countsEndorsements() {
		return 0, ErrEndorsementsNotCounted
	}
	if subjectID == "" || holderID == "" {
		return 0, ErrInvalidEndorsement
	}
	row, err := encode(m.st.Object(roleEndorsement), Endorsement{SubjectID: subjectID, HolderID: holderID, CreatedAt: m.now()})
	if err != nil {
		return 0, err
	}
	if err := m.q(ctx, roleEndorsement).Clauses(clause.OnConflict{DoNothing: true}).Create(row).Error; err != nil {
		return 0, err
	}
	return m.CountEndorsements(ctx, subjectID)
}

func (m *catalogManager) CountEndorsements(ctx context.Context, subjectID string) (int, error) {
	if !m.countsEndorsements() {
		return 0, ErrEndorsementsNotCounted
	}
	if subjectID == "" {
		return 0, ErrInvalidEndorsement
	}
	var n int64
	err := m.q(ctx, roleEndorsement).Where("subject_id = ?", subjectID).Count(&n).Error
	return int(n), err
}
