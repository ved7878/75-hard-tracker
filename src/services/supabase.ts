import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChallengeConfig, DailyLog } from '../types';

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl: string | null = null;
let lastUsedKey: string | null = null;

export function getSupabaseClient(config?: ChallengeConfig): SupabaseClient | null {
  const url = config?.supabaseUrl?.trim();
  const key = config?.supabaseAnonKey?.trim();

  if (!url || !key) {
    return null;
  }

  if (cachedClient && lastUsedUrl === url && lastUsedKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key);
    lastUsedUrl = url;
    lastUsedKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    const client = createClient(url.trim(), key.trim());
    // Try to query the daily_logs table or a basic health check
    const { error } = await client.from('daily_logs').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Successfully connected to Supabase database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Connection failed' };
  }
}

export async function syncLogToSupabase(log: DailyLog, config: ChallengeConfig): Promise<boolean> {
  const client = getSupabaseClient(config);
  if (!client) return false;

  try {
    const { error } = await client.from('daily_logs').upsert({
      id: log.id,
      date: log.date,
      day_number: log.dayNumber,
      travel: log.travel,
      sickness: log.sickness,
      tasks: log.tasks,
      sport: log.sport,
      journal_notes: log.journalNotes,
      status: log.status,
      failed_tasks: log.failedTasks,
      is_locked: log.isLocked,
      completed_at: log.completedAt,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('Supabase sync error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to sync log to Supabase:', err);
    return false;
  }
}

export async function fetchAllLogsFromSupabase(config: ChallengeConfig): Promise<Record<string, DailyLog> | null> {
  const client = getSupabaseClient(config);
  if (!client) return null;

  try {
    const { data, error } = await client.from('daily_logs').select('*');
    if (error || !data) {
      console.warn('Error fetching logs from Supabase:', error);
      return null;
    }

    const logsMap: Record<string, DailyLog> = {};
    for (const row of data) {
      logsMap[row.date] = {
        id: row.id,
        date: row.date,
        dayNumber: row.day_number,
        travel: row.travel,
        sickness: row.sickness,
        tasks: row.tasks,
        sport: row.sport || { participated: false, sportName: '', durationMinutes: 0, improvementNotes: '' },
        journalNotes: row.journal_notes || '',
        status: row.status,
        failedTasks: row.failed_tasks || [],
        isLocked: row.is_locked || false,
        completedAt: row.completed_at,
        updatedAt: row.updated_at || new Date().toISOString(),
      };
    }
    return logsMap;
  } catch (err) {
    console.error('Failed to fetch from Supabase:', err);
    return null;
  }
}

export async function syncAllLogsToSupabase(logs: Record<string, DailyLog>, config: ChallengeConfig): Promise<number> {
  const client = getSupabaseClient(config);
  if (!client) return 0;

  const rows = Object.values(logs).map(log => ({
    id: log.id,
    date: log.date,
    day_number: log.dayNumber,
    travel: log.travel,
    sickness: log.sickness,
    tasks: log.tasks,
    sport: log.sport,
    journal_notes: log.journalNotes,
    status: log.status,
    failed_tasks: log.failedTasks,
    is_locked: log.isLocked,
    completed_at: log.completedAt,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return 0;

  try {
    const { error } = await client.from('daily_logs').upsert(rows);
    if (error) {
      console.error('Failed bulk sync to Supabase:', error);
      return 0;
    }
    return rows.length;
  } catch (err) {
    console.error('Supabase bulk sync exception:', err);
    return 0;
  }
}

/**
 * Upload an image (photo progress or medical proof) to Supabase Storage
 */
export async function uploadMediaToSupabase(
  file: File | Blob,
  fileName: string,
  bucketName: 'progress-photos' | 'medical-proofs',
  config: ChallengeConfig
): Promise<string | null> {
  const client = getSupabaseClient(config);
  if (!client) return null;

  try {
    const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const { data, error } = await client.storage
      .from(bucketName)
      .upload(cleanFileName, file, { upsert: true });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return null;
    }

    const { data: publicUrlData } = client.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Supabase upload exception:', err);
    return null;
  }
}

/**
 * SQL Schema for easy 1-click execution in Supabase SQL editor
 */
export const SUPABASE_SETUP_SQL = `-- 75 HARD DATABASE SCHEMA FOR SUPABASE
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- 1. Create table for daily logs
CREATE TABLE IF NOT EXISTS public.daily_logs (
    id TEXT PRIMARY KEY, -- YYYY-MM-DD
    date DATE NOT NULL,
    day_number INT NOT NULL,
    travel JSONB NOT NULL DEFAULT '{}'::jsonb,
    sickness JSONB NOT NULL DEFAULT '{}'::jsonb,
    tasks JSONB NOT NULL DEFAULT '{}'::jsonb,
    sport JSONB DEFAULT '{}'::jsonb,
    journal_notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'incomplete',
    failed_tasks TEXT[] DEFAULT '{}',
    is_locked BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create table for challenge settings
CREATE TABLE IF NOT EXISTS public.challenge_config (
    id TEXT PRIMARY KEY DEFAULT 'current_config',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_config ENABLE ROW LEVEL SECURITY;

-- 4. Create open access policies for single-user / anon key setup
CREATE POLICY "Allow anon read daily_logs" ON public.daily_logs FOR SELECT USING (true);
CREATE POLICY "Allow anon insert daily_logs" ON public.daily_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update daily_logs" ON public.daily_logs FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete daily_logs" ON public.daily_logs FOR DELETE USING (true);

CREATE POLICY "Allow anon read config" ON public.challenge_config FOR SELECT USING (true);
CREATE POLICY "Allow anon upsert config" ON public.challenge_config FOR ALL USING (true);

-- 5. Storage Buckets for Progress Photos and Medical Proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('medical-proofs', 'medical-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage access policies
CREATE POLICY "Allow public read progress photos" ON storage.objects
FOR SELECT USING (bucket_id = 'progress-photos');

CREATE POLICY "Allow public upload progress photos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'progress-photos');

CREATE POLICY "Allow public read medical proofs" ON storage.objects
FOR SELECT USING (bucket_id = 'medical-proofs');

CREATE POLICY "Allow public upload medical proofs" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'medical-proofs');
`;
