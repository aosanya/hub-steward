package mwanachamaagency

import (
	"errors"
	"fmt"

	"gorm.io/gorm"
)

const (
	MaxDraftsPerAgency    = 40
	MaxDesignSpecEntities = 1000
)

var ErrLimitExceeded = errors.New("mwanachamaagency: limit exceeded")

func limitExceeded(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrLimitExceeded, fmt.Sprintf(format, args...))
}

func CheckDesignSpecSize(entities int) error {
	if entities > MaxDesignSpecEntities {
		return limitExceeded("a design spec may carry at most %d entities in one call, this one carries %d; send it in several calls", MaxDesignSpecEntities, entities)
	}
	return nil
}

func (m *agencyManager) checkDraftRoom(tx *gorm.DB) error {
	var held int64
	if err := tx.Table(m.table(roleDraft)).Count(&held).Error; err != nil {
		return fmt.Errorf("CreateDraft: %w", err)
	}
	if held >= MaxDraftsPerAgency {
		return limitExceeded("an agency may hold at most %d drafts, open or archived", MaxDraftsPerAgency)
	}
	return nil
}
