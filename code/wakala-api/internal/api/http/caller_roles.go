package http

import (
	"context"
	"errors"
	"net/http"
	"slices"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const callerRolesAction = "instance.my_roles.read"

type callerRolesParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
}

type heldAgencyRole struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

type callerRoles struct {
	InstanceID  string           `json:"instance_id"`
	Membership  string           `json:"membership"`
	Roles       []heldAgencyRole `json:"roles"`
	Permissions []string         `json:"permissions"`
}

func registerCallerRolesRoute(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/my-roles", auth.require(d.getCallerRoles))
}

func (d *Deps) registerCallerRolesMCPTool(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{Name: "agency_get_my_roles", Title: "My Agency Roles", Description: "Read which agency roles the caller holds in an Agency Instance, the permission codes those roles carry (the owner holds every code), and the caller's membership (owner, agent or resident). Members only."}, d.mcpGetCallerRoles)
}

func (d *Deps) getCallerRoles(w http.ResponseWriter, r *http.Request) {
	out, err := d.callerRolesIn(r.Context(), r.PathValue("instanceID"))
	if err != nil {
		writeRecordErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (d *Deps) mcpGetCallerRoles(ctx context.Context, _ *mcp.CallToolRequest, p callerRolesParams) (*mcp.CallToolResult, callerRoles, error) {
	out, err := d.callerRolesIn(ctx, p.InstanceID)
	if err != nil {
		return nil, callerRoles{}, err
	}
	return textResult("Caller holds %d agency role(s) in agency %s as %s", len(out.Roles), p.InstanceID, out.Membership), out, nil
}

func (d *Deps) callerRolesIn(ctx context.Context, instanceID string) (callerRoles, error) {
	if err := d.requireAgentMay(ctx, instanceID, callerRolesAction); err != nil {
		return callerRoles{}, err
	}
	membership, err := admittedRole(ctx, d.Registry, instanceID)
	if err != nil {
		return callerRoles{}, err
	}
	out := callerRoles{InstanceID: instanceID, Membership: membership, Roles: []heldAgencyRole{}, Permissions: []string{}}
	if membership == agencies.RoleOwner {
		out.Permissions = allPermissionCodes()
	}
	m, err := d.Registry.AgencyManager(ctx, instanceID)
	if err != nil {
		return callerRoles{}, err
	}
	held, err := heldAgencyRoles(ctx, d.Registry, instanceID, m)
	if err != nil {
		if errors.Is(err, errNoLiveVersion) {
			return out, nil
		}
		return callerRoles{}, err
	}
	for _, role := range held.Roles {
		if !role.Deleted {
			out.Roles = append(out.Roles, heldAgencyRole{ID: role.ID, Code: role.Code, Name: role.Name})
		}
	}
	if membership != agencies.RoleOwner {
		out.Permissions, err = d.heldPermissionCodes(ctx, out.Roles)
		if err != nil {
			return callerRoles{}, err
		}
	}
	return out, nil
}

func allPermissionCodes() []string {
	catalog := agencymodels.PermissionCatalog()
	codes := make([]string, 0, len(catalog))
	for _, p := range catalog {
		codes = append(codes, p.Code)
	}
	slices.Sort(codes)
	return codes
}

func (d *Deps) heldPermissionCodes(ctx context.Context, roles []heldAgencyRole) ([]string, error) {
	codes := []string{}
	for _, role := range roles {
		granted, err := d.agencyRolePermissions(ctx, role.ID)
		if err != nil {
			return nil, err
		}
		codes = append(codes, granted...)
	}
	codes = agencymodels.DistinctPermissions(codes)
	slices.Sort(codes)
	return codes, nil
}

type heldRoles struct {
	DraftID string
	Roles   []agencymodels.Role
}

func heldAgencyRoles(ctx context.Context, reg agencies.Registry, instanceID string, m mwanachamaagency.AgencyManager) (heldRoles, error) {
	keys, err := heldRoleKeys(ctx, reg, instanceID, m)
	if err != nil {
		return heldRoles{}, err
	}
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		return heldRoles{}, err
	}
	live, err := m.ListRoles(ctx, draftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		return heldRoles{}, err
	}
	held := []agencymodels.Role{}
	for _, role := range live {
		if holdsRole(keys, role) {
			held = append(held, role)
		}
	}
	return heldRoles{DraftID: draftID, Roles: held}, nil
}

func holdsRole(held map[string]bool, role agencymodels.Role) bool {
	return held[role.ID] || (role.Code != "" && held[role.Code])
}

func heldRoleKeys(ctx context.Context, reg agencies.Registry, instanceID string, m mwanachamaagency.AgencyManager) (map[string]bool, error) {
	caller := accounts.IDFromContext(ctx)
	held := map[string]bool{}
	if links, ok := reg.(agencies.AgencyRoleLinks); ok {
		seat, err := links.AgencyRoleOf(ctx, instanceID, caller)
		if err == nil && seat != "" {
			held[seat] = true
			if role, err := m.GetRole(ctx, seat); err == nil && role.Code != "" {
				held[role.Code] = true
			}
		}
	}
	if groupRoles, ok := reg.(agencies.GroupRoles); ok {
		through, err := groupRoles.RoleIDsThroughGroups(ctx, instanceID, caller)
		if err != nil {
			return nil, err
		}
		for _, id := range through {
			held[id] = true
			if role, err := m.GetRole(ctx, id); err == nil && role.Code != "" {
				held[role.Code] = true
			}
		}
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	seats, err := directory.ListRoleAssignmentsForActor(ctx, caller, true)
	if err != nil {
		return nil, err
	}
	if len(seats) == 0 {
		return held, nil
	}
	kinds, err := directory.ListRoleKinds(ctx)
	if err != nil {
		return nil, err
	}
	definitionOf := make(map[string]string, len(kinds))
	for _, k := range kinds {
		if !k.Retired() && k.DefinitionRoleID != "" {
			definitionOf[k.ID] = k.DefinitionRoleID
		}
	}
	for _, s := range seats {
		if id := definitionOf[s.KindID]; id != "" {
			held[id] = true
		}
	}
	return held, nil
}
