package http

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	permissions "wakalaserver/modules/permissions"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

var residentActions = map[string][]string{
	formsScope: residentFormsActions,
	commScope:  residentCommActions,
	actorScope: residentActorActions,
}

var errNoResidentRole = errors.New("an instance id with no letter or digit names no resident role")

func residentMay(scope, action string) bool {
	for _, held := range residentActions[scope] {
		if action == held {
			return true
		}
	}
	return false
}

func everyResidentAction() []string {
	var out []string
	for _, actions := range residentActions {
		out = append(out, actions...)
	}
	sort.Strings(out)
	return out
}

func residentScopes() []string {
	out := make([]string, 0, len(residentActions))
	for scope := range residentActions {
		out = append(out, scope)
	}
	sort.Strings(out)
	return out
}

func residentRoleCode(instanceID string) string {
	var b strings.Builder
	b.WriteString("resident")
	pending := true
	for _, r := range strings.ToLower(instanceID) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			if pending {
				b.WriteByte('_')
				pending = false
			}
			b.WriteRune(r)
			continue
		}
		pending = true
	}
	if b.Len() == len("resident") {
		return ""
	}
	return b.String()
}

type residentGrants struct {
	pm permissions.PermissionsManager
}

func (d *Deps) residentGrants() residentGrants { return residentGrants{pm: d.Permissions} }

func (g residentGrants) seedRole(ctx context.Context, instanceID string) (string, error) {
	code := residentRoleCode(instanceID)
	if code == "" {
		return "", errNoResidentRole
	}
	_, err := g.pm.GetRole(ctx, code)
	if errors.Is(err, permissions.ErrRoleNotFound) {
		_, err = g.pm.CreateRole(ctx, permissions.Role{
			Code:        code,
			Name:        "Resident",
			Description: "What a resident of agency " + instanceID + " may do there.",
		})
		if errors.Is(err, permissions.ErrDuplicateRole) {
			err = nil
		}
	}
	if err != nil {
		return "", err
	}
	if _, err := g.pm.SeedActions(ctx, code, everyResidentAction()); err != nil {
		return "", err
	}
	return code, nil
}

func (g residentGrants) admit(ctx context.Context, instanceID, userID string) error {
	if g.pm == nil {
		return nil
	}
	code, err := g.seedRole(ctx, instanceID)
	if err != nil {
		return fmt.Errorf("resident role for %s: %w", instanceID, err)
	}
	for _, scope := range residentScopes() {
		_, err := g.pm.CreateGrant(ctx, permissions.Grant{
			Subject:   userID,
			Scope:     scope,
			Partition: instanceID,
			RoleCode:  code,
			GrantedBy: accounts.IDFromContext(ctx),
		})
		if err != nil && !errors.Is(err, permissions.ErrDuplicateGrant) {
			return fmt.Errorf("resident grant on %s in %s: %w", scope, instanceID, err)
		}
	}
	return nil
}

func (g residentGrants) release(ctx context.Context, instanceID, userID string) error {
	if g.pm == nil {
		return nil
	}
	code := residentRoleCode(instanceID)
	if code == "" {
		return nil
	}
	for _, scope := range residentScopes() {
		err := g.pm.WithdrawGrantIn(ctx, userID, instanceID, scope, code)
		if err != nil && !errors.Is(err, permissions.ErrGrantNotFound) {
			return fmt.Errorf("withdraw resident grant on %s in %s: %w", scope, instanceID, err)
		}
	}
	return nil
}

func (d *Deps) SeedResidentGrants(ctx context.Context) error {
	g := d.residentGrants()
	if g.pm == nil || d.Registry == nil {
		return nil
	}
	instances, err := d.Registry.ListInstances(ctx)
	if err != nil {
		return err
	}
	for _, inst := range instances {
		members, err := d.Registry.Members(ctx, inst.ID)
		if err != nil {
			return err
		}
		if _, err := g.seedRole(ctx, inst.ID); err != nil {
			return fmt.Errorf("resident role for %s: %w", inst.ID, err)
		}
		for _, m := range members {
			if m.Role != agencies.RoleResident {
				continue
			}
			if err := g.admit(ctx, inst.ID, m.UserID); err != nil {
				return err
			}
		}
	}
	return nil
}
