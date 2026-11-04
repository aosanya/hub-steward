package mwanachamapermissions

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/permissions/models"
	"wakalaserver/modules/shared/spec"
)

type (
	Role        = models.Role
	RoleAction  = models.RoleAction
	Grant       = models.Grant
	RoleFilter  = models.RoleFilter
	GrantFilter = models.GrantFilter
	Permission  = models.Permission
)

const ScopeEverywhere = models.ScopeEverywhere

type PermissionsManager interface {
	CreateRole(ctx context.Context, r models.Role) (models.Role, error)
	GetRole(ctx context.Context, code string) (models.Role, error)
	ListRoles(ctx context.Context, f models.RoleFilter) ([]models.Role, error)
	UpdateRole(ctx context.Context, r models.Role) (models.Role, error)
	DeleteRole(ctx context.Context, code string) error

	AddAction(ctx context.Context, roleCode, action string) (models.RoleAction, error)
	RemoveAction(ctx context.Context, roleCode, action string) error
	ListActions(ctx context.Context, roleCode string) ([]models.RoleAction, error)
	SetActions(ctx context.Context, roleCode string, actions []string) ([]models.RoleAction, error)
	SeedActions(ctx context.Context, roleCode string, actions []string) ([]models.RoleAction, error)

	CreateGrant(ctx context.Context, g models.Grant) (models.Grant, error)
	ListGrants(ctx context.Context, f models.GrantFilter) ([]models.Grant, error)
	WithdrawGrant(ctx context.Context, subject, scope, roleCode string) error
	WithdrawGrantIn(ctx context.Context, subject, partition, scope, roleCode string) error

	SetPermissionDefinition(ctx context.Context, p models.Permission) (models.Permission, error)
	OverridePermission(ctx context.Context, p models.Permission) (models.Permission, error)
	ClearPermissionOverride(ctx context.Context, partition, permission, roleKind string) error
	ReadPermission(ctx context.Context, partition, permission, roleKind string) (models.Permission, error)
	ListPermissions(ctx context.Context, partition string) ([]models.Permission, error)

	Seed(ctx context.Context, roleCode, name string, operations ...[]byte) ([]models.RoleAction, error)

	MayPerform(ctx context.Context, subject, scope, action string) (bool, error)
	MayPerformIn(ctx context.Context, subject, partition, scope, action string) (bool, error)
	ActionsFor(ctx context.Context, subject, scope string) ([]string, error)
	ActionsAnywhere(ctx context.Context, subject string) ([]string, error)
	AccessOf(ctx context.Context, subject, partition string) ([]AccessLine, error)
}

type manager struct {
	db    *gorm.DB
	store *store
	spec  *spec.Spec
}

func NewPermissionsManager(db *gorm.DB, s *spec.Spec) (PermissionsManager, error) {
	carriers := map[string]any{
		roleRole:       models.Role{},
		roleRoleAction: models.RoleAction{},
		roleGrant:      models.Grant{},
	}
	if _, ok := s.ByRole(rolePermission); ok {
		carriers[rolePermission] = models.Permission{}
	}
	st, err := newStore(db, s, carriers)
	if err != nil {
		return nil, err
	}
	return &manager{db: db, store: st, spec: s}, nil
}

func Migrate(db *gorm.DB, s *spec.Spec) error {
	if err := renamePowerToPermission(db, s); err != nil {
		return err
	}
	if err := spec.Migrate(db, s); err != nil {
		return err
	}
	if err := addPartition(db, s); err != nil {
		return err
	}
	return addEndsAt(db, s)
}

func (m *manager) object(role string) spec.Object { return m.store.Object(role) }

func (m *manager) table(role string) string { return m.store.Table(role) }

func (m *manager) query(ctx context.Context, role string) *gorm.DB {
	return m.store.Query(ctx, role)
}

func (m *manager) MayPerform(ctx context.Context, subject, scope, action string) (bool, error) {
	return m.MayPerformIn(ctx, subject, "", scope, action)
}

func (m *manager) MayPerformIn(ctx context.Context, subject, partition, scope, action string) (bool, error) {
	if subject == "" || scope == "" {
		return false, nil
	}
	if !isAction(action) {
		return false, ErrInvalidAction
	}
	if !isPartition(partition) {
		return false, ErrInvalidPartition
	}

	grants := m.table(roleGrant)
	actions := m.table(roleRoleAction)
	roles := m.table(roleRole)

	var n int64
	err := m.db.WithContext(ctx).
		Table(grants+" g").
		Joins(fmt.Sprintf("join %s ra on ra.%s = g.%s", actions,
			columnName("RoleCode"), columnName("RoleCode"))).
		Joins(fmt.Sprintf("join %s r on r.%s = g.%s", roles,
			columnName("Code"), columnName("RoleCode"))).
		Where("g."+columnName("Subject")+" = ?", subject).
		Where("g."+columnName("Scope")+" in (?, ?)", scope, models.ScopeEverywhere).
		Where("g."+columnName("Partition")+" in (?, ?)", partition, "").
		Where("g."+columnName("Deleted")+" = false").
		Where(stillRunning("g."), "", endInstant(time.Now())).
		Where("r."+columnName("Deleted")+" = false").
		Where("ra."+columnName("Action")+" = ?", action).
		Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("permissions: may perform: %w", err)
	}
	return n > 0, nil
}

func (m *manager) ActionsFor(ctx context.Context, subject, scope string) ([]string, error) {
	if subject == "" || scope == "" {
		return nil, nil
	}

	grants := m.table(roleGrant)
	actions := m.table(roleRoleAction)
	roles := m.table(roleRole)

	var out []string
	err := m.db.WithContext(ctx).
		Table(grants+" g").
		Joins(fmt.Sprintf("join %s ra on ra.%s = g.%s", actions,
			columnName("RoleCode"), columnName("RoleCode"))).
		Joins(fmt.Sprintf("join %s r on r.%s = g.%s", roles,
			columnName("Code"), columnName("RoleCode"))).
		Where("g."+columnName("Subject")+" = ?", subject).
		Where("g."+columnName("Scope")+" in (?, ?)", scope, models.ScopeEverywhere).
		Where("g."+columnName("Partition")+" = ?", "").
		Where("g."+columnName("Deleted")+" = false").
		Where(stillRunning("g."), "", endInstant(time.Now())).
		Where("r."+columnName("Deleted")+" = false").
		Distinct("ra."+columnName("Action")).
		Order("ra."+columnName("Action")).
		Pluck("ra."+columnName("Action"), &out).Error
	if err != nil {
		return nil, fmt.Errorf("permissions: actions for: %w", err)
	}
	return out, nil
}

func (m *manager) ActionsAnywhere(ctx context.Context, subject string) ([]string, error) {
	if subject == "" {
		return nil, nil
	}

	grants := m.table(roleGrant)
	actions := m.table(roleRoleAction)
	roles := m.table(roleRole)

	var out []string
	err := m.db.WithContext(ctx).
		Table(grants+" g").
		Joins(fmt.Sprintf("join %s ra on ra.%s = g.%s", actions,
			columnName("RoleCode"), columnName("RoleCode"))).
		Joins(fmt.Sprintf("join %s r on r.%s = g.%s", roles,
			columnName("Code"), columnName("RoleCode"))).
		Where("g."+columnName("Subject")+" = ?", subject).
		Where("g."+columnName("Deleted")+" = false").
		Where(stillRunning("g."), "", endInstant(time.Now())).
		Where("r."+columnName("Deleted")+" = false").
		Distinct("ra."+columnName("Action")).
		Order("ra."+columnName("Action")).
		Pluck("ra."+columnName("Action"), &out).Error
	if err != nil {
		return nil, fmt.Errorf("permissions: actions anywhere: %w", err)
	}
	return out, nil
}
