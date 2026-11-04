package http

import (
	"context"
	"errors"
	"io"
	"net/http"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type joinBody struct {
	Message string `json:"message"`
}

type joinModeRequest struct {
	JoinMode string `json:"join_mode"`
}

func registerJoinRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers, residents residentGrants, mayDecide func(http.HandlerFunc) http.HandlerFunc) {
	mux.HandleFunc("POST /instances/{instanceID}/join", auth.require(joinInstance(reg, residents)))
	mux.HandleFunc("POST /instances/{instanceID}/leave", auth.require(leaveInstance(reg, residents)))
	mux.HandleFunc("PUT /instances/{instanceID}/join-mode", auth.require(setJoinMode(reg)))
	mux.HandleFunc("PUT /instances/{instanceID}/name", auth.require(renameInstance(reg)))
	mux.HandleFunc("GET /instances/{instanceID}/join-requests", auth.require(mayDecide(listJoinRequests(reg))))
	mux.HandleFunc("POST /instances/{instanceID}/join-requests/{userID}/approve", auth.require(mayDecide(decideJoinRequest(reg, residents, true))))
	mux.HandleFunc("POST /instances/{instanceID}/join-requests/{userID}/refuse", auth.require(mayDecide(decideJoinRequest(reg, residents, false))))
}

var joinStatusCodes = map[string]int{
	agencies.JoinedNow:      http.StatusCreated,
	agencies.JoinRequested:  http.StatusAccepted,
	agencies.AlreadyAMember: http.StatusOK,
}

func joinInstance(reg agencies.Registry, residents residentGrants) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		caller := accounts.IDFromContext(r.Context())
		if caller == "" {
			writeErr(w, http.StatusUnauthorized, "authentication required")
			return
		}
		var in joinBody
		if err := readJSON(r, &in); err != nil && !errors.Is(err, io.EOF) {
			writeReadErr(w, err)
			return
		}
		if inst, err := reg.GetInstance(r.Context(), r.PathValue("instanceID")); err != nil || !inst.Approved() {
			writeInstanceErr(w, agencies.ErrInstanceNotFound)
			return
		}
		out, err := reg.Join(r.Context(), r.PathValue("instanceID"), caller, in.Message)
		if errors.Is(err, agencies.ErrJoinMessageTooLong) {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		if out.Status == agencies.JoinRequested {
			openJoinThread(r.Context(), reg, r.PathValue("instanceID"), agencies.SubjectAgencyJoinRequest, caller, caller)
		}
		if out.Role == agencies.RoleResident {
			if err := admitResident(r.Context(), reg, residents, r.PathValue("instanceID"), caller); err != nil {
				writeErr(w, http.StatusInternalServerError, "internal error")
				return
			}
		}
		writeJSON(w, joinStatusCodes[out.Status], out)
	}
}

func leaveInstance(reg agencies.Registry, residents residentGrants) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, caller := r.PathValue("instanceID"), accounts.IDFromContext(r.Context())
		if err := residents.release(r.Context(), instanceID, caller); err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		err := reg.Leave(r.Context(), instanceID, caller)
		switch {
		case err == nil:
			w.WriteHeader(http.StatusNoContent)
		case errors.Is(err, agencies.ErrNothingToLeave):
			writeErr(w, http.StatusNotFound, agencies.ErrInstanceNotFound.Error())
		case errors.Is(err, agencies.ErrOperatorCannotLeave):
			writeErr(w, http.StatusConflict, err.Error())
		default:
			writeInstanceErr(w, err)
		}
	}
}

func setJoinMode(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		if err := mustBeMember(r.Context(), reg, instanceID); err != nil {
			writeInstanceErr(w, err)
			return
		}
		var in joinModeRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		out, err := reg.SetJoinMode(r.Context(), instanceID, in.JoinMode)
		if errors.Is(err, agencies.ErrInvalidJoinMode) {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

type renameRequest struct {
	Name string `json:"name"`
}

func renameInstance(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		if err := mustBeMember(r.Context(), reg, instanceID); err != nil {
			writeInstanceErr(w, err)
			return
		}
		var in renameRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		out, err := reg.RenameInstance(r.Context(), instanceID, in.Name)
		if errors.Is(err, agencies.ErrInvalidInstanceName) {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func listJoinRequests(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		if err := mustBeMember(r.Context(), reg, instanceID); err != nil {
			writeInstanceErr(w, err)
			return
		}
		out, err := reg.JoinRequests(r.Context(), instanceID)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func decideJoinRequest(reg agencies.Registry, residents residentGrants, approve bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		if err := mustBeMember(r.Context(), reg, instanceID); err != nil {
			writeInstanceErr(w, err)
			return
		}
		err := reg.DecideJoinRequest(r.Context(), instanceID, r.PathValue("userID"), approve)
		if errors.Is(err, agencies.ErrJoinRequestNotFound) {
			writeErr(w, http.StatusNotFound, err.Error())
			return
		}
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		if approve {
			if err := admitResident(r.Context(), reg, residents, instanceID, r.PathValue("userID")); err != nil {
				writeErr(w, http.StatusInternalServerError, "internal error")
				return
			}
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func admitResident(ctx context.Context, reg agencies.Registry, residents residentGrants, instanceID, userID string) error {
	if err := adoptCallerAsActor(ctx, reg, instanceID, userID); err != nil {
		return err
	}
	return residents.admit(ctx, instanceID, userID)
}
