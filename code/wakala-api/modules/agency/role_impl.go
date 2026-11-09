package mwanachamaagency

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) CreateRole(ctx context.Context, r models.Role) (models.Role, error) {
	if r.Name == "" {
		return models.Role{}, fmt.Errorf("%w: Role.Name is required", ErrInvalidRole)
	}
	if err := m.validateOpenDraftID(ctx, r.DraftID); err != nil {
		return models.Role{}, err
	}
	r.Permissions = models.DistinctPermissions(r.Permissions)
	r.ID = newID()
	r.Deleted = false
	r.CreatedAt = models.NowRFC3339()
	r.LastUpdated = r.CreatedAt

	err := m.createWithCode(ctx, roleRole, "role", "R", func(code string) any {
		r.Code = code
		return r
	})
	if err != nil {
		return models.Role{}, fmt.Errorf("CreateRole: %w", err)
	}
	return r, nil
}

func (m *agencyManager) GetRole(ctx context.Context, id string) (models.Role, error) {
	return m.findRole(ctx, m.db, id)
}

func (m *agencyManager) ListRoles(ctx context.Context, draftID string, filter RoleFilter) ([]models.Role, error) {
	q := scopeQuery(m.q(ctx, roleRole), draftID)
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "name", filter.Name)
	q = likeFilter(q, "description", filter.Description)

	out, err := list[models.Role](m, q, roleRole)
	if err != nil {
		return nil, fmt.Errorf("ListRoles: %w", err)
	}
	return out, nil
}

func (m *agencyManager) UpdateRole(ctx context.Context, r models.Role) (models.Role, error) {
	if !r.FromRequest() && r.Name == "" {
		return models.Role{}, fmt.Errorf("%w: Role.Name is required", ErrInvalidRole)
	}
	var out models.Role
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRole(ctx, tx, r.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		if !r.Carries("name") {
			r.Name = existing.Name
		}
		if !r.Carries("description") {
			r.Description = existing.Description
		}
		if !r.Carries("permissions") {
			r.Permissions = existing.Permissions
		}
		if !r.Carries("staff") {
			r.Staff = existing.Staff
		}
		if r.Name == "" {
			return fmt.Errorf("%w: Role.Name is required", ErrInvalidRole)
		}
		r.Code = existing.Code
		r.DraftID = existing.DraftID
		r.Permissions = models.DistinctPermissions(r.Permissions)
		r.CreatedAt = existing.CreatedAt
		r.LastUpdated = models.NowRFC3339()

		if err := m.writeUpdate(ctx, tx, roleRole, r.ID, r, ErrRoleNotFound, "draft_id"); err != nil {
			return err
		}
		out = r
		return m.sendBack(ctx, tx, existing.DraftID, usageKey("role", existing.Code))
	})
	if err != nil {
		return models.Role{}, fmt.Errorf("UpdateRole: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteRole(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRole(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		if err := m.refuseRoleHeldByScenario(ctx, tx, existing); err != nil {
			return err
		}
		if err := m.sendBack(ctx, tx, existing.DraftID, usageKey("role", existing.Code)); err != nil {
			return err
		}
		if err := m.deleteWhere(ctx, tx, roleRoleAssignment, "role_id = ?", id); err != nil {
			return err
		}
		return m.deleteWhere(ctx, tx, roleRole, "id = ?", id)
	})
	if err != nil {
		return fmt.Errorf("DeleteRole: %w", err)
	}
	return nil
}

func (m *agencyManager) findRole(ctx context.Context, tx *gorm.DB, id string) (models.Role, error) {
	var r models.Role
	err := m.find(ctx, tx, roleRole, id, &r, ErrRoleNotFound)
	if errors.Is(err, ErrRoleNotFound) {
		return models.Role{}, m.roleNotFoundError(ctx, tx, id)
	}
	if err != nil {
		return models.Role{}, err
	}
	return r, nil
}

func (m *agencyManager) roleNotFoundError(ctx context.Context, tx *gorm.DB, id string) error {
	pattern := "%" + likeEscaper.Replace(strings.ToLower(id)) + "%"
	q := tx.WithContext(ctx).Table(m.table(roleRole)).
		Where("LOWER(code) LIKE ? ESCAPE '\\' OR LOWER(name) LIKE ? ESCAPE '\\'", pattern, pattern)

	matches, err := list[models.Role](m, q, roleRole)
	if err != nil || len(matches) == 0 {
		return ErrRoleNotFound
	}
	hints := make([]string, len(matches))
	for i, r := range matches {
		hints[i] = fmt.Sprintf("%s %q (id: %s)", r.Code, r.Name, r.ID)
	}
	return fmt.Errorf("%w: no role with id %q — did you mean one of: %s", ErrRoleNotFound, id, strings.Join(hints, "; "))
}
