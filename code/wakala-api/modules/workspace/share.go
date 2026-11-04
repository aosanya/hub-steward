package mwanachamaworkspace

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/workspace/models"
)

func (m *manager) IssueShare(ctx context.Context, workbookID, label, issuedBy string) (models.Share, string, error) {
	if strings.TrimSpace(workbookID) == "" {
		return models.Share{}, "", ErrInvalidShare
	}
	if _, err := m.GetWorkbook(ctx, workbookID); err != nil {
		return models.Share{}, "", err
	}

	raw, err := newKey()
	if err != nil {
		return models.Share{}, "", err
	}
	s := models.Share{
		ID:         newID(),
		WorkbookID: workbookID,
		KeyHash:    models.HashKey(raw),
		Label:      label,
		Status:     models.ShareStatusActive,
		IssuedBy:   issuedBy,
		IssuedAt:   models.NowRFC3339(),
	}
	row, err := encode(m.object(roleShare), s)
	if err != nil {
		return models.Share{}, "", err
	}
	if err := m.query(ctx, roleShare).Create(row).Error; err != nil {
		return models.Share{}, "", fmt.Errorf("workspace: issue share: %w", err)
	}
	return s, raw, nil
}

func newKey() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("workspace: mint key: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (m *manager) ListShares(ctx context.Context, workbookID string) ([]models.Share, error) {
	q := m.query(ctx, roleShare).
		Where(columnName("WorkbookID")+" = ?", workbookID).
		Order(columnName("IssuedAt") + " desc")

	out := []models.Share{}
	err := m.rows(ctx, roleShare, q, func(row map[string]any) error {
		var s models.Share
		if err := decode(m.object(roleShare), row, &s); err != nil {
			return err
		}
		out = append(out, s)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("workspace: list shares: %w", err)
	}
	return out, nil
}

func (m *manager) RetireShare(ctx context.Context, shareID string) error {
	var row map[string]any
	err := m.query(ctx, roleShare).Where(columnName("ID")+" = ?", shareID).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrShareNotFound
	}
	if err != nil {
		return fmt.Errorf("workspace: read share: %w", err)
	}
	err = m.query(ctx, roleShare).
		Where(columnName("ID")+" = ?", shareID).
		Updates(map[string]any{
			columnName("Status"):    string(models.ShareStatusRetired),
			columnName("RetiredAt"): models.NowRFC3339(),
		}).Error
	if err != nil {
		return fmt.Errorf("workspace: retire share: %w", err)
	}
	return nil
}

func (m *manager) OpenWithKey(ctx context.Context, workbookID, key string) (models.Workbook, error) {
	if key == "" {
		return models.Workbook{}, ErrWorkbookNotFound
	}
	var held int64
	err := m.query(ctx, roleShare).
		Where(columnName("WorkbookID")+" = ?", workbookID).
		Where(columnName("KeyHash")+" = ?", models.HashKey(key)).
		Where(columnName("Status")+" = ?", string(models.ShareStatusActive)).
		Count(&held).Error
	if err != nil {
		return models.Workbook{}, fmt.Errorf("workspace: open with key: %w", err)
	}
	if held == 0 {
		return models.Workbook{}, ErrWorkbookNotFound
	}
	return m.GetWorkbook(ctx, workbookID)
}
