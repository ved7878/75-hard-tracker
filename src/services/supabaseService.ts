import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile, ChallengeConfig, DailyLog } from '../types';
import { DEFAULT_CONFIG } from './rulesEngine';
import { storage, DEFAULT_USERS } from './storage';

// Local storage keys for hybrid offline/online fallback
const SB_URL_KEY = '75hard_supabase_url';
const SB_KEY_KEY = '75hard_supabase_key';

class SupabaseService {
  private client: SupabaseClient | null = null;
  private currentUrl: string = '';
  private currentKey: string = '';

  constructor() {
    this.init();
  }

  public init(url?: string, key?: string) {
    // Priority: Explicit params > Vite Env Vars > LocalStorage
    const sbUrl = (
      url ||
      import.meta.env.VITE_SUPABASE_URL ||
      localStorage.getItem(SB_URL_KEY) ||
      ''
    ).trim();

    const sbKey = (
      key ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      localStorage.getItem(SB_KEY_KEY) ||
      ''
    ).trim();

    if (sbUrl && sbKey) {
      try {
        this.client = createClient(sbUrl, sbKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        });
        this.currentUrl = sbUrl;
        this.currentKey = sbKey;
        localStorage.setItem(SB_URL_KEY, sbUrl);
        localStorage.setItem(SB_KEY_KEY, sbKey);
      } catch (err) {
        console.error('Supabase initialization failed:', err);
        this.client = null;
      }
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.client && this.currentUrl && this.currentKey);
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public getCredentials(): { url: string; key: string } {
    return {
      url: this.currentUrl,
      key: this.currentKey,
    };
  }

  public async setCredentials(url: string, key: string): Promise<{ success: boolean; message: string }> {
    const testResult = await this.testConnection(url, key);
    if (testResult.success) {
      this.init(url, key);
      return { success: true, message: 'Supabase connected and credentials saved!' };
    }
    return testResult;
  }

  public async testConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
    try {
      const tempClient = createClient(url.trim(), key.trim());
      const { error } = await tempClient.from('profiles').select('id', { count: 'exact', head: true });
      if (error && error.code !== 'PGRST116') {
        return { success: false, message: `Supabase error: ${error.message}` };
      }
      return { success: true, message: 'Successfully connected to Supabase database!' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Connection test failed' };
    }
  }

  // --------------------------------------------------------------------------
  // USER AUTHENTICATION & SQUAD MANAGEMENT
  // --------------------------------------------------------------------------

  public async getUsers(): Promise<UserProfile[]> {
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          const profiles: UserProfile[] = data.map(row => ({
            id: row.id,
            username: row.username,
            name: row.name,
            email: row.email,
            password: row.password,
            pin: row.pin,
            avatar: row.avatar,
            color: row.color,
            role: row.role,
            depositAmount: row.role === 'admin' ? 0 : (Number(row.deposit_amount) || 2000),
            recoveryAnswer: row.recovery_answer,
            createdAt: row.created_at,
          }));
          // Sync to local cache
          storage.saveUsers(profiles);
          return profiles;
        }
      } catch (err) {
        console.warn('Falling back to local users store:', err);
      }
    }
    return storage.getUsers();
  }

  public async login(
    usernameOrEmail: string,
    passwordOrPin: string
  ): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    const cleanId = usernameOrEmail.trim().toLowerCase();
    const cleanSecret = passwordOrPin.trim();

    // 1. Try Supabase cloud if active
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('profiles')
          .select('*')
          .or(`username.ilike.${cleanId},email.ilike.${cleanId}`)
          .limit(1);

        if (!error && data && data.length > 0) {
          const u = data[0];
          const passwordMatch = u.password === cleanSecret;
          const pinMatch = u.pin === cleanSecret;

          if (passwordMatch || pinMatch) {
            const user: UserProfile = {
              id: u.id,
              username: u.username,
              name: u.name,
              email: u.email,
              password: u.password,
              pin: u.pin,
              avatar: u.avatar,
              color: u.color,
              role: u.role,
              depositAmount: u.role === 'admin' ? 0 : (Number(u.deposit_amount) || 2000),
              createdAt: u.created_at,
            };
            return { success: true, user };
          } else {
            return { success: false, message: 'Invalid password or PIN.' };
          }
        }
      } catch (err) {
        console.warn('Cloud login failed, testing local:', err);
      }
    }

    // 2. Local fallback
    const localUsers = storage.getUsers();
    const found = localUsers.find(
      u =>
        u.username?.toLowerCase() === cleanId ||
        u.id.toLowerCase() === cleanId ||
        u.email?.toLowerCase() === cleanId ||
        u.name?.toLowerCase() === cleanId
    );

    if (!found) {
      return { success: false, message: 'Challenger account not found.' };
    }

    if (found.password === cleanSecret || found.pin === cleanSecret) {
      return { success: true, user: found };
    }

    return { success: false, message: 'Incorrect password or PIN.' };
  }

  public async forgotPassword(
    usernameOrEmail: string,
    recoveryKeyOrCode: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanId = usernameOrEmail.trim().toLowerCase();
    const cleanKey = recoveryKeyOrCode.trim();

    // Standard recovery master keys: Admin PIN 7575 or default squad key '75hard'
    const isMasterRecovery =
      cleanKey === '7575' ||
      cleanKey.toLowerCase() === '75hard' ||
      cleanKey === (import.meta.env.VITE_RECOVERY_KEY || 'HARD75_RECOVERY_SQUAD');

    // 1. Cloud Supabase reset
    if (this.client) {
      try {
        const { data: users, error } = await this.client
          .from('profiles')
          .select('*')
          .or(`username.ilike.${cleanId},email.ilike.${cleanId}`)
          .limit(1);

        if (!error && users && users.length > 0) {
          const user = users[0];
          const isUserRecovery = user.recovery_answer && user.recovery_answer.toLowerCase() === cleanKey.toLowerCase();

          if (isMasterRecovery || isUserRecovery) {
            const { error: updateErr } = await this.client
              .from('profiles')
              .update({ password: newPassword, updated_at: new Date().toISOString() })
              .eq('id', user.id);

            if (!updateErr) {
              return { success: true, message: `Password for ${user.name} has been reset successfully!` };
            }
          } else {
            return { success: false, message: 'Invalid Recovery Key or Admin Reset PIN.' };
          }
        }
      } catch (err) {
        console.warn('Supabase password reset failed, trying local:', err);
      }
    }

    // 2. Local fallback reset
    const localUsers = storage.getUsers();
    const userIndex = localUsers.findIndex(
      u =>
        u.username?.toLowerCase() === cleanId ||
        u.id.toLowerCase() === cleanId ||
        u.email?.toLowerCase() === cleanId ||
        u.name?.toLowerCase() === cleanId
    );

    if (userIndex === -1) {
      return { success: false, message: 'No account found with that username or email.' };
    }

    const targetUser = localUsers[userIndex];
    const isUserRecovery = targetUser.recoveryAnswer?.toLowerCase() === cleanKey.toLowerCase();

    if (isMasterRecovery || isUserRecovery) {
      localUsers[userIndex].password = newPassword;
      storage.saveUsers(localUsers);
      return { success: true, message: `Password for ${targetUser.name} has been reset successfully!` };
    }

    return { success: false, message: 'Invalid Recovery Key or Admin Reset PIN.' };
  }

  public async createUser(newUser: {
    username: string;
    name: string;
    email?: string;
    password?: string;
    pin?: string;
    avatar?: string;
    depositAmount?: number;
    role?: 'challenger' | 'admin';
  }): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    const cleanUsername = newUser.username.trim().toLowerCase();
    const id = `user_${Date.now()}`;

    const profile: UserProfile = {
      id,
      username: cleanUsername,
      name: newUser.name.trim(),
      email: newUser.email?.trim() || `${cleanUsername}@75hard.local`,
      password: newUser.password?.trim() || `${cleanUsername}123`,
      pin: newUser.pin?.trim() || '1111',
      avatar: newUser.avatar || '🦁',
      color: 'from-rose-600 to-rose-700',
      role: newUser.role || 'challenger',
      depositAmount: newUser.depositAmount ?? 2000,
      createdAt: new Date().toISOString(),
    };

    if (this.client) {
      try {
        const { error } = await this.client.from('profiles').insert({
          id: profile.id,
          username: profile.username,
          name: profile.name,
          email: profile.email,
          password: profile.password,
          pin: profile.pin,
          avatar: profile.avatar,
          color: profile.color,
          role: profile.role,
          deposit_amount: profile.depositAmount,
          created_at: profile.createdAt,
        });

        if (error) {
          return { success: false, message: error.message };
        }
      } catch (err: any) {
        return { success: false, message: err?.message || 'Failed to create user in database.' };
      }
    }

    // Save to local cache
    const current = storage.getUsers();
    current.push(profile);
    storage.saveUsers(current);

    return { success: true, user: profile, message: `Challenger ${profile.name} added to squad!` };
  }

  public async updateUser(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    if (this.client) {
      try {
        const payload: any = {};
        if (updates.name) payload.name = updates.name;
        if (updates.username) payload.username = updates.username.toLowerCase();
        if (updates.email) payload.email = updates.email;
        if (updates.password) payload.password = updates.password;
        if (updates.pin) payload.pin = updates.pin;
        if (updates.avatar) payload.avatar = updates.avatar;
        if (updates.depositAmount !== undefined) payload.deposit_amount = updates.depositAmount;

        const { error } = await this.client
          .from('profiles')
          .update(payload)
          .eq('id', userId);

        if (error) {
          console.warn('Update user in cloud failed:', error);
        }
      } catch (err) {
        console.warn('Error updating user cloud:', err);
      }
    }

    const localUsers = storage.getUsers();
    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx] = { ...localUsers[idx], ...updates };
      storage.saveUsers(localUsers);
      return { success: true, user: localUsers[idx] };
    }

    return { success: false, message: 'User not found' };
  }

  public async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    if (this.client) {
      try {
        await this.client.from('daily_logs').delete().eq('user_id', userId);
        await this.client.from('profiles').delete().eq('id', userId);
      } catch (err) {
        console.warn('Cloud delete error:', err);
      }
    }

    const localUsers = storage.getUsers().filter(u => u.id !== userId);
    storage.saveUsers(localUsers);
    return { success: true, message: 'User removed from squad.' };
  }

  // --------------------------------------------------------------------------
  // DAILY LOGS & PROGRESS TRACKING
  // --------------------------------------------------------------------------

  public async fetchAllLogs(): Promise<Record<string, Record<string, DailyLog>>> {
    if (this.client) {
      try {
        const { data, error } = await this.client.from('daily_logs').select('*');
        if (!error && data) {
          const allLogs: Record<string, Record<string, DailyLog>> = {};
          for (const row of data) {
            const uid = row.user_id;
            if (!allLogs[uid]) allLogs[uid] = {};
            allLogs[uid][row.date] = {
              id: row.id,
              date: row.date,
              userId: uid,
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
              updatedAt: row.updated_at,
            };
          }
          // Merge with local storage
          Object.entries(allLogs).forEach(([uid, uLogs]) => {
            storage.saveUserLogs(uid, uLogs);
          });
          return allLogs;
        }
      } catch (err) {
        console.warn('Failed to fetch logs from cloud, using local:', err);
      }
    }
    return storage.getAllUsersLogs();
  }

  public async saveLog(userId: string, log: DailyLog): Promise<boolean> {
    // 1. Save to local storage first for zero latency
    storage.saveUserLog(userId, log);

    // 2. Sync to Supabase in background
    if (this.client) {
      try {
        const id = `${userId}_${log.date}`;
        const { error } = await this.client.from('daily_logs').upsert({
          id,
          user_id: userId,
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
          console.error('Supabase log upsert error:', error);
          return false;
        }
        return true;
      } catch (err) {
        console.error('Exception syncing log to cloud:', err);
        return false;
      }
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // MEDIA UPLOADS (SUPABASE STORAGE)
  // --------------------------------------------------------------------------

  public async uploadMedia(
    file: File | Blob,
    fileName: string,
    bucket: 'progress-photos' | 'medical-proofs',
    userId: string
  ): Promise<string | null> {
    if (!this.client) {
      // Fallback: convert to base64 data url
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }

    try {
      const cleanName = `${userId}_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(cleanName, file, { upsert: true });

      if (error) {
        console.warn(`Storage upload to ${bucket} failed, falling back to data URL:`, error);
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      }

      const { data: publicUrlData } = this.client.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Media upload exception:', err);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // CHALLENGE CONFIG
  // --------------------------------------------------------------------------

  public async getConfig(): Promise<ChallengeConfig> {
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('challenge_config')
          .select('config')
          .eq('id', 'current_config')
          .single();

        if (!error && data && data.config) {
          const merged = { ...DEFAULT_CONFIG, ...data.config };
          storage.saveConfig(merged);
          return merged;
        }
      } catch (err) {
        console.warn('Failed to load cloud config:', err);
      }
    }
    return storage.getConfig();
  }

  public async saveConfig(config: ChallengeConfig): Promise<boolean> {
    storage.saveConfig(config);

    if (this.client) {
      try {
        await this.client.from('challenge_config').upsert({
          id: 'current_config',
          config,
          updated_at: new Date().toISOString(),
        });
        return true;
      } catch (err) {
        console.warn('Failed to save config to cloud:', err);
        return false;
      }
    }
    return true;
  }
}

export const supabaseService = new SupabaseService();
