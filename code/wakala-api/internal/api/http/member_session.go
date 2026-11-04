package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"wakalaserver/internal/shopauth"
)

const memberSessionTimeout = 10 * time.Second

const maxSessionTokenLength = 4096

type memberSessions struct {
	project  shopauth.Verifier
	verified *verifiedTokens
}

func plausibleSessionToken(token string) bool {
	if token == "" || len(token) > maxSessionTokenLength {
		return false
	}
	for i := 0; i < len(token); i++ {
		if token[i] <= ' ' || token[i] > '~' {
			return false
		}
	}
	return true
}

func writeSessionFailure(w http.ResponseWriter, route string, err error) {
	switch {
	case errors.Is(err, shopauth.ErrNoProject):
		writeErr(w, http.StatusServiceUnavailable, "member sign-in is not configured")
	case errors.Is(err, shopauth.ErrSessionEnded):
		writeErr(w, http.StatusUnauthorized, "that session has ended; sign in again")
	case errors.Is(err, shopauth.ErrRateLimited):
		w.Header().Set("Retry-After", "5")
		writeErr(w, http.StatusTooManyRequests, "the sign-in service is busy; try again shortly")
	default:
		slog.Default().Warn("a member session call failed", "route", route, "error", err.Error())
		writeErr(w, http.StatusBadGateway, "the sign-in service did not answer")
	}
}

func (m memberSessions) refresh(w http.ResponseWriter, r *http.Request) {
	var in struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := readJSON(r, &in); err != nil {
		writeReadErr(w, err)
		return
	}
	if in.RefreshToken == "" {
		writeErr(w, http.StatusBadRequest, "a refresh token is required")
		return
	}
	if !plausibleSessionToken(in.RefreshToken) {
		writeErr(w, http.StatusBadRequest, "that does not look like a refresh token")
		return
	}
	if !m.project.Configured() {
		writeErr(w, http.StatusServiceUnavailable, "member sign-in is not configured")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), memberSessionTimeout)
	defer cancel()
	session, err := m.project.RefreshSession(ctx, in.RefreshToken)
	if err != nil {
		writeSessionFailure(w, "refresh", err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, session)
}

func (m memberSessions) revoke(w http.ResponseWriter, r *http.Request) {
	token, ok := bearerToken(r)
	if !ok || !plausibleSessionToken(token) {
		writeErr(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if !m.project.Configured() {
		writeErr(w, http.StatusServiceUnavailable, "member sign-in is not configured")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), memberSessionTimeout)
	defer cancel()
	err := m.project.EndSession(ctx, token)
	m.verified.forget(token)
	if err != nil {
		writeSessionFailure(w, "revoke", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func registerMemberSessionRoutes(mux *http.ServeMux, m memberSessions) {
	mux.HandleFunc("POST /auth/refresh", m.refresh)
	mux.HandleFunc("POST /auth/revoke", m.revoke)
}
