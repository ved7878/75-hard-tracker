-- ==============================================================================
-- 75 HARD TRACKER - MIGRATION 001: SYNC AN EXISTING DATABASE WITH THE CURRENT APP
-- ==============================================================================
-- WHY: schema.sql uses CREATE TABLE IF NOT EXISTS, so re-running it on a database
-- that was created by an OLDER version of the app does NOT add new columns.
-- Older versions created:
--   * daily_logs WITHOUT user_id / created_at (id was just 'YYYY-MM-DD')
--   * daily_logs with constraint "unique_user_day" instead of "unique_user_date"
--   * challenge_config with an extra "users" column (harmless, left in place)
--   * no password_resets table, no squad_profiles view, no updated_at triggers
-- The current app also stores new keys inside challenge_config.config
-- (wakeUpGraceMinutes, calorieTarget, proteinTargetG, requireLogin, autoSyncSupabase).
--
-- SAFE TO RE-RUN: every statement is idempotent. Existing data is kept.
-- HOW: Supabase Dashboard > SQL Editor > New Query > paste > Run.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PROFILES: create if missing, then add any missing columns
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '1111';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '🦁';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'from-rose-600 to-rose-700';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'challenger';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 2000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_answer TEXT DEFAULT '75hard';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_role_check CHECK (role IN ('challenger', 'admin'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Seed accounts only if they don't exist yet (never overwrites changed passwords)
INSERT INTO public.profiles (id, username, name, email, password, pin, avatar, color, role, deposit_amount)
VALUES
    ('user_1', 'vedant', 'Vedant', 'vedant@75hard.local', 'vedant123', '1111', '🦁', 'from-rose-600 to-rose-700', 'challenger', 2000),
    ('user_2', 'vedansh', 'Vedansh', 'vedansh@75hard.local', 'vedansh123', '2222', '🐺', 'from-blue-600 to-indigo-700', 'challenger', 2000),
    ('user_3', 'aryaman', 'Aryaman', 'aryaman@75hard.local', 'aryaman123', '3333', '🦅', 'from-amber-500 to-orange-600', 'challenger', 2000),
    ('admin', 'admin', 'Referee / Admin', 'admin@75hard.local', 'admin7575', '7575', '⚖️', 'from-purple-600 to-indigo-800', 'admin', 0)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. CHALLENGE_CONFIG: add missing columns + backfill new config keys
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_config (
    id TEXT PRIMARY KEY DEFAULT 'current_config',
    config JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.challenge_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Adds the keys introduced by the wake-up check-in window + nutrition tracking.
-- "defaults || config" means values already saved by the admin always win.
UPDATE public.challenge_config
SET config = '{
        "wakeUpGraceMinutes": 10,
        "calorieTarget": 2200,
        "proteinTargetG": 120,
        "requireLogin": false,
        "autoSyncSupabase": false
    }'::jsonb || config,
    updated_at = NOW()
WHERE id = 'current_config'
  AND NOT (config ?& ARRAY['wakeUpGraceMinutes', 'calorieTarget', 'proteinTargetG', 'requireLogin', 'autoSyncSupabase']);

-- ------------------------------------------------------------------------------
-- 3. DAILY_LOGS: add missing columns, fix old ids, constraints, indexes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_logs (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    day_number INT NOT NULL,
    travel JSONB NOT NULL DEFAULT '{}'::jsonb,
    sickness JSONB NOT NULL DEFAULT '{}'::jsonb,
    tasks JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'incomplete'
);

ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS sport JSONB
    DEFAULT '{"participated": false, "sportName": "", "durationMinutes": 0, "improvementNotes": ""}'::jsonb;
ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS journal_notes TEXT DEFAULT '';
ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS failed_tasks TEXT[] DEFAULT '{}';
ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Rows from the very first single-user version had no user_id -> they belong to user_1
UPDATE public.daily_logs SET user_id = 'user_1' WHERE user_id IS NULL;
ALTER TABLE public.daily_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.daily_logs ALTER COLUMN user_id DROP DEFAULT;

-- The app upserts with id = '<user_id>_<date>'. Old rows used id = '<date>', which
-- would make every new save collide with the (user_id, date) unique constraint.
UPDATE public.daily_logs d
SET id = d.user_id || '_' || d.date::text
WHERE d.id <> d.user_id || '_' || d.date::text
  AND NOT EXISTS (
      SELECT 1 FROM public.daily_logs x WHERE x.id = d.user_id || '_' || d.date::text
  );

-- Proper defaults for the JSON columns (older versions used '{}')
ALTER TABLE public.daily_logs ALTER COLUMN travel
    SET DEFAULT '{"isTravelling": false, "hours": 0, "gymAvailable": true}'::jsonb;
ALTER TABLE public.daily_logs ALTER COLUMN sickness
    SET DEFAULT '{"isSick": false, "hasMedicalProof": false, "isExempt": false, "status": "none"}'::jsonb;

DO $$
BEGIN
    -- One log per user per day (old DBs may have it as "unique_user_day")
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.daily_logs'::regclass
          AND conname IN ('unique_user_date', 'unique_user_day')
    ) THEN
        ALTER TABLE public.daily_logs
            ADD CONSTRAINT unique_user_date UNIQUE (user_id, date);
    END IF;

    -- Allowed status values
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.daily_logs'::regclass AND conname = 'daily_logs_status_check'
    ) THEN
        ALTER TABLE public.daily_logs
            ADD CONSTRAINT daily_logs_status_check
            CHECK (status IN ('completed', 'incomplete', 'exempt', 'future')) NOT VALID;
    END IF;

    -- Link logs to profiles (only when every log belongs to a known profile)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.daily_logs'::regclass AND contype = 'f'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.daily_logs l
            LEFT JOIN public.profiles p ON p.id = l.user_id
            WHERE p.id IS NULL
        ) THEN
            ALTER TABLE public.daily_logs
                ADD CONSTRAINT daily_logs_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
        ELSE
            RAISE NOTICE 'Skipped daily_logs -> profiles foreign key: some logs reference users that are not in profiles.';
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON public.daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_status ON public.daily_logs(status);

-- ------------------------------------------------------------------------------
-- 4. PASSWORD_RESETS table (added in the auth redesign)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reset_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. RLS + policies (DROP IF EXISTS so this can be re-run)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read profiles" ON public.profiles;
CREATE POLICY "Allow anon read profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert profiles" ON public.profiles;
CREATE POLICY "Allow anon insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update profiles" ON public.profiles;
CREATE POLICY "Allow anon update profiles" ON public.profiles FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anon delete profiles" ON public.profiles;
CREATE POLICY "Allow anon delete profiles" ON public.profiles FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow anon read config" ON public.challenge_config;
CREATE POLICY "Allow anon read config" ON public.challenge_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon upsert config" ON public.challenge_config;
CREATE POLICY "Allow anon upsert config" ON public.challenge_config FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow anon read daily_logs" ON public.daily_logs;
CREATE POLICY "Allow anon read daily_logs" ON public.daily_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon upsert daily_logs" ON public.daily_logs;
CREATE POLICY "Allow anon upsert daily_logs" ON public.daily_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow anon password_resets" ON public.password_resets;
CREATE POLICY "Allow anon password_resets" ON public.password_resets FOR ALL USING (true);

-- ------------------------------------------------------------------------------
-- 6. Safe public view (no password / pin / recovery_answer)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.squad_profiles AS
SELECT id, username, name, email, avatar, color, role, deposit_amount, created_at
FROM public.profiles;

GRANT SELECT ON public.squad_profiles TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 7. Storage buckets
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-proofs', 'medical-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access Progress Photos" ON storage.objects;
CREATE POLICY "Public Access Progress Photos" ON storage.objects FOR ALL USING (bucket_id = 'progress-photos');
DROP POLICY IF EXISTS "Public Access Medical Proofs" ON storage.objects;
CREATE POLICY "Public Access Medical Proofs" ON storage.objects FOR ALL USING (bucket_id = 'medical-proofs');

-- ------------------------------------------------------------------------------
-- 8. updated_at triggers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS set_logs_updated_at ON public.daily_logs;
CREATE TRIGGER set_logs_updated_at
BEFORE UPDATE ON public.daily_logs
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

COMMIT;

-- Ask PostgREST (Supabase API) to pick up the new columns immediately
NOTIFY pgrst, 'reload schema';
