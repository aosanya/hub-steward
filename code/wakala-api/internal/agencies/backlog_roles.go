package agencies

import (
	"context"
	"errors"
	"slices"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

type backlogRoles struct {
	r          *registry
	instanceID string
}

func (r *registry) backlogRolesIn(instanceID string) mwanachamataskmanager.RoleSync {
	return backlogRoles{r: r, instanceID: instanceID}
}

func (b backlogRoles) published(ctx context.Context) ([]agencymodels.DocumentRole, error) {
	m, err := b.r.AgencyManager(ctx, b.instanceID)
	if err != nil {
		return nil, err
	}
	live, err := m.ListPublications(ctx, mwanachamaagency.PublicationFilter{Channel: agencymodels.DefaultChannel})
	if err != nil || len(live) == 0 {
		return nil, err
	}
	newest := live[0]
	for _, p := range live {
		if p.Version > newest.Version {
			newest = p
		}
	}
	pub, err := m.GetPublication(ctx, newest.Version)
	if errors.Is(err, mwanachamaagency.ErrPublicationNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return pub.Document.Roles, nil
}

func backlogRoleCodeOf(role agencymodels.DocumentRole) string {
	for _, candidate := range []string{role.Code, strings.ReplaceAll(strings.ToLower(strings.TrimSpace(role.Name)), " ", "_")} {
		if candidate == mwanachamataskmanager.RoleCodeBacklogMember || candidate == mwanachamataskmanager.RoleCodeBacklogWorker {
			return candidate
		}
	}
	return ""
}

func (b backlogRoles) SetBacklogRole(ctx context.Context, groupID, roleCode string) error {
	open, err := b.r.groupIsOpen(ctx, b.instanceID, groupID)
	if err != nil {
		return err
	}
	if open {
		roleCode = ""
	}
	roles, err := b.published(ctx)
	if err != nil {
		return err
	}
	ids := map[string]string{}
	for _, role := range roles {
		if code := backlogRoleCodeOf(role); code != "" {
			ids[code] = role.ID
		}
	}
	for code, id := range ids {
		if code == roleCode {
			continue
		}
		if err := b.r.TakeGroupRole(ctx, b.instanceID, groupID, id); err != nil {
			return err
		}
	}
	if id, ok := ids[roleCode]; ok && roleCode != "" {
		return b.r.GiveGroupRole(ctx, b.instanceID, groupID, id)
	}
	return nil
}

func (b backlogRoles) GroupRoleState(ctx context.Context, groupID string) (mwanachamataskmanager.RoleState, error) {
	open, err := b.r.groupIsOpen(ctx, b.instanceID, groupID)
	if err != nil || open {
		return mwanachamataskmanager.RoleState{}, err
	}
	held, err := b.r.GroupRoleIDs(ctx, b.instanceID, groupID)
	if err != nil || len(held) == 0 {
		return mwanachamataskmanager.RoleState{}, err
	}
	roles, err := b.published(ctx)
	if err != nil {
		return mwanachamataskmanager.RoleState{}, err
	}
	state := mwanachamataskmanager.RoleState{}
	for _, role := range roles {
		if !slices.Contains(held, role.ID) {
			continue
		}
		code := backlogRoleCodeOf(role)
		if code == "" {
			code = role.Code
		}
		state.Codes = append(state.Codes, code)
		state.CanRead = state.CanRead || slices.Contains(role.Permissions, mwanachamataskmanager.PermissionTaskRead)
		state.CanEdit = state.CanEdit || slices.Contains(role.Permissions, mwanachamataskmanager.PermissionTaskEdit)
	}
	slices.Sort(state.Codes)
	return state, nil
}
