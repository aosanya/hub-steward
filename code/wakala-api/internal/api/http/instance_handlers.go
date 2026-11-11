package http

import (
	"errors"
	"net/http"

	mwanachamaagencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/modules/shared/plaintext"
)

// createInstanceRequest is the wire shape for POST /instances.
type createInstanceRequest struct {
	Name string `json:"name"`
}

func createInstance(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in createInstanceRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		if in.Name == "" {
			writeErr(w, http.StatusBadRequest, "name must not be empty")
			return
		}
		caller := accounts.IDFromContext(r.Context())
		if isMachineCaller(caller) {
			writeErr(w, http.StatusForbidden, errMachineCannotCreate.Error())
			return
		}
		if caller == "" {
			writeErr(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if err := checkInstanceRoom(r.Context(), reg, caller, in.Name); err != nil {
			if errors.Is(err, errInstanceNameTooLong) || errors.Is(err, agencies.ErrInvalidInstanceName) {
				writeErr(w, http.StatusBadRequest, err.Error())
				return
			}
			if errors.Is(err, errTooManyInstances) {
				writeErr(w, http.StatusConflict, err.Error())
				return
			}
			writeInternalErr(w, err)
			return
		}
		out, err := reg.CreateInstance(r.Context(), in.Name)
		if err != nil {
			writeInternalErr(w, err)
			return
		}
		if err := reg.AddMember(r.Context(), out.ID, caller, agencies.RoleOwner); err != nil {
			writeInternalErr(w, err)
			return
		}
		mgr, err := reg.AgencyManager(r.Context(), out.ID)
		if err != nil {
			writeInternalErr(w, err)
			return
		}
		if _, err := mgr.CreateAgency(r.Context(), mwanachamaagencymodels.Agency{
			Name: in.Name,
		}); err != nil {
			writeInternalErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, out)
	}
}

// getInstance handles GET /instances/{instanceID}.
func getInstance(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		if err := mustBeMember(r.Context(), reg, instanceID); err != nil {
			writeInstanceErr(w, err)
			return
		}
		out, err := reg.GetInstance(r.Context(), instanceID)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func listInstances(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		out, err := reg.MembershipsFor(r.Context(), accounts.IDFromContext(r.Context()))
		if err != nil {
			writeInternalErr(w, err)
			return
		}
		for i := range out {
			if out[i].Role == agencies.RoleResident {
				out[i].TableSlug = ""
			}
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func writeInstanceErr(w http.ResponseWriter, err error) {
	if errors.Is(err, agencies.ErrInstanceNotFound) {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	writeInternalErr(w, err)
}

func writeInternalErr(w http.ResponseWriter, err error) {
	if refusal := plaintext.Unstorable(err); refusal != nil {
		writeErr(w, http.StatusBadRequest, refusal.Error())
		return
	}
	logInstanceFailure(w, err)
	writeErr(w, http.StatusInternalServerError, "internal error")
}

func registerInstanceRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers, residents residentGrants, mayDecide func(http.HandlerFunc) http.HandlerFunc, mayChange func(string, http.HandlerFunc) http.HandlerFunc) {
	mux.HandleFunc("POST /instances", auth.require(createInstance(reg)))
	mux.HandleFunc("GET /instances", auth.require(listInstances(reg)))
	mux.HandleFunc("GET /instances/{instanceID}", auth.require(getInstance(reg)))
	mux.HandleFunc("PUT /instances/{instanceID}/kind", auth.require(setKind(reg)))
	mux.HandleFunc("POST /instances/{instanceID}/agents", auth.require(addAgentRoute(reg)))
	registerJoinRoutes(mux, reg, auth, residents, mayDecide, mayChange)
	registerDirectoryRoutes(mux, reg, auth)
}
