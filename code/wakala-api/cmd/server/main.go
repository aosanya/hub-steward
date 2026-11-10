// Command server boots the mwanachama-wakala-api service.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	mwanachamaauth "wakalaserver/modules/auth"
	mwanachamainsights "wakalaserver/modules/insights"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	apihttp "wakalaserver/internal/api/http"
	"wakalaserver/internal/apikeys"
	"wakalaserver/internal/authz"
	"wakalaserver/internal/dbpool"
	"wakalaserver/internal/formsettings"
	"wakalaserver/internal/languages"
	"wakalaserver/internal/launch"
	"wakalaserver/internal/launchlog"
	"wakalaserver/internal/notifyrules"
	"wakalaserver/internal/reviewruns"
	"wakalaserver/internal/session"
	"wakalaserver/internal/shopauth"
	"wakalaserver/internal/shopdb"
	"wakalaserver/internal/specs"
	"wakalaserver/internal/supabasemgmt"
)

// devSessionSecret signs session cookies when WAKALA_SESSION_SECRET is
// unset. A public constant in the source is a dev convenience and nothing
// else — fine for a local `make run`/`make self-test`, and the WARN log
// below says so loudly. There is no dev/deployment-shape signal in this
// repo yet (unlike the gateway's GATEWAY_ENV), so unlike the gateway this
// cannot fail closed outside one; that refinement can follow once this
// repo's own deployment story exists.
const devSessionSecret = "wakala-dev-insecure-session-secret"

func main() {
	// LOG_LEVEL=debug turns on the per-statement detail behind the launch
	// flow's step logging (internal/launch).
	level := slog.LevelInfo
	if strings.EqualFold(os.Getenv("LOG_LEVEL"), "debug") {
		level = slog.LevelDebug
	}
	logger := newLogger(level)
	slog.SetDefault(logger)

	prepareEnvironment(logger)

	addr := ":8080"
	if v := os.Getenv("PORT"); v != "" {
		addr = ":" + v
	}
	deps := buildDeps(logger)
	if err := deps.SeedResidentGrants(context.Background()); err != nil {
		logger.Error("could not seed the residents' grants", "effect", "a resident missing a grant is refused their agency's forms until they join again", "error", err.Error())
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           withRequestLog(apihttp.NewRouter(deps), logger),
		ReadHeaderTimeout: apihttp.ServerReadHeaderTimeout,
		ReadTimeout:       apihttp.ServerReadTimeout,
		IdleTimeout:       apihttp.ServerIdleTimeout,
	}

	go func() {
		logger.Info("listening", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("listen failed", "addr", addr, "error", err.Error())
			os.Exit(1)
		}
	}()

	sweepCtx, stopSweep := context.WithCancel(context.Background())
	defer stopSweep()
	startScheduleSweep(sweepCtx, deps.Registry, logger)
	startStepLimitSweep(sweepCtx, deps.Registry, deps.NotifyRules.Rule, logger)
	if deps.Reviews != nil {
		go resumeReviews(sweepCtx, deps.Reviews, logger)
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	logger.Info("shutting down")
	stopSweep()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

// buildDeps wires this repo's Deps bundle. DATABASE_URL (the same env var
// `make migrate-up` already targets) opens the real decision #8 Postgres
// backend via GORM; unset falls back to sqlite, as before —
// WAKALA_SQLITE_PATH points that at a file so a local `make run` keeps its
// data across restarts, and unset (the self-test default) keeps everything
// in-memory and disposable. Tests still run against sqlite regardless
// (decision #8), never a real Postgres container.
func buildDeps(logger *slog.Logger) *apihttp.Deps {
	var db *gorm.DB
	var err error
	var memberAccounts apihttp.MemberAccounts
	var memberSessions apihttp.MemberSessions
	var memberSessionsSeen apihttp.MemberSessionsSeen
	epochs := authz.NewEpochs()
	tenantGate := dbpool.NewGate(accounts.TenantLimitFromEnv(dbpool.DefaultTenantLimit, os.Getenv))
	accounts.TenantGate = tenantGate
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		db, err = gorm.Open(postgres.Open(dsn), accounts.GormConfig())
		if err != nil {
			logger.Error("could not open postgres", "error", err.Error())
			os.Exit(1)
		}
		if pool, err := db.DB(); err == nil {
			sizePool(pool, poolConnections(os.Getenv))
		}
		memberAccounts = identityAccounts(logger, db)
		memberSessions, memberSessionsSeen = identitySessions(logger, db)
	} else {
		dsn := sqliteDSN(os.Getenv("WAKALA_SQLITE_PATH"))
		db, err = gorm.Open(sqlite.Open(dsn), accounts.GormConfig())
		if err != nil {
			logger.Error("could not open sqlite", "dsn", dsn, "error", err.Error())
			os.Exit(1)
		}
	}
	dbpool.Install(db, dbpool.Options{Gate: tenantGate})
	logger.Info("per-tenant database concurrency", "tenant_limit", accounts.TenantLimitFromEnv(dbpool.DefaultTenantLimit, os.Getenv))
	notifyRules, err := notifyrules.NewStore(db)
	if err != nil {
		logger.Error("could not build notifyrules.Store", "error", err.Error())
		os.Exit(1)
	}

	formsSettings, err := formsettings.NewStore(db)
	if err != nil {
		logger.Error("could not build formsettings.Store", "error", err.Error())
		os.Exit(1)
	}

	lifetime := invitationLifetime(logger)
	permissionsManager := buildPermissions(logger)
	scenariosAtOnce := agencies.ScenariosAtOnce(func(context.Context, string) (int, error) { return 0, nil })
	atOnce := func(ctx context.Context, instanceID string) (int, error) { return scenariosAtOnce(ctx, instanceID) }
	testSeat := &testRunSeat{logger: logger}
	var consentReg agencies.Registry
	reg, err := agencies.NewRegistry(db, append(testSeat.options(), agencies.WithConsentRequired(apihttp.ConsentRequired(func() agencies.Registry { return consentReg })), agencies.WithModuleMounted(apihttp.ModuleMounted(func() agencies.Registry { return consentReg })), agencies.WithScenariosAtOnce(atOnce), agencies.WithEpochs(epochs), lifetime, webPush(logger), agencies.WithMutability(notifyRules.Mutable), agencies.WithRules(notifyRules.Rule), agencies.WithFormsApproval(formsSettings.Required), agencies.WithRecordGrants(apihttp.RecordGrants(permissionsManager)))...)
	if err != nil {
		logger.Error("could not build agencies.Registry", "error", err.Error())
		os.Exit(1)
	}
	consentReg = reg

	// wakala-api keeps no store of its own (architecture-agency-launch.md): a
	// launch's connection lives in the website's database, reached through the
	// scoped wakala_gateway role. Unset leaves every caller on the shared
	// registry, which is what a plain local boot wants.
	accounts.AllowLocalDSN = os.Getenv("WAKALA_ALLOW_LOCAL_DSN") == "true"
	// Kept as the concrete type and only widened into Deps when non-nil: a typed
	// nil in an interface field is not nil, and the launch routes test for nil.
	var shop *shopdb.Store
	if dsn := os.Getenv("SHOP_GATEWAY_DB_URL"); dsn != "" {
		if shop, err = shopdb.Open(dsn); err != nil {
			logger.Error("could not open the shop database", "error", err.Error())
			os.Exit(1)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := shop.Ping(ctx); err != nil {
			logger.Error("could not reach the shop database", "error", err.Error())
			os.Exit(1)
		}
	} else {
		logger.Warn("SHOP_GATEWAY_DB_URL is unset",
			"effect", "POST /launch answers 503 and no launched agency can be reached",
			"fix", "set it to the wakala_gateway login on the shop database")
	}

	// Resolve is how the pool refills: it is memory only, so a restart or a
	// request for an agency launched long ago comes back through here.
	resolve := func(ctx context.Context, accountID string) (accounts.Connection, bool, error) {
		if shop == nil {
			return accounts.Connection{}, false, nil
		}
		conn, err := shop.Resolve(ctx, accountID)
		if errors.Is(err, shopdb.ErrLaunchNotFound) || errors.Is(err, shopdb.ErrNotProvisioned) {
			return accounts.Connection{}, false, nil
		}
		if err != nil {
			return accounts.Connection{}, false, err
		}
		return conn, true, nil
	}
	var acctReg agencies.Registry
	acctRouter := accounts.NewRouter(reg, resolve, accounts.OpenPostgres, 32, append(testSeat.options(), agencies.WithConsentRequired(apihttp.ConsentRequired(func() agencies.Registry { return acctReg })), agencies.WithModuleMounted(apihttp.ModuleMounted(func() agencies.Registry { return acctReg })), lifetime, agencies.WithFormsApproval(formsSettings.Required), agencies.WithScenariosAtOnce(atOnce))...)
	acctReg = acctRouter

	authRaw, err := specs.Raw("auth")
	if err != nil {
		logger.Error("could not read the auth declaration", "error", err.Error())
		os.Exit(1)
	}
	authSpec, err := mwanachamaauth.ParseSpec(authRaw)
	if err != nil {
		logger.Error("could not load the auth declaration", "error", err.Error())
		os.Exit(1)
	}
	if err := mwanachamaauth.Provision(db, authSpec); err != nil {
		logger.Error("could not provision mwanachama-backend-auth tables", "error", err.Error())
		os.Exit(1)
	}
	operators, err := mwanachamaauth.NewOperatorStore(db, authSpec)
	if err != nil {
		logger.Error("could not build the auth operator store", "error", err.Error())
		os.Exit(1)
	}

	sessionStore, err := mwanachamaauth.NewSessionStore(db.Session(&gorm.Session{SkipDefaultTransaction: true}), authSpec)
	if err != nil {
		logger.Error("could not build the auth session store", "error", err.Error())
		os.Exit(1)
	}
	studioSessions := session.NewLedger(sessionStore, epochs)

	insightSpec, err := mwanachamainsights.SpecFor("app")
	if err != nil {
		logger.Error("could not load the mwanachama-backend-insights spec", "error", err.Error())
		os.Exit(1)
	}
	if err := mwanachamainsights.Provision(db, insightSpec); err != nil {
		logger.Error("could not provision mwanachama-backend-insights tables", "error", err.Error())
		os.Exit(1)
	}
	insights, err := mwanachamainsights.NewInsightManager(db, insightSpec)
	if err != nil {
		logger.Error("could not build mwanachamainsights.InsightManager", "error", err.Error())
		os.Exit(1)
	}

	catalogManager := buildCatalog(logger)
	reportsManager := buildReports(logger)
	formManager := buildForms(logger)
	workspaceManager := buildWorkspace(logger)

	keys, err := apikeys.NewManager(db)
	if err != nil {
		logger.Error("could not build apikeys.Manager", "error", err.Error())
		os.Exit(1)
	}

	languageStore, err := languages.NewStore(db)
	if err != nil {
		logger.Error("could not build languages.Store", "error", err.Error())
		os.Exit(1)
	}

	secret := os.Getenv("WAKALA_SESSION_SECRET")
	if secret == "" {
		logger.Warn("signing sessions with the PUBLIC dev secret",
			"env", "WAKALA_SESSION_SECRET unset",
			"effect", "anyone who reads this repository can forge a session cookie",
			"fix", "set WAKALA_SESSION_SECRET to a private value")
		secret = devSessionSecret
	}

	adminToken := os.Getenv("WAKALA_ADMIN_TOKEN")
	if adminToken == "" {
		logger.Warn("WAKALA_ADMIN_TOKEN is unset",
			"effect", "POST /auth/credentials is refused, so no new sign-in can be created",
			"fix", "set WAKALA_ADMIN_TOKEN and send it as the X-Admin-Token header")
	}

	// The launch runner. Without Supabase OAuth credentials a launch can be
	// recorded but not built, which is what a plain local boot does.
	var launcher *launch.Runner
	// The steps of a running launch, for the page that started it to watch,
	// and the channel a question mid-launch is answered on.
	var progress *launchlog.Journal
	var prompts *launchlog.Prompts
	if id, sec := os.Getenv("SUPABASE_OAUTH_CLIENT_ID"), os.Getenv("SUPABASE_OAUTH_CLIENT_SECRET"); id != "" && sec != "" && shop != nil {
		var cidrs []string
		for _, c := range strings.Split(os.Getenv("ALLOWED_CIDRS"), ",") {
			if c = strings.TrimSpace(c); c != "" {
				cidrs = append(cidrs, c)
			}
		}
		redirect := strings.TrimRight(os.Getenv("WAKALA_SHOP_ORIGIN"), "/") + "/admin/launch"
		progress = &launchlog.Journal{}
		prompts = &launchlog.Prompts{}
		launcher = &launch.Runner{
			OAuth:        supabasemgmt.Config{ClientID: id, ClientSecret: sec, RedirectURI: redirect},
			Store:        shop,
			Log:          logger,
			Progress:     progress,
			Prompts:      prompts,
			Import:       apihttp.ImportIntoLaunched,
			AllowedCIDRs: cidrs,
			DevMode:      os.Getenv("WAKALA_DEV_MODE") == "true",
			Region:       os.Getenv("SUPABASE_REGION"),
		}
		if len(cidrs) == 0 && !launcher.DevMode {
			logger.Warn("ALLOWED_CIDRS is unset",
				"effect", "every launch is refused before it creates anything",
				"fix", "set ALLOWED_CIDRS to this server's egress address, or WAKALA_DEV_MODE=true")
		}
	} else {
		logger.Warn("launching is not configured",
			"effect", "POST /launch records a launch but nothing is built",
			"fix", "set SUPABASE_OAUTH_CLIENT_ID, SUPABASE_OAUTH_CLIENT_SECRET and SHOP_GATEWAY_DB_URL")
	}

	shopOrigin := strings.TrimRight(os.Getenv("WAKALA_SHOP_ORIGIN"), "/")
	shopURL := strings.TrimRight(os.Getenv("SHOP_SUPABASE_URL"), "/")
	if shopURL == "" || os.Getenv("SHOP_SUPABASE_ANON_KEY") == "" {
		logger.Warn("the shop's Supabase is not configured",
			"effect", "POST /launch cannot check who the caller is and answers 503",
			"fix", "set SHOP_SUPABASE_URL and SHOP_SUPABASE_ANON_KEY")
	}

	// The project that holds the catalog authenticates the agents that work
	// on it: a caller presents that project's own user token and wakala-api
	// asks the project who it belongs to, so no credential for them lives
	// here. Unset, only a local session or API key is accepted.
	catalogAuthURL := strings.TrimRight(os.Getenv("CATALOG_SUPABASE_URL"), "/")
	catalogAnonKey := os.Getenv("CATALOG_SUPABASE_ANON_KEY")
	if catalogAuthURL == "" || catalogAnonKey == "" {
		logger.Warn("the catalog project's sign-in is not configured",
			"effect", "an agent cannot authenticate with the database it works on",
			"fix", "set CATALOG_SUPABASE_URL and CATALOG_SUPABASE_ANON_KEY")
	} else {
		logger.Info("catalog sign-in mounted", "project", catalogAuthURL)
	}

	publicBaseURL := strings.TrimRight(os.Getenv("PUBLIC_BASE_URL"), "/")
	if publicBaseURL == "" {
		logger.Warn("no public base URL is set",
			"effect", "the OAuth protected resource metadata names whatever host a request arrived on",
			"fix", "set PUBLIC_BASE_URL to this API's own origin")
	}

	var aiResolver apihttp.AIResolver
	var reviews *reviewruns.Service
	if key := os.Getenv("AI_MASTER_KEY"); key != "" {
		aiResolver = apihttp.NewAIResolver(db, acctRouter, []byte(key))
		scenariosAtOnce = agencies.ScenariosAtOnceFrom(aiResolver)
		testSeat.attach(acctRouter, aiResolver)
		reviews = newReviewService(logger, acctRouter, aiResolver)
	}

	deps := &apihttp.Deps{
		AI:             aiResolver,
		CatalogAuth:    shopauth.Verifier{URL: catalogAuthURL, AnonKey: catalogAnonKey},
		Shop:           shopauth.Verifier{URL: shopURL, AnonKey: os.Getenv("SHOP_SUPABASE_ANON_KEY")},
		ShopOrigin:     shopOrigin,
		PublicBaseURL:  publicBaseURL,
		MemberOrigins:  memberOrigins(logger),
		StudioOrigins:  studioOrigins(logger),
		PlatformOwners: apihttp.PlatformOwnersFrom(os.Getenv("PLATFORM_OWNER_ACCOUNT_IDS")),
		Registry:       acctRouter,
		Sessions:       session.NewHMACManager([]byte(secret), nil, nil).KeptIn(studioSessions),
		StudioSessions: studioSessions,
		Operators:      operators,
		// AdminToken gates POST /auth/credentials — see auth_routes.go's
		// createCredential for why there is no other door onto it yet.
		AdminToken:    adminToken,
		SessionCookie: sessionCookie(logger),
		APIKeys:       keys,
		NotifyRules:   notifyRules,
		Languages:     languageStore,
		FormsSettings: formsSettings,
		Insights:      insights,
		Catalog:       catalogManager,
		Ratings:       buildRatings(logger),
		Reports:       reportsManager,
		Forms:         formManager,
		Permissions:   permissionsManager,
		Workspace:     workspaceManager.manager,
		Layouts:       workspaceManager.layouts,
	}
	if reviews != nil {
		deps.Reviews = reviews
	}
	apihttp.ApplyCaches(deps)
	if memberAccounts != nil {
		deps.MemberAccounts = memberAccounts
	}
	deps.InvitationMail = invitationMail(logger)
	if memberSessions != nil {
		deps.MemberSessions = memberSessions
		deps.MemberSessionsSeen = memberSessionsSeen
	}
	if shop != nil {
		deps.ShopDB = shop
	}
	if launcher != nil {
		deps.Launcher = launcher
		deps.LaunchProgress = progress
		deps.LaunchAnswers = prompts
	}
	return deps
}
