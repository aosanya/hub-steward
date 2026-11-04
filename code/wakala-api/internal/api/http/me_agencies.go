package http

import (
	"context"
	"net/http"
	"sort"

	"wakalaserver/internal/accounts"
)

type callerAgency struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
}

type callerAgencies struct {
	Agencies []callerAgency `json:"agencies"`
}

func (d *Deps) agenciesJoinedBy(ctx context.Context, subject string) ([]callerAgency, error) {
	memberships, err := d.Registry.MembershipsFor(ctx, subject)
	if err != nil {
		return nil, err
	}
	out := make([]callerAgency, 0, len(memberships))
	for _, m := range memberships {
		out = append(out, callerAgency{ID: m.ID, Name: m.Name, Role: m.Role})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func listAgenciesJoined(d *Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		joined, err := d.agenciesJoinedBy(r.Context(), accounts.IDFromContext(r.Context()))
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "could not read the agencies the caller belongs to")
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, callerAgencies{Agencies: joined})
	}
}
