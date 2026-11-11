package mwanachamacatalog

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/catalog/models"
)

func (m *catalogManager) links(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleShareLink)
}

func (m *catalogManager) IssueShareLink(ctx context.Context, slug, label, by string) (ShareLink, string, error) {
	if len(label) > models.MaxShareLabelBytes {
		return ShareLink{}, "", ErrInvalidShareLink
	}
	if err := plainText(ErrInvalidShareLink, "label", label); err != nil {
		return ShareLink{}, "", err
	}
	entry, err := m.findEntry(ctx, slug)
	if err != nil {
		return ShareLink{}, "", err
	}
	if entry.Visibility != models.VisibilityPrivate {
		return ShareLink{}, "", ErrNotPrivate
	}

	raw, err := newShareKey()
	if err != nil {
		return ShareLink{}, "", err
	}

	link := models.ShareLink{
		ID:        newID(),
		Slug:      slug,
		KeyHash:   models.HashKey(raw),
		Label:     label,
		Status:    models.LinkStatusActive,
		CreatedBy: by,
		CreatedAt: m.now(),
	}
	if err := m.insert(ctx, roleShareLink, link); err != nil {
		return ShareLink{}, "", err
	}
	if err := m.retireIfNoLongerPrivate(ctx, link); err != nil {
		return ShareLink{}, "", err
	}
	return link, raw, nil
}

func (m *catalogManager) retireIfNoLongerPrivate(ctx context.Context, link models.ShareLink) error {
	current, err := m.findEntry(ctx, link.Slug)
	if err == nil && current.Visibility == models.VisibilityPrivate {
		return nil
	}
	if retireErr := m.retireLinksFor(ctx, link.Slug, m.now()); retireErr != nil {
		return retireErr
	}
	if err != nil {
		return err
	}
	return ErrNotPrivate
}

func (m *catalogManager) RetireShareLink(ctx context.Context, id string) (ShareLink, error) {
	var link ShareLink
	err := m.take(m.links(ctx).Where("id = ?", id), roleShareLink, &link, ErrShareLinkNotFound)
	if err != nil {
		return ShareLink{}, err
	}
	if link.Status == models.LinkStatusRetired {
		return link, nil
	}

	now := m.now()
	if err := m.links(ctx).Where("id = ?", id).Updates(map[string]any{
		"status": string(models.LinkStatusRetired), "retired_at": now,
	}).Error; err != nil {
		return ShareLink{}, err
	}
	link.Status, link.RetiredAt = models.LinkStatusRetired, now
	return link, nil
}

func (m *catalogManager) ListShareLinks(ctx context.Context, slug string) ([]ShareLink, error) {
	if _, err := m.findEntry(ctx, slug); err != nil {
		return nil, err
	}
	return listOf[ShareLink](m, m.links(ctx).Where("slug = ?", slug).Order("created_at DESC, id DESC"), roleShareLink)
}

// keyOpens reports whether raw is a live key for slug. It matches on the
// hash, so the raw key never has to be stored to be checked.
func (m *catalogManager) keyOpens(ctx context.Context, slug, raw string) (bool, error) {
	var n int64
	err := m.links(ctx).
		Where("slug = ? AND key_hash = ? AND status = ?",
			slug, models.HashKey(raw), string(models.LinkStatusActive)).
		Count(&n).Error
	return n > 0, err
}

// retireLinksFor retires every live key for slug.
func (m *catalogManager) retireLinksFor(ctx context.Context, slug, now string) error {
	return m.links(ctx).
		Where("slug = ? AND status = ?", slug, string(models.LinkStatusActive)).
		Updates(map[string]any{
			"status": string(models.LinkStatusRetired), "retired_at": now,
		}).Error
}

// newShareKey mints 32 bytes of randomness, hex-encoded — the same 64-char
// shape the mining token already uses.
func newShareKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("newShareKey: %w", err)
	}
	return hex.EncodeToString(b), nil
}
