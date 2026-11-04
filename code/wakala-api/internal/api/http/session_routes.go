package http

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	mwanachamaauth "wakalaserver/modules/auth"
	authmodels "wakalaserver/modules/auth/models"
	authroutes "wakalaserver/modules/auth/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const (
	studioSessionsPrefix     = "/auth"
	studioSessionListAction  = "auth.session.list"
	studioSessionEndAction   = "auth.session.end"
	memberSessionsNotKept    = "member sessions are not configured"
	memberSessionsNotApplied = "member sessions cannot be read until an operator applies the identity project's session functions"
)

type MemberSessions interface {
	List(ctx context.Context, subjectID string) ([]authmodels.IdentitySession, error)
	End(ctx context.Context, subjectID, sessionID string) error
}

type MemberSessionsSeen interface {
	Touch(ctx context.Context, subjectID, sessionID string) error
}

type studioCaller struct{}

func (studioCaller) CallerID(r *http.Request) string { return accounts.IDFromContext(r.Context()) }

type studioCurrentSession struct {
	store mwanachamaauth.SessionRepository
}

func (s studioCurrentSession) CallerSessionID(r *http.Request) string {
	if s.store == nil {
		return ""
	}
	c, err := r.Cookie(sessionCookieName)
	if err != nil {
		return ""
	}
	rec, err := s.store.ByToken(r.Context(), c.Value, time.Now().UTC())
	if err != nil {
		return ""
	}
	return rec.ID
}

func registerStudioSessionRoutes(mux *http.ServeMux, d *Deps) {
	served := map[string]bool{studioSessionListAction: true, studioSessionEndAction: true}
	for _, route := range authroutes.Routes(authroutes.Deps{
		Sessions:       d.StudioSessions,
		Identity:       studioCaller{},
		CurrentSession: studioCurrentSession{store: d.StudioSessions},
	}) {
		if served[route.Action] {
			mux.HandleFunc(route.Pattern(studioSessionsPrefix), requireSession(d.Sessions, route.Handler))
		}
	}
}

type memberSessionView struct {
	authmodels.IdentitySession
	Current bool `json:"current"`
}

type memberAgency struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
}

type memberWithSessions struct {
	MemberID  string                       `json:"member_id"`
	FirstName string                       `json:"first_name"`
	LastName  string                       `json:"last_name"`
	Agencies  []memberAgency               `json:"agencies"`
	Sessions  []authmodels.IdentitySession `json:"sessions"`
}

func registerMemberAppSessionRoutes(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("GET /me/sessions", auth.requireProjectUser(listOwnMemberSessions(d.MemberSessions, auth)))
	mux.HandleFunc("DELETE /me/sessions/{sessionID}", auth.requireProjectUser(endOwnMemberSession(d.MemberSessions, auth)))
	mux.HandleFunc("GET /owner/member-sessions", auth.require(listOwnedMembersSessions(d.Registry, d.MemberSessions)))
}

func writeMemberSessionErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, authmodels.ErrSessionNotFound):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, authmodels.ErrIdentitySessionFunctionsMissing):
		writeErr(w, http.StatusServiceUnavailable, memberSessionsNotApplied)
	default:
		writeErr(w, http.StatusInternalServerError, "internal error")
	}
}

func listOwnMemberSessions(sessions MemberSessions, auth callers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if sessions == nil {
			writeErr(w, http.StatusServiceUnavailable, memberSessionsNotKept)
			return
		}
		caller := accounts.IDFromContext(r.Context())
		list, err := sessions.List(r.Context(), caller)
		if err != nil {
			writeMemberSessionErr(w, err)
			return
		}
		inUse := auth.projectSessionOf(r, caller)
		out := make([]memberSessionView, 0, len(list))
		for _, s := range list {
			out = append(out, memberSessionView{IdentitySession: s, Current: inUse != "" && s.ID == inUse})
		}
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, map[string]any{"sessions": out})
	}
}

func endOwnMemberSession(sessions MemberSessions, auth callers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if sessions == nil {
			writeErr(w, http.StatusServiceUnavailable, memberSessionsNotKept)
			return
		}
		caller := accounts.IDFromContext(r.Context())
		id := r.PathValue("sessionID")
		if inUse := auth.projectSessionOf(r, caller); inUse != "" && strings.EqualFold(id, inUse) {
			writeErr(w, http.StatusConflict, authmodels.ErrSessionInUse.Error())
			return
		}
		if err := sessions.End(r.Context(), caller, id); err != nil {
			writeMemberSessionErr(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func (c callers) requireProjectUser(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if token, ok := bearerToken(r); ok {
			if id, ok := c.projectUserSeen(r.Context(), token); ok {
				next(w, r.WithContext(accounts.WithID(r.Context(), id)))
				return
			}
		}
		c.refuse(w, r)
	}
}

func (c callers) projectSessionOf(r *http.Request, caller string) string {
	token, ok := bearerToken(r)
	if !ok || caller == "" {
		return ""
	}
	if id, verified := c.projectUser(r.Context(), token); !verified || id != caller {
		return ""
	}
	return sessionClaimOf(token)
}

func sessionClaimOf(token string) string {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return ""
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return ""
	}
	var claims struct {
		SessionID string `json:"session_id"`
	}
	if json.Unmarshal(raw, &claims) != nil {
		return ""
	}
	return claims.SessionID
}

func listOwnedMembersSessions(reg agencies.Registry, sessions MemberSessions) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if sessions == nil {
			writeErr(w, http.StatusServiceUnavailable, memberSessionsNotKept)
			return
		}
		ctx := r.Context()
		caller := accounts.IDFromContext(ctx)
		members, err := membersOfOwnedAgencies(ctx, reg, caller)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		for i := range members {
			list, err := sessions.List(ctx, members[i].MemberID)
			if err != nil {
				writeMemberSessionErr(w, err)
				return
			}
			members[i].Sessions = list
		}
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, map[string]any{"members": members})
	}
}

func membersOfOwnedAgencies(ctx context.Context, reg agencies.Registry, caller string) ([]memberWithSessions, error) {
	held, err := reg.MembershipsFor(ctx, caller)
	if err != nil {
		return nil, err
	}
	out := []memberWithSessions{}
	at := map[string]int{}
	for _, m := range held {
		if m.Role != agencies.RoleOwner {
			continue
		}
		roster, err := reg.Members(ctx, m.Instance.ID)
		if err != nil {
			return nil, err
		}
		for _, member := range roster {
			if member.UserID == caller {
				continue
			}
			i, seen := at[member.UserID]
			if !seen {
				i = len(out)
				at[member.UserID] = i
				out = append(out, memberWithSessions{MemberID: member.UserID, Agencies: []memberAgency{}, Sessions: []authmodels.IdentitySession{}})
			}
			out[i].Agencies = append(out[i].Agencies, memberAgency{ID: m.Instance.ID, Name: m.Instance.Name, Role: member.Role})
			if out[i].FirstName == "" && out[i].LastName == "" {
				out[i].FirstName, out[i].LastName = memberNameIn(ctx, reg, m.Instance.ID, member.UserID)
			}
		}
	}
	return out, nil
}

func memberNameIn(ctx context.Context, reg agencies.Registry, instanceID, memberID string) (string, string) {
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil || directory == nil {
		return "", ""
	}
	held, err := directory.GetActor(ctx, memberID)
	if err != nil {
		return "", ""
	}
	return held.FirstName, held.LastName
}
