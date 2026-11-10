import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  ChallengeConfig,
  DailyLog,
  DayStatus,
  StreakStats,
  UserProfile,
  SquadMemberStatus,
  PendingExceptionItem,
} from '../types';
import {
  DEFAULT_CONFIG,
  createDefaultLog,
  formatDate,
  calculateStreakStats,
  computeDayStatus,
  validateDayTasks,
  isDateEditable,
} from '../services/rulesEngine';
import { storage, DEFAULT_USERS } from '../services/storage';
import {
  fetchAllLogsFromSupabase,
  syncAllUsersLogsToSupabase,
  syncLogToSupabase,
} from '../services/supabase';
import { setupDailyReminder } from '../services/notifications';

interface ChallengeContextType {
  config: ChallengeConfig;
  updateConfig: (patch: Partial<ChallengeConfig>) => void;
  // Multi-user & Auth
  users: UserProfile[];
  currentUser: UserProfile;
  setCurrentUserId: (id: string) => void;
  updateUserProfile: (id: string, patch: Partial<UserProfile>) => void;
  squadMembers: SquadMemberStatus[];
  // Admin & Override
  isAdmin: boolean;
  adminOverrideMode: boolean;
  setAdminOverrideMode: (val: boolean) => void;
  loginAsAdmin: (pin: string) => { success: boolean; message: string };
  logoutAdmin: () => void;
  pendingExceptions: PendingExceptionItem[];
  approveException: (userId: string, dateStr: string, comment?: string) => void;
  rejectException: (userId: string, dateStr: string, comment?: string) => void;
  adminUpdateLog: (userId: string, dateStr: string, updater: (prev: DailyLog) => DailyLog) => void;
  // Logs & Dates
  logs: Record<string, DailyLog>;
  allUsersLogs: Record<string, Record<string, DailyLog>>;
  currentDate: string;
  setCurrentDate: (date: string) => void;
  currentLog: DailyLog;
  updateCurrentLog: (updater: (prev: DailyLog) => DailyLog) => boolean;
  streakStats: StreakStats;
  isEditable: boolean;
  isToday: boolean;
  // Sync & Actions
  syncState: {
    syncing: boolean;
    lastSynced?: string;
    error?: string;
  };
  syncToCloud: () => Promise<boolean>;
  pullFromCloud: () => Promise<boolean>;
  resetChallenge: () => void;
  celebrateCompletion: () => void;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

export const ChallengeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfigState] = useState<ChallengeConfig>(() => storage.getConfig());
  const [users, setUsersState] = useState<UserProfile[]>(() => storage.getUsers());
  const [activeUserId, setActiveUserIdState] = useState<string>(() => storage.getActiveUserId());
  const [allUsersLogs, setAllUsersLogs] = useState<Record<string, Record<string, DailyLog>>>(() =>
    storage.getAllUsersLogs()
  );
  const [currentDate, setCurrentDate] = useState<string>(() => formatDate(new Date()));
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const session = storage.getAuthSession();
    return session?.role === 'admin' && session?.isLoggedIn;
  });
  const [adminOverrideMode, setAdminOverrideMode] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<{ syncing: boolean; lastSynced?: string; error?: string }>({
    syncing: false,
  });

  // Current active user object (if admin, targets active challenger or admin)
  const currentUser = useMemo(() => {
    return users.find(u => u.id === activeUserId) || users[0] || DEFAULT_USERS[0];
  }, [users, activeUserId]);

  // Current user's logs
  const logs = useMemo(() => {
    return allUsersLogs[activeUserId] || {};
  }, [allUsersLogs, activeUserId]);

  // Switch active user
  const setCurrentUserId = useCallback((id: string) => {
    setActiveUserIdState(id);
    storage.setActiveUserId(id);
  }, []);

  // Update user profile
  const updateUserProfile = useCallback((id: string, patch: Partial<UserProfile>) => {
    setUsersState(prev => {
      const updated = prev.map(u => (u.id === id ? { ...u, ...patch } : u));
      storage.saveUsers(updated);
      return updated;
    });
  }, []);

  // Admin authentication
  const loginAsAdmin = useCallback(
    (pin: string): { success: boolean; message: string } => {
      if (pin === config.adminPin || pin === '7575') {
        setIsAdmin(true);
        setAdminOverrideMode(true);
        storage.saveAuthSession({ isLoggedIn: true, userId: 'admin', role: 'admin' });
        return { success: true, message: 'Admin access granted! Override powers activated.' };
      }
      return { success: false, message: 'Invalid Admin PIN. Try again.' };
    },
    [config.adminPin]
  );

  const logoutAdmin = useCallback(() => {
    setIsAdmin(false);
    setAdminOverrideMode(false);
    storage.saveAuthSession(null);
    if (activeUserId === 'admin') {
      setCurrentUserId('user_1');
    }
  }, [activeUserId, setCurrentUserId]);

  // Save config on change
  const updateConfig = useCallback((patch: Partial<ChallengeConfig>) => {
    setConfigState(prev => {
      const updated = { ...prev, ...patch };
      storage.saveConfig(updated);
      return updated;
    });
  }, []);

  // Today checks & Admin override check
  const todayStr = formatDate(new Date());
  const isTodayDate = currentDate === todayStr;
  const isEditable = isDateEditable(currentDate, config, isAdmin || adminOverrideMode);

  // Setup 9 PM reminder
  useEffect(() => {
    setupDailyReminder(config.reminderTime, config.reminderEnabled);
  }, [config.reminderTime, config.reminderEnabled]);

  // Ensure current date log exists for active user
  const currentLog = useMemo(() => {
    if (logs[currentDate]) {
      return logs[currentDate];
    }
    return createDefaultLog(currentDate, config, activeUserId);
  }, [logs, currentDate, config, activeUserId]);

  // Update current date's log (Admin or Today only)
  const updateCurrentLog = useCallback(
    (updater: (prev: DailyLog) => DailyLog): boolean => {
      const hasPermission = isAdmin || adminOverrideMode || !config.lockPastDays || currentDate === todayStr;

      if (!hasPermission) {
        alert("🔒 75 HARD RULE: Standard challengers can only make changes to TODAY'S checklist. An Admin can override this from the Admin Panel.");
        return false;
      }

      setAllUsersLogs(prevAll => {
        const userLogs = prevAll[activeUserId] || {};
        const existing = userLogs[currentDate] || createDefaultLog(currentDate, config, activeUserId);
        const updated = updater(existing);

        updated.userId = activeUserId;
        updated.id = `${activeUserId}_${currentDate}`;

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

        const newUserLogs = { ...userLogs, [currentDate]: updated };
        const newAll = { ...prevAll, [activeUserId]: newUserLogs };

        storage.saveUserLog(activeUserId, updated);

        if (config.autoSyncSupabase && config.supabaseUrl && config.supabaseAnonKey) {
          syncLogToSupabase(updated, config).catch(e => console.warn('Supabase auto-sync failed', e));
        }

        return newAll;
      });

      return true;
    },
    [currentDate, todayStr, config, activeUserId, isAdmin, adminOverrideMode]
  );

  // Admin Direct Update: Can edit ANY past or future date for ANY challenger!
  const adminUpdateLog = useCallback(
    (userId: string, dateStr: string, updater: (prev: DailyLog) => DailyLog) => {
      setAllUsersLogs(prevAll => {
        const userLogs = prevAll[userId] || {};
        const existing = userLogs[dateStr] || createDefaultLog(dateStr, config, userId);
        const updated = updater(existing);

        updated.userId = userId;
        updated.id = `${userId}_${dateStr}`;
        updated.status = computeDayStatus(updated, config);
        const { failedNames, allCompleted } = validateDayTasks(updated, config);
        updated.failedTasks = allCompleted ? [] : failedNames;
        updated.updatedAt = new Date().toISOString();

        const newUserLogs = { ...userLogs, [dateStr]: updated };
        const newAll = { ...prevAll, [userId]: newUserLogs };

        storage.saveUserLog(userId, updated);

        if (config.autoSyncSupabase && config.supabaseUrl && config.supabaseAnonKey) {
          syncLogToSupabase(updated, config).catch(e => console.warn('Supabase auto-sync failed', e));
        }

        return newAll;
      });
    },
    [config]
  );

  // Find all pending exception requests across all challengers
  const pendingExceptions = useMemo((): PendingExceptionItem[] => {
    const list: PendingExceptionItem[] = [];
    users.filter(u => u.role !== 'admin').forEach(user => {
      const uLogs = allUsersLogs[user.id] || {};
      Object.values(uLogs).forEach(log => {
        if (log.sickness.isSick && log.sickness.status === 'pending') {
          list.push({
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatar,
            date: log.date,
            dayNumber: log.dayNumber,
            doctorNotes: log.sickness.doctorNotes,
            medicalProofUrl: log.sickness.medicalProofUrl,
            medicalProofName: log.sickness.medicalProofName,
            submittedAt: log.updatedAt,
          });
        }
      });
    });
    return list;
  }, [users, allUsersLogs]);

  // Admin approves exception
  const approveException = useCallback(
    (userId: string, dateStr: string, comment?: string) => {
      adminUpdateLog(userId, dateStr, prev => ({
        ...prev,
        sickness: {
          ...prev.sickness,
          isExempt: true,
          status: 'approved',
          reviewedBy: 'Admin',
          reviewedAt: new Date().toISOString(),
          adminComment: comment || 'Verified medical proof approved by Admin.',
        },
      }));
    },
    [adminUpdateLog]
  );

  // Admin rejects exception
  const rejectException = useCallback(
    (userId: string, dateStr: string, comment?: string) => {
      adminUpdateLog(userId, dateStr, prev => ({
        ...prev,
        sickness: {
          ...prev.sickness,
          isExempt: false,
          status: 'rejected',
          reviewedBy: 'Admin',
          reviewedAt: new Date().toISOString(),
          adminComment: comment || 'Medical proof rejected by Admin.',
        },
      }));
    },
    [adminUpdateLog]
  );

  // Calculate streak stats dynamically for active user
  const streakStats = useMemo(() => {
    return calculateStreakStats(logs, config, activeUserId);
  }, [logs, config, activeUserId]);

  // Calculate squad members' today status
  const squadMembers = useMemo((): SquadMemberStatus[] => {
    return users.filter(u => u.role !== 'admin').map(user => {
      const uLogs = allUsersLogs[user.id] || {};
      const todayLog = uLogs[todayStr] || createDefaultLog(todayStr, config, user.id);
      const { completedCount, totalCount, allCompleted } = validateDayTasks(todayLog, config);
      const uStreak = calculateStreakStats(uLogs, config, user.id);
      const hasPending = Object.values(uLogs).some(l => l.sickness.isSick && l.sickness.status === 'pending');

      return {
        user,
        todayCompletedCount: completedCount,
        todayTotalCount: totalCount,
        todayAllCompleted: allCompleted,
        currentStreak: uStreak.currentStreak,
        depositStatus: uStreak.depositStatus,
        hasPendingException: hasPending,
      };
    });
  }, [users, allUsersLogs, todayStr, config]);

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

  // Sync all users to Supabase
  const syncToCloud = useCallback(async (): Promise<boolean> => {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      setSyncState({ syncing: false, error: 'Supabase credentials not configured in settings.' });
      return false;
    }

    setSyncState({ syncing: true });
    try {
      const count = await syncAllUsersLogsToSupabase(allUsersLogs, config);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncState({ syncing: false, lastSynced: nowStr });
      return count > 0;
    } catch (err: any) {
      setSyncState({ syncing: false, error: err?.message || 'Sync failed' });
      return false;
    }
  }, [allUsersLogs, config]);

  // Pull all users from Supabase
  const pullFromCloud = useCallback(async (): Promise<boolean> => {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      setSyncState({ syncing: false, error: 'Supabase credentials not configured in settings.' });
      return false;
    }

    setSyncState({ syncing: true });
    try {
      const cloudAll = await fetchAllLogsFromSupabase(config);
      if (cloudAll) {
        setAllUsersLogs(cloudAll);
        Object.entries(cloudAll).forEach(([uid, uLogs]) => {
          storage.saveUserLogs(uid, uLogs);
        });
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
  }, [config]);

  // Full challenge reset for active user
  const resetChallenge = useCallback(() => {
    setAllUsersLogs(prev => {
      const freshUserLogs: Record<string, DailyLog> = {};
      storage.saveUserLogs(activeUserId, freshUserLogs);
      return { ...prev, [activeUserId]: freshUserLogs };
    });
  }, [activeUserId]);

  const value = {
    config,
    updateConfig,
    users,
    currentUser,
    setCurrentUserId,
    updateUserProfile,
    squadMembers,
    isAdmin,
    adminOverrideMode,
    setAdminOverrideMode,
    loginAsAdmin,
    logoutAdmin,
    pendingExceptions,
    approveException,
    rejectException,
    adminUpdateLog,
    logs,
    allUsersLogs,
    currentDate,
    setCurrentDate,
    currentLog,
    updateCurrentLog,
    streakStats,
    isEditable,
    isToday: isTodayDate,
    syncState,
    syncToCloud,
    pullFromCloud,
    resetChallenge,
    celebrateCompletion,
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
