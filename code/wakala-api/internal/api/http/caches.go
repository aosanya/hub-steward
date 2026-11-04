package http

import (
	"context"
	"net/http"
	"slices"

	permissions "wakalaserver/modules/permissions"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
	"wakalaserver/internal/authz"
	"wakalaserver/internal/dbpool"
	"wakalaserver/internal/session"
)

func (d *Deps) epochLedger() *authz.Epochs {
	d.cacheMu.Lock()
	defer d.cacheMu.Unlock()
	if d.epochs == nil {
		if source, ok := d.Registry.(agencies.EpochSource); ok && source.Epochs() != nil {
			d.epochs = source.Epochs()
		} else {
			d.epochs = authz.NewEpochs()
		}
	}
	return d.epochs
}

func ApplyCaches(d *Deps) {
	epochs := d.epochLedger()
	if d.Sessions != nil {
		if _, wrapped := d.Sessions.(*session.Cached); !wrapped {
			d.Sessions = session.NewCached(d.Sessions, epochs)
		}
	}
	if d.APIKeys != nil {
		if _, wrapped := d.APIKeys.(*apikeys.Cached); !wrapped {
			d.APIKeys = apikeys.NewCached(d.APIKeys, epochs)
		}
	}
	if d.Permissions != nil {
		if _, wrapped := d.Permissions.(*cachedPermissions); !wrapped {
			d.Permissions = CachePermissions(d.Permissions, epochs)
		}
	}
}

func (d *Deps) rolePermissionsCache() *authz.Cache[[]string] {
	epochs := d.epochLedger()
	d.cacheMu.Lock()
	defer d.cacheMu.Unlock()
	if d.permissions == nil {
		d.permissions = authz.NewCache[[]string]("permissions", epochs)
	}
	return d.permissions
}

func (d *Deps) cachedRolePermissions(ctx context.Context, roleID string) ([]string, error) {
	tenant := partitionOf(ctx)
	codes, err := d.rolePermissionsCache().Get(ctx, tenant+"\x00"+roleID, func(ctx context.Context) ([]string, []string, error) {
		m, err := d.Registry.AgencyManager(ctx, tenant)
		if err != nil {
			return nil, nil, err
		}
		r, err := m.GetRole(ctx, roleID)
		if err != nil {
			return nil, nil, err
		}
		return slices.Clone(r.Permissions), []string{authz.TenantKey(tenant)}, nil
	})
	return slices.Clone(codes), err
}

type cachedPermissions struct {
	permissions.PermissionsManager
	epochs   *authz.Epochs
	anywhere *authz.Cache[[]string]
	may      *authz.Cache[bool]
}

func CachePermissions(inner permissions.PermissionsManager, epochs *authz.Epochs) permissions.PermissionsManager {
	return &cachedPermissions{
		PermissionsManager: inner,
		epochs:             epochs,
		anywhere:           authz.NewCache[[]string]("permitted-actions", epochs),
		may:                authz.NewCache[bool]("may-perform", epochs),
	}
}

func (c *cachedPermissions) ActionsAnywhere(ctx context.Context, subject string) ([]string, error) {
	actions, err := c.anywhere.Get(ctx, subject, func(ctx context.Context) ([]string, []string, error) {
		actions, err := c.PermissionsManager.ActionsAnywhere(ctx, subject)
		return slices.Clone(actions), []string{authz.SubjectKey(subject)}, err
	})
	return slices.Clone(actions), err
}

func (c *cachedPermissions) MayPerformIn(ctx context.Context, subject, partition, scope, action string) (bool, error) {
	key := subject + "\x00" + partition + "\x00" + scope + "\x00" + action
	return c.may.Get(ctx, key, func(ctx context.Context) (bool, []string, error) {
		ok, err := c.PermissionsManager.MayPerformIn(ctx, subject, partition, scope, action)
		return ok, []string{authz.SubjectKey(subject), authz.TenantKey(partition)}, err
	})
}

func (c *cachedPermissions) CreateGrant(ctx context.Context, g permissions.Grant) (permissions.Grant, error) {
	defer c.epochs.Bump(authz.SubjectKey(g.Subject), authz.TenantKey(g.Partition))
	return c.PermissionsManager.CreateGrant(ctx, g)
}

func (c *cachedPermissions) WithdrawGrant(ctx context.Context, subject, scope, roleCode string) error {
	defer c.epochs.Bump(authz.SubjectKey(subject))
	return c.PermissionsManager.WithdrawGrant(ctx, subject, scope, roleCode)
}

func (c *cachedPermissions) WithdrawGrantIn(ctx context.Context, subject, partition, scope, roleCode string) error {
	defer c.epochs.Bump(authz.SubjectKey(subject), authz.TenantKey(partition))
	return c.PermissionsManager.WithdrawGrantIn(ctx, subject, partition, scope, roleCode)
}

func (c *cachedPermissions) UpdateRole(ctx context.Context, r permissions.Role) (permissions.Role, error) {
	defer c.epochs.Bump(authz.Global)
	return c.PermissionsManager.UpdateRole(ctx, r)
}

func (c *cachedPermissions) DeleteRole(ctx context.Context, code string) error {
	defer c.epochs.Bump(authz.Global)
	return c.PermissionsManager.DeleteRole(ctx, code)
}

func (c *cachedPermissions) AddAction(ctx context.Context, roleCode, action string) (permissions.RoleAction, error) {
	defer c.epochs.Bump(authz.Global)
	return c.PermissionsManager.AddAction(ctx, roleCode, action)
}

func (c *cachedPermissions) RemoveAction(ctx context.Context, roleCode, action string) error {
	defer c.epochs.Bump(authz.Global)
	return c.PermissionsManager.RemoveAction(ctx, roleCode, action)
}

func (c *cachedPermissions) SetActions(ctx context.Context, roleCode string, actions []string) ([]permissions.RoleAction, error) {
	defer c.epochs.Bump(authz.Global)
	return c.PermissionsManager.SetActions(ctx, roleCode, actions)
}

func (c *cachedPermissions) SeedActions(ctx context.Context, roleCode string, actions []string) ([]permissions.RoleAction, error) {
	defer c.epochs.Bump(authz.Global)
	return c.PermissionsManager.SeedActions(ctx, roleCode, actions)
}

func (c *cachedPermissions) Seed(ctx context.Context, roleCode, name string, operations ...[]byte) ([]permissions.RoleAction, error) {
	defer c.epochs.Bump(authz.Global)
	return c.PermissionsManager.Seed(ctx, roleCode, name, operations...)
}

func (c *cachedPermissions) SetPermissionDefinition(ctx context.Context, p permissions.Permission) (permissions.Permission, error) {
	defer c.epochs.Bump(authz.Global)
	return c.PermissionsManager.SetPermissionDefinition(ctx, p)
}

func (c *cachedPermissions) OverridePermission(ctx context.Context, p permissions.Permission) (permissions.Permission, error) {
	defer c.epochs.Bump(authz.Global)
	return c.PermissionsManager.OverridePermission(ctx, p)
}

func (c *cachedPermissions) ClearPermissionOverride(ctx context.Context, partition, permission, roleKind string) error {
	defer c.epochs.Bump(authz.Global)
	return c.PermissionsManager.ClearPermissionOverride(ctx, partition, permission, roleKind)
}

func withTenantSlot(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r.WithContext(dbpool.WithSlot(r.Context())))
	})
}
