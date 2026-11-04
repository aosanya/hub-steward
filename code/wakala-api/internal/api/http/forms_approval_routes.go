package http

import (
	"net/http"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/formsettings"
)

const formsApprovalPath = formsInstancePrefix + "/approval-setting"

func registerFormsApprovalRoutes(mux *http.ServeMux, reg agencies.Registry, store *formsettings.Store, auth callers) {
	if reg == nil || store == nil {
		return
	}
	mux.HandleFunc("GET "+formsApprovalPath, auth.require(readFormsApproval(reg, store)))
	mux.HandleFunc("PUT "+formsApprovalPath, auth.require(setFormsApproval(reg, store)))
}

func ownerOnly(r *http.Request, reg agencies.Registry) (string, error) {
	instanceID := r.PathValue("instanceID")
	role, err := admittedRole(r.Context(), reg, instanceID)
	if err != nil {
		return "", err
	}
	if role != agencies.RoleOwner {
		return "", agencies.ErrInstanceNotFound
	}
	return instanceID, nil
}

func readFormsApproval(reg agencies.Registry, store *formsettings.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, err := ownerOnly(r, reg)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		a, err := store.Approval(r.Context(), instanceID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, a)
	}
}

func setFormsApproval(reg agencies.Registry, store *formsettings.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, err := ownerOnly(r, reg)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		var body formsettings.Approval
		if err := readJSON(r, &body); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		a, err := store.PutApproval(r.Context(), instanceID, body)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		fm, err := reg.FormManager(r.Context(), instanceID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		fm.UseApprovalRequired(a.ApprovalRequired)
		writeJSON(w, http.StatusOK, a)
	}
}
