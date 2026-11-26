package http

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

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
	SeatedRoles []heldAgencyRole `json:"seated_roles"`
	Permissions []string         `json:"permissions"`
}

func registerCallerRolesRoute(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/my-roles", auth.require(d.getCallerRoles))
}

func (d *Deps) registerCallerRolesMCPTool(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{Name: "agency_get_my_roles", Title: "My Agency Roles", Description: "Read which agency roles the caller holds in an Agency Instance, the permission codes those roles carry (the owner holds every code), the roles the caller is seated in across every group (seated_roles, which decide who may answer a question), and the caller's membership (owner, agent or resident). Members only."}, d.mcpGetCallerRoles)
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
	ctx = withPartitionContext(ctx, instanceID)
	if err := d.requireAgentMay(ctx, instanceID, callerRolesAction); err != nil {
		return callerRoles{}, err
	}
	membership, err := admittedRole(ctx, d.Registry, instanceID)
	if err != nil {
		return callerRoles{}, err
	}
	out := callerRoles{InstanceID: instanceID, Membership: membership, Roles: []heldAgencyRole{}, SeatedRoles: []heldAgencyRole{}, Permissions: []string{}}
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
	out.SeatedRoles, err = d.seatedRolesOf(ctx, instanceID, m)
	if err != nil {
		return callerRoles{}, err
	}
	if membership != agencies.RoleOwner {
		out.Permissions, err = d.heldPermissionCodes(ctx, out.Roles)
		if err != nil {
			return callerRoles{}, err
		}
	}
	return out, nil
}

func (d *Deps) seatedRolesOf(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager) ([]heldAgencyRole, error) {
	held, err := heldAgencyRolesInAnyGroup(ctx, d.Registry, instanceID, accounts.IDFromContext(ctx), m)
	if err != nil {
		return nil, err
	}
	seated := []heldAgencyRole{}
	for _, role := range held.Roles {
		if !role.Deleted {
			seated = append(seated, heldAgencyRole{ID: role.ID, Code: role.Code, Name: role.Name})
		}
	}
	return seated, nil
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
	keys, err := callerRoleKeys(ctx, reg, instanceID)
	if err != nil {
		return heldRoles{}, err
	}
	return rolesMatching(ctx, m, keys)
}

func heldAgencyRolesInAnyGroup(ctx context.Context, reg agencies.Registry, instanceID, actorID string, m mwanachamaagency.AgencyManager) (heldRoles, error) {
	seats, err := agencies.SeatsInAnyGroup(ctx, reg, instanceID, actorID)
	if err != nil {
		return heldRoles{}, err
	}
	return rolesMatching(ctx, m, roleKeysOf(seats))
}

func rolesMatching(ctx context.Context, m mwanachamaagency.AgencyManager, keys map[string]bool) (heldRoles, error) {
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		return heldRoles{}, err
	}
	if len(keys) == 0 {
		return heldRoles{DraftID: draftID, Roles: []agencymodels.Role{}}, nil
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

func isRoleNamed(wanted string, role agencymodels.Role) bool {
	return role.ID == wanted || (role.Code != "" && role.Code == wanted) || (role.Name != "" && strings.EqualFold(role.Name, strings.TrimSpace(wanted)))
}

func callerRoleKeys(ctx context.Context, reg agencies.Registry, instanceID string) (map[string]bool, error) {
	seats, err := agencies.SeatsInAssumedGroup(ctx, reg, instanceID, accounts.IDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	return roleKeysOf(seats), nil
}

func roleKeysOf(seats []agencies.LiveSeat) map[string]bool {
	held := map[string]bool{}
	for _, seat := range seats {
		if id := seat.DefinitionRoleID(); id != "" {
			held[id] = true
		}
	}
	return held
}
