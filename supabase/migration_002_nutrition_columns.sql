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

-- Handy read-only view: one row per challenger per day, with goals and % of goal
CREATE OR REPLACE VIEW public.daily_nutrition AS
SELECT
    l.user_id,
    p.name                                            AS challenger,
    l.date,
    l.day_number,
    COALESCE(l.calories, 0)                           AS calories,
    COALESCE(l.protein_grams, 0)                      AS protein_grams,
    (c.config ->> 'calorieTarget')::numeric           AS calorie_target,
    (c.config ->> 'proteinTargetG')::numeric          AS protein_target_g,
    ROUND(100 * COALESCE(l.calories, 0)
          / NULLIF((c.config ->> 'calorieTarget')::numeric, 0), 1)   AS calories_pct_of_goal,
    ROUND(100 * COALESCE(l.protein_grams, 0)
          / NULLIF((c.config ->> 'proteinTargetG')::numeric, 0), 1)  AS protein_pct_of_goal
FROM public.daily_logs l
LEFT JOIN public.profiles p ON p.id = l.user_id
LEFT JOIN public.challenge_config c ON c.id = 'current_config';

GRANT SELECT ON public.daily_nutrition TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Example: averages per challenger
-- SELECT challenger,
--        ROUND(AVG(calories)) AS avg_kcal,
--        ROUND(AVG(protein_grams)) AS avg_protein_g
-- FROM public.daily_nutrition
-- WHERE calories > 0 OR protein_grams > 0
-- GROUP BY challenger;
