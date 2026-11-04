package http

import (
	"context"
	"encoding/json"
	"net/http"

	"wakalaserver/internal/agencies"
)

const (
	authorRoleField  = "author_role"
	authorAdminField = "author_admin"
)

var roleBadgedLists = map[string]bool{
	"comm.chat_message.list": true,
}

func withAuthorRoles(reg agencies.Registry, action string, serve http.HandlerFunc) http.HandlerFunc {
	return rewrittenBy(authorRolesRewrite(reg, action), serve)
}

func authorRolesRewrite(reg agencies.Registry, action string) rowRewrite {
	if !roleBadgedLists[action] {
		return nil
	}
	return func(r *http.Request, rows []map[string]json.RawMessage) ([]map[string]json.RawMessage, error) {
		instanceID := r.PathValue("instanceID")
		roles, err := roleNamesInGroup(r.Context(), reg, instanceID, r.PathValue("structure_id"))
		if err != nil {
			return nil, err
		}
		staff, err := agencyStaff(r.Context(), reg, instanceID)
		if err != nil {
			return nil, err
		}
		return badgeEach(rows, roles, staff), nil
	}
}

func roleNamesInGroup(ctx context.Context, reg agencies.Registry, instanceID, groupID string) (map[string]string, error) {
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	seats, err := directory.ListRoleAssignmentsForGroup(ctx, groupID, true)
	if err != nil || len(seats) == 0 {
		return map[string]string{}, err
	}
	kinds, err := directory.ListRoleKinds(ctx)
	if err != nil {
		return nil, err
	}
	kindNames := make(map[string]string, len(kinds))
	leadingKinds := make(map[string]bool, len(kinds))
	for _, k := range kinds {
		kindNames[k.ID] = k.Name
		leadingKinds[k.ID] = k.LeadsGroup
	}
	out := make(map[string]string, len(seats))
	leading := make(map[string]bool, len(seats))
	for _, seat := range seats {
		name := kindNames[seat.KindID]
		if name == "" || leading[seat.ActorID] {
			continue
		}
		if _, seated := out[seat.ActorID]; seated && !leadingKinds[seat.KindID] {
			continue
		}
		out[seat.ActorID] = name
		leading[seat.ActorID] = leadingKinds[seat.KindID]
	}
	return out, nil
}

func agencyStaff(ctx context.Context, reg agencies.Registry, instanceID string) (map[string]bool, error) {
	members, err := reg.Members(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	staff := make(map[string]bool, len(members))
	for _, m := range members {
		if m.Role == agencies.RoleOwner || m.Role == agencies.RoleAgent {
			staff[m.UserID] = true
		}
	}
	return staff, nil
}

func badgeEach(rows []map[string]json.RawMessage, roles map[string]string, staff map[string]bool) []map[string]json.RawMessage {
	if rows == nil {
		return []map[string]json.RawMessage{}
	}
	author := namedBy{idField: "author_id"}
	for _, row := range rows {
		id := author.idOf(row)
		role, _ := json.Marshal(roles[id])
		row[authorRoleField] = role
		admin, _ := json.Marshal(roles[id] == "" && staff[id])
		row[authorAdminField] = admin
	}
	return rows
}
