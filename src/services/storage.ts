import { ChallengeConfig, DailyLog } from '../types';
import { DEFAULT_CONFIG } from './rulesEngine';

const CONFIG_KEY = '75hard_challenge_config';
const LOGS_KEY = '75hard_daily_logs';
const LAST_ACTIVE_DATE_KEY = '75hard_last_active_date';

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

  getAllLogs(): Record<string, DailyLog> {
    try {
      const stored = localStorage.getItem(LOGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load logs from localStorage', e);
    }
    return {};
  },

  saveLog(log: DailyLog): void {
    try {
      const logs = storage.getAllLogs();
      logs[log.date] = {
        ...log,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save log to localStorage', e);
    }
  },

  saveAllLogs(logs: Record<string, DailyLog>): void {
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save all logs to localStorage', e);
    }
  },

  getLastActiveDate(): string | null {
    return localStorage.getItem(LAST_ACTIVE_DATE_KEY);
  },

  setLastActiveDate(dateStr: string): void {
    localStorage.setItem(LAST_ACTIVE_DATE_KEY, dateStr);
  },

  exportBackup(): string {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      config: storage.getConfig(),
      logs: storage.getAllLogs(),
    };
    return JSON.stringify(data, null, 2);
  },

  importBackup(jsonString: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.config) {
        storage.saveConfig({ ...DEFAULT_CONFIG, ...parsed.config });
      }
      if (parsed.logs) {
        storage.saveAllLogs(parsed.logs);
      }
      return { success: true, message: 'Backup restored successfully!' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Invalid backup JSON file' };
    }
  },

  clearAllData(): void {
    localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem(LOGS_KEY);
    localStorage.removeItem(LAST_ACTIVE_DATE_KEY);
  },
};
