// Package shopdb is wakala-api's only view of the website's database, through
// the wakala_gateway role (website migration 20260922000200). wakala-api keeps
// no store of its own, so this is where a launch's OAuth code comes from, where
// a launch's progress is recorded, and where a Studio uuid resolves back to a
// customer's Supabase connection when the in-memory pool is cold.
//
// The role is granted two tables and nothing else: launch_grant (read, and mark
// spent) and launched_agency (read, create, update — never delete). Anything
// this package tries beyond that is refused by the database, not by Go.
package shopdb

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"

	"wakalaserver/internal/accounts"
)

var (
	// ErrGrantNotFound covers every reason a launch cannot proceed — unknown
	// state, expired, already spent, or no code stored yet. They are not told
	// apart: a caller who can distinguish them can probe other people's launches.
	ErrGrantNotFound = errors.New("shopdb: no open launch for that state")
	// ErrLaunchNotFound is returned for an unknown launched_agency id.
	ErrLaunchNotFound = errors.New("shopdb: no such launch")
	// ErrNotProvisioned is returned when a launch exists but has no usable
	// connection yet — it never finished, or it failed.
	ErrNotProvisioned = errors.New("shopdb: launch has no database yet")
)

// Grant is one consented launch, as the website recorded it.
type Grant struct {
	UserID        string
	AgencySlug    string
	Code          string
	CodeVerifier  string
	CustomerEmail string
}

// Store is the connection to the website's database.
type Store struct{ db *sql.DB }

func Open(dsn string) (*Store, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("shopdb: %w", err)
	}
	accounts.PoolFromEnv("WAKALA_SHOP_DB", accounts.ShopPool, os.Getenv).Apply(db)
	return &Store{db: db}, nil
}

// Ping checks the credential at boot, so a wrong DSN is a startup error rather
// than a failure in the middle of someone's launch.
func (s *Store) Ping(ctx context.Context) error { return s.db.PingContext(ctx) }

func (s *Store) Close() error { return s.db.Close() }

// Grant returns the open, unspent, unexpired grant for state, which must
// already carry the code the website stored on the way back from Supabase.
func (s *Store) Grant(ctx context.Context, state string) (Grant, error) {
	var g Grant
	err := s.db.QueryRowContext(ctx, `
		select user_id, agency_slug, coalesce(code, ''), code_verifier, customer_email
		  from public.launch_grant
		 where state = $1 and used_at is null and expires_at > now() and code is not null`,
		state).Scan(&g.UserID, &g.AgencySlug, &g.Code, &g.CodeVerifier, &g.CustomerEmail)
	if errors.Is(err, sql.ErrNoRows) {
		return Grant{}, ErrGrantNotFound
	}
	if err != nil {
		return Grant{}, fmt.Errorf("shopdb: read grant: %w", err)
	}
	return g, nil
}

// SpendGrant marks a grant used. It is the point of no return for one consent:
// the authorization code behind it can only be exchanged once, so spending it
// and exchanging it must happen together.
func (s *Store) SpendGrant(ctx context.Context, state string) error {
	res, err := s.db.ExecContext(ctx,
		`update public.launch_grant set used_at = now() where state = $1 and used_at is null`, state)
	if err != nil {
		return fmt.Errorf("shopdb: spend grant: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrGrantNotFound
	}
	return nil
}

// CreateLaunch records that a launch has begun, before anything exists in the
// customer's account. A launch that dies later is then a visible row rather
// than a project nobody knows about.
func (s *Store) CreateLaunch(ctx context.Context, userID, agencySlug, customerEmail string) (string, error) {
	var id string
	err := s.db.QueryRowContext(ctx, `
		insert into public.launched_agency (user_id, agency_slug, customer_email, status)
		values ($1, $2, $3, 'creating')
		returning id`, userID, agencySlug, customerEmail).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("shopdb: create launch: %w", err)
	}
	return id, nil
}

// SetProject records the customer's project the moment it exists, so a launch
// that fails afterwards can still be traced to the thing it created.
func (s *Store) SetProject(ctx context.Context, id, ref, url, region string) error {
	return s.update(ctx, id, `
		update public.launched_agency
		   set project_ref = $2, project_url = $3, region = $4, status = 'locking_down', updated_at = now()
		 where id = $1`, ref, url, region)
}

// SetStatus moves a launch along, or records why it stopped.
func (s *Store) SetStatus(ctx context.Context, id, status, failure string) error {
	return s.update(ctx, id, `
		update public.launched_agency
		   set status = $2, error = $3, updated_at = now()
		 where id = $1`, status, failure)
}

// SetCredentials stores what wakala-api needs to come back to this database
// later: the wakala_api role's password, and the anon key Studio signs in with.
func (s *Store) SetCredentials(ctx context.Context, id, anonKey, dbPassword string) error {
	return s.update(ctx, id, `
		update public.launched_agency
		   set anon_key = $2, db_password = $3, updated_at = now()
		 where id = $1`, anonKey, dbPassword)
}

func (s *Store) update(ctx context.Context, id, q string, args ...any) error {
	res, err := s.db.ExecContext(ctx, q, append([]any{id}, args...)...)
	if err != nil {
		return fmt.Errorf("shopdb: update launch: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrLaunchNotFound
	}
	return nil
}

// AgencyDoc returns the agency document to import for one launch. The gateway
// role cannot read the catalogue directly — this function is scoped to agencies
// a real launch names (website migration 20260922000400).
func (s *Store) AgencyDoc(ctx context.Context, launchID string) (json.RawMessage, error) {
	var doc []byte
	err := s.db.QueryRowContext(ctx, `select public.launch_agency_doc($1)`, launchID).Scan(&doc)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && len(doc) == 0) {
		return nil, ErrLaunchNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("shopdb: agency doc: %w", err)
	}
	return doc, nil
}

// LaunchOwner returns the admin a launch belongs to, so watching one can be
// refused to everybody else.
func (s *Store) LaunchOwner(ctx context.Context, id string) (string, error) {
	var userID string
	err := s.db.QueryRowContext(ctx, `select user_id from public.launched_agency where id = $1`, id).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrLaunchNotFound
	}
	if err != nil {
		return "", fmt.Errorf("shopdb: launch owner: %w", err)
	}
	return userID, nil
}

// ProjectPassword returns the wakala_api password already stored for a
// project, or "" when no launch of ours has used it. A second agency launched
// into the same project must reuse it: provisioning with a fresh one would
// rotate the role's password out from under the agencies already there.
func (s *Store) ProjectPassword(ctx context.Context, projectRef string) (string, error) {
	var pw sql.NullString
	err := s.db.QueryRowContext(ctx,
		`select db_password from public.launched_agency
		  where project_ref = $1 and coalesce(db_password, '') <> ''
		  order by created_at desc limit 1`, projectRef).Scan(&pw)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("shopdb: project password: %w", err)
	}
	return pw.String, nil
}

// Resolve turns a Studio uuid into the connection for that customer's database.
// This is what refills wakala-api's pool after a restart.
func (s *Store) Resolve(ctx context.Context, id string) (accounts.Connection, error) {
	var ref, region, pw, status sql.NullString
	err := s.db.QueryRowContext(ctx,
		`select project_ref, region, db_password, status from public.launched_agency where id = $1`,
		id).Scan(&ref, &region, &pw, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return accounts.Connection{}, ErrLaunchNotFound
	}
	if err != nil {
		return accounts.Connection{}, fmt.Errorf("shopdb: resolve: %w", err)
	}
	if status.String != "ready" || ref.String == "" || pw.String == "" {
		return accounts.Connection{}, ErrNotProvisioned
	}
	return accounts.Connection{
		Kind:       accounts.KindSupabase,
		ProjectRef: ref.String,
		Region:     region.String,
		Password:   pw.String,
	}, nil
}
