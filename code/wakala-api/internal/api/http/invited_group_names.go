package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	mwanachamaactor "wakalaserver/modules/actor"
	commmodels "wakalaserver/modules/comm/models"

	"wakalaserver/internal/agencies"
)

const groupNameField = "group_name"

type groupNamedBy struct {
	idField string
	applies func(row map[string]json.RawMessage) bool
}

var groupNamedLists = map[string]groupNamedBy{
	"actor.invitation.list_mine": {idField: "group_id", applies: everyRow},
	"comm.notification.list":     {idField: "SubjectID", applies: anInvitationNotice},
}

func everyRow(map[string]json.RawMessage) bool { return true }

func anInvitationNotice(row map[string]json.RawMessage) bool {
	return stringField(row, "Event") == string(commmodels.EventGroupInvited) &&
		stringField(row, "SubjectKind") == string(commmodels.SubjectGroup)
}

func stringField(row map[string]json.RawMessage, field string) string {
	var v string
	_ = json.Unmarshal(row[field], &v)
	return v
}

func withInvitedGroupNames(reg agencies.Registry, action string, serve http.HandlerFunc) http.HandlerFunc {
	return rewrittenBy(invitedGroupNamesRewrite(reg, action), serve)
}

func invitedGroupNamesRewrite(reg agencies.Registry, action string) rowRewrite {
	field, named := groupNamedLists[action]
	if !named {
		return nil
	}
	return func(r *http.Request, rows []map[string]json.RawMessage) ([]map[string]json.RawMessage, error) {
		return field.nameEach(r.Context(), reg, r.PathValue("instanceID"), rows)
	}
}

func (f groupNamedBy) nameEach(ctx context.Context, reg agencies.Registry, instanceID string, rows []map[string]json.RawMessage) ([]map[string]json.RawMessage, error) {
	if rows == nil {
		return []map[string]json.RawMessage{}, nil
	}
	var ids []string
	for _, row := range rows {
		if f.applies(row) {
			ids = append(ids, stringField(row, f.idField))
		}
	}
	if len(ids) == 0 {
		return rows, nil
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	names, err := groupNamesByID(ctx, directory, ids)
	if err != nil {
		return nil, err
	}
	return f.withNames(rows, names), nil
}

func (f groupNamedBy) withNames(rows []map[string]json.RawMessage, names map[string]string) []map[string]json.RawMessage {
	for _, row := range rows {
		if !f.applies(row) {
			continue
		}
		name, _ := json.Marshal(names[stringField(row, f.idField)])
		row[groupNameField] = name
	}
	return rows
}

func groupNamesByID(ctx context.Context, directory mwanachamaactor.UserManager, ids []string) (map[string]string, error) {
	out := make(map[string]string, len(ids))
	for _, id := range ids {
		if _, seen := out[id]; seen || id == "" {
			continue
		}
		g, err := directory.GetGroup(ctx, id)
		if errors.Is(err, mwanachamaactor.ErrGroupNotFound) {
			out[id] = ""
			continue
		}
		if err != nil {
			return nil, err
		}
		out[id] = g.Name
	}
	return out, nil
}
