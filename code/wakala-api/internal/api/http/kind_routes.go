package http

import (
	"net/http"

	"wakalaserver/internal/agencies"
)

type kindRequest struct {
	Kind string `json:"kind"`
}

func setKind(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		if err := mustBeMember(r.Context(), reg, instanceID); err != nil {
			writeInstanceErr(w, err)
			return
		}
		var in kindRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		out, err := reg.SetKind(r.Context(), instanceID, in.Kind)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}
