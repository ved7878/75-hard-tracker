import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile, ChallengeConfig, DailyLog } from '../types';
import { normalizeConfig, createDefaultTasks } from './rulesEngine';
import { storage, DEFAULT_USERS } from './storage';

// Local storage keys for hybrid offline/online fallback
const SB_URL_KEY = '75hard_supabase_url';
const SB_KEY_KEY = '75hard_supabase_key';

const timeOf = (iso?: string) =>
  iso ? Date.parse(iso.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1').replace(/([+-]\d{2})$/, '$1:00')) || 0 : 0;

/**
 * Fills in any task / travel / sickness / sport fields missing from a stored log,
 * so one malformed or older row can't crash the dashboard for the whole squad.
 */
function normalizeLog(input: DailyLog, config: ChallengeConfig): DailyLog {
  const log: any = input; // rows from the DB may be missing fields the type says exist
  const defaults = createDefaultTasks(config);
  const rawTasks: any = log.tasks || {};
  const tasks: any = {};
  (Object.keys(defaults) as Array<keyof typeof defaults>).forEach(k => {
    tasks[k] = { ...defaults[k], ...(rawTasks[k] || {}) };
  });
  return {
    ...log,
    travel: { isTravelling: false, hours: 0, gymAvailable: true, ...(log.travel || {}) },
    sickness: { isSick: false, hasMedicalProof: false, isExempt: false, status: 'none', ...(log.sickness || {}) },
    tasks,
    sport: { participated: false, sportName: '', durationMinutes: 0, improvementNotes: '', ...(log.sport || {}) },
    journalNotes: log.journalNotes || '',
    failedTasks: log.failedTasks || [],
    isLocked: Boolean(log.isLocked),
  };
}

const SESSION_TOKEN_KEY = '75hard_session_token';
const SESSION_USER_KEY = '75hard_session_user';
// Old builds kept every plaintext password here – wipe it whenever the cloud is in use
const LEGACY_CREDENTIALS_KEY = '75hard_auth_credentials';

/** Supabase returns snake_case public profile rows; map them to the app's shape. */
function mapProfile(row: any): UserProfile {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    color: row.color,
    role: row.role,
    depositAmount: row.role === 'admin' ? 0 : Number(row.deposit_amount ?? 2000),
    createdAt: row.created_at,
  };
}

function readSessionToken(): string {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/** Friendly message for "the database hasn't been upgraded yet" vs. a network problem. */
function rpcErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return 'Something went wrong.';
  if (error.code === 'PGRST202' || /function .* does not exist|Could not find the function/i.test(error.message || '')) {
    return 'The database needs the secure-login update (run supabase/migration_004_secure_login.sql).';
  }
  if (/fetch|network|Failed to/i.test(error.message || '')) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return error.message || 'Something went wrong.';
}

export type SessionRestore =
  | { status: 'signed-in'; user: UserProfile }
  | { status: 'signed-out' }
  | { status: 'offline'; user: UserProfile };

class SupabaseService {
  private client: SupabaseClient | null = null;
  private currentUrl: string = '';
  private currentKey: string = '';
  private sessionToken: string = readSessionToken();
  /** Who the session token belongs to (cached; the database is the real authority). */
  private sessionUser: UserProfile | null = (() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_USER_KEY) || 'null');
    } catch {
      return null;
    }
  })();

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
        this.currentUrl = sbUrl;
        this.currentKey = sbKey;
        this.buildClient();
        localStorage.setItem(SB_URL_KEY, sbUrl);
        localStorage.setItem(SB_KEY_KEY, sbKey);
        localStorage.removeItem(LEGACY_CREDENTIALS_KEY);
      } catch (err) {
        console.error('Supabase initialization failed:', err);
        this.client = null;
      }
    }
  }

  /**
   * (Re)creates the client so every request carries the current session token.
   * The database's row-level security reads it from the x-session-token header.
   */
  private buildClient() {
    this.client = createClient(this.currentUrl, this.currentKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: this.sessionToken ? { headers: { 'x-session-token': this.sessionToken } } : undefined,
    });
  }

  private setSession(token: string, user: UserProfile | null) {
    this.sessionToken = token;
    this.sessionUser = token ? user : null;
    try {
      if (token) {
        localStorage.setItem(SESSION_TOKEN_KEY, token);
        if (user) localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(SESSION_USER_KEY);
      }
    } catch {}
    if (this.currentUrl && this.currentKey) this.buildClient();
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
      const tempClient = createClient(url.trim(), key.trim(), { auth: { persistSession: false } });
      const { error } = await tempClient.from('squad_profiles').select('id', { count: 'exact', head: true });
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
  // In cloud mode every credential check happens inside the database (see
  // supabase/migration_004_secure_login.sql); the browser never sees a password,
  // PIN or hash. Local mode (no Supabase configured) is a single-device fallback.
  // --------------------------------------------------------------------------

  public async getUsers(): Promise<UserProfile[]> {
    if (this.client) {
      try {
        // squad_profiles holds only public columns – credentials live in profiles, which
        // the API can't read at all.
        const { data, error } = await this.client
          .from('squad_profiles')
          .select('id, username, name, email, avatar, color, role, deposit_amount, created_at')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          const profiles = data.map(mapProfile);
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

    // 1. Cloud: verified by the database, never falls back to built-in accounts
    if (this.client) {
      const { data, error } = await this.client.rpc('app_login', {
        p_identifier: cleanId,
        p_secret: cleanSecret,
      });
      if (error) return { success: false, message: rpcErrorMessage(error) };
      if (!data || data.error || !data.token) {
        return { success: false, message: data?.error || 'Wrong username, password or PIN.' };
      }
      const user = mapProfile(data.user);
      this.setSession(data.token, user);
      return { success: true, user };
    }

    // 2. Local single-device mode (no database configured)
    const authUsers = storage.getAuthUsers();
    const found = authUsers.find(
      u =>
        u.username?.toLowerCase() === cleanId ||
        u.id.toLowerCase() === cleanId ||
        u.email?.toLowerCase() === cleanId ||
        u.name?.toLowerCase() === cleanId ||
        (cleanId === 'referee' && u.role === 'admin')
    );

    if (!found) {
      return { success: false, message: 'Challenger account not found.' };
    }

    if (found.password === cleanSecret || found.pin === cleanSecret) {
      // Strip credentials before returning to client session
      const { password: _p, pin: _pin, recoveryAnswer: _ra, ...safeUser } = found;
      return { success: true, user: safeUser };
    }

    return { success: false, message: 'Incorrect password or PIN.' };
  }

  /**
   * Restores the signed-in user on app start. In cloud mode the stored token is checked
   * by the database, so editing localStorage can't impersonate anyone.
   */
  public async restoreSession(): Promise<SessionRestore> {
    if (!this.client || !this.sessionToken) return { status: 'signed-out' };
    const { data, error } = await this.client.rpc('app_current_user');
    if (error) {
      // Server unreachable: keep the person signed in on this device until we can check.
      // (Every write is still verified by the database, so this grants nothing.)
      try {
        const cached = localStorage.getItem(SESSION_USER_KEY);
        if (cached) return { status: 'offline', user: JSON.parse(cached) };
      } catch {}
      return { status: 'signed-out' };
    }
    if (!data) {
      this.setSession('', null); // expired / revoked (e.g. password changed elsewhere)
      return { status: 'signed-out' };
    }
    const user = mapProfile(data);
    this.sessionUser = user;
    try {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } catch {}
    return { status: 'signed-in', user };
  }

  public async logout(): Promise<void> {
    const client = this.client;
    const hadToken = Boolean(this.sessionToken);
    if (client && hadToken) {
      // Revoke on the server before dropping the token header
      try {
        await client.rpc('app_logout');
      } catch {}
    }
    this.setSession('', null);
  }

  public async forgotPassword(
    usernameOrEmail: string,
    recoveryKeyOrCode: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    // Cloud: there is no self-service reset any more – a shared "master key" let anyone
    // take over any account. The referee resets it from Admin → Squad.
    if (this.client) {
      return {
        success: false,
        message: 'Ask your referee to set a new password for you (Admin → Squad → key icon).',
      };
    }

    // Local single-device mode: only the account's own recovery answer works
    const cleanId = usernameOrEmail.trim().toLowerCase();
    const cleanKey = recoveryKeyOrCode.trim();
    const authUsers = storage.getAuthUsers();
    const userIndex = authUsers.findIndex(
      u =>
        u.username?.toLowerCase() === cleanId ||
        u.id.toLowerCase() === cleanId ||
        u.email?.toLowerCase() === cleanId ||
        u.name?.toLowerCase() === cleanId
    );

    if (userIndex === -1) {
      return { success: false, message: 'No account found with that username or email.' };
    }

    const targetUser = authUsers[userIndex];
    if (targetUser.recoveryAnswer && targetUser.recoveryAnswer.toLowerCase() === cleanKey.toLowerCase()) {
      authUsers[userIndex].password = newPassword;
      storage.saveAuthUsers(authUsers);
      return { success: true, message: `Password for ${targetUser.name} has been reset successfully!` };
    }

    return { success: false, message: 'Wrong recovery answer. Ask your referee to reset your password.' };
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

    // Cloud: the database validates, hashes and stores; only the referee may do this
    if (this.client) {
      const { data, error } = await this.client.rpc('admin_create_user', {
        p_user: {
          username: cleanUsername,
          name: newUser.name.trim(),
          email: newUser.email?.trim() || '',
          password: newUser.password?.trim() || '',
          pin: newUser.pin?.trim() || '',
          avatar: newUser.avatar || '🦁',
          deposit_amount: newUser.depositAmount ?? 2000,
        },
      });
      if (error) return { success: false, message: rpcErrorMessage(error) };
      if (!data || data.error || !data.user) return { success: false, message: data?.error || 'Could not add challenger.' };
      const user = mapProfile(data.user);
      storage.saveUsers([...storage.getUsers().filter(u => u.id !== user.id), user]);
      return { success: true, user, message: `Challenger ${user.name} added to squad!` };
    }

    // Local single-device mode
    const id = `user_${Date.now()}`;
    const taken = [...storage.getAuthUsers(), ...storage.getUsers()].some(
      u => u.username?.toLowerCase() === cleanUsername || u.id.toLowerCase() === cleanUsername
    );
    if (taken || cleanUsername === 'admin' || cleanUsername === 'referee') {
      return { success: false, message: `The username "${cleanUsername}" is already taken.` };
    }

    const profile: UserProfile = {
      id,
      username: cleanUsername,
      name: newUser.name.trim(),
      email: newUser.email?.trim() || `${cleanUsername}@75hard.local`,
      password: newUser.password?.trim() || '',
      pin: newUser.pin?.trim() || undefined,
      avatar: newUser.avatar || '🦁',
      color: 'from-rose-600 to-rose-700',
      role: newUser.role || 'challenger',
      depositAmount: newUser.depositAmount ?? 2000,
      createdAt: new Date().toISOString(),
    };

    const authUsers = storage.getAuthUsers();
    authUsers.push(profile);
    storage.saveAuthUsers(authUsers);

    const current = storage.getUsers();
    const { password: _p, pin: _pin, recoveryAnswer: _ra, ...safeProfile } = profile;
    current.push(safeProfile);
    storage.saveUsers(current);

    return { success: true, user: safeProfile, message: `Challenger ${profile.name} added to squad!` };
  }

  public async updateUser(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    const { password: _p, pin: _pin, recoveryAnswer: _ra, ...safeUpdates } = updates;

    if (this.client) {
      const changes: Record<string, unknown> = {};
      if (updates.name) changes.name = updates.name;
      if (updates.username) changes.username = updates.username.toLowerCase();
      if (updates.email) changes.email = updates.email;
      if (updates.password) changes.password = updates.password;
      if (updates.pin) changes.pin = updates.pin;
      if (updates.avatar) changes.avatar = updates.avatar;
      if (updates.depositAmount !== undefined) changes.deposit_amount = updates.depositAmount;

      const { data, error } = await this.client.rpc('app_update_user', { p_user_id: userId, p_changes: changes });
      if (error) return { success: false, message: rpcErrorMessage(error) };
      if (!data || data.error) return { success: false, message: data?.error || 'Could not update the account.' };
    } else {
      // Local single-device mode
      const authUsers = storage.getAuthUsers();
      const idx = authUsers.findIndex(u => u.id === userId);
      if (idx !== -1) {
        authUsers[idx] = { ...authUsers[idx], ...updates };
        storage.saveAuthUsers(authUsers);
      }
    }

    // Public profile cache (never holds credentials)
    const publicUsers = storage.getUsers();
    const pIdx = publicUsers.findIndex(u => u.id === userId);
    if (pIdx !== -1) {
      publicUsers[pIdx] = { ...publicUsers[pIdx], ...safeUpdates };
      storage.saveUsers(publicUsers);
    }

    return { success: true, message: 'Account updated.' };
  }

  public async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    if (this.client) {
      const { data, error } = await this.client.rpc('admin_delete_user', { p_user_id: userId });
      if (error) return { success: false, message: rpcErrorMessage(error) };
      if (!data || data.error) return { success: false, message: data?.error || 'Could not remove user.' };
    }

    const localUsers = storage.getUsers().filter(u => u.id !== userId);
    storage.saveUsers(localUsers);
    // Also remove their login and logs, so a removed person can't sign in any more
    if (!this.client) storage.saveAuthUsers(storage.getAuthUsers().filter(u => u.id !== userId));
    try {
      localStorage.removeItem(`75hard_logs_${userId}`);
    } catch (e) {}
    return { success: true, message: 'User removed from squad.' };
  }

  // --------------------------------------------------------------------------
  // DAILY LOGS & PROGRESS TRACKING
  // --------------------------------------------------------------------------

  /** Cloud reads/writes of logs need a signed-in session (row-level security). */
  private canSyncLogs(): boolean {
    return Boolean(this.client && this.sessionToken);
  }

  /** Only logs this session is allowed to write get re-pushed (own logs; referee: all). */
  private mayWriteLog(userId: string): boolean {
    return Boolean(this.sessionUser && (this.sessionUser.role === 'admin' || this.sessionUser.id === userId));
  }

  public async fetchAllLogs(): Promise<Record<string, Record<string, DailyLog>>> {
    if (this.client && this.canSyncLogs()) {
      try {
        const { data, error } = await this.client.from('daily_logs').select('*');
        if (!error && data) {
          const config = storage.getConfig();
          const cloudLogs: Record<string, Record<string, DailyLog>> = {};
          for (const row of data) {
            const uid = row.user_id;
            if (!cloudLogs[uid]) cloudLogs[uid] = {};
            cloudLogs[uid][row.date] = normalizeLog(
              {
                id: row.id,
                date: row.date,
                userId: uid,
                dayNumber: row.day_number,
                travel: row.travel,
                sickness: row.sickness,
                tasks: row.tasks,
                sport: row.sport,
                journalNotes: row.journal_notes,
                status: row.status,
                failedTasks: row.failed_tasks,
                isLocked: row.is_locked,
                completedAt: row.completed_at,
                updatedAt: row.updated_at,
              },
              config
            );
          }

          // Merge with this device's copy instead of overwriting it: an edit made while
          // offline (or whose cloud save failed / was cut off) is newer than the cloud row,
          // so keep it and push it up again rather than silently losing it.
          const localLogs = storage.getAllUsersLogs();

          // When the referee wipes the data (config.dataResetAt), copies cached on this phone
          // from before the wipe must be thrown away – not pushed back up as "unsaved edits".
          const { data: cfgRow } = await this.client
            .from('challenge_config')
            .select('config')
            .eq('id', 'current_config')
            .maybeSingle();
          const resetAt = timeOf(cfgRow?.config?.dataResetAt);

          const merged: Record<string, Record<string, DailyLog>> = {};
          const toPush: DailyLog[] = [];
          new Set([...Object.keys(cloudLogs), ...Object.keys(localLogs)]).forEach(uid => {
            const c = cloudLogs[uid] || {};
            const l = localLogs[uid] || {};
            merged[uid] = {};
            new Set([...Object.keys(c), ...Object.keys(l)]).forEach(date => {
              const cloudLog = c[date];
              const localLog = l[date] && timeOf(l[date].updatedAt) > resetAt ? l[date] : undefined;
              if (!cloudLog && !localLog) return; // wiped by a data reset
              if (localLog && (!cloudLog || timeOf(localLog.updatedAt) > timeOf(cloudLog.updatedAt))) {
                merged[uid][date] = normalizeLog(localLog, config);
                if (this.mayWriteLog(uid)) toPush.push(merged[uid][date]);
              } else {
                merged[uid][date] = cloudLog;
              }
            });
            storage.saveUserLogs(uid, merged[uid]);
          });

          // Re-sync unsaved local edits in the background
          toPush.forEach(log => {
            this.saveLog(log.userId, log);
          });
          return merged;
        }
      } catch (err) {
        console.warn('Failed to fetch logs from cloud, using local:', err);
      }
    }
    return storage.getAllUsersLogs();
  }

  private pendingCloudSaves = new Map<string, { timer: ReturnType<typeof setTimeout>; userId: string; log: DailyLog }>();

  /**
   * Saves locally right away and batches the cloud write, so typing in a text field
   * doesn't fire one network request per keystroke.
   */
  public saveLogDebounced(userId: string, log: DailyLog, delayMs = 700): void {
    storage.saveUserLog(userId, log);
    if (!this.canSyncLogs()) return;
    const key = `${userId}_${log.date}`;
    const existing = this.pendingCloudSaves.get(key);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      this.pendingCloudSaves.delete(key);
      this.saveLog(userId, log);
    }, delayMs);
    this.pendingCloudSaves.set(key, { timer, userId, log });
  }

  /** Drop a queued cloud write for one day (used when a newer full save is about to happen). */
  public cancelPendingSave(userId: string, date: string): void {
    const key = `${userId}_${date}`;
    const pending = this.pendingCloudSaves.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingCloudSaves.delete(key);
    }
  }

  /** Immediately push any queued cloud writes (e.g. when the app is backgrounded). */
  public flushPendingSaves(): void {
    this.pendingCloudSaves.forEach(({ timer, userId, log }, key) => {
      clearTimeout(timer);
      this.pendingCloudSaves.delete(key);
      this.saveLog(userId, log);
    });
  }

  public async saveLog(userId: string, log: DailyLog): Promise<boolean> {
    // 1. Save to local storage first for zero latency
    storage.saveUserLog(userId, log);

    // 2. Sync to Supabase in background (needs a signed-in session)
    if (this.client && this.canSyncLogs()) {
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
        .upload(cleanName, file, { upsert: false }); // names are unique; storage policy forbids overwriting

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
          const merged = normalizeConfig(data.config);
          storage.saveConfig(merged);
          return merged;
        }
      } catch (err) {
        console.warn('Failed to load cloud config:', err);
      }
    }
    return normalizeConfig(storage.getConfig());
  }

  /**
   * Saves config locally and to the cloud. Returns false (with message) if the cloud write
   * failed, so the UI can tell the admin instead of silently reverting on next reload.
   */
  public async saveConfig(config: ChallengeConfig): Promise<{ success: boolean; message?: string }> {
    const normalized = normalizeConfig(config);
    storage.saveConfig(normalized);

    if (this.client) {
      try {
        const { error } = await this.client.from('challenge_config').upsert({
          id: 'current_config',
          config: normalized,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.warn('Failed to save config to cloud:', error);
          return { success: false, message: `Cloud save failed: ${error.message}` };
        }
        return { success: true };
      } catch (err: any) {
        console.warn('Failed to save config to cloud:', err);
        return { success: false, message: err?.message || 'Cloud save failed' };
      }
    }
    return { success: true };
  }
}

export const supabaseService = new SupabaseService();
