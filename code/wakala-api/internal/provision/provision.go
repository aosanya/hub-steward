// Package provision lays an account's own database out (WK27/WK28): a
// dedicated role and schema the API alone can use, with nothing granted to
// Supabase's public-facing roles. The same SQL runs against a local
// Supabase and, through the Management API, a hosted one.
package provision

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"wakalaserver/internal/accounts"
)

// Schema and Role are the names the API's own objects live under.
const (
	Schema = accounts.APISchema
	Role   = accounts.APIRole
)

// ErrCIDRsRequired is returned when a non-dev provision has no
// ALLOWED_CIDRS to restrict the project's network to.
var ErrCIDRsRequired = errors.New("provision: ALLOWED_CIDRS must be set outside development")

// Exec runs one SQL statement against the target project as its owner. A
// local target runs it over a direct connection; a hosted one sends it to
// the Management API's database/query.
type Exec func(ctx context.Context, sql string) error

// Statements is the lock-down, in order and idempotent. The role can create
// in the schema, so it builds its own tables as instances are registered and
// owns them, and nothing else — least of all anon or authenticated — is
// granted anything there.
//
// The schema is public (accounts.APISchema), so the agency is where its owner
// will look for it. That puts it inside PostgREST's exposed set, so the grants
// below are the whole lock rather than a second one, and SecureTables adds
// row-level security on top once the tables exist. Revoking from PUBLIC is
// what takes the default "anyone may use this schema" away.
//
// The schema is granted to the role rather than owned by it. On a hosted
// Supabase these run as `postgres`, which may create a role but is given
// membership of it without the SET option, and both CREATE SCHEMA
// AUTHORIZATION and ALTER SCHEMA OWNER TO require being able to SET ROLE to
// the new owner. CREATE on the schema is what the role actually needs.
func Statements(password string) []string {
	q := "'" + strings.ReplaceAll(password, "'", "''") + "'"
	return append([]string{
		fmt.Sprintf(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '%[1]s') THEN
    CREATE ROLE %[1]s LOGIN PASSWORD %[2]s NOINHERIT;
  ELSE
    ALTER ROLE %[1]s LOGIN PASSWORD %[2]s NOINHERIT;
  END IF;
END $$`, Role, q),
	}, SchemaStatements()...)
}

// SchemaStatements is the lock-down without the role's password: everything a
// project that already has the role needs, and nothing that touches it.
//
// Setting the password again is not harmless even when the value is identical.
// ALTER ROLE rewrites the SCRAM verifier with a fresh salt, and Supabase's
// pooler keeps authenticating against what it cached until it catches up — so a
// second agency launched into a project would knock out its own connection, and
// every other agency living there, for the window in between.
func SchemaStatements() []string {
	return []string{
		fmt.Sprintf(`CREATE SCHEMA IF NOT EXISTS %s`, Schema),
		fmt.Sprintf(`REVOKE ALL ON SCHEMA %s FROM PUBLIC`, Schema),
		fmt.Sprintf(`GRANT USAGE, CREATE ON SCHEMA %s TO %s`, Schema, Role),
		fmt.Sprintf(`ALTER ROLE %s SET search_path = %s`, Role, Schema),
		fmt.Sprintf(`DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA %[1]s FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA %[1]s FROM authenticated;
  END IF;
END $$`, Schema),
	}
}

// SecureTablesSQL turns row-level security on, with no policy attached, for
// every table the API role owns in the schema: on a schema PostgREST exposes,
// a grant that should not be there still yields no rows. It has to run after
// the tables exist, so a launch applies it once the agency is imported rather
// than with the rest of the lock-down.
//
// This costs the API nothing. A table's owner is exempt from its own RLS
// unless the table is FORCEd, and these tables are owned by the role that
// reads them.
func SecureTablesSQL() string {
	return fmt.Sprintf(`DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = '%[1]s' AND tableowner = '%[2]s' LOOP
    EXECUTE format('ALTER TABLE %%I.%%I ENABLE ROW LEVEL SECURITY', '%[1]s', t.tablename);
  END LOOP;
END $$`, Schema, Role)
}

// Run applies Statements through exec with a freshly generated API password,
// and returns it.
func Run(ctx context.Context, exec Exec) (string, error) {
	pw, err := randomPassword()
	if err != nil {
		return "", err
	}
	return RunWith(ctx, exec, pw)
}

// RunWith is Run against a password already in hand.
func RunWith(ctx context.Context, exec Exec, pw string) (string, error) {
	return run(ctx, exec, Statements(pw), pw)
}

// RunSchema is the lock-down for a project that already has the role, and is
// what a second agency launched into the same project runs. It leaves the
// password alone — see SchemaStatements for why that matters — and returns the
// one it was told to keep.
func RunSchema(ctx context.Context, exec Exec, pw string) (string, error) {
	return run(ctx, exec, SchemaStatements(), pw)
}

func run(ctx context.Context, exec Exec, statements []string, pw string) (string, error) {
	for _, stmt := range statements {
		if err := exec(ctx, stmt); err != nil {
			return "", fmt.Errorf("provision: %w", err)
		}
	}
	return pw, nil
}

func randomPassword() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Local provisions a database reachable over adminDSN (a `supabase start`
// Postgres, or any Postgres in development) and returns the Connection the
// API should store: the dedicated role, never adminDSN's own credentials.
func Local(ctx context.Context, adminDSN string, open func(dsn string) (*sql.DB, error)) (accounts.Connection, error) {
	u, err := url.Parse(adminDSN)
	if err != nil || u.Host == "" {
		return accounts.Connection{}, fmt.Errorf("provision: admin dsn is not a postgres url")
	}
	db, err := open(adminDSN)
	if err != nil {
		return accounts.Connection{}, fmt.Errorf("provision: could not reach the database")
	}
	defer db.Close()

	pw, err := Run(ctx, func(ctx context.Context, stmt string) error {
		_, err := db.ExecContext(ctx, stmt)
		return err
	})
	if err != nil {
		return accounts.Connection{}, err
	}
	u.User = url.UserPassword(Role, pw)
	return accounts.Connection{Kind: accounts.KindLocal, DSN: u.String()}, nil
}

// CreateUserFunction is how a launched project gets its first user without a
// service-role key (owner invariant, 2026-09-22). GoTrue's admin API refuses
// anything but service_role, so instead the launch installs this narrow door
// while it still has superuser access: SECURITY DEFINER, owned by postgres, and
// executable only by the API role. wakala_api itself never gets rights on auth.
//
// It is a copy of what GoTrue does on sign-up, which is the cost of this
// approach: the columns matter (auth.identities.provider_id became required in
// a later version), and a Supabase auth-schema change breaks user creation in
// every launched project at once. Re-check it when Supabase bumps auth.
//
// Roles go in raw_app_meta_data — never raw_user_meta_data, which the user can
// write themselves and could therefore forge.
func CreateUserFunction() string {
	return fmt.Sprintf(`
CREATE OR REPLACE FUNCTION %[1]s.create_user(p_email text, p_password text, p_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' OR p_password IS NULL OR btrim(p_password) = '' THEN
    RAISE EXCEPTION 'email and password are required';
  END IF;

  -- A project can hold more than one agency, so this runs again on a launch
  -- into a project the same person already has. Their sign-in is theirs
  -- already: hand back the existing id rather than failing on the unique
  -- email, and never touch the password they have been using.
  SELECT id INTO v_id FROM auth.users WHERE email = lower(btrim(p_email));
  IF FOUND THEN
    RETURN v_id;
  END IF;
  v_id := gen_random_uuid();

  -- The four token columns default to NULL, and GoTrue reads them into plain
  -- strings: leaving them unset makes every sign-in fail with "Database error
  -- querying schema". They are empty strings, never NULL.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) VALUES (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    lower(btrim(p_email)),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', p_role),
    '{}'::jsonb, now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', lower(btrim(p_email)), 'email_verified', true),
    'email', now(), now(), now()
  );

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION %[1]s.create_user(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION %[1]s.create_user(text, text, text) TO %[2]s;
`, Schema, Role)
}

// SeedUserSQL creates the first user of a launched project — the person who
// launched it, from the email already on the website's row — and stamps them
// admin so their own token carries the claim.
func SeedUserSQL(email, password string) string {
	q := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
	return fmt.Sprintf(`SELECT %s.create_user(%s, %s, 'admin')`, Schema, q(email), q(password))
}

// NewPassword is a generated credential for a launched project — the API role's
// login, or the first user's password.
func NewPassword() (string, error) { return randomPassword() }
