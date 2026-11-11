package mwanachamacatalog

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/catalog/models"
)

func nowRFC3339() string { return time.Now().UTC().Format(time.RFC3339) }

func (m *catalogManager) checkEntry(e *Entry) error {
	at, ok := models.NormalizePublishAt(e.PublishAt)
	if !ok {
		return ErrInvalidEntry
	}
	e.PublishAt = at
	disposeAt, ok := models.NormalizePublishAt(e.DisposeAt)
	if !ok {
		return ErrInvalidEntry
	}
	e.DisposeAt = disposeAt
	if err := m.checks(roleEntry, *e); err != nil {
		return ErrInvalidEntry
	}
	return nil
}

func (m *catalogManager) entries(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleEntry)
}

// findEntry reads one non-deleted Entry by slug.
func (m *catalogManager) findEntry(ctx context.Context, slug string) (Entry, error) {
	var e Entry
	err := m.take(
		m.entries(ctx).Where("slug = ? AND deleted = ?", slug, false),
		roleEntry, &e, ErrEntryNotFound)
	return e, err
}

func (m *catalogManager) CreateEntry(ctx context.Context, e Entry) (Entry, error) {
	e.Visibility = models.VisibilityPending
	e.ApprovedAt = ""
	if err := m.fillWard(ctx, &e); err != nil {
		return Entry{}, err
	}
	if err := m.checkEntry(&e); err != nil {
		return Entry{}, err
	}
	if err := m.checkKind(ctx, e.Doc); err != nil {
		return Entry{}, err
	}

	now := m.now()
	e.ID = newID()
	e.CreatedAt, e.UpdatedAt = now, now
	e.Deleted = false
	if err := m.insert(ctx, roleEntry, e); err != nil {
		if isUniqueViolation(err) {
			return Entry{}, ErrEntryExists
		}
		return Entry{}, err
	}
	return e, nil
}

func (m *catalogManager) UpsertEntry(ctx context.Context, e Entry) (Entry, error) {
	existing, err := m.findEntry(ctx, e.Slug)
	if errors.Is(err, ErrEntryNotFound) {
		e.PublishAt = ""
		return m.CreateEntry(ctx, e)
	}
	if err != nil {
		return Entry{}, err
	}
	e.PublishAt = existing.PublishAt
	return m.rewriteEntry(ctx, existing, e)
}

func reviewedContentChanged(existing, sent Entry) bool {
	return !sameDocument(existing.Doc, sent.Doc) ||
		existing.Name != sent.Name ||
		existing.Summary != sent.Summary
}

func (m *catalogManager) rewriteEntry(ctx context.Context, existing, e Entry) (Entry, error) {
	if err := entryMayBeChangedBy(ctx, existing, e.SubmittedBy); err != nil {
		return Entry{}, err
	}
	if err := m.fillWard(ctx, &e); err != nil {
		return Entry{}, err
	}
	reviewReset := reviewedContentChanged(existing, e)
	e.Visibility, e.ApprovedAt = existing.Visibility, existing.ApprovedAt
	if reviewReset {
		e.Visibility = models.VisibilityPending
		e.ApprovedAt = ""
	}
	if err := m.checkEntry(&e); err != nil {
		return Entry{}, err
	}
	if err := m.checkKind(ctx, e.Doc); err != nil {
		return Entry{}, err
	}

	e.ID = existing.ID
	e.CreatedAt = existing.CreatedAt
	e.UpdatedAt = m.now()
	e.Deleted = false

	if err := m.replaceEntry(ctx, e, reviewReset); err != nil {
		return Entry{}, err
	}
	if reviewReset {
		if err := m.retireLinksFor(ctx, e.Slug, e.UpdatedAt); err != nil {
			return Entry{}, err
		}
	}
	return e, nil
}

func sameDocument(stored, sent string) bool {
	if stored == sent {
		return true
	}
	canonicalStored, ok := canonicalDocument(stored)
	if !ok {
		return false
	}
	canonicalSent, ok := canonicalDocument(sent)
	if !ok {
		return false
	}
	return canonicalStored == canonicalSent
}

func canonicalDocument(doc string) (string, bool) {
	dec := json.NewDecoder(strings.NewReader(doc))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return "", false
	}
	out, err := json.Marshal(v)
	if err != nil {
		return "", false
	}
	return string(out), true
}

func (m *catalogManager) replaceEntry(ctx context.Context, e Entry, reviewReset bool) error {
	row, err := encode(m.st.Object(roleEntry), e)
	if err != nil {
		return err
	}
	if !reviewReset {
		delete(row, "visibility")
		delete(row, "approved_at")
	}
	return m.entries(ctx).Where("id = ?", e.ID).Updates(row).Error
}

func (m *catalogManager) GetEntry(ctx context.Context, slug string) (Entry, error) {
	return m.findEntry(ctx, slug)
}

func (m *catalogManager) OpenEntry(ctx context.Context, slug, key string) (Entry, error) {
	keyed := false
	if key != "" {
		var err error
		if keyed, err = m.keyOpens(ctx, slug, key); err != nil {
			return Entry{}, err
		}
	}
	e, err := m.findEntry(ctx, slug)
	if err != nil {
		return Entry{}, err
	}
	if !e.PublishedBy(m.now()) {
		return Entry{}, ErrEntryNotFound
	}

	switch e.Visibility {
	case models.VisibilityPublic:
		return withoutWriter(e), nil
	case models.VisibilityPrivate:
		if !keyed {
			return Entry{}, ErrEntryNotFound
		}
		return withoutWriter(e), nil
	default:
		return Entry{}, ErrEntryNotFound
	}
}

func withoutWriter(e Entry) Entry {
	e.SubmittedBy = ""
	return e
}

func (m *catalogManager) UpdateEntry(ctx context.Context, e Entry) (Entry, error) {
	existing, err := m.findEntry(ctx, e.Slug)
	if err != nil {
		return Entry{}, err
	}
	if e.ID != "" && e.ID != existing.ID {
		return Entry{}, ErrSlugImmutable
	}
	return m.rewriteEntry(ctx, existing, e)
}

func (m *catalogManager) SetVisibility(ctx context.Context, slug string, v Visibility) (Entry, error) {
	if err := m.checksField(roleEntry, "visibility", string(v)); err != nil {
		return Entry{}, ErrInvalidEntry
	}
	existing, err := m.findEntry(ctx, slug)
	if err != nil {
		return Entry{}, err
	}

	now := m.now()
	approvedAt := now
	if v == models.VisibilityPending {
		approvedAt = ""
	}

	updates := map[string]any{
		"visibility":  string(v),
		"approved_at": approvedAt,
		"updated_at":  now,
	}
	if err := m.entries(ctx).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
		return Entry{}, err
	}

	if v != models.VisibilityPrivate {
		if err := m.retireLinksFor(ctx, slug, now); err != nil {
			return Entry{}, err
		}
	}
	return m.GetEntry(ctx, slug)
}

func (m *catalogManager) DeleteEntry(ctx context.Context, slug, deletedBy string) error {
	existing, err := m.findEntry(ctx, slug)
	if err != nil {
		return err
	}
	if err := entryMayBeChangedBy(ctx, existing, deletedBy); err != nil {
		return err
	}
	now := m.now()
	if err := m.entries(ctx).Where("id = ?", existing.ID).
		Updates(map[string]any{"deleted": true, "updated_at": now}).Error; err != nil {
		return err
	}
	if err := m.privates(ctx).Where("slug = ?", slug).Delete(&map[string]any{}).Error; err != nil {
		return err
	}
	return m.retireLinksFor(ctx, slug, now)
}

// isUniqueViolation reports whether err is a duplicate-key error. The two
// drivers word it differently and neither exposes a portable code through
// GORM.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	s := strings.ToLower(err.Error())
	return strings.Contains(s, "unique") || strings.Contains(s, "duplicate")
}
