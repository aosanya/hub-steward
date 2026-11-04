package http

import (
	"net/http"
	"net/url"
	"strings"
)

func isStateChanging(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions, http.MethodTrace:
		return false
	}
	return true
}

func originOf(rawURL string) string {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

const signInPath = "/auth/signin"

func actsWithASession(r *http.Request) bool {
	return r.Header.Get("Cookie") != "" || r.URL.Path == signInPath
}

func refuseForeignOrigin(allowed []string, publicBaseURL string, next http.Handler) http.Handler {
	trusted := originSet(allowed)
	if own := originOf(publicBaseURL); own != "" {
		trusted[own] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isStateChanging(r.Method) || !actsWithASession(r) {
			next.ServeHTTP(w, r)
			return
		}
		origin := r.Header.Get("Origin")
		if origin == "" {
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				writeErr(w, http.StatusForbidden, "cross-site request refused")
				return
			}
			next.ServeHTTP(w, r)
			return
		}
		if trusted[origin] || strings.EqualFold(strings.TrimPrefix(strings.TrimPrefix(origin, "https://"), "http://"), r.Host) {
			next.ServeHTTP(w, r)
			return
		}
		writeErr(w, http.StatusForbidden, "cross-site request refused")
	})
}
