import { ChallengeConfig, DailyLog, UserProfile } from '../types';
import { DEFAULT_CONFIG } from './rulesEngine';

const CONFIG_KEY = '75hard_challenge_config';
const USERS_KEY = '75hard_users_list';
const ACTIVE_USER_KEY = '75hard_active_user_id';
const LOGS_PREFIX = '75hard_logs_';
const LEGACY_LOGS_KEY = '75hard_daily_logs';

export const DEFAULT_USERS: UserProfile[] = [
  { id: 'user_1', name: 'Challenger 1', avatar: '🦁', color: 'from-rose-600 to-rose-700' },
  { id: 'user_2', name: 'Challenger 2', avatar: '🐺', color: 'from-blue-600 to-indigo-700' },
  { id: 'user_3', name: 'Challenger 3', avatar: '🦅', color: 'from-amber-500 to-orange-600' },
];

export const storage = {
  getConfig(): ChallengeConfig {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
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

  getUsers(): UserProfile[] {
    try {
      const stored = localStorage.getItem(USERS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load users from localStorage', e);
    }
    storage.saveUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  },

  saveUsers(users: UserProfile[]): void {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save users to localStorage', e);
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
      // Check legacy logs if migrating
      if (userId === 'user_1') {
        const legacy = localStorage.getItem(LEGACY_LOGS_KEY);
        if (legacy && !localStorage.getItem(`${LOGS_PREFIX}user_1`)) {
          const parsed = JSON.parse(legacy);
          // Set userId on each legacy log
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
      result[u.id] = storage.getUserLogs(u.id);
    });
    return result;
  },

  exportBackup(): string {
    const users = storage.getUsers();
    const allLogs = storage.getAllUsersLogs();
    const data = {
      version: '2.0',
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
        // legacy import
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
  },
};
