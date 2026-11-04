package mwanachamapermissions

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wakalaserver/modules/permissions/models"
)

func (m *manager) SetPermissionDefinition(ctx context.Context, p models.Permission) (models.Permission, error) {
	p.Layer, p.SetBy = models.PermissionLayerDefinition, ""
	return m.putPermission(ctx, p)
}

func (m *manager) OverridePermission(ctx context.Context, p models.Permission) (models.Permission, error) {
	if p.SetBy == "" {
		return models.Permission{}, ErrInvalidPermission
	}
	p.Layer = models.PermissionLayerOverride
	return m.putPermission(ctx, p)
}

func (m *manager) ClearPermissionOverride(ctx context.Context, partition, permission, roleKind string) error {
	if !m.permissionsDeclared() {
		return ErrPermissionsNotDeclared
	}
	if err := checkPermissionKey(partition, permission, roleKind); err != nil {
		return err
	}
	err := m.query(ctx, rolePermission).
		Where(keyOfPermission(), partition, permission, roleKind, models.PermissionLayerOverride).
		Delete(map[string]any{}).Error
	if err != nil {
		return fmt.Errorf("permissions: clear permission override: %w", err)
	}
	return nil
}

func (m *manager) ReadPermission(ctx context.Context, partition, permission, roleKind string) (models.Permission, error) {
	if !m.permissionsDeclared() {
		return models.Permission{}, ErrPermissionsNotDeclared
	}
	if err := checkPermissionKey(partition, permission, roleKind); err != nil {
		return models.Permission{}, err
	}
	for _, layer := range []models.PermissionLayer{models.PermissionLayerOverride, models.PermissionLayerDefinition} {
		p, err := m.findPermission(ctx, partition, permission, roleKind, layer)
		if err == nil {
			return p, nil
		}
		if !errors.Is(err, ErrPermissionNotFound) {
			return models.Permission{}, err
		}
	}
	return models.Permission{}, ErrPermissionNotFound
}

func (m *manager) putPermission(ctx context.Context, p models.Permission) (models.Permission, error) {
	if !m.permissionsDeclared() {
		return models.Permission{}, ErrPermissionsNotDeclared
	}
	if err := checkPermissionKey(p.Partition, p.Permission, p.RoleKind); err != nil {
		return models.Permission{}, err
	}
	p.SetAt = models.NowRFC3339()
	row, err := encode(m.object(rolePermission), p)
	if err != nil {
		return models.Permission{}, err
	}
	err = m.query(ctx, rolePermission).Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: columnName("Partition")}, {Name: columnName("Permission")},
			{Name: columnName("RoleKind")}, {Name: columnName("Layer")},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			columnName("Held"), columnName("SetBy"), columnName("SetAt"),
		}),
	}).Create(row).Error
	if err != nil {
		return models.Permission{}, fmt.Errorf("permissions: set permission: %w", err)
	}
	return p, nil
}

func (m *manager) findPermission(ctx context.Context, partition, permission, roleKind string, layer models.PermissionLayer) (models.Permission, error) {
	var row map[string]any
	err := m.query(ctx, rolePermission).
		Where(keyOfPermission(), partition, permission, roleKind, layer).
		Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Permission{}, ErrPermissionNotFound
	}
	if err != nil {
		return models.Permission{}, fmt.Errorf("permissions: read permission: %w", err)
	}
	var out models.Permission
	if err := decode(m.object(rolePermission), row, &out); err != nil {
		return models.Permission{}, err
	}
	return out, nil
}

func keyOfPermission() string {
	return columnName("Partition") + " = ? and " +
		columnName("Permission") + " = ? and " +
		columnName("RoleKind") + " = ? and " +
		columnName("Layer") + " = ?"
}

func checkPermissionKey(partition, permission, roleKind string) error {
	if partition == "" || !isPartition(partition) {
		return ErrInvalidPartition
	}
	if !isCode(permission) || !isCode(roleKind) {
		return ErrInvalidPermission
	}
	return nil
}

func (m *manager) permissionsDeclared() bool {
	_, ok := m.spec.ByRole(rolePermission)
	return ok
}

func (m *manager) ListPermissions(ctx context.Context, partition string) ([]models.Permission, error) {
	if !m.permissionsDeclared() {
		return nil, ErrPermissionsNotDeclared
	}
	if partition == "" || !isPartition(partition) {
		return nil, ErrInvalidPartition
	}
	var rows []map[string]any
	err := m.query(ctx, rolePermission).
		Where(columnName("Partition")+" = ?", partition).
		Order(columnName("Permission") + ", " + columnName("RoleKind")).
		Find(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("permissions: list permissions: %w", err)
	}
	out := []models.Permission{}
	at := map[[2]string]int{}
	for _, row := range rows {
		var p models.Permission
		if err := decode(m.object(rolePermission), row, &p); err != nil {
			return nil, err
		}
		key := [2]string{p.Permission, p.RoleKind}
		i, seen := at[key]
		if !seen {
			at[key] = len(out)
			out = append(out, p)
			continue
		}
		if p.Layer == models.PermissionLayerOverride {
			out[i] = p
		}
	}
	return out, nil
}
