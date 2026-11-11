import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChallengeConfig, DailyLog, UserProfile } from '../types';
import schemaSql from '../../supabase/schema.sql?raw';
import secureLoginSql from '../../supabase/migration_004_secure_login.sql?raw';

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
      id: `${log.userId || 'user_1'}_${log.date}`,
      user_id: log.userId || 'user_1',
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

export async function fetchAllLogsFromSupabase(config: ChallengeConfig): Promise<Record<string, Record<string, DailyLog>> | null> {
  const client = getSupabaseClient(config);
  if (!client) return null;

  try {
    const { data, error } = await client.from('daily_logs').select('*');
    if (error || !data) {
      console.warn('Error fetching logs from Supabase:', error);
      return null;
    }

    const allUsersLogs: Record<string, Record<string, DailyLog>> = {
      user_1: {},
      user_2: {},
      user_3: {},
    };

    for (const row of data) {
      const uId = row.user_id || 'user_1';
      if (!allUsersLogs[uId]) {
        allUsersLogs[uId] = {};
      }

      allUsersLogs[uId][row.date] = {
        id: row.id,
        date: row.date,
        userId: uId,
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
    return allUsersLogs;
  } catch (err) {
    console.error('Failed to fetch from Supabase:', err);
    return null;
  }
}

export async function syncAllUsersLogsToSupabase(
  allUsersLogs: Record<string, Record<string, DailyLog>>,
  config: ChallengeConfig
): Promise<number> {
  const client = getSupabaseClient(config);
  if (!client) return 0;

  const rows: any[] = [];
  Object.entries(allUsersLogs).forEach(([uid, userLogs]) => {
    Object.values(userLogs).forEach(log => {
      rows.push({
        id: `${uid}_${log.date}`,
        user_id: uid,
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
    });
  });

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
  config: ChallengeConfig,
  userId: string = 'user_1'
): Promise<string | null> {
  const client = getSupabaseClient(config);
  if (!client) return null;

  try {
    const cleanFileName = `${userId}_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '')}`;
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
 * SQL schema shown / copied in the app for 1-click setup in the Supabase SQL editor.
 * Loaded straight from supabase/schema.sql so the in-app copy can never drift out of date.
 */
// Full setup = base schema + secure-login lock-down (schema.sql alone leaves the database open)
export const SUPABASE_SETUP_SQL: string = `${schemaSql}

${secureLoginSql}`;
