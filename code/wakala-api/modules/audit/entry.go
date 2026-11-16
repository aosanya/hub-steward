package mwanachamaaudit

import (
	"context"
	"fmt"
	"sync"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/audit/models"
	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"
)

type Entry = models.Entry

type EntryFilter struct {
	InstanceID string `query:"instance_id"`
}

type AuditManager interface {
	Record(ctx context.Context, instanceID, actor, action, subject string) (models.Entry, error)
	ListEntries(ctx context.Context, filter EntryFilter) ([]models.Entry, error)
}

type auditManager struct {
	st    *store
	clock Clock

	mu   sync.Mutex
	last time.Time
}

func NewAuditManager(db *gorm.DB, s *spec.Spec) (AuditManager, error) {
	return NewAuditManagerWithClock(db, s, SystemClock)
}

func NewAuditManagerWithClock(db *gorm.DB, s *spec.Spec, clock Clock) (AuditManager, error) {
	if db == nil {
		return nil, fmt.Errorf("NewAuditManager: db must not be nil")
	}
	if clock == nil {
		return nil, fmt.Errorf("NewAuditManager: clock must not be nil")
	}
	st, err := newStore(db, s, map[string]any{roleEntry: models.Entry{}})
	if err != nil {
		return nil, fmt.Errorf("NewAuditManager: %w", err)
	}
	return &auditManager{st: st, clock: clock}, nil
}

func (m *auditManager) Record(ctx context.Context, instanceID, actor, action, subject string) (models.Entry, error) {
	e := models.Entry{InstanceID: instanceID, Actor: actor, Action: action, Subject: subject}
	if err := check(m.st.Object(roleEntry), e); err != nil {
		return models.Entry{}, fmt.Errorf("%w: %s", ErrInvalidEntry, err)
	}
	e.ID = newID()
	e.At = formatTime(m.nextTime())

	if err := m.st.Insert(ctx, roleEntry, e); err != nil {
		return models.Entry{}, fmt.Errorf("Record: %w", err)
	}
	return e, nil
}

func (m *auditManager) nextTime() time.Time {
	m.mu.Lock()
	defer m.mu.Unlock()
	t := m.clock().UTC().Truncate(time.Nanosecond)
	if !t.After(m.last) {
		t = m.last.Add(time.Nanosecond)
	}
	m.last = t
	return t
}

func (m *auditManager) ListEntries(ctx context.Context, filter EntryFilter) ([]models.Entry, error) {
	if filter.InstanceID == "" {
		return nil, fmt.Errorf("%w: instance_id is required", ErrInvalidEntry)
	}
	q := m.st.Query(ctx, roleEntry).Where("instance_id = ?", filter.InstanceID)
	out, err := specstore.List[models.Entry](m.st, q.Order("at desc"), roleEntry)
	if err != nil {
		return nil, fmt.Errorf("ListEntries: %w", err)
	}
	return out, nil
}
