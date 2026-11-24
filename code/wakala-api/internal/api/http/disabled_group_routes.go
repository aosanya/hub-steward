package http

import (
	"context"
	"errors"
	"net/http"

	"wakalaserver/internal/agencies"
)

var errDisabledGroupsNotServed = errors.New("disabled groups are not available")

type disabledGroupView struct {
	InstanceID string `json:"instance_id"`
	GroupID    string `json:"group_id"`
	Disabled   bool   `json:"disabled"`
}

type disabledGroupList struct {
	InstanceID string   `json:"instance_id"`
	GroupIDs   []string `json:"group_ids"`
}

func registerDisabledGroupRoutes(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("POST /instances/{instanceID}/groups/{groupID}/disable", auth.require(d.setGroupDisabledRoute(true)))
	mux.HandleFunc("POST /instances/{instanceID}/groups/{groupID}/enable", auth.require(d.setGroupDisabledRoute(false)))
	mux.HandleFunc("GET /instances/{instanceID}/disabled-groups", auth.require(d.listDisabledGroupsRoute))
}

func (d *Deps) disabledGroupsAsAdministrator(ctx context.Context, instanceID string) (agencies.DisabledGroups, error) {
	if _, err := d.groupRolesAsOwner(ctx, instanceID); err != nil {
		return nil, err
	}
	kept, ok := d.Registry.(agencies.DisabledGroups)
	if !ok {
		return nil, errDisabledGroupsNotServed
	}
	return kept, nil
}

func (d *Deps) setGroupDisabledRoute(disabled bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, groupID := r.PathValue("instanceID"), r.PathValue("groupID")
		kept, err := d.disabledGroupsAsAdministrator(r.Context(), instanceID)
		if err != nil {
			writeDisabledGroupErr(w, err)
			return
		}
		if err := d.checkTagGroup(r.Context(), instanceID, groupID); err != nil {
			writeDisabledGroupErr(w, err)
			return
		}
		if disabled {
			err = kept.DisableGroup(r.Context(), instanceID, groupID)
		} else {
			err = kept.EnableGroup(r.Context(), instanceID, groupID)
		}
		if err != nil {
			writeDisabledGroupErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, disabledGroupView{InstanceID: instanceID, GroupID: groupID, Disabled: disabled})
	}
}

func (d *Deps) listDisabledGroupsRoute(w http.ResponseWriter, r *http.Request) {
	instanceID := r.PathValue("instanceID")
	kept, err := d.disabledGroupsAsAdministrator(r.Context(), instanceID)
	if err != nil {
		writeDisabledGroupErr(w, err)
		return
	}
	ids, err := kept.DisabledGroupIDs(r.Context(), instanceID)
	if err != nil {
		writeDisabledGroupErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, disabledGroupList{InstanceID: instanceID, GroupIDs: ids})
}

func (d *Deps) enabledGroups(ctx context.Context, instanceID string, groups []seatedGroup) ([]seatedGroup, error) {
	kept, ok := d.Registry.(agencies.DisabledGroups)
	if !ok || len(groups) == 0 {
		return groups, nil
	}
	disabled, err := kept.DisabledGroupIDs(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	off := make(map[string]bool, len(disabled))
	for _, id := range disabled {
		off[id] = true
	}
	out := make([]seatedGroup, 0, len(groups))
	for _, g := range groups {
		if !off[g.ID] {
			out = append(out, g)
		}
	}
	return out, nil
}

func writeDisabledGroupErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errDisabledGroupsNotServed):
		writeErr(w, http.StatusNotImplemented, err.Error())
	case errors.Is(err, agencies.ErrDisabledGroupInvalid):
		writeErr(w, http.StatusUnprocessableEntity, err.Error())
	default:
		writeTagErr(w, err)
	}
}
