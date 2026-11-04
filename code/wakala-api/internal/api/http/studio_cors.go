package http

import (
	"fmt"
	"net/http"
	"strings"
)

const (
	studioAllowedMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
	studioAllowedHeaders = "Authorization, Content-Type, X-Conversation-Id, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID"
	studioExposedHeaders = "Mcp-Session-Id, WWW-Authenticate, Retry-After"
	studioPreflightAge   = "600"
)

func StudioOriginsFrom(raw string) (origins, rejected []string) {
	return originsFrom(raw)
}

func OriginsOverlap(a, b []string) []string {
	inB := originSet(b)
	var shared []string
	for _, o := range a {
		if inB[o] {
			shared = append(shared, o)
		}
	}
	return shared
}

func CheckedStudioOrigins(raw string, memberOrigins []string) (origins, rejected []string, err error) {
	origins, rejected = StudioOriginsFrom(raw)
	if shared := OriginsOverlap(origins, memberOrigins); len(shared) > 0 {
		return nil, rejected, fmt.Errorf("STUDIO_ORIGINS and MEMBER_APP_ORIGINS both list %s: the console is granted credentials and a member app never is, so an origin cannot be both", strings.Join(shared, ","))
	}
	return origins, rejected, nil
}

func allowStudioOrigins(origins []string, next http.Handler) http.Handler {
	allowed := originSet(origins)
	delete(allowed, "")
	if len(allowed) == 0 {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if !allowed[origin] {
			next.ServeHTTP(w, r)
			return
		}
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Access-Control-Allow-Credentials", "true")
		h.Add("Vary", "Origin")
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			h.Set("Access-Control-Allow-Methods", studioAllowedMethods)
			h.Set("Access-Control-Allow-Headers", studioAllowedHeaders)
			h.Set("Access-Control-Max-Age", studioPreflightAge)
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.Set("Access-Control-Expose-Headers", studioExposedHeaders)
		next.ServeHTTP(w, r)
	})
}
