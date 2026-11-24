package http

import (
	"net/http"
	"time"

	"wakalaserver/internal/accounts"
)

const assumedGroupProjectWindow = 30 * 24 * time.Hour

const assumedKeyWindow = 30 * 24 * time.Hour

const (
	cookieSessionKeyPrefix  = "cookie:"
	projectSessionKeyPrefix = "project:"
	keySessionKeyPrefix     = "key:"
)

type loginSession struct {
	key    string
	endsAt time.Time
}

func (d *Deps) loginSessionOf(r *http.Request, auth callers) (loginSession, bool) {
	caller := accounts.IDFromContext(r.Context())
	if keyID := auth.keySessionOf(r, caller); keyID != "" {
		return loginSession{key: keySessionKeyPrefix + keyID, endsAt: time.Now().UTC().Add(assumedKeyWindow)}, true
	}
	if claim := auth.projectSessionOf(r, caller); claim != "" {
		return loginSession{key: projectSessionKeyPrefix + claim, endsAt: time.Now().UTC().Add(assumedGroupProjectWindow)}, true
	}
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil || d.Sessions == nil {
		return loginSession{}, false
	}
	verified, err := d.Sessions.Verify(r.Context(), cookie.Value)
	if err != nil || verified.MemberID != caller {
		return loginSession{}, false
	}
	return loginSession{key: cookieSessionKeyPrefix + digest(cookie.Value), endsAt: verified.ExpiresAt}, true
}
