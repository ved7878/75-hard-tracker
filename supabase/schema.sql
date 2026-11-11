-- ==============================================================================
-- 75 HARD TRACKER - SUPABASE PRODUCTION DATABASE SCHEMA
-- Compatible with Vercel & Supabase Architecture
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Go to your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Navigate to "SQL Editor" in the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run" (Ctrl+Enter)
-- 4. THEN run migration_004_secure_login.sql. This file on its own leaves the
--    database open to anyone with the public key (it is shown/copied in the app
--    together with migration 004 for that reason). Re-running this file re-opens
--    access, so always run migration 004 again afterwards.
-- ==============================================================================

-- 1. Create PROFILES / USERS Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    password TEXT NOT NULL,
    pin TEXT DEFAULT '1111',
    avatar TEXT DEFAULT '🦁',
    color TEXT DEFAULT 'from-rose-600 to-rose-700',
    role TEXT NOT NULL DEFAULT 'challenger' CHECK (role IN ('challenger', 'admin')),
    deposit_amount NUMERIC DEFAULT 2000,
    recovery_answer TEXT DEFAULT '75hard',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. Create CHALLENGE_CONFIG Table
CREATE TABLE IF NOT EXISTS public.challenge_config (
    id TEXT PRIMARY KEY DEFAULT 'current_config',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create DAILY_LOGS Table
CREATE TABLE IF NOT EXISTS public.daily_logs (
    id TEXT PRIMARY KEY, -- e.g. user_1_2026-11-11
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    day_number INT NOT NULL,
    travel JSONB NOT NULL DEFAULT '{"isTravelling": false, "hours": 0, "gymAvailable": true}'::jsonb,
    sickness JSONB NOT NULL DEFAULT '{"isSick": false, "hasMedicalProof": false, "isExempt": false, "status": "none"}'::jsonb,
    tasks JSONB NOT NULL DEFAULT '{}'::jsonb,
    sport JSONB DEFAULT '{"participated": false, "sportName": "", "durationMinutes": 0, "improvementNotes": ""}'::jsonb,
    journal_notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('completed', 'incomplete', 'exempt', 'future')),
    failed_tasks TEXT[] DEFAULT '{}',
    is_locked BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_date UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON public.daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_status ON public.daily_logs(status);

-- 3.1 Daily nutrition (auto-filled from tasks.diet JSON; the app never writes these)
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

-- 4. Create PASSWORD RESETS Table
CREATE TABLE IF NOT EXISTS public.password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reset_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5.1 Real Table for Squad Profiles (Editable in Supabase Table Editor; excludes credentials)
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

-- ------------------------------------------------------------------------------
-- 5.2 Real Table for Daily Nutrition (Editable in Supabase Table Editor)
-- ------------------------------------------------------------------------------
-- Only drop it while it is still a VIEW (re-running must not fail once it's a table)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = 'daily_nutrition' AND c.relkind = 'v') THEN
        DROP VIEW public.daily_nutrition CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.daily_nutrition (
    id TEXT PRIMARY KEY, -- e.g. user_1_2026-11-11
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

-- ------------------------------------------------------------------------------
-- 5.3 Auto-Sync Triggers for squad_profiles & daily_nutrition Tables
-- ------------------------------------------------------------------------------
-- Profiles -> squad_profiles sync
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

-- squad_profiles -> profiles sync (when admin updates squad_profiles directly in Supabase)
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

-- daily_logs -> daily_nutrition sync
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

-- 6. Setup Access Policies (Anon & Authenticated)
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

-- 7. Storage Buckets (Progress Photos & Medical Proofs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-proofs', 'medical-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access Progress Photos" ON storage.objects;
CREATE POLICY "Public Access Progress Photos" ON storage.objects
FOR ALL USING (bucket_id = 'progress-photos');

DROP POLICY IF EXISTS "Public Access Medical Proofs" ON storage.objects;
CREATE POLICY "Public Access Medical Proofs" ON storage.objects
FOR ALL USING (bucket_id = 'medical-proofs');

-- 8. Seed Default Challenger Accounts & Admin
-- Only creates missing accounts – never resets passwords that were changed.
-- migration_004 hashes these and erases the plaintext; change them after first login.
INSERT INTO public.profiles (id, username, name, email, password, pin, avatar, color, role, deposit_amount)
VALUES
    ('user_1', 'vedant', 'Vedant', 'vedant@75hard.local', 'vedant123', '1111', '🦁', 'from-rose-600 to-rose-700', 'challenger', 2000),
    ('user_2', 'vedansh', 'Vedansh', 'vedansh@75hard.local', 'vedansh123', '2222', '🐺', 'from-blue-600 to-indigo-700', 'challenger', 2000),
    ('user_3', 'aryaman', 'Aryaman', 'aryaman@75hard.local', 'aryaman123', '3333', '🦅', 'from-amber-500 to-orange-600', 'challenger', 2000),
    ('admin', 'admin', 'Referee / Admin', 'admin@75hard.local', 'admin7575', '7575', '⚖️', 'from-purple-600 to-indigo-800', 'admin', 0)
ON CONFLICT (id) DO NOTHING;

-- 9. Seed Default Challenge Configuration
INSERT INTO public.challenge_config (id, config)
VALUES (
    'current_config',
    '{
        "startDate": "2026-11-11",
        "durationDays": 75,
        "endDate": "2027-01-24",
        "depositAmount": 2000,
        "currencySymbol": "₹",
        "wakeUpTarget": "06:00",
        "wakeUpTravelTarget": "08:00",
        "wakeUpGraceMinutes": 10,
        "travelThresholdHours": 4,
        "readingMinPages": 5,
        "readingMaxPages": 10,
        "stepsTarget": 10000,
        "runTargetKm": 3.0,
        "floorsTarget": 20,
        "travelSubstituteSteps": 15000,
        "travelSubstituteRunKm": 5.0,
        "familyTargetMinutes": 10,
        "calorieTarget": 2200,
        "proteinTargetG": 120,
        "reminderTime": "21:00",
        "reminderEnabled": true,
        "strictResetOnMiss": true,
        "lockPastDays": true,
        "requireLogin": false,
        "autoSyncSupabase": false
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 10. Automated updated_at Trigger
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

