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

BEGIN;

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

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Example: averages per challenger
-- SELECT challenger,
--        ROUND(AVG(calories)) AS avg_kcal,
--        ROUND(AVG(protein_grams)) AS avg_protein_g
-- FROM public.daily_nutrition
-- WHERE calories > 0 OR protein_grams > 0
-- GROUP BY challenger;
