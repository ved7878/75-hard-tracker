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

BEGIN;

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

COMMIT;

-- Reload Supabase API schema cache
NOTIFY pgrst, 'reload schema';
