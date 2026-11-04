package launch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/launchlog"
	"wakalaserver/internal/provision"
	"wakalaserver/internal/shopdb"
	"wakalaserver/internal/supabasemgmt"
)

// How long a launch keeps trying to dial a project whose role the pooler has
// not caught up with yet.
const (
	openAttempts = 6
	openBackoff  = 5 * time.Second
)

// ErrCIDRsRequired is returned when a non-development launch has no allowed
// network range to restrict the new project to.
var ErrCIDRsRequired = provision.ErrCIDRsRequired

// Store is the website's database, the only durable record of a launch.
type Store interface {
	Grant(ctx context.Context, state string) (shopdb.Grant, error)
	SpendGrant(ctx context.Context, state string) error
	SetProject(ctx context.Context, id, ref, url, region string) error
	SetStatus(ctx context.Context, id, status, failure string) error
	SetCredentials(ctx context.Context, id, anonKey, dbPassword string) error
	AgencyDoc(ctx context.Context, launchID string) (json.RawMessage, error)
	// ProjectPassword is the wakala_api password an earlier launch already
	// stored for a project, or "" for one this API has never touched.
	ProjectPassword(ctx context.Context, projectRef string) (string, error)
}

// Importer lays an agency document into a freshly migrated database. Supplied
// by the HTTP layer, which owns the import logic.
type Importer func(ctx context.Context, db *gorm.DB, name string, doc json.RawMessage) error

// Progress receives every step as it happens, for the admin watching the page
// that started the launch. Nil is fine: the steps are logged either way.
type Progress interface {
	Append(launchID string, e launchlog.Event)
}

// Asker lets a running launch put a question to the person watching it and
// wait for the answer. Nil means nobody can be asked, and the launch decides
// for itself instead of stalling.
type Asker interface {
	Ask(launchID string) (answers <-chan string, cancel func())
}

// Runner performs launches.
type Runner struct {
	OAuth    supabasemgmt.Config
	Store    Store
	Log      *slog.Logger
	Progress Progress
	// Prompts is how a name collision is resolved without losing the launch.
	Prompts Asker
	// Import lays the agency into the new database.
	Import Importer
	// Open dials a launched project. Defaults to GORM over Postgres.
	Open func(ctx context.Context, c accounts.Connection) (*gorm.DB, error)
	// Secure locks the tables Import just made. Defaults to provision's
	// row-level-security SQL over that same connection — which is the point of
	// the seam: it must run as the role that owns those tables, not as the
	// project owner the rest of the lock-down goes through.
	Secure func(ctx context.Context, db *gorm.DB) error
	// AllowedCIDRs restricts direct database access to the API's own egress.
	// Empty is refused unless DevMode.
	AllowedCIDRs []string
	DevMode      bool
	// Region and PollEvery have sensible defaults.
	Region    string
	PollEvery time.Duration
}

// Result is what a finished launch produced.
type Result struct {
	ProjectRef string
	AnonKey    string
}

func (r *Runner) log() *slog.Logger {
	if r.Log != nil {
		return r.Log
	}
	return slog.Default()
}

func (r *Runner) region() string {
	if r.Region != "" {
		return r.Region
	}
	return "eu-central-1"
}

func (r *Runner) poll() time.Duration {
	if r.PollEvery > 0 {
		return r.PollEvery
	}
	return 5 * time.Second
}

func (r *Runner) open(ctx context.Context, c accounts.Connection) (*gorm.DB, error) {
	if r.Open != nil {
		return r.Open(ctx, c)
	}
	return accounts.OpenPostgres(ctx, c)
}

// openWithRetry dials the launched project, giving the pooler time to catch up
// with a role that was created moments ago. Supabase's pooler authenticates
// against its own cached copy of the role, so the first connection after a
// CREATE ROLE can be refused while the credential is still propagating — a
// failure that fixes itself, and a bad reason to lose a launch.
func (r *Runner) openWithRetry(ctx context.Context, c accounts.Connection, note func(attempt int, err error)) (*gorm.DB, error) {
	var err error
	for attempt := 1; attempt <= openAttempts; attempt++ {
		var db *gorm.DB
		if db, err = r.open(ctx, c); err == nil {
			return db, nil
		}
		if attempt == openAttempts {
			break
		}
		note(attempt, err)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(openBackoff):
		}
	}
	return nil, err
}

// target is where an agency is going: a project to create, or one the person
// already has. Several agencies may share a project — wakala-api's registry
// gives each one a private table set inside a single database — so this is a
// choice, not just a name.
type target struct {
	Name     string // the project to create, when Existing is empty
	Existing string // a project ref to build into instead
}

// prefix an answer carries to mean "use this project" rather than "call the
// new one this". A ref is twenty letters and could otherwise be a name.
const usePrefix = "project:"

// chooseTarget asks the person where this agency should live and waits for the
// answer, holding the launch open while it does.
//
// It asks at launch rather than before it because this is the first moment the
// real answer exists: listing the organization's projects needs the Management
// API token, and that token only exists once the consent has been exchanged.
// Asking earlier could offer a name but never the projects.
//
// It also asks rather than failing on a collision. The authorization behind the
// token is single-use and already spent here, so a failure would cost the
// person another trip through the consent screen to change one word.
//
// With nobody to ask — no Prompts wired, or a page that went away — it takes
// the first free variant of the name rather than stalling until the timeout.
func (r *Runner) chooseTarget(ctx context.Context, api *supabasemgmt.Session, launchID string, started time.Time, name string) (target, error) {
	existing, err := api.Projects(ctx)
	if err != nil {
		return target{}, fmt.Errorf("launch: reading existing projects: %w", err)
	}
	taken := make(map[string]bool, len(existing))
	byRef := make(map[string]supabasemgmt.Project, len(existing))
	options := make([]string, 0, len(existing))
	for _, p := range existing {
		taken[strings.ToLower(strings.TrimSpace(p.Name))] = true
		byRef[p.Ref] = p
		options = append(options, p.Ref+" "+p.Name)
	}
	free := func(n string) bool { return !taken[strings.ToLower(strings.TrimSpace(n))] }

	suggestion := name
	if !free(suggestion) {
		suggestion = nextFree(name, free)
	}
	if r.Prompts == nil {
		return target{Name: suggestion}, nil
	}

	for {
		answers, cancel := r.Prompts.Ask(launchID)
		r.emit(launchID, started, launchlog.StateNaming, "where should this agency live?", []any{
			"name", name, "suggestion", suggestion,
			"taken", strconv.FormatBool(!free(name)), "projects", strconv.Itoa(len(options)),
		}, options...)
		r.log().Info("waiting for a launch target", "launch", launchID, "suggestion", suggestion, "projects", len(options))

		select {
		case answer, open := <-answers:
			cancel()
			answer = strings.TrimSpace(answer)
			if !open || answer == "" {
				return target{Name: suggestion}, nil
			}
			if ref, ok := strings.CutPrefix(answer, usePrefix); ok {
				p, known := byRef[strings.TrimSpace(ref)]
				if !known {
					// Asked again rather than guessed: a ref that is not theirs
					// is the one thing here that must not be acted on.
					r.log().Warn("a launch was pointed at an unknown project", "launch", launchID, "project", ref)
					continue
				}
				return target{Existing: p.Ref}, nil
			}
			if free(answer) {
				return target{Name: answer}, nil
			}
			name, suggestion = answer, nextFree(answer, free)
		case <-ctx.Done():
			cancel()
			return target{}, ctx.Err()
		}
	}
}

// nextFree appends the first number that is not taken. "acme" becomes "acme-2",
// then "acme-3": a suggestion the person can accept without thinking, not a
// name they are stuck with.
func nextFree(name string, free func(string) bool) string {
	base := strings.TrimSpace(name)
	for i := 2; i < 1000; i++ {
		candidate := fmt.Sprintf("%s-%d", base, i)
		if free(candidate) {
			return candidate
		}
	}
	return base
}

// secure enables row-level security on the agency's own tables. ALTER TABLE
// demands ownership, and these tables were created by the API role through
// GORM — the Management API's `postgres` is not their owner and is refused
// (42501), so this one step goes over the API's own connection.
func (r *Runner) secure(ctx context.Context, db *gorm.DB) error {
	if r.Secure != nil {
		return r.Secure(ctx, db)
	}
	return db.WithContext(ctx).Exec(provision.SecureTablesSQL()).Error
}

// emit publishes one step to whoever is watching this launch. attrs are the
// same key/value pairs the step logs, flattened to strings for the page.
func (r *Runner) emit(launchID string, started time.Time, state, step string, attrs []any, options ...string) {
	if r.Progress == nil {
		return
	}
	r.Progress.Append(launchID, launchlog.Event{
		At:      time.Now(),
		Elapsed: time.Since(started).Round(time.Millisecond).String(),
		Step:    step,
		Fields:  fields(attrs),
		Options: options,
		State:   state,
	})
}

// fields pairs up slog-style attributes. An odd trailing key is dropped rather
// than shown against a missing value.
func fields(attrs []any) map[string]string {
	if len(attrs) < 2 {
		return nil
	}
	out := make(map[string]string, len(attrs)/2)
	for i := 0; i+1 < len(attrs); i += 2 {
		out[fmt.Sprint(attrs[i])] = fmt.Sprint(attrs[i+1])
	}
	return out
}

// Run builds launchID's agency in the customer's own Supabase. It records
// progress as it goes and, on failure, marks the launch failed with a reason
// rather than leaving it stuck mid-flight.
func (r *Runner) Run(ctx context.Context, launchID, state, projectName string) (Result, error) {
	started := time.Now()
	res, err := r.run(ctx, started, launchID, state, projectName)
	if err != nil {
		// A context deadline mid-launch still leaves a real project behind, so
		// the reason is recorded on a fresh context rather than the dead one.
		note, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
		defer cancel()
		if serr := r.Store.SetStatus(note, launchID, "failed", userFacing(err)); serr != nil {
			r.log().Error("could not record a failed launch", "launch", launchID, "error", serr.Error())
		}
		r.log().Error("launch failed", "launch", launchID, "project", res.ProjectRef, "error", err.Error())
		// The watcher is told what the admin is told, never the driver error.
		r.emit(launchID, started, launchlog.StateFailed, userFacing(err), nil)
		return res, err
	}
	return res, nil
}

func (r *Runner) revoke(ctx context.Context, launchID string, token supabasemgmt.Token) {
	if token.Refresh == "" {
		r.log().Warn("the Supabase authorization could not be revoked: no refresh token was issued", "launch", launchID)
		return
	}
	end, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
	defer cancel()
	if err := r.OAuth.Revoke(end, token.Refresh); err != nil {
		r.log().Error("the Supabase authorization could not be revoked", "launch", launchID, "error", err.Error())
	}
}

func (r *Runner) run(ctx context.Context, started time.Time, launchID, state, projectName string) (Result, error) {
	var res Result

	// Refused before anything is created: a project with unrestricted database
	// access is not something to make and clean up afterwards.
	if len(r.AllowedCIDRs) == 0 && !r.DevMode {
		return res, ErrCIDRsRequired
	}

	// A launch runs for a minute or more against someone else's Supabase, so
	// every step announces itself — to the server log, and to the admin
	// watching the page that started it. A stalled launch should say what it is
	// waiting on rather than going quiet until it succeeds or fails.
	log := r.log().With("launch", launchID)
	step := func(msg string, attrs ...any) {
		r.emit(launchID, started, launchlog.StateRunning, msg, attrs)
		log.Info(msg, append(attrs, "elapsed", time.Since(started).Round(time.Millisecond).String())...)
	}
	step("launch starting", "agency", projectName, "region", r.region(), "dev_mode", r.DevMode)

	grant, err := r.Store.Grant(ctx, state)
	if err != nil {
		return res, fmt.Errorf("launch: %w", err)
	}
	doc, err := r.Store.AgencyDoc(ctx, launchID)
	if err != nil {
		return res, fmt.Errorf("launch: agency document: %w", err)
	}

	// The code is single-use, so spending it and exchanging it belong together:
	// if the exchange happens the grant is gone either way.
	if err := r.Store.SpendGrant(ctx, state); err != nil {
		return res, fmt.Errorf("launch: %w", err)
	}
	step("exchanging the Supabase authorization")
	token, err := r.OAuth.Exchange(ctx, grant.Code, grant.CodeVerifier)
	if err != nil {
		return res, fmt.Errorf("launch: exchanging Supabase access: %w", err)
	}
	defer r.revoke(ctx, launchID, token)
	api := r.OAuth.For(token.Access)

	orgs, err := api.Orgs(ctx)
	if err != nil {
		return res, fmt.Errorf("launch: reading organizations: %w", err)
	}
	if len(orgs) == 0 {
		return res, errors.New("launch: no Supabase organization is available to create a project in")
	}

	// Asked before anything is created: a new project, or one they already
	// have. Several agencies can share a project — each gets its own table set
	// — so this is the one decision the launch cannot make for them.
	step("reading your Supabase projects")
	where, err := r.chooseTarget(ctx, api, launchID, started, projectName)
	if err != nil {
		return res, err
	}

	var proj supabasemgmt.Project
	if where.Existing != "" {
		step("using an existing project", "project", where.Existing)
		if proj, err = api.Project(ctx, where.Existing); err != nil {
			return res, fmt.Errorf("launch: reading the chosen project: %w", err)
		}
	} else {
		dbPass, err := provision.NewPassword()
		if err != nil {
			return res, err
		}
		step("creating the project", "name", where.Name, "organization", orgs[0].Slug)
		if proj, err = api.CreateProject(ctx, where.Name, orgs[0].Slug, r.region(), dbPass); err != nil {
			return res, fmt.Errorf("launch: creating the project: %w", err)
		}
	}
	res.ProjectRef = proj.Ref
	log = log.With("project", proj.Ref)

	// Recorded before the slow steps, so a failure from here on is traceable to
	// the project it created.
	if err := r.Store.SetProject(ctx, launchID, proj.Ref, projectURL(proj.Ref), r.region()); err != nil {
		return res, fmt.Errorf("launch: recording the project: %w", err)
	}
	onStatus := func(status string) { step("waiting for the project", "status", status) }
	if err := api.Ready(ctx, proj.Ref, r.poll(), onStatus); err != nil {
		return res, fmt.Errorf("launch: waiting for the project: %w", err)
	}

	// Lock-down runs as the project owner through the Management API, which is
	// the only superuser access available — and the last thing that needs it.
	exec := func(ctx context.Context, sql string) error {
		log.Debug("running provisioning SQL", "sql", sqlSummary(sql))
		return api.Query(ctx, proj.Ref, sql)
	}
	// A project this API has provisioned before keeps the password it already
	// has: minting a new one would rotate wakala_api out from under every
	// agency already living in this project.
	known, err := r.Store.ProjectPassword(ctx, proj.Ref)
	if err != nil {
		return res, fmt.Errorf("launch: reading the project's stored password: %w", err)
	}
	joining := known != ""
	step("securing the database", "schema", provision.Schema, "role", provision.Role, "reusing_password", joining)
	secure := provision.RunWith
	if joining {
		// The role is already there with this password. Re-setting it would
		// rewrite its SCRAM verifier and lock this launch — and every agency
		// already in the project — out until the pooler caught up.
		secure = provision.RunSchema
	} else if known, err = provision.NewPassword(); err != nil {
		return res, err
	}
	apiPass, err := secure(ctx, exec, known)
	if err != nil {
		return res, fmt.Errorf("launch: securing the database: %w", err)
	}
	step("installing the sign-in helper")
	if err := exec(ctx, provision.CreateUserFunction()); err != nil {
		return res, fmt.Errorf("launch: installing the sign-in helper: %w", err)
	}

	step("reading the project keys")
	anonKey, err := api.AnonKey(ctx, proj.Ref)
	if err != nil {
		return res, fmt.Errorf("launch: reading the project keys: %w", err)
	}
	res.AnonKey = anonKey

	// Everything the API needs afterwards is now known, so it is stored before
	// the remaining steps — losing it would strand a working database.
	if err := r.Store.SetCredentials(ctx, launchID, anonKey, apiPass); err != nil {
		return res, fmt.Errorf("launch: recording the credentials: %w", err)
	}

	conn := accounts.Connection{Kind: accounts.KindSupabase, ProjectRef: proj.Ref, Region: r.region(), Password: apiPass}
	if err := r.Store.SetStatus(ctx, launchID, "migrating", ""); err != nil {
		return res, err
	}
	step("connecting to the new database")
	db, err := r.openWithRetry(ctx, conn, func(attempt int, err error) {
		step("the database is not accepting the connection yet, retrying", "attempt", attempt, "error", err.Error())
	})
	if err != nil {
		return res, fmt.Errorf("launch: connecting to the new database: %w", err)
	}
	defer closeDB(db)

	// The same GORM migration the shared store uses, pointed at this database.
	name := agencyName(doc, grant.AgencySlug)
	step("building the agency", "agency", name, "bytes", len(doc))
	if err := r.Import(ctx, db, name, doc); err != nil {
		return res, fmt.Errorf("launch: building the agency: %w", err)
	}

	// Only now do the tables exist to secure. The agency sits in the schema
	// PostgREST exposes, so this is the lock that makes it unreadable to
	// anything holding the anon key.
	step("securing the agency's tables", "schema", provision.Schema)
	if err := r.secure(ctx, db); err != nil {
		return res, fmt.Errorf("launch: securing the agency's tables: %w", err)
	}

	if err := r.Store.SetStatus(ctx, launchID, "seeding", ""); err != nil {
		return res, err
	}
	firstPass, err := provision.NewPassword()
	if err != nil {
		return res, err
	}
	step("creating the first sign-in")
	if err := exec(ctx, provision.SeedUserSQL(grant.CustomerEmail, firstPass)); err != nil {
		return res, fmt.Errorf("launch: creating the first sign-in: %w", err)
	}

	// Applied last: the API's own connections above go through the same door it
	// closes, so restricting earlier would lock the launch out of its own work.
	if len(r.AllowedCIDRs) > 0 {
		step("restricting database access", "cidrs", r.AllowedCIDRs)
		if err := api.RestrictNetwork(ctx, proj.Ref, r.AllowedCIDRs); err != nil {
			return res, fmt.Errorf("launch: restricting database access: %w", err)
		}
	} else {
		step("leaving database access open", "reason", "development mode, no ALLOWED_CIDRS")
	}

	if err := r.Store.SetStatus(ctx, launchID, "ready", ""); err != nil {
		return res, err
	}
	ready := []any{"url", projectURL(proj.Ref), "schema", provision.Schema}
	r.emit(launchID, started, launchlog.StateReady, "launch ready", ready)
	log.Info("launch ready", append(ready, "elapsed", time.Since(started).Round(time.Millisecond).String())...)
	return res, nil
}

// sqlLiteral matches a single-quoted Postgres string, doubled quotes included.
var sqlLiteral = regexp.MustCompile(`'(?:[^']|'')*'`)

// sqlSummary is a provisioning statement on one bounded line. Every secret one
// of these carries — the role's password, the first user's — arrives as a
// quoted literal, so the literals are replaced before anything is logged; a
// statement is folded rather than cut at its first line because the useful part
// of the ones wrapped in DO $$ BEGIN is never the first line.
func sqlSummary(sql string) string {
	s := strings.Join(strings.Fields(sqlLiteral.ReplaceAllString(sql, "'…'")), " ")
	if r := []rune(s); len(r) > 160 {
		s = string(r[:160]) + "…"
	}
	return s
}

func closeDB(db *gorm.DB) {
	if sqlDB, err := db.DB(); err == nil {
		_ = sqlDB.Close()
	}
}

func projectURL(ref string) string { return "https://" + ref + ".supabase.co" }

// agencyName prefers the document's own name, falling back to the slug.
func agencyName(doc json.RawMessage, slug string) string {
	var d struct {
		Name   string `json:"name"`
		Agency struct {
			Name string `json:"name"`
		} `json:"agency"`
	}
	if err := json.Unmarshal(doc, &d); err == nil {
		if d.Name != "" {
			return d.Name
		}
		if d.Agency.Name != "" {
			return d.Agency.Name
		}
	}
	return slug
}

// userFacing is what the admin reads on their own launch. It never carries a
// driver error or a URL, and it always says whether anything was left behind.
func userFacing(err error) string {
	switch {
	case errors.Is(err, ErrCIDRsRequired):
		return "This server has no allowed network range configured, so it refused to create a project. Nothing was created."
	case errors.Is(err, shopdb.ErrGrantNotFound):
		return "The Supabase access for this launch had expired or was already used. Start again from the agency."
	}
	var se *supabasemgmt.Error
	if errors.As(err, &se) {
		return fmt.Sprintf("Supabase refused a step (%d). Check the project in your Supabase dashboard before launching again.", se.Status)
	}
	return "The launch stopped part-way. Check the project in your Supabase dashboard before launching again."
}
