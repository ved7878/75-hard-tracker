import { ChallengeConfig, DailyLog, UserProfile } from '../types';
import { DEFAULT_CONFIG, normalizeConfig } from './rulesEngine';

const CONFIG_KEY = '75hard_challenge_config';
const USERS_KEY = '75hard_users_list';
const AUTH_CREDENTIALS_KEY = '75hard_auth_credentials';
const ACTIVE_USER_KEY = '75hard_active_user_id';
const LOGS_PREFIX = '75hard_logs_';
const LEGACY_LOGS_KEY = '75hard_daily_logs';
const AUTH_SESSION_KEY = '75hard_auth_session';

export const DEFAULT_USERS: UserProfile[] = [
  { id: 'user_1', username: 'vedant', name: 'Vedant', email: 'vedant@75hard.local', password: 'vedant123', avatar: '🦁', color: 'from-rose-600 to-rose-700', role: 'challenger', pin: '1111', depositAmount: 2000 },
  { id: 'user_2', username: 'vedansh', name: 'Vedansh', email: 'vedansh@75hard.local', password: 'vedansh123', avatar: '🐺', color: 'from-blue-600 to-indigo-700', role: 'challenger', pin: '2222', depositAmount: 2000 },
  { id: 'user_3', username: 'aryaman', name: 'Aryaman', email: 'aryaman@75hard.local', password: 'aryaman123', avatar: '🦅', color: 'from-amber-500 to-orange-600', role: 'challenger', pin: '3333', depositAmount: 2000 },
  { id: 'admin', username: 'admin', name: 'Referee / Admin', email: 'admin@75hard.local', password: 'admin7575', avatar: '⚖️', color: 'from-purple-600 to-indigo-800', role: 'admin', pin: '7575', depositAmount: 0 },
];

/**
 * Strips sensitive credentials (password, PIN, recovery secrets) from user objects
 * before exposing to UI components, squad listings, or general state.
 */
export function sanitizeUser(user: UserProfile): UserProfile {
  const { password: _p, pin: _pin, recoveryAnswer: _ra, ...safe } = user;
  return safe;
}

export const storage = {
  getConfig(): ChallengeConfig {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) {
        return normalizeConfig(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load config from localStorage', e);
    }
    return DEFAULT_CONFIG;
  },

  saveConfig(config: ChallengeConfig): void {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save config to localStorage', e);
    }
  },

  /**
   * Returns SANITIZED public profiles for squad views, leaderboards, and dashboard.
   * Passwords and PINs are strictly stripped.
   */
  getUsers(): UserProfile[] {
    try {
      const stored = localStorage.getItem(USERS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          return parsed.map(sanitizeUser);
        }
      }
    } catch (e) {
      console.error('Failed to load users from localStorage', e);
    }
    const safeDefaults = DEFAULT_USERS.map(sanitizeUser);
    storage.saveUsers(safeDefaults);
    return safeDefaults;
  },

  /**
   * Saves sanitized profiles to USERS_KEY. Never stores raw credentials here.
   */
  saveUsers(users: UserProfile[]): void {
    try {
      const sanitized = users.map(sanitizeUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Failed to save users to localStorage', e);
    }
  },

  /**
   * Internal auth store: Used exclusively for local offline authentication checks.
   * Isolated from public UI state and never exposed to squad listings.
   */
  getAuthUsers(): UserProfile[] {
    try {
      const stored = localStorage.getItem(AUTH_CREDENTIALS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          // Merge with DEFAULT_USERS to ensure any missing fields are present
          const merged = parsed.map(user => {
            const def = DEFAULT_USERS.find(
              d => d.id === user.id || d.username?.toLowerCase() === user.username?.toLowerCase() || d.name?.toLowerCase() === user.name?.toLowerCase()
            );
            return def ? { ...def, ...user } : user;
          });
          return merged;
        }
      }
    } catch (e) {
      console.error('Failed to load auth credentials from localStorage', e);
    }
    storage.saveAuthUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  },

  saveAuthUsers(users: UserProfile[]): void {
    try {
      localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save auth credentials to localStorage', e);
    }
  },

  getActiveUserId(): string {
    return localStorage.getItem(ACTIVE_USER_KEY) || 'user_1';
  },

  setActiveUserId(id: string): void {
    localStorage.setItem(ACTIVE_USER_KEY, id);
  },

  getUserLogs(userId: string): Record<string, DailyLog> {
    try {
      if (userId === 'user_1') {
        const legacy = localStorage.getItem(LEGACY_LOGS_KEY);
        if (legacy && !localStorage.getItem(`${LOGS_PREFIX}user_1`)) {
          const parsed = JSON.parse(legacy);
          Object.values(parsed).forEach((l: any) => { l.userId = 'user_1'; });
          localStorage.setItem(`${LOGS_PREFIX}user_1`, JSON.stringify(parsed));
          return parsed;
        }
      }

      const stored = localStorage.getItem(`${LOGS_PREFIX}${userId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(`Failed to load logs for user ${userId}`, e);
    }
    return {};
  },

  saveUserLog(userId: string, log: DailyLog): void {
    try {
      const logs = storage.getUserLogs(userId);
      logs[log.date] = {
        ...log,
        userId,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`${LOGS_PREFIX}${userId}`, JSON.stringify(logs));
    } catch (e) {
      console.error(`Failed to save log for user ${userId}`, e);
    }
  },

  saveUserLogs(userId: string, logs: Record<string, DailyLog>): void {
    try {
      localStorage.setItem(`${LOGS_PREFIX}${userId}`, JSON.stringify(logs));
    } catch (e) {
      console.error(`Failed to save logs for user ${userId}`, e);
    }
  },

  getAllUsersLogs(): Record<string, Record<string, DailyLog>> {
    const users = storage.getUsers();
    const result: Record<string, Record<string, DailyLog>> = {};
    users.forEach(u => {
      if (u.role !== 'admin') {
        result[u.id] = storage.getUserLogs(u.id);
      }
    });
    return result;
  },

  getAuthSession(): { isLoggedIn: boolean; userId: string; role: 'challenger' | 'admin' } | null {
    try {
      const stored = localStorage.getItem(AUTH_SESSION_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse auth session', e);
    }
    return null;
  },

  saveAuthSession(session: { isLoggedIn: boolean; userId: string; role: 'challenger' | 'admin' } | null): void {
    if (session) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  },

  exportBackup(): string {
    const users = storage.getUsers();
    const allLogs = storage.getAllUsersLogs();
    const data = {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      config: storage.getConfig(),
      users,
      activeUserId: storage.getActiveUserId(),
      allLogs,
    };
    return JSON.stringify(data, null, 2);
  },

  importBackup(jsonString: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.config) {
        storage.saveConfig({ ...DEFAULT_CONFIG, ...parsed.config });
      }
      if (parsed.users && Array.isArray(parsed.users)) {
        storage.saveUsers(parsed.users);
      }
      if (parsed.allLogs) {
        Object.entries(parsed.allLogs).forEach(([uid, logs]) => {
          storage.saveUserLogs(uid, logs as Record<string, DailyLog>);
        });
      } else if (parsed.logs) {
        storage.saveUserLogs('user_1', parsed.logs);
      }
      return { success: true, message: 'Backup restored successfully!' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Invalid backup JSON file' };
    }
  },

  clearAllData(): void {
    const users = storage.getUsers();
    users.forEach(u => localStorage.removeItem(`${LOGS_PREFIX}${u.id}`));
    localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(ACTIVE_USER_KEY);
    localStorage.removeItem(LEGACY_LOGS_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
  },
};
