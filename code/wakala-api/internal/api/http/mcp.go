// mcp.go mounts a Model Context Protocol server at /mcp (decision #9): an
// AI agent's way to design an Agency, mirroring the same
// mwanachama-backend-agency operations mwanachama-wakala-studio's human
// operator uses (decision #2 — both are thin clients over this one core
// API). The Agency-domain tools themselves live in
// mwanachama-backend-agency's own mcp package (decision #16) — this file
// only supplies resolveAgencyManager as that package's ManagerResolver, the
// same way requireCaller resolves a request's {instanceID} path segment
// for the HTTP surface. mcp_tools_instance.go's agency_list_instances is
// the one tool that stays local: it exposes this repo's own Registry
// (decision #15), a concept the library has no notion of.
//
// Also mounts mwanachama-backend-insights' insight_create/insight_list
// (its own mcp package, same "library owns its tools" pattern as agency)
// — hosted here rather than on api-gateway's /mcp because that endpoint is
// deliberately read-only and insight_create is a write. Unlike agency,
// insights has exactly one fixed instance, so d.Insights is passed as a
// concrete manager, no ManagerResolver needed.
package http

import (
	"context"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymcp "wakalaserver/modules/agency/mcp"
	mwanachamaassetmanager "wakalaserver/modules/assetmanager"
	insightsmcp "wakalaserver/modules/insights/mcp"
	mwanachamasources "wakalaserver/modules/sources"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/dbpool"
)

// resolveAgencyManager turns a caller-supplied InstanceID into the
// mwanachama-backend-agency manager for that Instance. A tool never sees a
// raw agencies.ErrInstanceNotFound — the SDK reports any non-nil error as a
// tool-level failure (IsError), which already reads clearly enough
// ("instance not found") without this package inventing a second error
// shape just for MCP.
func (d *Deps) resolveAgencyManager(ctx context.Context, instanceID string) (mwanachamaagency.AgencyManager, error) {
	return agencyManagerFor(ctx, d.Registry, instanceID)
}

func (d *Deps) resolveSourceManager(ctx context.Context, instanceID string) (mwanachamasources.SourceManager, error) {
	return sourceManagerFor(ctx, d.Registry, instanceID)
}

func (d *Deps) resolveAssetManager(ctx context.Context, instanceID string) (mwanachamaassetmanager.AssetManager, error) {
	return assetManagerFor(ctx, d.Registry, instanceID)
}

func newMCPServer(d *Deps) *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{Name: "mwanachama-wakala", Version: "1.0.0"}, nil)
	server.AddReceivingMiddleware(slotPerToolCall)
	server.AddReceivingMiddleware(conversationPerToolCall)
	d.registerInstanceMCPTools(server)
	d.registerApprovalMCPTools(server)
	d.registerCatalogMCPTools(server)
	d.registerReportsMCPTools(server)
	d.registerTemplateMCPTools(server)
	agencymcp.RegisterToolsAs(server, d.resolveAgencyManager, accounts.IDFromContext)
	d.guardAgencyMCPTools(server)
	d.registerReviewRunMCPTools(server)
	d.registerTaskManagerMCPTools(server, d.resolveTaskManager)
	insightsmcp.RegisterTools(server, scopeInsightsToCaller(d.Insights, d.Registry))
	d.registerSourcesMCPTools(server, d.resolveSourceManager)
	d.registerAssetMCPTools(server, d.resolveAssetManager)
	d.registerFormsMCPTools(server)
	d.registerActorCommMCPTools(server)
	d.registerFormsCatalogMCPTools(server)
	d.registerFormsGitMCPTools(server)
	d.registerAIMCPTools(server)
	d.registerMarketMCPTools(server)
	d.registerRiskMCPTools(server)
	d.registerLiveRecordMCPTools(server)
	d.registerCallerOpenStepsMCPTool(server)
	d.registerSubmitStepAnswersMCPTool(server)
	return server
}

func slotPerToolCall(next mcp.MethodHandler) mcp.MethodHandler {
	return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
		if method == "tools/call" {
			ctx = dbpool.WithSlot(ctx)
		}
		return next(ctx, method, req)
	}
}

func registerMCPRoutes(mux *http.ServeMux, d *Deps) {
	servers := newMCPServers(d)
	handler := mcp.NewStreamableHTTPHandler(servers.forRequest, &mcp.StreamableHTTPOptions{
		SessionTimeout: mcpSessionIdleTimeout,
	})
	resource := newProtectedResource(d)
	registerProtectedResourceRoutes(mux, resource)
	owners := newSessionOwners()
	mux.HandleFunc(mcpPath, d.callerAuth().pointingAt(resource.metadataURL).
		require(guardMCPBody(bindMCPSessions(owners, handler.ServeHTTP))))
}
