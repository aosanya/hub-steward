package http

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	mwanachamaauth "wakalaserver/modules/auth"

	"wakalaserver/internal/shopauth"
)

const DefaultMemberOrigin = "http://localhost:5062"

const magicLinkAccepted = "if that address can sign in, a link is on its way to it"

const magicLinksInFlight = 16

const magicLinkSendTimeout = 15 * time.Second

func MemberOriginsFrom(raw string) (origins, rejected []string) {
	if strings.TrimSpace(raw) == "" {
		return []string{DefaultMemberOrigin}, nil
	}
	return originsFrom(raw)
}

func originsFrom(raw string) (origins, rejected []string) {
	for _, entry := range strings.Split(raw, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if origin, ok := canonicalOrigin(entry); ok {
			origins = append(origins, origin)
		} else {
			rejected = append(rejected, entry)
		}
	}
	return origins, rejected
}

func canonicalOrigin(raw string) (string, bool) {
	u, err := url.Parse(strings.TrimRight(raw, "/"))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" ||
		u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
		return "", false
	}
	return u.Scheme + "://" + strings.ToLower(u.Host), true
}

func originSet(origins []string) map[string]bool {
	set := make(map[string]bool, len(origins))
	for _, o := range origins {
		set[o] = true
	}
	return set
}

func allowMemberOrigins(origins []string, next http.Handler) http.Handler {
	allowed := originSet(origins)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if !allowed[origin] {
			next.ServeHTTP(w, r)
			return
		}
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Add("Vary", "Origin")
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Conversation-Id")
			h.Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type magicLinkSender struct {
	project shopauth.Verifier
	origins []string
	allowed map[string]bool
	slots   chan struct{}
	sent    func(error)
}

func newMagicLinkSender(project shopauth.Verifier, origins []string) *magicLinkSender {
	return &magicLinkSender{
		project: project,
		origins: origins,
		allowed: originSet(origins),
		slots:   make(chan struct{}, magicLinksInFlight),
		sent:    logMagicLinkOutcome,
	}
}

func logMagicLinkOutcome(err error) {
	if err != nil {
		slog.Default().Warn("a member sign-in link was not sent", "error", err.Error())
	}
}

func (s *magicLinkSender) redirectFor(requested, callerOrigin string) (string, bool) {
	if requested == "" {
		if s.allowed[callerOrigin] {
			return callerOrigin + "/", true
		}
		return s.origins[0] + "/", true
	}
	u, err := url.Parse(requested)
	if err != nil || u.User != nil || u.Fragment != "" {
		return "", false
	}
	origin, ok := canonicalOrigin(u.Scheme + "://" + u.Host)
	if !ok || !s.allowed[origin] {
		return "", false
	}
	return requested, true
}

type linkRequest struct {
	Email      string `json:"email"`
	RedirectTo string `json:"redirect_to"`
}

func (s *magicLinkSender) address(w http.ResponseWriter, r *http.Request, in linkRequest) (email, redirect string, ok bool) {
	email = mwanachamaauth.Normalize(in.Email)
	if email == "" {
		writeErr(w, http.StatusBadRequest, "an email address is required")
		return "", "", false
	}
	if len(email) > maxEmailLength || !mwanachamaauth.ValidEmail(email) {
		writeErr(w, http.StatusBadRequest, "that does not look like an email address")
		return "", "", false
	}
	if len(s.origins) == 0 {
		writeErr(w, http.StatusServiceUnavailable, "member sign-in is not configured")
		return "", "", false
	}
	redirect, ok = s.redirectFor(strings.TrimSpace(in.RedirectTo), r.Header.Get("Origin"))
	if !ok {
		writeErr(w, http.StatusBadRequest, "that redirect is not one of the member app's addresses")
		return "", "", false
	}
	if !s.project.Configured() {
		writeErr(w, http.StatusServiceUnavailable, "member sign-in is not configured")
		return "", "", false
	}
	return email, redirect, true
}

func (s *magicLinkSender) reserve(w http.ResponseWriter) bool {
	select {
	case s.slots <- struct{}{}:
		return true
	default:
		w.Header().Set("Retry-After", "5")
		writeErr(w, http.StatusTooManyRequests, "too many sign-in links are being sent; try again shortly")
		return false
	}
}

func (s *magicLinkSender) release() { <-s.slots }

func (s *magicLinkSender) sendReserved(email, redirect string) {
	go func() {
		defer s.release()
		ctx, cancel := context.WithTimeout(context.Background(), magicLinkSendTimeout)
		defer cancel()
		s.sent(s.project.SendMagicLink(ctx, email, redirect))
	}()
}

func (s *magicLinkSender) handle(w http.ResponseWriter, r *http.Request) {
	var in linkRequest
	if err := readJSON(r, &in); err != nil {
		writeReadErr(w, err)
		return
	}
	email, redirect, ok := s.address(w, r, in)
	if !ok || !s.reserve(w) {
		return
	}
	s.sendReserved(email, redirect)
	writeJSON(w, http.StatusAccepted, map[string]string{"message": magicLinkAccepted})
}

func registerMemberSignInRoutes(mux *http.ServeMux, s *magicLinkSender) {
	mux.HandleFunc("POST /auth/magic-link", s.handle)
}
