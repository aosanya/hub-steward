package http

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaactor "wakalaserver/modules/actor"
	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

var (
	errGroupRolesNotServed = errors.New("group roles are not available")
	errUnknownGroup        = errors.New("that group does not exist in this agency")
	errGroupRoleNeedsIDs   = errors.New("a group and an agency role are both needed")
)

type groupRoleRequest struct {
	GroupID      string `json:"group_id"`
	AgencyRoleID string `json:"agency_role_id"`
}

type groupRoleItem struct {
	agencies.GroupRole
	RoleName string `json:"role_name,omitempty"`
	RoleCode string `json:"role_code,omitempty"`
}

type groupRoleList struct {
	Items []groupRoleItem `json:"items"`
}

type groupRoleParams struct {
	InstanceID   string `json:"instance_id" jsonschema:"the Agency Instance"`
	GroupID      string `json:"group_id" jsonschema:"the group that holds the role"`
	AgencyRoleID string `json:"agency_role_id" jsonschema:"the agency role the group holds"`
}

type groupRoleListParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
	GroupID    string `json:"group_id,omitempty" jsonschema:"only the roles of this group"`
}

func registerGroupRoleRoutes(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/group-roles", auth.require(d.listGroupRolesRoute))
	mux.HandleFunc("POST /instances/{instanceID}/group-roles", auth.require(d.giveGroupRoleRoute))
	mux.HandleFunc("DELETE /instances/{instanceID}/group-roles/{groupID}/{roleID}", auth.require(d.takeGroupRoleRoute))
}

func (d *Deps) registerGroupRoleMCPTools(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{Name: "agency_give_group_role", Title: "Give a group a role", Description: "Owner only: give a group a role of this agency, so every member of the group holds the role's permissions (for example task.read to open the Backlogs). Giving a role the group already holds changes nothing."}, d.mcpGiveGroupRole)
	mcp.AddTool(server, &mcp.Tool{Name: "agency_take_group_role", Title: "Take a role from a group", Description: "Owner only: take a role away from a group; its members lose the role's permissions at once."}, d.mcpTakeGroupRole)
	mcp.AddTool(server, &mcp.Tool{Name: "agency_list_group_roles", Title: "List the roles of groups", Description: "Owner only: list which agency roles each group holds, or only one group's roles."}, d.mcpListGroupRoles)
}

func (d *Deps) groupRolesAsOwner(ctx context.Context, instanceID string) (agencies.GroupRoles, error) {
	caller := accounts.IDFromContext(ctx)
	role, err := d.Registry.RoleOf(ctx, instanceID, caller)
	if caller == "" || err != nil || (role != agencies.RoleOwner && role != agencies.RoleAgent) {
		return nil, agencies.ErrInstanceNotFound
	}
	if role != agencies.RoleOwner {
		return nil, dispatch.ErrForbidden
	}
	held, ok := d.Registry.(agencies.GroupRoles)
	if !ok {
		return nil, errGroupRolesNotServed
	}
	return held, nil
}

func (d *Deps) checkGroupRoleTarget(ctx context.Context, instanceID, groupID, roleID string) error {
	if strings.TrimSpace(groupID) == "" || strings.TrimSpace(roleID) == "" {
		return errGroupRoleNeedsIDs
	}
	directory, err := d.Registry.ActorManager(ctx, instanceID)
	if err != nil {
		return err
	}
	group, err := directory.GetGroup(ctx, groupID)
	if err != nil {
		if errors.Is(err, mwanachamaactor.ErrGroupNotFound) {
			return errUnknownGroup
		}
		return err
	}
	if group.Open() {
		return agencies.ErrOpenGroupRole
	}
	if _, err := d.agencyRolePermissions(withPartitionContext(ctx, instanceID), roleID); err != nil {
		return errUnknownAgencyRole
	}
	return nil
}

func groupRoleStatus(err error) int {
	switch {
	case errors.Is(err, agencies.ErrInstanceNotFound):
		return http.StatusNotFound
	case errors.Is(err, dispatch.ErrForbidden):
		return http.StatusForbidden
	case errors.Is(err, errGroupRolesNotServed):
		return http.StatusNotImplemented
	case errors.Is(err, errUnknownGroup), errors.Is(err, agencies.ErrOpenGroupRole), errors.Is(err, errUnknownAgencyRole), errors.Is(err, errGroupRoleNeedsIDs):
		return http.StatusUnprocessableEntity
	}
	return http.StatusInternalServerError
}

func writeGroupRoleErr(w http.ResponseWriter, err error) {
	status := groupRoleStatus(err)
	if status == http.StatusInternalServerError {
		writeErr(w, status, "internal error")
		return
	}
	writeErr(w, status, err.Error())
}

func (d *Deps) giveGroupRole(ctx context.Context, instanceID, groupID, roleID string) (agencies.GroupRole, error) {
	held, err := d.groupRolesAsOwner(ctx, instanceID)
	if err != nil {
		return agencies.GroupRole{}, err
	}
	if err := d.checkGroupRoleTarget(ctx, instanceID, groupID, roleID); err != nil {
		return agencies.GroupRole{}, err
	}
	if err := held.GiveGroupRole(ctx, instanceID, groupID, roleID); err != nil {
		return agencies.GroupRole{}, err
	}
	return agencies.GroupRole{InstanceID: instanceID, GroupID: groupID, AgencyRoleID: roleID}, nil
}

func (d *Deps) takeGroupRole(ctx context.Context, instanceID, groupID, roleID string) (agencies.GroupRole, error) {
	held, err := d.groupRolesAsOwner(ctx, instanceID)
	if err != nil {
		return agencies.GroupRole{}, err
	}
	if strings.TrimSpace(groupID) == "" || strings.TrimSpace(roleID) == "" {
		return agencies.GroupRole{}, errGroupRoleNeedsIDs
	}
	if err := held.TakeGroupRole(ctx, instanceID, groupID, roleID); err != nil {
		return agencies.GroupRole{}, err
	}
	return agencies.GroupRole{InstanceID: instanceID, GroupID: groupID, AgencyRoleID: roleID}, nil
}

func (d *Deps) listGroupRoles(ctx context.Context, instanceID, groupID string) (groupRoleList, error) {
	held, err := d.groupRolesAsOwner(ctx, instanceID)
	if err != nil {
		return groupRoleList{}, err
	}
	all, err := held.ListGroupRoles(ctx, instanceID)
	if err != nil {
		return groupRoleList{}, err
	}
	items := make([]groupRoleItem, 0, len(all))
	manager, err := d.Registry.AgencyManager(ctx, instanceID)
	if err != nil {
		return groupRoleList{}, err
	}
	for _, gr := range all {
		if groupID != "" && gr.GroupID != groupID {
			continue
		}
		item := groupRoleItem{GroupRole: gr}
		if role, err := manager.GetRole(ctx, gr.AgencyRoleID); err == nil {
			item.RoleName, item.RoleCode = role.Name, role.Code
		}
		items = append(items, item)
	}
	return groupRoleList{Items: items}, nil
}

func (d *Deps) giveGroupRoleRoute(w http.ResponseWriter, r *http.Request) {
	var req groupRoleRequest
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	out, err := d.giveGroupRole(r.Context(), r.PathValue("instanceID"), req.GroupID, req.AgencyRoleID)
	if err != nil {
		writeGroupRoleErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

func (d *Deps) takeGroupRoleRoute(w http.ResponseWriter, r *http.Request) {
	out, err := d.takeGroupRole(r.Context(), r.PathValue("instanceID"), r.PathValue("groupID"), r.PathValue("roleID"))
	if err != nil {
		writeGroupRoleErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (d *Deps) listGroupRolesRoute(w http.ResponseWriter, r *http.Request) {
	out, err := d.listGroupRoles(r.Context(), r.PathValue("instanceID"), r.URL.Query().Get("group_id"))
	if err != nil {
		writeGroupRoleErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (d *Deps) mcpGiveGroupRole(ctx context.Context, _ *mcp.CallToolRequest, p groupRoleParams) (*mcp.CallToolResult, agencies.GroupRole, error) {
	out, err := d.giveGroupRole(ctx, p.InstanceID, p.GroupID, p.AgencyRoleID)
	if err != nil {
		return nil, agencies.GroupRole{}, err
	}
	return textResult("Group %s now holds role %s in agency %s", out.GroupID, out.AgencyRoleID, out.InstanceID), out, nil
}

func (d *Deps) mcpTakeGroupRole(ctx context.Context, _ *mcp.CallToolRequest, p groupRoleParams) (*mcp.CallToolResult, agencies.GroupRole, error) {
	out, err := d.takeGroupRole(ctx, p.InstanceID, p.GroupID, p.AgencyRoleID)
	if err != nil {
		return nil, agencies.GroupRole{}, err
	}
	return textResult("Group %s no longer holds role %s in agency %s", out.GroupID, out.AgencyRoleID, out.InstanceID), out, nil
}

func (d *Deps) mcpListGroupRoles(ctx context.Context, _ *mcp.CallToolRequest, p groupRoleListParams) (*mcp.CallToolResult, groupRoleList, error) {
	out, err := d.listGroupRoles(ctx, p.InstanceID, p.GroupID)
	if err != nil {
		return nil, groupRoleList{}, err
	}
	return textResult("Found %d group role(s) in agency %s", len(out.Items), p.InstanceID), out, nil
}
