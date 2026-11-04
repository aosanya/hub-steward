package provision

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"slices"

	"github.com/jackc/pgx/v5/pgconn"
)

const InviteFunction = Schema + ".invite_member"

var ErrInviteFunctionMissing = errors.New("provision: the identity project has no invite_member function wakala-api may call")

var roleNamePattern = regexp.MustCompile(`^[a-z_][a-z0-9_]{0,62}$`)

var supabaseClientRoles = []string{"anon", "authenticated", "service_role"}

func InviteMemberFunction(role string) (string, error) {
	if !roleNamePattern.MatchString(role) {
		return "", fmt.Errorf("provision: %q is not a role name", role)
	}
	if role == "public" || slices.Contains(supabaseClientRoles, role) {
		return "", fmt.Errorf("provision: %q is a role the project's clients sign in as, never wakala-api's", role)
	}
	revokes := ""
	for _, client := range supabaseClientRoles {
		revokes += fmt.Sprintf(`
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '%[1]s') THEN
    REVOKE ALL ON FUNCTION %[2]s(text) FROM %[1]s;
  END IF;`, client, InviteFunction)
	}
	return fmt.Sprintf(`
CREATE OR REPLACE FUNCTION %[1]s(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_email text := lower(btrim(p_email));
  v_id uuid;
BEGIN
  IF v_email IS NULL OR v_email = '' OR position('@' in v_email) < 2 THEN
    RAISE EXCEPTION 'an email address is required';
  END IF;

  SELECT id INTO v_id FROM auth.users WHERE email = v_email;
  IF FOUND THEN
    RETURN v_id;
  END IF;
  v_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, invited_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) VALUES (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_email, '', now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    '{}'::jsonb, now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', NULL, now(), now()
  );

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION %[1]s(text) FROM PUBLIC;
DO $$ BEGIN%[3]s
END $$;
GRANT EXECUTE ON FUNCTION %[1]s(text) TO %[2]s;
`, InviteFunction, role, revokes), nil
}

type IdentityAccounts struct {
	DB *sql.DB
}

func (a IdentityAccounts) Invite(ctx context.Context, email string) (string, error) {
	var id string
	err := a.DB.QueryRowContext(ctx, "SELECT "+InviteFunction+"($1)::text", email).Scan(&id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && (pgErr.Code == "42883" || pgErr.Code == "42501" || pgErr.Code == "3F000") {
		return "", ErrInviteFunctionMissing
	}
	if err != nil {
		return "", fmt.Errorf("provision: invite_member: %w", err)
	}
	if id == "" {
		return "", errors.New("provision: invite_member answered no account")
	}
	return id, nil
}
