package http

import (
	"net/http"
	"sort"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func (d *Deps) registerJoinRequestsAcrossGroups(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	mux.HandleFunc("GET "+actorInstancePrefix+"/join-requests", auth.require(d.agentMayDecideJoinRequests(func(w http.ResponseWriter, r *http.Request) {
		m, role, err := actorManagerFor(r.Context(), reg, r.PathValue("instanceID"))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		if role != agencies.RoleOwner && role != agencies.RoleAgent {
			writeInstanceErr(w, agencies.ErrInstanceNotFound)
			return
		}
		rows, err := joinRequestsAcrossGroups(r, m, r.URL.Query().Get("pending_only") == "true")
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, rows)
	})))
}

func joinRequestsAcrossGroups(r *http.Request, m mwanachamaactor.UserManager, pendingOnly bool) ([]mwanachamaactor.GroupJoinRequest, error) {
	groups, err := m.ListGroups(r.Context(), r.URL.Query().Get("hierarchy_id"))
	if err != nil {
		return nil, err
	}
	rows := []mwanachamaactor.GroupJoinRequest{}
	for _, g := range groups {
		found, err := m.ListJoinRequestsForGroup(r.Context(), g.ID, pendingOnly)
		if err != nil {
			return nil, err
		}
		rows = append(rows, found...)
	}
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].AskedAt > rows[j].AskedAt })
	return rows, nil
}
