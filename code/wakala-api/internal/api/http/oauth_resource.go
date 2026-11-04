package http

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/oauthex"
)

const (
	protectedResourcePath = "/.well-known/oauth-protected-resource"
	mcpPath               = "/mcp"
)

type protectedResource struct {
	baseURL              string
	authorizationServers []string
}

func newProtectedResource(d *Deps) protectedResource {
	var servers []string
	if issuer := authorizationServer(d.CatalogAuth.URL); issuer != "" {
		servers = append(servers, issuer)
	}
	return protectedResource{baseURL: d.PublicBaseURL, authorizationServers: servers}
}

func authorizationServer(projectURL string) string {
	trimmed := strings.TrimRight(projectURL, "/")
	if trimmed == "" {
		return ""
	}
	return trimmed + "/auth/v1"
}

func (p protectedResource) base(r *http.Request) string {
	if p.baseURL != "" {
		return strings.TrimRight(p.baseURL, "/")
	}
	return requestScheme(r) + "://" + r.Host
}

func requestScheme(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-Proto"); forwarded != "" {
		return strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	if r.TLS != nil {
		return "https"
	}
	return "http"
}

func (p protectedResource) metadataURL(r *http.Request) string {
	return p.base(r) + protectedResourcePath + mcpPath
}

func (p protectedResource) document(r *http.Request) *oauthex.ProtectedResourceMetadata {
	return &oauthex.ProtectedResourceMetadata{
		Resource:               p.base(r) + mcpPath,
		AuthorizationServers:   p.authorizationServers,
		BearerMethodsSupported: []string{"header"},
		ResourceName:           "Mwanachama-Wakala",
	}
}

func (p protectedResource) serve(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(p.document(r))
}

func registerProtectedResourceRoutes(mux *http.ServeMux, p protectedResource) {
	mux.HandleFunc(protectedResourcePath, p.serve)
	mux.HandleFunc(protectedResourcePath+mcpPath, p.serve)
}
