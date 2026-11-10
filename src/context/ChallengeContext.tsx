import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { ChallengeConfig, DailyLog, DayStatus, StreakStats } from '../types';
import {
  DEFAULT_CONFIG,
  createDefaultLog,
  formatDate,
  calculateStreakStats,
  computeDayStatus,
  validateDayTasks,
} from '../services/rulesEngine';
import { storage } from '../services/storage';
import {
  fetchAllLogsFromSupabase,
  syncAllLogsToSupabase,
  syncLogToSupabase,
} from '../services/supabase';
import { setupDailyReminder } from '../services/notifications';

interface ChallengeContextType {
  config: ChallengeConfig;
  updateConfig: (patch: Partial<ChallengeConfig>) => void;
  logs: Record<string, DailyLog>;
  currentDate: string;
  setCurrentDate: (date: string) => void;
  currentLog: DailyLog;
  updateCurrentLog: (updater: (prev: DailyLog) => DailyLog) => void;
  streakStats: StreakStats;
  syncState: {
    syncing: boolean;
    lastSynced?: string;
    error?: string;
  };
  syncToCloud: () => Promise<boolean>;
  pullFromCloud: () => Promise<boolean>;
  resetChallenge: () => void;
  celebrateCompletion: () => void;
  isToday: boolean;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

export const ChallengeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfigState] = useState<ChallengeConfig>(() => storage.getConfig());
  const [logs, setLogsState] = useState<Record<string, DailyLog>>(() => storage.getAllLogs());
  const [currentDate, setCurrentDate] = useState<string>(() => formatDate(new Date()));
  const [syncState, setSyncState] = useState<{ syncing: boolean; lastSynced?: string; error?: string }>({
    syncing: false,
  });

  // Keep reminder setup active
  useEffect(() => {
    setupDailyReminder(config.reminderTime, config.reminderEnabled);
  }, [config.reminderTime, config.reminderEnabled]);

  // Save config on change
  const updateConfig = useCallback((patch: Partial<ChallengeConfig>) => {
    setConfigState(prev => {
      const updated = { ...prev, ...patch };
      storage.saveConfig(updated);
      return updated;
    });
  }, []);

  // Ensure current date log exists
  const currentLog = useMemo(() => {
    if (logs[currentDate]) {
      return logs[currentDate];
    }
    return createDefaultLog(currentDate, config);
  }, [logs, currentDate, config]);

  // Update current date's log
  const updateCurrentLog = useCallback((updater: (prev: DailyLog) => DailyLog) => {
    setLogsState(prevLogs => {
      const existing = prevLogs[currentDate] || createDefaultLog(currentDate, config);
      const updated = updater(existing);

      // Recompute status
      updated.status = computeDayStatus(updated, config);
      const { failedNames, allCompleted } = validateDayTasks(updated, config);
      updated.failedTasks = allCompleted ? [] : failedNames;
      if (allCompleted && !updated.completedAt) {
        updated.completedAt = new Date().toISOString();
      } else if (!allCompleted) {
        updated.completedAt = undefined;
      }
      updated.updatedAt = new Date().toISOString();

      const newLogs = { ...prevLogs, [currentDate]: updated };
      storage.saveLog(updated);

      // Auto sync with Supabase if configured
      if (config.autoSyncSupabase && config.supabaseUrl && config.supabaseAnonKey) {
        syncLogToSupabase(updated, config).catch(e => console.warn('Supabase auto-sync failed', e));
      }

      return newLogs;
    });
  }, [currentDate, config]);

  // Calculate streak stats dynamically
  const streakStats = useMemo(() => {
    return calculateStreakStats(logs, config);
  }, [logs, config]);

  const celebrateCompletion = useCallback(() => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#e11d48', '#10b981', '#3b82f6', '#f59e0b', '#ffffff'],
      });
    } catch (e) {
      console.warn('Confetti error', e);
    }
  }, []);

  // Sync to Supabase
  const syncToCloud = useCallback(async (): Promise<boolean> => {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      setSyncState({ syncing: false, error: 'Supabase credentials not configured in settings.' });
      return false;
    }

    setSyncState({ syncing: true });
    try {
      const count = await syncAllLogsToSupabase(logs, config);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncState({ syncing: false, lastSynced: nowStr });
      return count > 0;
    } catch (err: any) {
      setSyncState({ syncing: false, error: err?.message || 'Sync failed' });
      return false;
    }
  }, [logs, config]);

  // Pull from Supabase
  const pullFromCloud = useCallback(async (): Promise<boolean> => {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      setSyncState({ syncing: false, error: 'Supabase credentials not configured in settings.' });
      return false;
    }

    setSyncState({ syncing: true });
    try {
      const cloudLogs = await fetchAllLogsFromSupabase(config);
      if (cloudLogs) {
        const merged = { ...logs, ...cloudLogs };
        setLogsState(merged);
        storage.saveAllLogs(merged);
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setSyncState({ syncing: false, lastSynced: nowStr });
        return true;
      }
      setSyncState({ syncing: false, error: 'No data found in Supabase' });
      return false;
    } catch (err: any) {
      setSyncState({ syncing: false, error: err?.message || 'Pull failed' });
      return false;
    }
  }, [logs, config]);

  // Full challenge reset
  const resetChallenge = useCallback(() => {
    const freshLogs: Record<string, DailyLog> = {};
    setLogsState(freshLogs);
    storage.saveAllLogs(freshLogs);
  }, []);

  const isTodayDate = currentDate === formatDate(new Date());

  const value = {
    config,
    updateConfig,
    logs,
    currentDate,
    setCurrentDate,
    currentLog,
    updateCurrentLog,
    streakStats,
    syncState,
    syncToCloud,
    pullFromCloud,
    resetChallenge,
    celebrateCompletion,
    isToday: isTodayDate,
  };

  return <ChallengeContext.Provider value={value}>{children}</ChallengeContext.Provider>;
};

export const useChallenge = (): ChallengeContextType => {
  const context = useContext(ChallengeContext);
  if (!context) {
    throw new Error('useChallenge must be used within a ChallengeProvider');
  }
  return context;
};
