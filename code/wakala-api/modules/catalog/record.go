package mwanachamacatalog

import (
	"context"
	"encoding/json"
	"errors"

	"gorm.io/gorm"
)

func (m *catalogManager) keepsRecords() bool {
	_, kept := m.st.Spec().ByRole(roleRecord)
	return kept
}

func (m *catalogManager) records(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleRecord)
}

func (m *catalogManager) PutRecord(ctx context.Context, r Record) (Record, error) {
	if !m.keepsRecords() {
		return Record{}, ErrRecordsNotKept
	}
	if r.SubjectID == "" || r.HolderID == "" {
		return Record{}, ErrInvalidRecord
	}
	r.Changes = ""
	if err := m.checks(roleRecord, r); err != nil {
		return Record{}, ErrInvalidRecord
	}
	onePerHolder := m.onePerHolder(ctx)
	var out Record
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if onePerHolder {
			if err := m.refuseASecondStanding(tx, r); err != nil {
				return err
			}
		}
		var err error
		out, err = m.putRecord(ctx, tx, r)
		return err
	})
	return out, err
}

func (m *catalogManager) putRecord(ctx context.Context, tx *gorm.DB, r Record) (Record, error) {
	at := m.now()
	of := func() *gorm.DB {
		return tx.Table(m.st.Table(roleRecord)).Where("subject_id = ? AND holder_id = ? AND scope_id = ?", r.SubjectID, r.HolderID, r.ScopeID)
	}
	var existing Record
	err := m.take(of(), roleRecord, &existing, errNoRecord)
	switch {
	case errors.Is(err, errNoRecord):
		r.ID = newID()
		r.CreatedAt = at
		r.LastUpdated = at
		r.Changes = changesWith("", at)
		row, err := encode(m.st.Object(roleRecord), r)
		if err != nil {
			return Record{}, err
		}
		return r, tx.Table(m.st.Table(roleRecord)).Create(row).Error
	case err != nil:
		return Record{}, err
	}
	merged := existing
	merged.Doc = r.Doc
	merged.LastUpdated = at
	merged.Changes = changesWith(existing.Changes, at)
	row, err := encode(m.st.Object(roleRecord), merged)
	if err != nil {
		return Record{}, err
	}
	return merged, of().Updates(row).Error
}

func changesWith(stored, at string) string {
	var times []string
	if stored != "" {
		_ = json.Unmarshal([]byte(stored), &times)
	}
	raw, _ := json.Marshal(append(times, at))
	return string(raw)
}

func (m *catalogManager) ListRecords(ctx context.Context, subjectID, scopeID string) ([]Record, error) {
	if !m.keepsRecords() {
		return nil, ErrRecordsNotKept
	}
	if subjectID == "" {
		return nil, ErrInvalidRecord
	}
	q := m.records(ctx).Where("subject_id = ?", subjectID)
	if scopeID != "" {
		q = q.Where("scope_id = ?", scopeID)
	}
	return listOf[Record](m, q.Order("created_at, holder_id, scope_id"), roleRecord)
}

func (m *catalogManager) CountRecords(ctx context.Context, subjectID, scopeID string) ([]FieldTally, error) {
	records, err := m.ListRecords(ctx, subjectID, scopeID)
	if err != nil {
		return nil, err
	}
	return TallyRecords(records)
}

const SettingOneRecordPerHolder = "record.one_per_holder"

func (m *catalogManager) onePerHolder(ctx context.Context) bool {
	s, err := m.GetSetting(ctx, SettingOneRecordPerHolder)
	return err == nil && s.Value == "true"
}

func (m *catalogManager) refuseASecondStanding(tx *gorm.DB, r Record) error {
	var n int64
	err := tx.Table(m.st.Table(roleRecord)).
		Where("subject_id = ? AND holder_id = ? AND scope_id <> ?", r.SubjectID, r.HolderID, r.ScopeID).
		Count(&n).Error
	if err != nil {
		return err
	}
	if n > 0 {
		return ErrRecordHolderSpoke
	}
	return nil
}

var errNoRecord = errors.New("catalog: no record stored")
