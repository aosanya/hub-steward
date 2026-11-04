package http

import (
	"errors"
	"net/http"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/notifyrules"
)

func registerNotificationRuleRoutes(mux *http.ServeMux, reg agencies.Registry, store *notifyrules.Store, auth callers) {
	if store == nil {
		return
	}
	mux.HandleFunc("GET /instances/{instanceID}/notification-rules", auth.require(listNotificationRules(reg, store)))
	mux.HandleFunc("GET /instances/{instanceID}/notification-rules/{event}", auth.require(readNotificationRule(reg, store)))
	mux.HandleFunc("PUT /instances/{instanceID}/notification-rules/{event}", auth.require(putNotificationRule(reg, store)))
	mux.HandleFunc("DELETE /instances/{instanceID}/notification-rules/{event}", auth.require(resetNotificationRule(reg, store)))
	mux.HandleFunc("POST /instances/{instanceID}/notification-rules/{event}/preview", auth.require(previewNotificationRule(reg, store)))
}

func ownerOfRules(w http.ResponseWriter, r *http.Request, reg agencies.Registry) (string, bool) {
	instanceID := r.PathValue("instanceID")
	role, err := admittedRole(r.Context(), reg, instanceID)
	if err != nil {
		writeInstanceErr(w, err)
		return "", false
	}
	if role != agencies.RoleOwner {
		writeInstanceErr(w, agencies.ErrInstanceNotFound)
		return "", false
	}
	return instanceID, true
}

func listNotificationRules(reg agencies.Registry, store *notifyrules.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, ok := ownerOfRules(w, r, reg)
		if !ok {
			return
		}
		rules, err := store.All(r.Context(), instanceID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": rules})
	}
}

func readNotificationRule(reg agencies.Registry, store *notifyrules.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, ok := ownerOfRules(w, r, reg)
		if !ok {
			return
		}
		rule, err := store.Rule(r.Context(), instanceID, notifyrules.Event(r.PathValue("event")))
		if err != nil {
			writeNotificationRuleErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, rule)
	}
}

type notificationRuleBody struct {
	Told     []notifyrules.Audience `json:"told"`
	Fallback []notifyrules.Audience `json:"fallback"`
	Mutable  bool                   `json:"mutable"`
}

func putNotificationRule(reg agencies.Registry, store *notifyrules.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, ok := ownerOfRules(w, r, reg)
		if !ok {
			return
		}
		var body notificationRuleBody
		if err := readJSON(r, &body); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		rule := notifyrules.Rule{Event: notifyrules.Event(r.PathValue("event")), Told: body.Told, Fallback: body.Fallback, Mutable: body.Mutable}
		out, err := store.Put(r.Context(), instanceID, rule)
		if err != nil {
			writeNotificationRuleErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func resetNotificationRule(reg agencies.Registry, store *notifyrules.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, ok := ownerOfRules(w, r, reg)
		if !ok {
			return
		}
		out, err := store.Reset(r.Context(), instanceID, notifyrules.Event(r.PathValue("event")))
		if err != nil {
			writeNotificationRuleErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func writeNotificationRuleErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, notifyrules.ErrUnknownEvent):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, notifyrules.ErrAudienceRefused), errors.Is(err, notifyrules.ErrMuteFixed):
		writeErr(w, http.StatusBadRequest, err.Error())
	default:
		writeErr(w, http.StatusInternalServerError, "internal error")
	}
}
