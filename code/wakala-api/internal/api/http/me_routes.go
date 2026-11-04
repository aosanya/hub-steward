package http

import (
	"net/http"
	"sort"

	permissions "wakalaserver/modules/permissions"

	"wakalaserver/internal/accounts"
)

type callerActions struct {
	Subject string   `json:"subject"`
	Gated   bool     `json:"gated"`
	Actions []string `json:"actions"`
	Scopes  []string `json:"scopes"`
}

func registerMeRoutes(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("GET /me/actions", auth.require(func(w http.ResponseWriter, r *http.Request) {
		subject := accounts.IDFromContext(r.Context())
		out := callerActions{
			Subject: subject, Gated: d.Permissions != nil,
			Actions: []string{}, Scopes: []string{},
		}
		if d.Permissions == nil {
			writeJSON(w, http.StatusOK, out)
			return
		}
		actions, err := d.Permissions.ActionsAnywhere(r.Context(), subject)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "could not read the caller's permissions")
			return
		}
		if actions != nil {
			out.Actions = actions
		}
		grants, err := d.Permissions.ListGrants(r.Context(), permissions.GrantFilter{Subject: subject})
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "could not read the caller's grants")
			return
		}
		seen := map[string]bool{}
		for _, g := range grants {
			if seen[g.Scope] {
				continue
			}
			seen[g.Scope] = true
			out.Scopes = append(out.Scopes, g.Scope)
		}
		sort.Strings(out.Scopes)
		writeJSON(w, http.StatusOK, out)
	}))
}
