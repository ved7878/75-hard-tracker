-- ==============================================================================
-- 75 HARD TRACKER - SUPABASE PRODUCTION DATABASE SCHEMA
-- Compatible with Vercel & Supabase Architecture
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Go to your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Navigate to "SQL Editor" in the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run" (Ctrl+Enter)
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

-- 5.1 Public Safe View for Squad Profiles (Strictly excludes password, pin, recovery_answer)
CREATE OR REPLACE VIEW public.squad_profiles AS
SELECT 
    id, 
    username, 
    name, 
    email, 
    avatar, 
    color, 
    role, 
    deposit_amount, 
    created_at 
FROM public.profiles;

GRANT SELECT ON public.squad_profiles TO anon, authenticated;

-- 5.2 Daily nutrition view (calories / protein vs. goals, per challenger per day)
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
INSERT INTO public.profiles (id, username, name, email, password, pin, avatar, color, role, deposit_amount)
VALUES
    ('user_1', 'vedant', 'Vedant', 'vedant@75hard.local', 'vedant123', '1111', '🦁', 'from-rose-600 to-rose-700', 'challenger', 2000),
    ('user_2', 'vedansh', 'Vedansh', 'vedansh@75hard.local', 'vedansh123', '2222', '🐺', 'from-blue-600 to-indigo-700', 'challenger', 2000),
    ('user_3', 'aryaman', 'Aryaman', 'aryaman@75hard.local', 'aryaman123', '3333', '🦅', 'from-amber-500 to-orange-600', 'challenger', 2000),
    ('admin', 'admin', 'Referee / Admin', 'admin@75hard.local', 'admin7575', '7575', '⚖️', 'from-purple-600 to-indigo-800', 'admin', 0)
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    name = EXCLUDED.name,
    password = EXCLUDED.password,
    pin = EXCLUDED.pin,
    avatar = EXCLUDED.avatar,
    color = EXCLUDED.color,
    deposit_amount = EXCLUDED.deposit_amount;

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
        "adminPin": "7575",
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

