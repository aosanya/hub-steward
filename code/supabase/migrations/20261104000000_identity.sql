DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wakala_api') THEN
    CREATE ROLE wakala_api LOGIN PASSWORD 'wakala_local';
  END IF;
END $$;

GRANT USAGE, CREATE ON SCHEMA public TO wakala_api;

CREATE OR REPLACE FUNCTION public.invite_member(p_email text)
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

REVOKE ALL ON FUNCTION public.invite_member(text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.invite_member(text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.invite_member(text) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.invite_member(text) FROM service_role;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.invite_member(text) TO wakala_api;

CREATE SCHEMA IF NOT EXISTS sign_in_private;
CREATE TABLE IF NOT EXISTS sign_in_private.session_last_seen (
  session_id uuid PRIMARY KEY REFERENCES auth.sessions(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL
);
ALTER TABLE sign_in_private.session_last_seen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA sign_in_private FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA sign_in_private FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA sign_in_private FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON SCHEMA sign_in_private FROM service_role;
  END IF;
END $$;
REVOKE ALL ON TABLE sign_in_private.session_last_seen FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE sign_in_private.session_last_seen FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE sign_in_private.session_last_seen FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON TABLE sign_in_private.session_last_seen FROM service_role;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.list_sign_in_sessions(uuid);
CREATE FUNCTION public.list_sign_in_sessions(p_subject uuid)
RETURNS TABLE (session_id uuid, user_agent text, started_at timestamptz, last_refreshed_at timestamptz, last_seen_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT s.id,
         coalesce(s.user_agent, ''),
         coalesce(s.created_at, s.updated_at),
         coalesce(s.refreshed_at AT TIME ZONE 'UTC', s.updated_at, s.created_at),
         greatest(seen.seen_at, coalesce(s.refreshed_at AT TIME ZONE 'UTC', s.updated_at, s.created_at))
  FROM auth.sessions AS s
  LEFT JOIN sign_in_private.session_last_seen AS seen ON seen.session_id = s.id
  WHERE s.user_id = p_subject
    AND (s.not_after IS NULL OR s.not_after > now())
  ORDER BY 5 DESC NULLS LAST, 1
$fn$;

REVOKE ALL ON FUNCTION public.list_sign_in_sessions(uuid) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.list_sign_in_sessions(uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.list_sign_in_sessions(uuid) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.list_sign_in_sessions(uuid) FROM service_role;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.list_sign_in_sessions(uuid) TO wakala_api;

CREATE OR REPLACE FUNCTION public.end_sign_in_session(p_subject uuid, p_session uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  PERFORM 1 FROM auth.sessions WHERE id = p_session AND user_id = p_subject FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  DELETE FROM auth.refresh_tokens WHERE session_id = p_session;
  DELETE FROM auth.sessions WHERE id = p_session AND user_id = p_subject;
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.end_sign_in_session(uuid, uuid) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.end_sign_in_session(uuid, uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.end_sign_in_session(uuid, uuid) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.end_sign_in_session(uuid, uuid) FROM service_role;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.end_sign_in_session(uuid, uuid) TO wakala_api;

CREATE OR REPLACE FUNCTION public.touch_sign_in_session(p_subject uuid, p_session uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  INSERT INTO sign_in_private.session_last_seen AS seen (session_id, seen_at)
  SELECT s.id, now()
  FROM auth.sessions AS s
  WHERE s.id = p_session
    AND s.user_id = p_subject
    AND (s.not_after IS NULL OR s.not_after > now())
  ON CONFLICT (session_id) DO UPDATE
    SET seen_at = excluded.seen_at
    WHERE seen.seen_at < excluded.seen_at - interval '120 seconds'
$fn$;

REVOKE ALL ON FUNCTION public.touch_sign_in_session(uuid, uuid) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.touch_sign_in_session(uuid, uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.touch_sign_in_session(uuid, uuid) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.touch_sign_in_session(uuid, uuid) FROM service_role;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.touch_sign_in_session(uuid, uuid) TO wakala_api;
