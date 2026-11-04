package mwanachamaagency

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) actorOfDraft(ctx context.Context, tx *gorm.DB, draftID, id string) error {
	var r models.Role
	q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleRole)), draftID).Where("id = ?", id)
	err := m.take(q, roleRole, &r, ErrRoleNotFound)
	if err == nil || !errors.Is(err, ErrRoleNotFound) {
		return err
	}
	groups, gerr := m.groupIDs(ctx)
	if gerr != nil {
		return gerr
	}
	if groups[id] {
		return nil
	}
	return err
}

func (m *agencyManager) groupIDs(ctx context.Context) (map[string]bool, error) {
	if m.groups == nil {
		return nil, nil
	}
	groups, err := m.groups(ctx)
	if err != nil {
		return nil, fmt.Errorf("the groups: %w", err)
	}
	ids := make(map[string]bool, len(groups))
	for _, g := range groups {
		ids[g.ID] = true
	}
	return ids, nil
}

func (s *issueScan) addGroupIDs(ids map[string]bool) error {
	for id := range s.groups {
		ids[id] = true
	}
	return nil
}
