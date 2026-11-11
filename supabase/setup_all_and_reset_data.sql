-- ==============================================================================
-- 75 HARD TRACKER - ONE-SHOT: BRING DATABASE UP TO DATE + RESET TRACKING DATA
-- ==============================================================================
-- Use this when you're not sure which migrations were already applied.
-- It runs migrations 001 → 004 (each step skips whatever already exists), then wipes
-- all tracking data. ACCOUNTS ARE KEPT (usernames, names, avatars, deposits and their
-- current passwords / PINs).
--
-- WIPED:   daily logs (habits, photos links, sick-day requests, journals),
--          daily nutrition, failed-login counters, old password-reset rows
-- KEPT:    accounts (profiles / squad_profiles), challenge rules & dates,
--          login sessions, storage bucket files (see note at the end)
--
-- Everything runs in ONE transaction: if any step fails, nothing is changed.
-- HOW: Supabase Dashboard > SQL Editor > New Query > paste ALL of this > Run.
-- Afterwards: deploy the latest app, sign in as the referee and change every
-- password and PIN (the old defaults are public in the git history).
--
-- Generated from the four migration files – edit those, not this file.
-- ==============================================================================

BEGIN;


-- ##############################################################################
-- migration_001_sync_missing_columns.sql
-- ##############################################################################
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
-- 6. Squad Profiles Real Table (Full editing supported in Supabase Table Editor)
-- ------------------------------------------------------------------------------
-- Only drop it while it is still a VIEW (re-running must not fail once it's a table)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = 'squad_profiles' AND c.relkind = 'v') THEN
        DROP VIEW public.squad_profiles CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.squad_profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    avatar TEXT DEFAULT '🦁',
    color TEXT DEFAULT 'from-rose-600 to-rose-700',
    role TEXT NOT NULL DEFAULT 'challenger' CHECK (role IN ('challenger', 'admin')),
    deposit_amount NUMERIC DEFAULT 2000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_squad_profiles_username ON public.squad_profiles(username);
CREATE INDEX IF NOT EXISTS idx_squad_profiles_role ON public.squad_profiles(role);

ALTER TABLE public.squad_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all squad_profiles" ON public.squad_profiles;
CREATE POLICY "Allow anon all squad_profiles" ON public.squad_profiles FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.squad_profiles TO anon, authenticated, service_role;

-- Profiles -> squad_profiles auto-sync
CREATE OR REPLACE FUNCTION sync_squad_profiles_from_profiles()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.squad_profiles (
        id, username, name, email, avatar, color, role, deposit_amount, created_at, updated_at
    ) VALUES (
        NEW.id, NEW.username, NEW.name, NEW.email, NEW.avatar, NEW.color, NEW.role, NEW.deposit_amount, COALESCE(NEW.created_at, NOW()), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        avatar = EXCLUDED.avatar,
        color = EXCLUDED.color,
        role = EXCLUDED.role,
        deposit_amount = EXCLUDED.deposit_amount,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_squad_profiles ON public.profiles;
CREATE TRIGGER trigger_sync_squad_profiles
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE sync_squad_profiles_from_profiles();

-- Profiles delete -> squad_profiles delete
CREATE OR REPLACE FUNCTION sync_squad_profiles_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.squad_profiles WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_squad_profiles_del ON public.profiles;
CREATE TRIGGER trigger_sync_squad_profiles_del
AFTER DELETE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE sync_squad_profiles_delete();

-- squad_profiles -> profiles sync (when updated directly in Supabase)
CREATE OR REPLACE FUNCTION sync_profiles_from_squad_profiles()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET username = NEW.username,
        name = NEW.name,
        email = NEW.email,
        avatar = NEW.avatar,
        color = NEW.color,
        role = NEW.role,
        deposit_amount = NEW.deposit_amount,
        updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_profiles_from_squad ON public.squad_profiles;
CREATE TRIGGER trigger_sync_profiles_from_squad
AFTER UPDATE ON public.squad_profiles
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE PROCEDURE sync_profiles_from_squad_profiles();

-- Initial backfill into squad_profiles
INSERT INTO public.squad_profiles (id, username, name, email, avatar, color, role, deposit_amount, created_at, updated_at)
SELECT id, username, name, email, avatar, color, role, deposit_amount, created_at, updated_at
FROM public.profiles
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    avatar = EXCLUDED.avatar,
    color = EXCLUDED.color,
    role = EXCLUDED.role,
    deposit_amount = EXCLUDED.deposit_amount,
    updated_at = NOW();

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


-- Ask PostgREST (Supabase API) to pick up the new columns immediately


-- ##############################################################################
-- migration_002_nutrition_columns.sql
-- ##############################################################################
-- ==============================================================================
-- 75 HARD TRACKER - MIGRATION 002: DAILY CALORIES & PROTEIN AS REAL COLUMNS
-- ==============================================================================
-- The app saves daily nutrition inside the tasks JSON:
--     daily_logs.tasks -> 'diet' -> 'calories'      (kcal eaten that day)
--     daily_logs.tasks -> 'diet' -> 'proteinGrams'  (grams of protein that day)
-- and the goals inside challenge_config.config ('calorieTarget', 'proteinTargetG').
--
-- This adds GENERATED columns that Postgres fills from that JSON automatically,
-- so they are always in sync and NO app code change is needed (the app never
-- writes these columns; Postgres computes them on every insert/update).
--
-- Run AFTER migration_001. Safe to re-run.
-- ==============================================================================


ALTER TABLE public.daily_logs
    ADD COLUMN IF NOT EXISTS calories NUMERIC
    GENERATED ALWAYS AS (
        CASE WHEN jsonb_typeof(tasks -> 'diet' -> 'calories') = 'number'
             THEN (tasks -> 'diet' ->> 'calories')::numeric
        END
    ) STORED;

ALTER TABLE public.daily_logs
    ADD COLUMN IF NOT EXISTS protein_grams NUMERIC
    GENERATED ALWAYS AS (
        CASE WHEN jsonb_typeof(tasks -> 'diet' -> 'proteinGrams') = 'number'
             THEN (tasks -> 'diet' ->> 'proteinGrams')::numeric
        END
    ) STORED;

-- Make sure the goals exist in the saved config (keeps values the admin already set)
UPDATE public.challenge_config
SET config = '{"calorieTarget": 2200, "proteinTargetG": 120}'::jsonb || config
WHERE id = 'current_config'
  AND NOT (config ?& ARRAY['calorieTarget', 'proteinTargetG']);

-- Real table: one row per challenger per day, with goals and % of goal (Fully editable in Supabase Table Editor)
-- Only drop it while it is still a VIEW (re-running must not fail once it's a table)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = 'daily_nutrition' AND c.relkind = 'v') THEN
        DROP VIEW public.daily_nutrition CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.daily_nutrition (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    challenger TEXT,
    date DATE NOT NULL,
    day_number INT DEFAULT 1,
    calories NUMERIC DEFAULT 0,
    protein_grams NUMERIC DEFAULT 0,
    calorie_target NUMERIC DEFAULT 2200,
    protein_target_g NUMERIC DEFAULT 120,
    calories_pct_of_goal NUMERIC DEFAULT 0,
    protein_pct_of_goal NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_daily_nutrition_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_nutrition_user_date ON public.daily_nutrition(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_date ON public.daily_nutrition(date);

ALTER TABLE public.daily_nutrition ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all daily_nutrition" ON public.daily_nutrition;
CREATE POLICY "Allow anon all daily_nutrition" ON public.daily_nutrition FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.daily_nutrition TO anon, authenticated, service_role;

-- daily_logs -> daily_nutrition auto-sync
CREATE OR REPLACE FUNCTION sync_daily_nutrition_from_log()
RETURNS TRIGGER AS $$
DECLARE
    v_challenger TEXT;
    v_cal_target NUMERIC := 2200;
    v_prot_target NUMERIC := 120;
    v_cal NUMERIC := 0;
    v_prot NUMERIC := 0;
BEGIN
    SELECT name INTO v_challenger FROM public.profiles WHERE id = NEW.user_id;

    SELECT 
        COALESCE((config ->> 'calorieTarget')::numeric, 2200),
        COALESCE((config ->> 'proteinTargetG')::numeric, 120)
    INTO v_cal_target, v_prot_target
    FROM public.challenge_config WHERE id = 'current_config';

    IF jsonb_typeof(NEW.tasks -> 'diet' -> 'calories') = 'number' THEN
        v_cal := (NEW.tasks -> 'diet' ->> 'calories')::numeric;
    END IF;

    IF jsonb_typeof(NEW.tasks -> 'diet' -> 'proteinGrams') = 'number' THEN
        v_prot := (NEW.tasks -> 'diet' ->> 'proteinGrams')::numeric;
    END IF;

    INSERT INTO public.daily_nutrition (
        id, user_id, challenger, date, day_number,
        calories, protein_grams, calorie_target, protein_target_g,
        calories_pct_of_goal, protein_pct_of_goal, updated_at
    ) VALUES (
        NEW.user_id || '_' || NEW.date::text,
        NEW.user_id,
        COALESCE(v_challenger, NEW.user_id),
        NEW.date,
        NEW.day_number,
        v_cal,
        v_prot,
        v_cal_target,
        v_prot_target,
        ROUND(100 * v_cal / NULLIF(v_cal_target, 0), 1),
        ROUND(100 * v_prot / NULLIF(v_prot_target, 0), 1),
        NOW()
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
        challenger = EXCLUDED.challenger,
        day_number = EXCLUDED.day_number,
        calories = EXCLUDED.calories,
        protein_grams = EXCLUDED.protein_grams,
        calorie_target = EXCLUDED.calorie_target,
        protein_target_g = EXCLUDED.protein_target_g,
        calories_pct_of_goal = EXCLUDED.calories_pct_of_goal,
        protein_pct_of_goal = EXCLUDED.protein_pct_of_goal,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_daily_nutrition ON public.daily_logs;
CREATE TRIGGER trigger_sync_daily_nutrition
AFTER INSERT OR UPDATE ON public.daily_logs
FOR EACH ROW EXECUTE PROCEDURE sync_daily_nutrition_from_log();

-- daily_logs delete -> daily_nutrition delete
CREATE OR REPLACE FUNCTION sync_daily_nutrition_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.daily_nutrition WHERE user_id = OLD.user_id AND date = OLD.date;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_daily_nutrition_del ON public.daily_logs;
CREATE TRIGGER trigger_sync_daily_nutrition_del
AFTER DELETE ON public.daily_logs
FOR EACH ROW EXECUTE PROCEDURE sync_daily_nutrition_delete();

-- daily_nutrition -> daily_logs sync (when edited directly in Supabase Table Editor)
CREATE OR REPLACE FUNCTION sync_log_from_daily_nutrition()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.daily_logs
    SET tasks = jsonb_set(
            jsonb_set(
                COALESCE(tasks, '{}'::jsonb),
                '{diet,calories}',
                to_jsonb(COALESCE(NEW.calories, 0))
            ),
            '{diet,proteinGrams}',
            to_jsonb(COALESCE(NEW.protein_grams, 0))
        ),
        updated_at = NOW()
    WHERE user_id = NEW.user_id AND date = NEW.date;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_log_from_nutrition ON public.daily_nutrition;
CREATE TRIGGER trigger_sync_log_from_nutrition
AFTER UPDATE ON public.daily_nutrition
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE PROCEDURE sync_log_from_daily_nutrition();

-- Initial backfill from existing logs
INSERT INTO public.daily_nutrition (
    id, user_id, challenger, date, day_number,
    calories, protein_grams, calorie_target, protein_target_g,
    calories_pct_of_goal, protein_pct_of_goal
)
SELECT
    l.user_id || '_' || l.date::text,
    l.user_id,
    COALESCE(p.name, l.user_id),
    l.date,
    l.day_number,
    COALESCE(
        CASE WHEN jsonb_typeof(l.tasks -> 'diet' -> 'calories') = 'number'
             THEN (l.tasks -> 'diet' ->> 'calories')::numeric END,
        0
    ),
    COALESCE(
        CASE WHEN jsonb_typeof(l.tasks -> 'diet' -> 'proteinGrams') = 'number'
             THEN (l.tasks -> 'diet' ->> 'proteinGrams')::numeric END,
        0
    ),
    COALESCE((c.config ->> 'calorieTarget')::numeric, 2200),
    COALESCE((c.config ->> 'proteinTargetG')::numeric, 120),
    ROUND(100 * COALESCE(
        CASE WHEN jsonb_typeof(l.tasks -> 'diet' -> 'calories') = 'number'
             THEN (l.tasks -> 'diet' ->> 'calories')::numeric END, 0
    ) / NULLIF((c.config ->> 'calorieTarget')::numeric, 0), 1),
    ROUND(100 * COALESCE(
        CASE WHEN jsonb_typeof(l.tasks -> 'diet' -> 'proteinGrams') = 'number'
             THEN (l.tasks -> 'diet' ->> 'proteinGrams')::numeric END, 0
    ) / NULLIF((c.config ->> 'proteinTargetG')::numeric, 0), 1)
FROM public.daily_logs l
LEFT JOIN public.profiles p ON p.id = l.user_id
LEFT JOIN public.challenge_config c ON c.id = 'current_config'
ON CONFLICT (user_id, date) DO UPDATE SET
    challenger = EXCLUDED.challenger,
    day_number = EXCLUDED.day_number,
    calories = EXCLUDED.calories,
    protein_grams = EXCLUDED.protein_grams,
    calorie_target = EXCLUDED.calorie_target,
    protein_target_g = EXCLUDED.protein_target_g,
    calories_pct_of_goal = EXCLUDED.calories_pct_of_goal,
    protein_pct_of_goal = EXCLUDED.protein_pct_of_goal,
    updated_at = NOW();



-- Example: averages per challenger
-- SELECT challenger,
--        ROUND(AVG(calories)) AS avg_kcal,
--        ROUND(AVG(protein_grams)) AS avg_protein_g
-- FROM public.daily_nutrition
-- WHERE calories > 0 OR protein_grams > 0
-- GROUP BY challenger;


-- ##############################################################################
-- migration_003_convert_views_to_tables.sql
-- ##############################################################################
-- ==============================================================================
-- 75 HARD TRACKER - MIGRATION 003: CONVERT VIEWS TO EDITABLE TABLES
-- ==============================================================================
-- PURPOSE:
-- Supabase Table Editor renders SQL views as "View (Read-only)".
-- This migration converts 'squad_profiles' and 'daily_nutrition' from read-only
-- views into REAL, FULLY-EDITABLE PostgreSQL tables with bi-directional auto-sync
-- triggers and RLS permissions.
--
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard -> SQL Editor -> New Query
-- 2. Paste this entire file and click "Run" (or Ctrl+Enter)
-- 3. In Table Editor, squad_profiles & daily_nutrition will now be real, editable tables!
-- ==============================================================================


-- ==============================================================================
-- PART 1: CONVERT squad_profiles VIEW TO REAL TABLE
-- ==============================================================================

-- 1. Safely drop the read-only view
-- Only drop it while it is still a VIEW (re-running must not fail once it's a table)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = 'squad_profiles' AND c.relkind = 'v') THEN
        DROP VIEW public.squad_profiles CASCADE;
    END IF;
END $$;

-- 2. Create squad_profiles as a real table
CREATE TABLE IF NOT EXISTS public.squad_profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    avatar TEXT DEFAULT '🦁',
    color TEXT DEFAULT 'from-rose-600 to-rose-700',
    role TEXT NOT NULL DEFAULT 'challenger' CHECK (role IN ('challenger', 'admin')),
    deposit_amount NUMERIC DEFAULT 2000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_squad_profiles_username ON public.squad_profiles(username);
CREATE INDEX IF NOT EXISTS idx_squad_profiles_role ON public.squad_profiles(role);

-- 4. Enable RLS and setup full access policies
ALTER TABLE public.squad_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all squad_profiles" ON public.squad_profiles;
CREATE POLICY "Allow anon all squad_profiles" ON public.squad_profiles FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.squad_profiles TO anon, authenticated, service_role;

-- 5. Auto-sync trigger: profiles -> squad_profiles
CREATE OR REPLACE FUNCTION sync_squad_profiles_from_profiles()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.squad_profiles (
        id, username, name, email, avatar, color, role, deposit_amount, created_at, updated_at
    ) VALUES (
        NEW.id, NEW.username, NEW.name, NEW.email, NEW.avatar, NEW.color, NEW.role, NEW.deposit_amount, COALESCE(NEW.created_at, NOW()), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        avatar = EXCLUDED.avatar,
        color = EXCLUDED.color,
        role = EXCLUDED.role,
        deposit_amount = EXCLUDED.deposit_amount,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_squad_profiles ON public.profiles;
CREATE TRIGGER trigger_sync_squad_profiles
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE sync_squad_profiles_from_profiles();

-- Auto-sync delete: profiles -> squad_profiles
CREATE OR REPLACE FUNCTION sync_squad_profiles_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.squad_profiles WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_squad_profiles_del ON public.profiles;
CREATE TRIGGER trigger_sync_squad_profiles_del
AFTER DELETE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE sync_squad_profiles_delete();

-- Auto-sync trigger: squad_profiles -> profiles (when edited directly in Supabase Table Editor)
CREATE OR REPLACE FUNCTION sync_profiles_from_squad_profiles()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET username = NEW.username,
        name = NEW.name,
        email = NEW.email,
        avatar = NEW.avatar,
        color = NEW.color,
        role = NEW.role,
        deposit_amount = NEW.deposit_amount,
        updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_profiles_from_squad ON public.squad_profiles;
CREATE TRIGGER trigger_sync_profiles_from_squad
AFTER UPDATE ON public.squad_profiles
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE PROCEDURE sync_profiles_from_squad_profiles();

-- 6. Backfill existing data from profiles into squad_profiles
INSERT INTO public.squad_profiles (id, username, name, email, avatar, color, role, deposit_amount, created_at, updated_at)
SELECT id, username, name, email, avatar, color, role, deposit_amount, created_at, updated_at
FROM public.profiles
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    avatar = EXCLUDED.avatar,
    color = EXCLUDED.color,
    role = EXCLUDED.role,
    deposit_amount = EXCLUDED.deposit_amount,
    updated_at = NOW();


-- ==============================================================================
-- PART 2: CONVERT daily_nutrition VIEW TO REAL TABLE
-- ==============================================================================

-- 1. Safely drop the read-only view
-- Only drop it while it is still a VIEW (re-running must not fail once it's a table)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = 'daily_nutrition' AND c.relkind = 'v') THEN
        DROP VIEW public.daily_nutrition CASCADE;
    END IF;
END $$;

-- 2. Create daily_nutrition as a real table
CREATE TABLE IF NOT EXISTS public.daily_nutrition (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    challenger TEXT,
    date DATE NOT NULL,
    day_number INT DEFAULT 1,
    calories NUMERIC DEFAULT 0,
    protein_grams NUMERIC DEFAULT 0,
    calorie_target NUMERIC DEFAULT 2200,
    protein_target_g NUMERIC DEFAULT 120,
    calories_pct_of_goal NUMERIC DEFAULT 0,
    protein_pct_of_goal NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_daily_nutrition_user_date UNIQUE (user_id, date)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_user_date ON public.daily_nutrition(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_date ON public.daily_nutrition(date);

-- 4. Enable RLS and setup full access policies
ALTER TABLE public.daily_nutrition ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all daily_nutrition" ON public.daily_nutrition;
CREATE POLICY "Allow anon all daily_nutrition" ON public.daily_nutrition FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.daily_nutrition TO anon, authenticated, service_role;

-- 5. Auto-sync trigger: daily_logs -> daily_nutrition
CREATE OR REPLACE FUNCTION sync_daily_nutrition_from_log()
RETURNS TRIGGER AS $$
DECLARE
    v_challenger TEXT;
    v_cal_target NUMERIC := 2200;
    v_prot_target NUMERIC := 120;
    v_cal NUMERIC := 0;
    v_prot NUMERIC := 0;
BEGIN
    SELECT name INTO v_challenger FROM public.profiles WHERE id = NEW.user_id;

    SELECT 
        COALESCE((config ->> 'calorieTarget')::numeric, 2200),
        COALESCE((config ->> 'proteinTargetG')::numeric, 120)
    INTO v_cal_target, v_prot_target
    FROM public.challenge_config WHERE id = 'current_config';

    IF jsonb_typeof(NEW.tasks -> 'diet' -> 'calories') = 'number' THEN
        v_cal := (NEW.tasks -> 'diet' ->> 'calories')::numeric;
    END IF;

    IF jsonb_typeof(NEW.tasks -> 'diet' -> 'proteinGrams') = 'number' THEN
        v_prot := (NEW.tasks -> 'diet' ->> 'proteinGrams')::numeric;
    END IF;

    INSERT INTO public.daily_nutrition (
        id, user_id, challenger, date, day_number,
        calories, protein_grams, calorie_target, protein_target_g,
        calories_pct_of_goal, protein_pct_of_goal, updated_at
    ) VALUES (
        NEW.user_id || '_' || NEW.date::text,
        NEW.user_id,
        COALESCE(v_challenger, NEW.user_id),
        NEW.date,
        NEW.day_number,
        v_cal,
        v_prot,
        v_cal_target,
        v_prot_target,
        ROUND(100 * v_cal / NULLIF(v_cal_target, 0), 1),
        ROUND(100 * v_prot / NULLIF(v_prot_target, 0), 1),
        NOW()
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
        challenger = EXCLUDED.challenger,
        day_number = EXCLUDED.day_number,
        calories = EXCLUDED.calories,
        protein_grams = EXCLUDED.protein_grams,
        calorie_target = EXCLUDED.calorie_target,
        protein_target_g = EXCLUDED.protein_target_g,
        calories_pct_of_goal = EXCLUDED.calories_pct_of_goal,
        protein_pct_of_goal = EXCLUDED.protein_pct_of_goal,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_daily_nutrition ON public.daily_logs;
CREATE TRIGGER trigger_sync_daily_nutrition
AFTER INSERT OR UPDATE ON public.daily_logs
FOR EACH ROW EXECUTE PROCEDURE sync_daily_nutrition_from_log();

-- Auto-sync delete: daily_logs -> daily_nutrition
CREATE OR REPLACE FUNCTION sync_daily_nutrition_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.daily_nutrition WHERE user_id = OLD.user_id AND date = OLD.date;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_daily_nutrition_del ON public.daily_logs;
CREATE TRIGGER trigger_sync_daily_nutrition_del
AFTER DELETE ON public.daily_logs
FOR EACH ROW EXECUTE PROCEDURE sync_daily_nutrition_delete();

-- Auto-sync trigger: daily_nutrition -> daily_logs (when edited directly in Supabase Table Editor)
CREATE OR REPLACE FUNCTION sync_log_from_daily_nutrition()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.daily_logs
    SET tasks = jsonb_set(
            jsonb_set(
                COALESCE(tasks, '{}'::jsonb),
                '{diet,calories}',
                to_jsonb(COALESCE(NEW.calories, 0))
            ),
            '{diet,proteinGrams}',
            to_jsonb(COALESCE(NEW.protein_grams, 0))
        ),
        updated_at = NOW()
    WHERE user_id = NEW.user_id AND date = NEW.date;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_log_from_nutrition ON public.daily_nutrition;
CREATE TRIGGER trigger_sync_log_from_nutrition
AFTER UPDATE ON public.daily_nutrition
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE PROCEDURE sync_log_from_daily_nutrition();

-- 6. Backfill existing data from daily_logs into daily_nutrition
INSERT INTO public.daily_nutrition (
    id, user_id, challenger, date, day_number,
    calories, protein_grams, calorie_target, protein_target_g,
    calories_pct_of_goal, protein_pct_of_goal
)
SELECT
    l.user_id || '_' || l.date::text,
    l.user_id,
    COALESCE(p.name, l.user_id),
    l.date,
    l.day_number,
    COALESCE(
        CASE WHEN jsonb_typeof(l.tasks -> 'diet' -> 'calories') = 'number'
             THEN (l.tasks -> 'diet' ->> 'calories')::numeric END,
        0
    ),
    COALESCE(
        CASE WHEN jsonb_typeof(l.tasks -> 'diet' -> 'proteinGrams') = 'number'
             THEN (l.tasks -> 'diet' ->> 'proteinGrams')::numeric END,
        0
    ),
    COALESCE((c.config ->> 'calorieTarget')::numeric, 2200),
    COALESCE((c.config ->> 'proteinTargetG')::numeric, 120),
    ROUND(100 * COALESCE(
        CASE WHEN jsonb_typeof(l.tasks -> 'diet' -> 'calories') = 'number'
             THEN (l.tasks -> 'diet' ->> 'calories')::numeric END, 0
    ) / NULLIF((c.config ->> 'calorieTarget')::numeric, 0), 1),
    ROUND(100 * COALESCE(
        CASE WHEN jsonb_typeof(l.tasks -> 'diet' -> 'proteinGrams') = 'number'
             THEN (l.tasks -> 'diet' ->> 'proteinGrams')::numeric END, 0
    ) / NULLIF((c.config ->> 'proteinTargetG')::numeric, 0), 1)
FROM public.daily_logs l
LEFT JOIN public.profiles p ON p.id = l.user_id
LEFT JOIN public.challenge_config c ON c.id = 'current_config'
ON CONFLICT (user_id, date) DO UPDATE SET
    challenger = EXCLUDED.challenger,
    day_number = EXCLUDED.day_number,
    calories = EXCLUDED.calories,
    protein_grams = EXCLUDED.protein_grams,
    calorie_target = EXCLUDED.calorie_target,
    protein_target_g = EXCLUDED.protein_target_g,
    calories_pct_of_goal = EXCLUDED.calories_pct_of_goal,
    protein_pct_of_goal = EXCLUDED.protein_pct_of_goal,
    updated_at = NOW();


-- Reload Supabase API schema cache


-- ##############################################################################
-- migration_004_secure_login.sql
-- ##############################################################################
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


-- ==============================================================================
-- RESET TRACKING DATA (accounts are NOT deleted)
-- ==============================================================================
DELETE FROM public.daily_nutrition;
DELETE FROM public.daily_logs;
DELETE FROM public.password_resets;
DELETE FROM public.app_login_attempts;

-- Make sure the rules row exists, then stamp the reset time. Phones that still hold
-- old logs in their local cache throw them away instead of re-uploading them.
INSERT INTO public.challenge_config (id, config)
VALUES ('current_config', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

UPDATE public.challenge_config
SET config = config || jsonb_build_object(
        'dataResetAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    updated_at = NOW()
WHERE id = 'current_config';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------------------------
-- Check the result (run separately if you like):
--   SELECT (SELECT count(*) FROM public.profiles)   AS accounts_kept,
--          (SELECT count(*) FROM public.daily_logs)  AS logs_left,
--          (SELECT count(*) FROM public.profiles WHERE password IS NOT NULL OR pin IS NOT NULL) AS plaintext_left;
--   Expected: accounts_kept = your squad + referee, logs_left = 0, plaintext_left = 0
--
-- PHOTO / PROOF FILES: Supabase doesn't allow deleting storage files with SQL.
-- To remove old photos too: Dashboard > Storage > progress-photos (and medical-proofs)
-- > select all > Delete.
-- ------------------------------------------------------------------------------
