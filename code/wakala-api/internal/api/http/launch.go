// launch.go — the website hands a consented launch over to wakala-api (website
// W4). The website owns the Supabase consent screen and has already stored the
// authorization code against the admin who started it; this is where wakala-api
// picks that up.
//
// The caller is the admin's own browser, so it authenticates with the admin's
// own shop Supabase token — the shop is a static SPA and can hold no secret of
// its own to authenticate with. wakala-api verifies that token against the
// shop's Supabase and checks the launch belongs to the same person, so one
// admin cannot spend another's consent.
//
// Creating the customer's project, migrating it and seeding its first user is
// WK28; this route only proves the caller, records that a launch has begun, and
// answers with its id.
package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/launch"
	"wakalaserver/internal/launchlog"
	"wakalaserver/internal/shopauth"
	"wakalaserver/internal/shopdb"
)

// Launcher runs a launch to completion in the customer's Supabase. Nil leaves
// the route recording launches without building anything, which is what a
// deployment without Supabase OAuth credentials does.
type Launcher interface {
	Run(ctx context.Context, launchID, state, projectName string) (launch.Result, error)
}

// LaunchStore is the slice of the website's database the launch routes use.
// An interface so the route's own rules — who you are, whose launch it is —
// can be tested without a Postgres; shopdb's own tests cover the SQL.
type LaunchStore interface {
	Grant(ctx context.Context, state string) (shopdb.Grant, error)
	CreateLaunch(ctx context.Context, userID, agencySlug, customerEmail string) (string, error)
	LaunchOwner(ctx context.Context, launchID string) (string, error)
}

// LaunchProgress hands out the steps of a running launch. Nil leaves the
// stream route answering 503, which is what a deployment with no launcher does.
type LaunchProgress interface {
	Watch(launchID string) (replay []launchlog.Event, live <-chan launchlog.Event, stop func())
}

// launchTimeout bounds one launch. Supabase takes a couple of minutes to make
// a project usable, and the steps after it are quick.
const launchTimeout = 20 * time.Minute

type launchRequest struct {
	State string `json:"state"`
	// Name is what to call the customer's project. Optional; the agency's slug
	// is used when it is left out.
	Name string `json:"name"`
}

type launchResponse struct {
	LaunchID   string `json:"launch_id"`
	AgencySlug string `json:"agency_slug"`
	Status     string `json:"status"`
}

// shopAdmin proves the caller with their own shop Supabase token, writing the
// refusal itself when it cannot. The website's admin is the only caller these
// routes have.
func shopAdmin(w http.ResponseWriter, r *http.Request, d *Deps) (string, bool) {
	if d.ShopDB == nil || d.Shop.URL == "" {
		writeErr(w, http.StatusServiceUnavailable, "launching is not configured on this server")
		return "", false
	}
	token, _ := bearerToken(r)
	admin, err := d.Shop.Admin(r.Context(), token)
	if err != nil {
		// A missing token is "sign in"; a valid one that is not an agency
		// admin is "you may not". Anything else is the shop being unreachable.
		if errors.Is(err, shopauth.ErrNotAdmin) {
			status := http.StatusForbidden
			if token == "" {
				status = http.StatusUnauthorized
			}
			writeErr(w, status, "not an agency admin")
			return "", false
		}
		writeErr(w, http.StatusBadGateway, "could not check who you are")
		return "", false
	}
	return admin, true
}

// beginLaunch handles POST /launch.
func beginLaunch(d *Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		admin, ok := shopAdmin(w, r, d)
		if !ok {
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<14)
		var in launchRequest
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil || strings.TrimSpace(in.State) == "" {
			writeErr(w, http.StatusBadRequest, "state is required")
			return
		}

		grant, err := d.ShopDB.Grant(r.Context(), in.State)
		if err != nil {
			if errors.Is(err, shopdb.ErrGrantNotFound) {
				writeErr(w, http.StatusNotFound, "this launch expired, was already used, or has no Supabase access yet")
				return
			}
			writeErr(w, http.StatusBadGateway, "could not read the launch")
			return
		}
		// The consent belongs to whoever started it. Same refusal as an unknown
		// state, so a valid state cannot be used to probe for other people's.
		if grant.UserID != admin {
			writeErr(w, http.StatusNotFound, "this launch expired, was already used, or has no Supabase access yet")
			return
		}

		id, err := d.ShopDB.CreateLaunch(r.Context(), grant.UserID, grant.AgencySlug, grant.CustomerEmail)
		if err != nil {
			writeErr(w, http.StatusBadGateway, "could not record the launch")
			return
		}

		// Creating a Supabase project takes minutes, so the launch runs on its
		// own — detached from this request's context, which dies with the
		// response — and the admin follows it on My agencies. 202 means started,
		// not finished.
		if d.Launcher != nil {
			name := strings.TrimSpace(in.Name)
			if name == "" {
				name = grant.AgencySlug
			}
			go func() {
				ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), launchTimeout)
				defer cancel()
				_, _ = d.Launcher.Run(ctx, id, in.State, name)
			}()
		}
		writeJSON(w, http.StatusAccepted, launchResponse{LaunchID: id, AgencySlug: grant.AgencySlug, Status: "creating"})
	}
}

// Bounds on one watched launch: a comment often enough that a proxy does not
// close a connection that is only waiting on Supabase, and an end to the
// stream itself once the launch behind it could no longer be running.
const (
	launchBeat     = 15 * time.Second
	launchStreamed = launchTimeout + time.Minute
)

// watchLaunch handles GET /launch/{launchID}/events: the steps of one launch,
// as Server-Sent Events, replayed from the start so a page that connects late
// — or is reloaded — still sees the whole story.
func watchLaunch(d *Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		admin, ok := shopAdmin(w, r, d)
		if !ok {
			return
		}
		if d.LaunchProgress == nil {
			writeErr(w, http.StatusServiceUnavailable, "launch progress is not available on this server")
			return
		}
		flusher, ok := w.(http.Flusher)
		if !ok {
			writeErr(w, http.StatusInternalServerError, "this server cannot stream")
			return
		}
		// Whose launch it is, answered the same way for an unknown id as for
		// somebody else's: a launch id must not be probeable.
		id := r.PathValue("launchID")
		owner, err := d.ShopDB.LaunchOwner(r.Context(), id)
		if err != nil || owner != admin {
			writeErr(w, http.StatusNotFound, "no such launch")
			return
		}

		replay, live, stop := d.LaunchProgress.Watch(id)
		defer stop()

		h := w.Header()
		h.Set("Content-Type", "text/event-stream")
		h.Set("Cache-Control", "no-cache, no-transform")
		h.Set("Connection", "keep-alive")
		// Proxies that buffer a response would hold every step until the
		// launch ended, which is the one thing this route exists not to do.
		h.Set("X-Accel-Buffering", "no")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()

		send := func(e launchlog.Event) bool {
			b, err := json.Marshal(e)
			if err != nil {
				return true
			}
			if _, err := fmt.Fprintf(w, "id: %d\ndata: %s\n\n", e.Seq, b); err != nil {
				return false
			}
			flusher.Flush()
			return true
		}
		for _, e := range replay {
			if !send(e) {
				return
			}
		}

		beat := time.NewTicker(launchBeat)
		defer beat.Stop()
		over := time.NewTimer(launchStreamed)
		defer over.Stop()
		for {
			select {
			case <-r.Context().Done():
				return
			case <-over.C:
				return
			case e, open := <-live:
				if !open {
					fmt.Fprint(w, "event: end\ndata: {}\n\n")
					flusher.Flush()
					return
				}
				if !send(e) {
					return
				}
			case <-beat.C:
				if _, err := fmt.Fprint(w, ": waiting\n\n"); err != nil {
					return
				}
				flusher.Flush()
			}
		}
	}
}

// launchUsePrefix marks an answer as a project to use rather than a name to
// create. It mirrors internal/launch's own reading of the answer.
const launchUsePrefix = "project:"

// LaunchPrompts answers a question a running launch is waiting on. Nil leaves
// the answer route refusing, which is what a deployment with no launcher does.
type LaunchPrompts interface {
	Answer(launchID, answer string) bool
}

type launchNameRequest struct {
	// Name creates a project called this. Project, instead, puts the agency
	// into a project the person already has — several agencies can share one,
	// each with its own table set.
	Name    string `json:"name"`
	Project string `json:"project"`
}

// answerLaunchName handles POST /launch/{launchID}/name: the project name a
// launch is waiting for because the one it was given is taken. The launch is
// still running and still holding its Supabase token, which is the whole point
// — the alternative is failing and making the person consent again.
func answerLaunchName(d *Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		admin, ok := shopAdmin(w, r, d)
		if !ok {
			return
		}
		if d.LaunchAnswers == nil {
			writeErr(w, http.StatusServiceUnavailable, "launching is not configured on this server")
			return
		}
		id := r.PathValue("launchID")
		owner, err := d.ShopDB.LaunchOwner(r.Context(), id)
		if err != nil || owner != admin {
			writeErr(w, http.StatusNotFound, "no such launch")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<12)
		var in launchNameRequest
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, "a name or a project is required")
			return
		}
		// One or the other, never both: "call it X and also put it in Y" has no
		// meaning, and guessing which half was meant is worse than refusing.
		name, project := strings.TrimSpace(in.Name), strings.TrimSpace(in.Project)
		if (name == "") == (project == "") {
			writeErr(w, http.StatusBadRequest, "send either a name for a new project or an existing project")
			return
		}
		answer := name
		if project != "" {
			answer = launchUsePrefix + project
		}
		// A launch that has moved on, finished, or is running on another
		// replica is not waiting for this — say so rather than accept it and
		// leave the page believing the name took.
		if !d.LaunchAnswers.Answer(id, answer) {
			writeErr(w, http.StatusConflict, "this launch is not waiting for a name")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// allowShopOrigin lets the website's own origin call these routes from the
// admin's browser. Nothing else is allowed, and only when an origin is
// configured — an unset WAKALA_SHOP_ORIGIN means no cross-origin caller at all.
func allowShopOrigin(origin string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if origin != "" && r.Header.Get("Origin") == origin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func registerLaunchRoutes(mux *http.ServeMux, d *Deps) {
	mux.HandleFunc("/launch", allowShopOrigin(d.ShopOrigin, beginLaunch(d)))
	mux.HandleFunc("/launch/{launchID}/events", allowShopOrigin(d.ShopOrigin, watchLaunch(d)))
	mux.HandleFunc("/launch/{launchID}/name", allowShopOrigin(d.ShopOrigin, answerLaunchName(d)))
}

// ImportIntoLaunched lays an agency document into a freshly created customer
// database: the same registry and GORM migration the shared store uses, and the
// same importer POST /instances/import runs, pointed at a different database.
// Supplied to internal/launch so that package needs no knowledge of the import
// shape.
func ImportIntoLaunched(ctx context.Context, db *gorm.DB, name string, doc json.RawMessage) error {
	reg, err := agencies.NewRegistry(db)
	if err != nil {
		return fmt.Errorf("registry: %w", err)
	}
	var in importRequest
	// Decoded leniently, exactly as the HTTP importer does: a real export
	// carries sections this does not apply.
	if err := json.Unmarshal(doc, &in); err != nil {
		return fmt.Errorf("agency document: %w", err)
	}
	res, err := runImport(ctx, reg, "", name, in)
	if err != nil {
		return err
	}
	// A row that failed to land is reported by the importer rather than
	// returned, and a launch should not silently produce a half-built agency.
	if len(res.Errors) > 0 {
		return fmt.Errorf("agency document: %s", strings.Join(res.Errors, "; "))
	}
	return nil
}
