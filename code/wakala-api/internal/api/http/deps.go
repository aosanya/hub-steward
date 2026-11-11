package http

import (
	"sync"
	"time"

	mwanachamaauth "wakalaserver/modules/auth"
	catalog "wakalaserver/modules/catalog"
	forms "wakalaserver/modules/forms"
	mwanachamainsights "wakalaserver/modules/insights"
	permissions "wakalaserver/modules/permissions"
	ratings "wakalaserver/modules/ratings"
	workspace "wakalaserver/modules/workspace"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
	"wakalaserver/internal/authz"
	"wakalaserver/internal/formsettings"
	"wakalaserver/internal/languages"
	"wakalaserver/internal/notifyrules"
	"wakalaserver/internal/session"
	"wakalaserver/internal/shopauth"
)

// Deps is the dependency bundle NewRouter builds its mux from.
type Deps struct {
	// Registry resolves a URL's {instanceID} to the mwanachama-backend-agency
	// manager for that registered Agency (decision #15).
	Registry agencies.Registry
	AI       AIResolver
	Reviews  ReviewRunner

	rolePermissionsOverride rolePermissions

	// Sessions mints/verifies the httpOnly browser session cookie (decision
	// #11, WK7) — wakala-api's own token, not mwanachama-backend-auth's
	// SessionMinter shape, since that mints a bearer token for a JSON body
	// and this repo's frontend storage decision explicitly rules that out.
	Sessions session.Manager
	// Operators is mwanachama-backend-auth's console credential store — the
	// email/password door decision #11's cookie sits behind. This product
	// has no member/actor directory of its own (decision #13: single shared
	// store, no accounts), so an OperatorCredential's MemberID is minted
	// fresh per credential rather than referencing an existing record — see
	// auth_routes.go's createCredential.
	Operators mwanachamaauth.OperatorRepository
	// AdminToken gates POST /auth/credentials — the only way to mint a new
	// operator credential, since this repo has no sign-up flow (WKS8 is not
	// yet designed) and no capability system to require an existing session
	// against instead. Unset refuses the route outright, matching this
	// codebase family's ADMIN_TOKEN break-glass convention (the gateway's
	// own): a forgotten variable must close the door, not open it.
	AdminToken string
	// SessionCookie configures the Set-Cookie attributes for the session
	// cookie decision #11 calls for. Zero value is dev-shaped (host-only,
	// not Secure) — see cmd/server/main.go's env wiring.
	SessionCookie CookieConfig

	// APIKeys mints/verifies the bearer credential requireCaller accepts
	// alongside a session cookie (decision #4, WK8) — the door an MCP
	// client (WK9) authenticates the core API through, since it has no
	// browser to hold Sessions' cookie in.
	APIKeys apikeys.Manager

	NotifyRules *notifyrules.Store

	Languages     *languages.Store
	FormsSettings *formsettings.Store

	// Insights is mwanachama-backend-insights' single fixed-instance
	// manager, mounted here because api-gateway's own /mcp is
	// deliberately read-only and insight_create is a write — see that
	// repo's CLAUDE.md. Unlike Registry, this is not per-instance: there
	// is exactly one Insights table set for this whole deployment.
	Insights mwanachamainsights.InsightManager

	Catalog catalog.CatalogManager

	Ratings ratings.RatingsManager

	Reports catalog.CatalogManager

	Forms forms.FormManager

	Permissions permissions.PermissionsManager

	Workspace workspace.WorkspaceManager

	Layouts workspace.LayoutManager

	// ShopDB is wakala-api's only durable storage: the website's database,
	// through the scoped wakala_gateway role. It holds no store of its own
	// (architecture-agency-launch.md). Nil refuses the launch routes.
	ShopDB LaunchStore
	// CatalogAuth verifies a bearer token against the Supabase project that
	// holds the catalog, so an agent signs in to the database it works on
	// rather than to a credential this service keeps. Owner's direction,
	// 2026-09-24: the caller holds the identity, the pod holds none. Zero
	// value accepts nothing.
	CatalogAuth shopauth.Verifier

	// Shop verifies a website admin's own Supabase token, since the shop is a
	// static SPA with no secret of its own to authenticate with.
	Shop shopauth.Verifier
	// Launcher builds a launched agency in the customer's own Supabase. Nil
	// records launches without building them.
	Launcher Launcher
	// LaunchProgress is the running commentary the Launcher publishes, which
	// GET /launch/{launchID}/events streams to the admin watching. Nil leaves
	// that route answering 503.
	LaunchProgress LaunchProgress
	// LaunchAnswers carries a reply back to a launch that is waiting on one —
	// today, a project name to use instead of a taken one.
	LaunchAnswers LaunchPrompts
	// ShopOrigin is the website's origin, the only cross-origin caller allowed
	// onto the launch routes. Unset allows none.
	ShopOrigin string

	// PublicBaseURL is the origin callers reach this API on, which the OAuth
	// protected resource metadata has to state exactly. Unset derives it from
	// each request, which is right in tests and in dev but not behind a proxy
	// that rewrites the Host.
	PublicBaseURL string

	MemberOrigins []string

	StudioOrigins []string

	PlatformOwners []string

	MemberAccounts MemberAccounts

	InvitationMail *InvitationMail

	StudioSessions mwanachamaauth.SessionRepository

	MemberSessions MemberSessions

	MemberSessionsSeen MemberSessionsSeen

	Translator Translator

	verified *verifiedTokens

	cacheMu     sync.Mutex
	epochs      *authz.Epochs
	permissions *authz.Cache[[]string]
	sends       *sendLocks
}

// CookieConfig is the deployment-specific half of the session cookie —
// which domain it's scoped to and whether it requires HTTPS. Left
// configurable rather than guessed: which domains mwanachama-wakala-studio
// and this API's own deployment actually sit on is not yet decided (WKS6 is
// still unstarted on the studio side).
type CookieConfig struct {
	Domain   string
	Secure   bool
	SameSite string
}

func (d *Deps) callerAuth() callers {
	return callers{
		sessions: d.Sessions,
		keys:     d.APIKeys,
		project:  d.CatalogAuth,
		verified: d.verifiedTokens(),
		seen:     d.MemberSessionsSeen,
	}
}

func (d *Deps) verifiedTokens() *verifiedTokens {
	if d.verified == nil {
		d.verified = newVerifiedTokens(30 * time.Second)
	}
	return d.verified
}
