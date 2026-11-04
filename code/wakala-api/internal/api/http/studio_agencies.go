package http

import (
	"context"
	"net/http"
	"sort"

	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type studioAgency struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
}

type studioSelf struct {
	Subject  string         `json:"subject"`
	Agencies []studioAgency `json:"agencies"`
}

func registerStudioSelfRoute(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("GET /me", auth.require(func(w http.ResponseWriter, r *http.Request) {
		subject := accounts.IDFromContext(r.Context())
		opened, err := d.studioAgenciesFor(r.Context(), subject)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "could not read the agencies the caller may open")
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, studioSelf{Subject: subject, Agencies: opened})
	}))
	mux.HandleFunc("GET /me/agencies", auth.require(listAgenciesJoined(d)))
}

func (d *Deps) studioAgenciesFor(ctx context.Context, subject string) ([]studioAgency, error) {
	reg := d.Registry
	out := []studioAgency{}
	memberships, err := reg.MembershipsFor(ctx, subject)
	if err != nil {
		return nil, err
	}
	for _, m := range memberships {
		staff, err := isStaff(ctx, reg, m.ID, subject)
		if err != nil {
			return nil, err
		}
		if !staff {
			continue
		}
		out = append(out, studioAgency{ID: m.ID, Name: m.Name, Role: m.Role, Permissions: d.linkedAgentPermissions(ctx, reg, m)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func studioPermissionsFor(role string) []string {
	permissions := []string{}
	for _, p := range agencymodels.PermissionCatalog() {
		if role == agencies.RoleOwner || (role == agencies.RoleAgent && !p.Locked) {
			permissions = append(permissions, p.Code)
		}
	}
	sort.Strings(permissions)
	return permissions
}

func (d *Deps) linkedAgentPermissions(ctx context.Context, reg agencies.Registry, m agencies.Membership) []string {
	all := studioPermissionsFor(m.Role)
	if m.Role != agencies.RoleAgent {
		return all
	}
	links, ok := reg.(agencies.AgencyRoleLinks)
	if !ok {
		return all
	}
	subject := accounts.IDFromContext(ctx)
	roleID, err := links.AgencyRoleOf(ctx, m.ID, subject)
	if err != nil || roleID == "" {
		return []string{}
	}
	held, err := d.agencyRolePermissions(context.WithValue(ctx, partitionKey{}, m.ID), roleID)
	if err != nil {
		return []string{}
	}
	holds := map[string]bool{}
	for _, code := range held {
		holds[code] = true
	}
	out := []string{}
	for _, code := range all {
		if holds[code] {
			out = append(out, code)
		}
	}
	return out
}
