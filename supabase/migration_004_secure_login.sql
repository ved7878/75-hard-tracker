-- ==============================================================================
-- 75 HARD TRACKER - MIGRATION 004: SECURE LOGIN
-- ==============================================================================
-- Before this migration the public "anon" key (which ships inside the app's JS) could
-- read every password and PIN, edit anyone's logs, change the rules and delete users.
--
-- After it:
--   * Passwords / PINs are stored as bcrypt hashes. Plaintext copies are erased.
--   * Login happens INSIDE the database (app_login). The app receives a random session
--     token and sends it as the "x-session-token" header on every request.
--   * Row Level Security checks that token:
--       - profiles (credentials) ......... no direct access at all
--       - daily_logs ..................... read: signed-in squad; write: own rows (referee: all)
--       - challenge_config ............... read: anyone; write: referee only
--       - squad_profiles / daily_nutrition read-only
--   * Challengers can't approve their own sick days, and a stale phone can't undo the
--     referee's approve / reject decision.
--   * 5 wrong attempts in 15 min (or 20 in a day) locks that username temporarily.
--   * Storage: anyone can view/upload, nobody can overwrite or delete via the API.
--
-- RUN ORDER: schema.sql (or migrations 001-003) first, then this file.
-- Re-running schema.sql re-opens access – always run this file again afterwards.
-- Safe to re-run.
--
-- AFTER RUNNING: everyone's CURRENT password/PIN keeps working (they are hashed as-is).
-- The defaults (vedant123 / 1111, admin7575 / 7575, …) were published in the README and
-- git history – sign in as the referee and change every password straight away
-- (Admin → Squad → key icon, and More → Change password for the referee).
--
-- LOCKED OUT AS REFEREE? Run this in the SQL editor (pick your own values):
--   UPDATE public.profiles
--   SET password_hash = extensions.crypt('new-password', extensions.gen_salt('bf', 10)),
--       pin_hash      = extensions.crypt('482913',       extensions.gen_salt('bf', 10))
--   WHERE id = 'admin';
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- 1. Hash credentials and erase plaintext
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE public.profiles ALTER COLUMN password DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN pin DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN recovery_answer DROP DEFAULT;

UPDATE public.profiles
SET password_hash = extensions.crypt(password, extensions.gen_salt('bf', 10))
WHERE password IS NOT NULL AND password <> '';

UPDATE public.profiles
SET pin_hash = extensions.crypt(pin, extensions.gen_salt('bf', 10))
WHERE pin IS NOT NULL AND pin <> '';

UPDATE public.profiles
SET password = NULL, pin = NULL, recovery_answer = NULL
WHERE password IS NOT NULL OR pin IS NOT NULL OR recovery_answer IS NOT NULL;

-- The referee account must exist as a real profile now (no more built-in admin login)
INSERT INTO public.profiles (id, username, name, email, password_hash, pin_hash, avatar, color, role, deposit_amount)
VALUES (
    'admin', 'admin', 'Referee / Admin', 'admin@75hard.local',
    extensions.crypt('admin7575', extensions.gen_salt('bf', 10)),
    extensions.crypt('7575', extensions.gen_salt('bf', 10)),
    '⚖️', 'from-purple-600 to-indigo-800', 'admin', 0
)
ON CONFLICT (id) DO NOTHING;

-- Secrets must not live in the publicly readable rules config
UPDATE public.challenge_config
SET config = config - 'adminPin' - 'adminPassword' - 'recoveryKey'
WHERE config ?| ARRAY['adminPin', 'adminPassword', 'recoveryKey'];

-- ------------------------------------------------------------------------------
-- 2. Sessions + login attempts (never reachable through the API)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_sessions (
    token_hash TEXT PRIMARY KEY,                -- sha256 of the token; the token itself is never stored
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON public.app_sessions(user_id);

CREATE TABLE IF NOT EXISTS public.app_login_attempts (
    id BIGSERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_login_attempts_lookup ON public.app_login_attempts(identifier, attempted_at);

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_sessions, public.app_login_attempts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.app_login_attempts_id_seq FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Session helpers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_request_token()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(NULLIF(current_setting('request.headers', true), '')::json ->> 'x-session-token', '')
$$;

CREATE OR REPLACE FUNCTION public.app_session_user_id()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT s.user_id
    FROM public.app_sessions s
    WHERE s.token_hash = encode(extensions.digest(public.app_request_token(), 'sha256'), 'hex')
      AND s.expires_at > NOW()
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = public.app_session_user_id() AND role = 'admin'
    )
$$;

-- Public, credential-free view of one profile
CREATE OR REPLACE FUNCTION public.app_profile_json(p public.profiles)
RETURNS json
LANGUAGE sql STABLE
AS $$
    SELECT json_build_object(
        'id', p.id, 'username', p.username, 'name', p.name, 'email', p.email,
        'avatar', p.avatar, 'color', p.color, 'role', p.role,
        'deposit_amount', p.deposit_amount, 'created_at', p.created_at
    )
$$;

-- ------------------------------------------------------------------------------
-- 4. Login / session RPCs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_login(p_identifier TEXT, p_secret TEXT)
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_id     TEXT := lower(trim(COALESCE(p_identifier, '')));
    v_secret TEXT := trim(COALESCE(p_secret, ''));
    v_recent INT;
    v_daily  INT;
    v_user   public.profiles;
    v_token  TEXT;
BEGIN
    IF v_id = 'referee' THEN v_id := 'admin'; END IF;
    IF v_id = '' OR v_secret = '' THEN
        RETURN json_build_object('error', 'Enter your username and password or PIN.');
    END IF;

    SELECT
        COUNT(*) FILTER (WHERE attempted_at > NOW() - INTERVAL '15 minutes'),
        COUNT(*)
    INTO v_recent, v_daily
    FROM public.app_login_attempts
    WHERE identifier = v_id AND NOT success AND attempted_at > NOW() - INTERVAL '1 day';

    IF v_recent >= 5 OR v_daily >= 20 THEN
        RETURN json_build_object('error', 'Too many wrong attempts. Try again later or ask your referee.');
    END IF;

    SELECT * INTO v_user
    FROM public.profiles
    WHERE lower(username) = v_id OR lower(email) = v_id
    ORDER BY (lower(username) = v_id) DESC
    LIMIT 1;

    IF v_user.id IS NULL OR NOT (
           (v_user.password_hash IS NOT NULL AND v_user.password_hash = extensions.crypt(v_secret, v_user.password_hash))
        OR (v_user.pin_hash IS NOT NULL AND v_user.pin_hash = extensions.crypt(v_secret, v_user.pin_hash))
    ) THEN
        INSERT INTO public.app_login_attempts (identifier, success) VALUES (v_id, false);
        RETURN json_build_object('error', 'Wrong username, password or PIN.');
    END IF;

    INSERT INTO public.app_login_attempts (identifier, success) VALUES (v_id, true);
    -- A successful login clears that username's failed attempts; tidy up old rows
    DELETE FROM public.app_login_attempts
    WHERE (identifier = v_id AND NOT success) OR attempted_at < NOW() - INTERVAL '2 days';
    DELETE FROM public.app_sessions WHERE expires_at < NOW();

    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    INSERT INTO public.app_sessions (token_hash, user_id, expires_at)
    VALUES (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user.id, NOW() + INTERVAL '60 days');

    RETURN json_build_object('token', v_token, 'user', public.app_profile_json(v_user));
END;
$$;

CREATE OR REPLACE FUNCTION public.app_current_user()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.app_profile_json(p) FROM public.profiles p WHERE p.id = public.app_session_user_id()
$$;

CREATE OR REPLACE FUNCTION public.app_logout()
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    DELETE FROM public.app_sessions
    WHERE token_hash = encode(extensions.digest(public.app_request_token(), 'sha256'), 'hex')
$$;

-- ------------------------------------------------------------------------------
-- 5. Account management RPCs
-- ------------------------------------------------------------------------------
-- Self: name, email, avatar, password, pin.  Referee: also username + deposit, for anyone.
CREATE OR REPLACE FUNCTION public.app_update_user(p_user_id TEXT, p_changes JSONB)
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_me    TEXT := public.app_session_user_id();
    v_admin BOOLEAN := public.app_is_admin();
    v_c     JSONB := COALESCE(p_changes, '{}'::jsonb);
BEGIN
    IF v_me IS NULL THEN
        RETURN json_build_object('error', 'Your session expired. Please sign in again.');
    END IF;
    IF NOT v_admin AND v_me <> p_user_id THEN
        RETURN json_build_object('error', 'You can only change your own account.');
    END IF;
    IF v_c ? 'password' AND length(trim(v_c ->> 'password')) < 6 THEN
        RETURN json_build_object('error', 'Password needs at least 6 characters.');
    END IF;
    IF v_c ? 'pin' AND NOT ((v_c ->> 'pin') ~ '^[0-9]{4,6}$') THEN
        RETURN json_build_object('error', 'PIN must be 4–6 digits.');
    END IF;
    IF v_admin AND v_c ? 'username' AND NOT (lower(trim(v_c ->> 'username')) ~ '^[a-z0-9._-]{2,30}$') THEN
        RETURN json_build_object('error', 'Username can only use letters, numbers, dot, dash and underscore.');
    END IF;

    UPDATE public.profiles SET
        name           = CASE WHEN v_c ? 'name' AND trim(v_c ->> 'name') <> '' THEN trim(v_c ->> 'name') ELSE name END,
        email          = CASE WHEN v_c ? 'email' THEN NULLIF(trim(v_c ->> 'email'), '') ELSE email END,
        avatar         = CASE WHEN v_c ? 'avatar' AND (v_c ->> 'avatar') <> '' THEN v_c ->> 'avatar' ELSE avatar END,
        password_hash  = CASE WHEN v_c ? 'password' THEN extensions.crypt(trim(v_c ->> 'password'), extensions.gen_salt('bf', 10)) ELSE password_hash END,
        pin_hash       = CASE WHEN v_c ? 'pin' THEN extensions.crypt(v_c ->> 'pin', extensions.gen_salt('bf', 10)) ELSE pin_hash END,
        username       = CASE WHEN v_admin AND v_c ? 'username' THEN lower(trim(v_c ->> 'username')) ELSE username END,
        deposit_amount = CASE WHEN v_admin AND v_c ? 'deposit_amount' THEN GREATEST((v_c ->> 'deposit_amount')::numeric, 0) ELSE deposit_amount END,
        updated_at     = NOW()
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Account not found.');
    END IF;

    -- New password / PIN signs that account out on every OTHER device
    IF v_c ? 'password' OR v_c ? 'pin' THEN
        DELETE FROM public.app_sessions
        WHERE user_id = p_user_id
          AND token_hash IS DISTINCT FROM encode(extensions.digest(public.app_request_token(), 'sha256'), 'hex');
    END IF;

    RETURN json_build_object('ok', true);
EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('error', 'That username is already taken.');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_user(p_user JSONB)
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_username TEXT := lower(trim(COALESCE(p_user ->> 'username', '')));
    v_name     TEXT := trim(COALESCE(p_user ->> 'name', ''));
    v_password TEXT := trim(COALESCE(p_user ->> 'password', ''));
    v_pin      TEXT := trim(COALESCE(p_user ->> 'pin', ''));
    v_row      public.profiles;
BEGIN
    IF NOT public.app_is_admin() THEN
        RETURN json_build_object('error', 'Only the referee can add challengers.');
    END IF;
    IF v_name = '' OR NOT (v_username ~ '^[a-z0-9._-]{2,30}$') OR v_username IN ('admin', 'referee') THEN
        RETURN json_build_object('error', 'Enter a name and a username (letters, numbers, . _ -).');
    END IF;
    IF length(v_password) < 6 THEN
        RETURN json_build_object('error', 'Password needs at least 6 characters.');
    END IF;
    IF v_pin <> '' AND NOT (v_pin ~ '^[0-9]{4,6}$') THEN
        RETURN json_build_object('error', 'PIN must be 4–6 digits.');
    END IF;

    INSERT INTO public.profiles (id, username, name, email, password_hash, pin_hash, avatar, color, role, deposit_amount)
    VALUES (
        'user_' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint,
        v_username,
        v_name,
        COALESCE(NULLIF(trim(p_user ->> 'email'), ''), v_username || '@75hard.local'),
        extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
        CASE WHEN v_pin <> '' THEN extensions.crypt(v_pin, extensions.gen_salt('bf', 10)) END,
        COALESCE(NULLIF(p_user ->> 'avatar', ''), '🦁'),
        'from-rose-600 to-rose-700',
        'challenger',
        GREATEST(COALESCE((p_user ->> 'deposit_amount')::numeric, 2000), 0)
    )
    RETURNING * INTO v_row;

    RETURN json_build_object('user', public.app_profile_json(v_row));
EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('error', format('The username "%s" is already taken.', v_username));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id TEXT)
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.app_is_admin() THEN
        RETURN json_build_object('error', 'Only the referee can remove challengers.');
    END IF;
    IF p_user_id = 'admin' OR p_user_id = public.app_session_user_id() THEN
        RETURN json_build_object('error', 'The referee account can''t be removed.');
    END IF;
    DELETE FROM public.daily_logs WHERE user_id = p_user_id;
    DELETE FROM public.profiles WHERE id = p_user_id;
    RETURN json_build_object('ok', true);
END;
$$;

-- Who may call what: helpers are internal, the RPCs check the session themselves
REVOKE ALL ON FUNCTION public.app_profile_json(public.profiles) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_login(TEXT, TEXT), public.app_current_user(), public.app_logout(),
                       public.app_update_user(TEXT, JSONB), public.admin_create_user(JSONB),
                       public.admin_delete_user(TEXT), public.app_session_user_id(), public.app_is_admin()
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_login(TEXT, TEXT), public.app_current_user(), public.app_logout(),
                          public.app_update_user(TEXT, JSONB), public.admin_create_user(JSONB),
                          public.admin_delete_user(TEXT), public.app_session_user_id(), public.app_is_admin()
    TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 6. Replace every old "allow anyone" policy
-- ------------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('profiles', 'password_resets', 'challenge_config', 'daily_logs', 'squad_profiles', 'daily_nutrition')
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- profiles + password_resets: nothing via the API (login and edits go through the RPCs)
REVOKE ALL ON public.profiles, public.password_resets FROM anon, authenticated;

-- challenge_config: rules are public, only the referee may change them
REVOKE ALL ON public.challenge_config FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.challenge_config TO anon, authenticated;
CREATE POLICY "config readable" ON public.challenge_config FOR SELECT USING (true);
CREATE POLICY "config insert by referee" ON public.challenge_config FOR INSERT
    WITH CHECK ((SELECT public.app_is_admin()));
CREATE POLICY "config update by referee" ON public.challenge_config FOR UPDATE
    USING ((SELECT public.app_is_admin())) WITH CHECK ((SELECT public.app_is_admin()));

-- daily_logs: squad can read, each person writes their own, referee writes any
REVOKE ALL ON public.daily_logs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_logs TO anon, authenticated;
CREATE POLICY "logs readable by squad" ON public.daily_logs FOR SELECT
    USING ((SELECT public.app_session_user_id()) IS NOT NULL);
CREATE POLICY "logs insert own" ON public.daily_logs FOR INSERT
    WITH CHECK (user_id = (SELECT public.app_session_user_id()) OR (SELECT public.app_is_admin()));
CREATE POLICY "logs update own" ON public.daily_logs FOR UPDATE
    USING (user_id = (SELECT public.app_session_user_id()) OR (SELECT public.app_is_admin()))
    WITH CHECK (user_id = (SELECT public.app_session_user_id()) OR (SELECT public.app_is_admin()));
CREATE POLICY "logs delete by referee" ON public.daily_logs FOR DELETE
    USING ((SELECT public.app_is_admin()));

-- squad_profiles / daily_nutrition: read-only through the API (edit them in the Table Editor)
DO $$
BEGIN
    IF to_regclass('public.squad_profiles') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON public.squad_profiles FROM anon, authenticated';
        EXECUTE 'GRANT SELECT ON public.squad_profiles TO anon, authenticated';
        IF (SELECT relkind FROM pg_class WHERE oid = 'public.squad_profiles'::regclass) = 'r' THEN
            EXECUTE 'ALTER TABLE public.squad_profiles ENABLE ROW LEVEL SECURITY';
            EXECUTE 'CREATE POLICY "squad readable" ON public.squad_profiles FOR SELECT USING (true)';
        END IF;
    END IF;

    IF to_regclass('public.daily_nutrition') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON public.daily_nutrition FROM anon, authenticated';
        EXECUTE 'GRANT SELECT ON public.daily_nutrition TO anon, authenticated';
        IF (SELECT relkind FROM pg_class WHERE oid = 'public.daily_nutrition'::regclass) = 'r' THEN
            EXECUTE 'ALTER TABLE public.daily_nutrition ENABLE ROW LEVEL SECURITY';
            EXECUTE 'CREATE POLICY "nutrition readable by squad" ON public.daily_nutrition FOR SELECT
                     USING ((SELECT public.app_session_user_id()) IS NOT NULL)';
        END IF;
    END IF;
END $$;

-- The sync triggers (migration 003) write to tables the app can no longer write to
-- directly, so they must run with the owner's rights.
DO $$
DECLARE f TEXT;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.sync_daily_nutrition_from_log()',
        'public.sync_daily_nutrition_delete()',
        'public.sync_squad_profiles_from_profiles()',
        'public.sync_squad_profiles_delete()'
    ] LOOP
        IF to_regprocedure(f) IS NOT NULL THEN
            EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER SET search_path = public', f);
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 7. Challengers can't approve their own sick day or undo the referee's decision
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_guard_daily_log()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Table Editor / SQL (no app session) and the referee are trusted
    IF public.app_request_token() IS NULL OR public.app_is_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND COALESCE(OLD.sickness ->> 'status', 'none') IN ('approved', 'rejected') THEN
        -- Keep the referee's decision, whatever an out-of-date phone sends
        NEW.sickness := COALESCE(NEW.sickness, '{}'::jsonb) || jsonb_build_object(
            'isSick',          OLD.sickness -> 'isSick',
            'hasMedicalProof', OLD.sickness -> 'hasMedicalProof',
            'isExempt',        OLD.sickness -> 'isExempt',
            'status',          OLD.sickness -> 'status',
            'reviewedBy',      OLD.sickness -> 'reviewedBy',
            'reviewedAt',      OLD.sickness -> 'reviewedAt',
            'adminComment',    OLD.sickness -> 'adminComment'
        );
        IF OLD.status = 'exempt' THEN
            NEW.status := 'exempt';
        ELSIF NEW.status = 'exempt' THEN
            NEW.status := 'incomplete';
        END IF;
    ELSE
        IF COALESCE(NEW.sickness ->> 'status', 'none') IN ('approved', 'rejected')
           OR COALESCE(NEW.sickness ->> 'isExempt', 'false') = 'true' THEN
            NEW.sickness := COALESCE(NEW.sickness, '{}'::jsonb) || jsonb_build_object('status', 'pending', 'isExempt', false);
        END IF;
        IF NEW.status = 'exempt' THEN
            NEW.status := 'incomplete';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_daily_log ON public.daily_logs;
CREATE TRIGGER guard_daily_log
BEFORE INSERT OR UPDATE ON public.daily_logs
FOR EACH ROW EXECUTE PROCEDURE public.app_guard_daily_log();

-- ------------------------------------------------------------------------------
-- 8. Storage: view + upload only (no overwriting or deleting other people's files)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public Access Progress Photos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Medical Proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read medical proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload medical proofs" ON storage.objects;
DROP POLICY IF EXISTS "75hard read media" ON storage.objects;
DROP POLICY IF EXISTS "75hard upload media" ON storage.objects;

CREATE POLICY "75hard read media" ON storage.objects FOR SELECT
    USING (bucket_id IN ('progress-photos', 'medical-proofs'));
CREATE POLICY "75hard upload media" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id IN ('progress-photos', 'medical-proofs'));

-- 10 MB max, images + PDF only
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
WHERE id IN ('progress-photos', 'medical-proofs');

COMMIT;

NOTIFY pgrst, 'reload schema';
