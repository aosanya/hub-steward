// Package http wires this repo's internal/agencies.Registry into an HTTP
// surface: bare Instance management plus every mwanachama-backend-agency
// route (Agency/Draft/Goal/Workflow/WorkItem/RACI/department definitions),
// scoped per Instance — matching
// mwanachama-backend-api-gateway's internal/api/http/router.go's shape,
// hand-rolled net/http with no router dependency.
package http

import (
	"net/http"
)

// NewRouter builds the mux with every route registered.
func NewRouter(d *Deps) http.Handler {
	mux := http.NewServeMux()
	auth := d.callerAuth()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	registerInstanceRoutes(mux, d.Registry, auth, d.residentGrants(), d.agentMayDecideJoinRequests)
	registerInstanceImportRoute(mux, d.Registry, auth)
	registerTranslationRoutes(mux, d.Registry, auth, d.Translator, agencyContentLanguages(d.Languages))
	registerAgencyRoutes(mux, d.Registry, auth)
	d.registerReviewRunRoutes(mux, auth)
	d.registerRecordRowRoutes(mux, auth)
	d.registerCallerOpenStepsRoute(mux, auth)
	d.registerSubmitStepAnswersRoute(mux, auth)
	d.registerTaskManagerRoutes(mux, d.Registry, auth, d.endRecordGrantsOf, d.mayOnRecord)
	registerCaseProgressRoute(mux, d.Registry, auth, d.mayOnRecord)
	d.registerFormsCatalogRoutes(mux, d.Registry, auth)
	registerFormsLedRoute(mux, d.Registry, auth)
	registerFormsGitRoutes(mux, d.Registry, auth)
	d.registerSourcesRoutes(mux, d.Registry, auth)
	d.registerVotingRoutes(mux, d.Registry, auth)
	d.registerRiskRoutes(mux, d.Registry, auth)
	d.registerMarketRoutes(mux, d.Registry, auth)
	d.registerModuleMountRoutes(mux, d.Registry, auth)
	d.registerAssetManagerRoutes(mux, d.Registry, auth)
	d.registerAIRoutes(mux, d.Registry, auth)
	d.registerAIGateway(mux, d.Registry, auth)
	d.registerApprovalRoutes(mux, auth)
	d.registerActorRoutes(mux, d.Registry, auth)
	registerMemberRemovalRoutes(mux, d.Registry, auth)
	registerAgencyRoleLinkRoute(mux, d, auth)
	registerCallerRolesRoute(mux, d, auth)
	d.registerJoinRequestsAcrossGroups(mux, d.Registry, auth)
	registerAuthRoutes(mux, d.Operators, d.Sessions, d.AdminToken, d.SessionCookie)
	registerStudioSessionRoutes(mux, d)
	registerMemberAppSessionRoutes(mux, d, auth)
	registerAPIKeyRoutes(mux, d.Sessions, d.APIKeys)
	registerAgencyAPIKeyRoutes(mux, d.Sessions, d.Registry, d.APIKeys)
	registerServiceKeyRoutes(mux, d.AdminToken, d.APIKeys, auth)
	d.registerServiceGrantRoutes(mux, auth)
	registerInsightRoutes(mux, d.Insights, d.Registry, auth)
	d.registerAccountingRoutes(mux, d.Registry, auth)
	d.registerCatalogRoutes(mux, auth)
	d.registerCatalogRatingsRoutes(mux, auth)
	d.registerReportsRoutes(mux, auth)
	d.registerFormsRoutes(mux, auth)
	d.registerInstanceCommRoutes(mux, d.Registry, auth)
	d.registerWorkspaceRoutes(mux, auth)
	registerMeRoutes(mux, d, auth)
	registerStudioSelfRoute(mux, d, auth)
	registerMemberNameRoutes(mux, d.Registry, auth)
	registerLanguageRoutes(mux, d.Registry, d.Languages, auth)
	registerFormsApprovalRoutes(mux, d.Registry, d.FormsSettings, auth)
	registerNotificationRuleRoutes(mux, d.Registry, d.NotifyRules, auth)
	registerOperationRoutes(mux, d, auth, &operationCatalog{})
	registerPlatformOwnerRoutes(mux, auth, newPlatformOwners(d.PlatformOwners, d.Registry))
	registerMCPRoutes(mux, d)
	registerLaunchRoutes(mux, d)
	links := newMagicLinkSender(d.CatalogAuth, d.MemberOrigins)
	registerMemberSignInRoutes(mux, links)
	registerMemberInviteRoutes(mux, auth, memberInvitations{reg: d.Registry, accounts: d.MemberAccounts, links: links, residents: d.residentGrants(), mail: d.InvitationMail})
	registerMemberSessionRoutes(mux, memberSessions{project: d.CatalogAuth, verified: d.verifiedTokens()})

	return withWriteDeadline(responseWriteTimeout, withTenantSlot(allowStudioOrigins(d.StudioOrigins, allowMemberOrigins(d.MemberOrigins, refuseForeignOrigin(append(append([]string{}, d.StudioOrigins...), d.MemberOrigins...), d.PublicBaseURL, limitRequestBody(mux))))))
}
