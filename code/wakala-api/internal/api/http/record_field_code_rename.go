package http

import (
	"context"
	"errors"
	"net/http"
	"slices"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/agencies"
)

const updateRecordAction = "agency.record.update"

type renameFieldCodeRequest struct {
	Code string `json:"code"`
}

type renamedFieldCode struct {
	Record string   `json:"record"`
	Key    string   `json:"key"`
	Was    string   `json:"was"`
	Code   string   `json:"code"`
	Roles  []string `json:"roles"`
}

type renamedRole struct {
	id   string
	name string
	was  []string
}

func (d *Deps) registerRecordFieldCodeRoute(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	mux.HandleFunc("PUT /instances/{instanceID}/records/{recordID}/fields/{key}/code", auth.require(func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		m, err := agencyManagerFor(r.Context(), reg, instanceID)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		r = withPartition(r, instanceID)
		if !d.agentMayDesign(r, instanceID, updateRecordAction) {
			writeErr(w, http.StatusForbidden, "forbidden")
			return
		}
		var body renameFieldCodeRequest
		if err := readJSON(r, &body); err != nil {
			writeReadErr(w, err)
			return
		}
		renamed, err := renameFieldCode(r.Context(), m, r.PathValue("recordID"), r.PathValue("key"), body.Code)
		if err != nil {
			writeFieldCodeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, renamed)
	}))
}

func writeFieldCodeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, mwanachamaagency.ErrInvalidRecord):
		writeErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, mwanachamaagency.ErrRecordNotFound), errors.Is(err, errFieldNotInRecord):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, mwanachamaagency.ErrDraftNotOpen):
		writeErr(w, http.StatusConflict, err.Error())
	default:
		writeInstanceErr(w, err)
	}
}

var errFieldNotInRecord = errors.New("the record has no field with that key")

func renameFieldCode(ctx context.Context, m mwanachamaagency.AgencyManager, recordID, key, code string) (renamedFieldCode, error) {
	if code == "" {
		return renamedFieldCode{}, errors.Join(mwanachamaagency.ErrInvalidRecord, errors.New("a field code cannot be empty"))
	}
	record, err := m.GetRecord(ctx, recordID)
	if err != nil {
		return renamedFieldCode{}, err
	}
	at := slices.IndexFunc(record.Questions, func(q models.StepQuestion) bool { return q.Key == key })
	if at < 0 {
		return renamedFieldCode{}, errFieldNotInRecord
	}
	was := record.Questions[at].Code
	changed := record
	changed.Questions = slices.Clone(record.Questions)
	changed.Questions[at].Code = code
	saved, err := m.UpdateRecord(ctx, changed)
	if err != nil {
		return renamedFieldCode{}, err
	}
	moved, err := moveRolesToFieldCode(ctx, m, saved, was, saved.Questions[at].Code)
	if err != nil {
		_, _ = m.UpdateRecord(ctx, record)
		restoreRoles(ctx, m, moved)
		return renamedFieldCode{}, err
	}
	names := make([]string, 0, len(moved))
	for _, role := range moved {
		names = append(names, role.name)
	}
	return renamedFieldCode{Record: saved.Code, Key: key, Was: was, Code: saved.Questions[at].Code, Roles: names}, nil
}

func fieldPermissionRewrites(record models.Record, was, now string) map[string]string {
	rewrites := map[string]string{}
	for _, action := range []string{models.RowActionAdd, models.RowActionEdit, mwanachamaagency.RecordViewAction} {
		rewrites[mwanachamaagency.RecordPermissionCode(record.Code, action, was)] = mwanachamaagency.RecordPermissionCode(record.Code, action, now)
	}
	return rewrites
}

func moveRolesToFieldCode(ctx context.Context, m mwanachamaagency.AgencyManager, record models.Record, was, now string) ([]renamedRole, error) {
	roles, err := m.ListRoles(ctx, record.DraftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		return nil, err
	}
	rewrites := fieldPermissionRewrites(record, was, now)
	var moved []renamedRole
	for _, role := range roles {
		next := make([]string, len(role.Permissions))
		touched := false
		for i, code := range role.Permissions {
			next[i] = code
			if to, carried := rewrites[code]; carried {
				next[i], touched = to, true
			}
		}
		if !touched {
			continue
		}
		if _, err := m.SetRolePermissions(ctx, role.ID, next); err != nil {
			return moved, err
		}
		moved = append(moved, renamedRole{id: role.ID, name: role.Name, was: role.Permissions})
	}
	return moved, nil
}

func restoreRoles(ctx context.Context, m mwanachamaagency.AgencyManager, moved []renamedRole) {
	for _, role := range moved {
		_, _ = m.SetRolePermissions(ctx, role.id, role.was)
	}
}
