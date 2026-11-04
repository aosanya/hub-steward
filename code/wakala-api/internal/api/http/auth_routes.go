// auth_routes.go — the sign-in/sign-out/session-read surface decision #11
// calls for: mwanachama-backend-auth's OperatorRepository (email/password,
// lock-out) authenticates the caller, and this repo's own internal/session
// mints the resulting browser session as an httpOnly cookie rather than the
// bearer-token JSON body mwanachama-backend-auth's own
// routes.OperatorSignIn hands back — decision #11 rules localStorage/a
// client-held token out explicitly.
//
// signIn is not a call to authroutes.OperatorSignIn: that handler's only
// output shape is a JSON body carrying the raw token, which is exactly what
// httpOnly is supposed to keep out of anything script-readable. Rather than
// recover the token from that handler's response and reshape it, the small
// set of steps it performs (lock-out check, verify, record success/failure)
// are called directly against the same mwanachama-backend-auth primitives —
// same order, same one-sentence refusal, same lock-out policy — so the two
// stay behaviourally identical while the wire shape differs.
package http

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	mwanachamaauth "wakalaserver/modules/auth"

	"wakalaserver/internal/session"
	"wakalaserver/internal/throttle"
)

// sessionTTL is how long a signed-in session lasts before a caller must sign
// in again.
const sessionTTL = 30 * 24 * time.Hour

// sessionCookieName is the httpOnly cookie decision #11 calls for.
const sessionCookieName = "wakala_session"

// signInRefusal is the ONLY thing a failed sign-in ever says — no such
// address, wrong password, or a disabled credential all read alike, because
// a caller who can tell them apart has an account-enumeration oracle.
const signInRefusal = "that email address and password do not match a sign-in"

const maxEmailLength = 254

func signIn(ops mwanachamaauth.OperatorRepository, sessions session.Manager, cookie CookieConfig) http.HandlerFunc {
	guard := newSignInGuard()
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		email := mwanachamaauth.Normalize(in.Email)
		if email == "" || in.Password == "" {
			writeErr(w, http.StatusBadRequest, "an email address and a password are required")
			return
		}
		if len(email) > maxEmailLength {
			writeErr(w, http.StatusBadRequest, "that email address is too long to be one")
			return
		}
		now := time.Now()
		clientKey := signInClientKey(email, clientAddress(r))

		perClient, admitted := guard.byClient.Take(clientKey, now)
		if !admitted {
			writeSignInLocked(w, perClient.LockedUntil, now)
			return
		}
		if perAddress, admitted := guard.byAddress.Take(email, now); !admitted {
			writeSignInLocked(w, perAddress.LockedUntil, now)
			return
		}

		cred, hash, credErr := ops.Verifier(r.Context(), email)
		matched := false
		if credErr == nil {
			matched, _ = throttle.VerifyPassword(hash, in.Password)
		} else {
			throttle.VerifyAgainstNothing(in.Password)
		}

		if !matched {
			if perClient.Locked(now) {
				writeSignInLocked(w, perClient.LockedUntil, now)
				return
			}
			writeJSON(w, http.StatusUnauthorized, map[string]any{
				"error":      signInRefusal,
				"tries_left": perClient.TriesLeft(guard.byClient.LockAfter()),
			})
			return
		}

		guard.byClient.Clear(clientKey)
		guard.byAddress.Clear(email)
		s, err := sessions.Mint(session.WithUserAgent(r.Context(), r.UserAgent()), cred.SubjectID, sessionTTL)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "could not mint a session")
			return
		}
		http.SetCookie(w, sessionSetCookie(s, cookie))
		writeJSON(w, http.StatusCreated, map[string]any{"expires_at": s.ExpiresAt})
	}
}

func writeSignInLocked(w http.ResponseWriter, lockedUntil time.Time, now time.Time) {
	retryAfter(w, lockedUntil, now)
	writeJSON(w, http.StatusTooManyRequests, map[string]any{
		"error":        "too many wrong passwords — this sign-in is locked",
		"locked_until": lockedUntil,
		"tries_left":   0,
	})
}

func writeAdminTokenLocked(w http.ResponseWriter, lockedUntil time.Time, now time.Time) {
	retryAfter(w, lockedUntil, now)
	writeJSON(w, http.StatusTooManyRequests, map[string]any{
		"error":        "too many wrong tokens — try again later",
		"locked_until": lockedUntil,
	})
}

func retryAfter(w http.ResponseWriter, lockedUntil time.Time, now time.Time) {
	retry := int(lockedUntil.Sub(now).Seconds())
	if retry < 1 {
		retry = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(retry))
}

// signOut handles POST /auth/signout. Always succeeds — a caller with no
// cookie or an already-expired one is, from its own point of view, already
// signed out.
func signOut(sessions session.Manager, cookie CookieConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if c, err := r.Cookie(sessionCookieName); err == nil {
			_ = sessions.Revoke(r.Context(), c.Value)
		}
		http.SetCookie(w, sessionClearCookie(cookie))
		w.WriteHeader(http.StatusNoContent)
	}
}

// getSession handles GET /auth/session — the door
// mwanachama-wakala-studio's React Router loaders call server-side,
// forwarding the browser's own cookie, to learn whether a visitor is signed
// in (decision #11).
func getSession(sessions session.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookieName)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "not signed in")
			return
		}
		s, err := sessions.Verify(r.Context(), c.Value)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "not signed in")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"member_id":  s.MemberID,
			"expires_at": s.ExpiresAt,
		})
	}
}

// createCredentialRequest is the wire shape for POST /auth/credentials.
type createCredentialRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// createCredential handles POST /auth/credentials — the only way to mint a
// sign-in for this product. Gated on adminToken (X-Admin-Token header)
// rather than an existing session/capability: this repo has no member
// directory to check an inviter's authority against (decision #13) and no
// sign-up flow (mwanachama-wakala-studio's WKS8 is not yet designed), so an
// operator-supplied break-glass token is what stands in, matching this
// codebase family's existing ADMIN_TOKEN convention. adminToken == ""
// refuses every call — a deployment that forgot to set it gets a closed
// door, not an open one.
//
// The credential's MemberID is minted fresh here rather than taken from the
// request or looked up: mwanachama-backend-auth's OperatorCredential models
// a *member's* console credential, but this product has no member/actor
// registry of its own for it to reference (decision #13), so the credential
// is its own identity — one MemberID per credential, opaque, never chosen
// by the caller.
func createCredential(ops mwanachamaauth.OperatorRepository, adminToken string) http.HandlerFunc {
	wrongGuesses := throttle.NewStrikes(throttle.AdminTokenTrackedClients, throttle.AdminTokenTriesPerClient, throttle.AdminTokenLockFor)
	return func(w http.ResponseWriter, r *http.Request) {
		client := clientAddress(r)
		now := time.Now()
		if adminToken == "" {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		guesses, admitted := wrongGuesses.Take(client, now)
		if !admitted {
			writeAdminTokenLocked(w, guesses.LockedUntil, now)
			return
		}
		if subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Admin-Token")), []byte(adminToken)) != 1 {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		wrongGuesses.Clear(client)
		var in createCredentialRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		email := mwanachamaauth.Normalize(in.Email)
		if !mwanachamaauth.ValidEmail(email) {
			writeErr(w, http.StatusBadRequest, "that does not look like an email address")
			return
		}
		hash, err := mwanachamaauth.Hash(in.Password)
		if errors.Is(err, mwanachamaauth.ErrPasswordTooShort) {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		out, err := ops.Create(r.Context(),
			mwanachamaauth.OperatorCredential{SubjectID: uuid.New().String(), Email: email}, hash)
		if errors.Is(err, mwanachamaauth.ErrOperatorEmailTaken) {
			writeErr(w, http.StatusConflict, err.Error())
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusCreated, out)
	}
}

// registerAuthRoutes mounts the sign-in/sign-out/session-read/credential
// surface.
func registerAuthRoutes(mux *http.ServeMux, ops mwanachamaauth.OperatorRepository, sessions session.Manager, adminToken string, cookie CookieConfig) {
	mux.HandleFunc("POST /auth/signin", signIn(ops, sessions, cookie))
	mux.HandleFunc("POST /auth/signout", signOut(sessions, cookie))
	mux.HandleFunc("GET /auth/session", getSession(sessions))
	mux.HandleFunc("POST /auth/credentials", createCredential(ops, adminToken))
}

func sessionSetCookie(s session.Session, cookie CookieConfig) *http.Cookie {
	return &http.Cookie{
		Name:     sessionCookieName,
		Value:    s.Token,
		Path:     "/",
		Domain:   cookie.Domain,
		Expires:  s.ExpiresAt,
		HttpOnly: true,
		Secure:   cookie.Secure,
		SameSite: cookie.sameSite(),
	}
}

func sessionClearCookie(cookie CookieConfig) *http.Cookie {
	return &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		Domain:   cookie.Domain,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   cookie.Secure,
		SameSite: cookie.sameSite(),
	}
}
