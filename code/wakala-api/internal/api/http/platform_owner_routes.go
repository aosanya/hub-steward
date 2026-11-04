package http

import (
	"errors"
	"net/http"
	"strings"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

func PlatformOwnersFrom(raw string) []string {
	var ids []string
	for _, id := range strings.Split(raw, ",") {
		if id = strings.TrimSpace(id); id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

type platformOwners struct {
	ids       map[string]bool
	approvals agencies.ApprovalRegistry
}

func newPlatformOwners(ids []string, reg agencies.Registry) platformOwners {
	set := make(map[string]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	approvals, _ := reg.(agencies.ApprovalRegistry)
	return platformOwners{ids: set, approvals: approvals}
}

func (p platformOwners) only(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if p.approvals == nil || !p.ids[accounts.IDFromContext(r.Context())] {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		next(w, r)
	}
}

func (p platformOwners) listPending(w http.ResponseWriter, r *http.Request) {
	pending, err := p.approvals.ListPendingInstances(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": pending})
}

type approvalDecision struct {
	Note string `json:"note"`
}

func (p platformOwners) decide(approve bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in approvalDecision
		if r.ContentLength != 0 {
			if err := readJSON(r, &in); err != nil {
				writeReadErr(w, err)
				return
			}
		}
		inst, err := p.approvals.DecideApproval(r.Context(), r.PathValue("instanceID"), approve, in.Note)
		switch {
		case errors.Is(err, agencies.ErrInstanceNotFound):
			writeErr(w, http.StatusNotFound, "not found")
		case errors.Is(err, agencies.ErrApprovalDecided):
			writeErr(w, http.StatusConflict, "the agency's approval is already decided")
		case errors.Is(err, agencies.ErrApprovalNoteLong):
			writeErr(w, http.StatusBadRequest, "the note is too long")
		case err != nil:
			writeErr(w, http.StatusInternalServerError, "internal error")
		default:
			writeJSON(w, http.StatusOK, inst)
		}
	}
}

func registerPlatformOwnerRoutes(mux *http.ServeMux, auth callers, p platformOwners) {
	mux.HandleFunc("GET /platform/agencies/pending", auth.require(p.only(p.listPending)))
	mux.HandleFunc("POST /platform/agencies/{instanceID}/approve", auth.require(p.only(p.decide(true))))
	mux.HandleFunc("POST /platform/agencies/{instanceID}/decline", auth.require(p.only(p.decide(false))))
}
