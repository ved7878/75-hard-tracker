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
import { api } from '../services/api';
import { sound } from '../services/audio';
import { setupDailyReminder } from '../services/notifications';

interface ChallengeContextType {
  config: ChallengeConfig;
  updateConfig: (patch: Partial<ChallengeConfig>) => Promise<void>;
  // Auth & Multi-user
  currentUser: UserProfile | null;
  users: UserProfile[];
  isAdmin: boolean;
  adminOverrideMode: boolean;
  setAdminOverrideMode: (val: boolean) => void;
  loginChallenger: (username: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  // Admin user management
  adminAddUser: (userData: { name: string; username: string; pin: string; avatar: string; depositAmount: number }) => Promise<{ success: boolean; error?: string }>;
  adminDeleteUser: (id: string) => Promise<boolean>;
  // Admin Time-Machine & Exceptions
  pendingExceptions: PendingExceptionItem[];
  approveException: (userId: string, dateStr: string, comment?: string) => Promise<void>;
  rejectException: (userId: string, dateStr: string, comment?: string) => Promise<void>;
  adminUpdateLog: (userId: string, dateStr: string, updater: (prev: DailyLog) => DailyLog) => Promise<void>;
  // DB settings on backend
  dbSettings: { supabaseUrl: string; hasKey: boolean; isConnected: boolean } | null;
  updateDbSettings: (settings: { supabaseUrl: string; supabaseAnonKey?: string }) => Promise<{ success: boolean; message: string }>;
  // Logs & Tracking
  logs: Record<string, DailyLog>;
  allUsersLogs: Record<string, Record<string, DailyLog>>;
  currentDate: string;
  setCurrentDate: (date: string) => void;
  currentLog: DailyLog;
  updateCurrentLog: (updater: (prev: DailyLog) => DailyLog) => Promise<boolean>;
  streakStats: StreakStats;
  squadMembers: SquadMemberStatus[];
  isEditable: boolean;
  isToday: boolean;
  celebrateCompletion: () => void;
  setCurrentUserId: (id: string) => void;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

export const ChallengeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfigState] = useState<ChallengeConfig>(DEFAULT_CONFIG);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<Record<string, DailyLog>>({});
  const [allUsersLogs, setAllUsersLogs] = useState<Record<string, Record<string, DailyLog>>>({});
  const [squadMembers, setSquadMembers] = useState<SquadMemberStatus[]>([]);
  const [pendingExceptions, setPendingExceptions] = useState<PendingExceptionItem[]>([]);
  const [dbSettings, setDbSettings] = useState<{ supabaseUrl: string; hasKey: boolean; isConnected: boolean } | null>(null);

  const [currentDate, setCurrentDate] = useState<string>(() => formatDate(new Date()));
  const [adminOverrideMode, setAdminOverrideMode] = useState<boolean>(false);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  const todayStr = formatDate(new Date());
  const isTodayDate = currentDate === todayStr;
  const isAdmin = currentUser?.role === 'admin';
  const isEditable = isDateEditable(currentDate, config, isAdmin || adminOverrideMode);

  // Load config & initial session
  const refreshAppData = useCallback(async (user: UserProfile | null) => {
    try {
      const cfg = await api.getConfig();
      if (cfg && cfg.startDate) {
        setConfigState({ ...DEFAULT_CONFIG, ...cfg });
      }

      if (user) {
        const squad = await api.getSquad();
        setSquadMembers(squad);

        if (user.role === 'admin') {
          const adminUsers = await api.adminGetUsers();
          setUsers(adminUsers);
          const exceptions = await api.adminGetExceptions();
          setPendingExceptions(exceptions);
          const dbInfo = await api.adminGetDbSettings();
          setDbSettings(dbInfo);
        } else {
          // Standard challenger: load their logs
          const userLogs = await api.getLogs(user.id);
          setLogs(userLogs);
        }
      }
    } catch (err) {
      console.warn('Error refreshing app data:', err);
    }
  }, []);

  // Check saved session on mount
  useEffect(() => {
    const initAuth = async () => {
      const session = api.getSession();
      if (session.userId) {
        try {
          const meRes = await api.getConfig(); // test connection
          if (session.role === 'admin') {
            const adminUser: UserProfile = {
              id: 'admin',
              name: 'Referee / Admin',
              username: 'admin',
              role: 'admin',
              avatar: '⚖️',
              color: 'from-purple-600 to-indigo-800',
            };
            setCurrentUser(adminUser);
            await refreshAppData(adminUser);
          } else {
            // Find challenger
            const squad = await api.getSquad();
            const found = squad.find(s => s.user.id === session.userId);
            if (found) {
              setCurrentUser(found.user);
              await refreshAppData(found.user);
            } else {
              api.logout();
              setCurrentUser(null);
            }
          }
        } catch (e) {
          api.logout();
          setCurrentUser(null);
        }
      } else {
        // Load public squad & config for login preview
        try {
          const cfg = await api.getConfig();
          if (cfg && cfg.startDate) setConfigState({ ...DEFAULT_CONFIG, ...cfg });
          const squad = await api.getSquad();
          if (squad && squad.length > 0) {
            setUsers(squad.map(s => s.user));
          }
        } catch (e) {}
      }
      setIsLoadingSession(false);
    };

    initAuth();
  }, [refreshAppData]);

  // 9 PM reminder
  useEffect(() => {
    setupDailyReminder(config.reminderTime, config.reminderEnabled);
  }, [config.reminderTime, config.reminderEnabled]);

  // Challenger Login
  const loginChallenger = async (username: string, pin: string) => {
    const res = await api.loginChallenger(username, pin);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      await refreshAppData(res.user);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // Admin Login
  const loginAdmin = async (pin: string) => {
    const res = await api.loginAdmin(pin);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setAdminOverrideMode(true);
      await refreshAppData(res.user);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // Logout
  const logout = () => {
    api.logout();
    setCurrentUser(null);
    setLogs({});
    setAdminOverrideMode(false);
  };

  // Switch challenger view (if admin)
  const setCurrentUserId = async (id: string) => {
    if (isAdmin) {
      const targetLogs = await api.getLogs(id);
      setLogs(targetLogs);
    }
  };

  // Current active date's log
  const currentLog = useMemo(() => {
    if (logs[currentDate]) {
      return logs[currentDate];
    }
    return createDefaultLog(currentDate, config, currentUser?.id || 'user_1');
  }, [logs, currentDate, config, currentUser]);

  // Update current date's log (enforces today-only on server side!)
  const updateCurrentLog = useCallback(
    async (updater: (prev: DailyLog) => DailyLog): Promise<boolean> => {
      if (!currentUser) return false;

      const existing = logs[currentDate] || createDefaultLog(currentDate, config, currentUser.id);
      const updated = updater(existing);

      updated.userId = currentUser.id;
      updated.id = `${currentUser.id}_${currentDate}`;
      updated.status = computeDayStatus(updated, config);
      const { failedNames, allCompleted } = validateDayTasks(updated, config);
      updated.failedTasks = allCompleted ? [] : failedNames;
      if (allCompleted && !updated.completedAt) {
        updated.completedAt = new Date().toISOString();
        sound.playDayComplete();
      } else {
        sound.playTaskCheck();
      }
      updated.updatedAt = new Date().toISOString();

      // Optimistic state update
      setLogs(prev => ({ ...prev, [currentDate]: updated }));

      // Save to backend
      const res = await api.saveLog(updated);
      if (!res.success) {
        alert(res.error || 'Failed to save log to backend');
        return false;
      }

      // Refresh squad progress
      api.getSquad().then(setSquadMembers).catch(() => {});
      return true;
    },
    [currentUser, logs, currentDate, config]
  );

  // Admin: Update System Config
  const updateConfig = async (patch: Partial<ChallengeConfig>) => {
    try {
      const updated = await api.adminUpdateConfig(patch);
      setConfigState({ ...DEFAULT_CONFIG, ...updated });
    } catch (e: any) {
      alert(e.message || 'Failed to update system config');
    }
  };

  // Admin: Add Challenger
  const adminAddUser = async (userData: { name: string; username: string; pin: string; avatar: string; depositAmount: number }) => {
    try {
      const newUser = await api.adminAddUser(userData);
      setUsers(prev => [...prev, newUser]);
      const squad = await api.getSquad();
      setSquadMembers(squad);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Admin: Delete Challenger
  const adminDeleteUser = async (id: string) => {
    try {
      await api.adminDeleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      const squad = await api.getSquad();
      setSquadMembers(squad);
      return true;
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
      return false;
    }
  };

  // Admin: Time-Machine Override (Modify any past or future day)
  const adminUpdateLog = async (userId: string, dateStr: string, updater: (prev: DailyLog) => DailyLog) => {
    const existing = logs[dateStr] || createDefaultLog(dateStr, config, userId);
    const updated = updater(existing);

    updated.userId = userId;
    updated.id = `${userId}_${dateStr}`;
    updated.status = computeDayStatus(updated, config);
    const { failedNames } = validateDayTasks(updated, config);
    updated.failedTasks = failedNames;
    updated.updatedAt = new Date().toISOString();

    setLogs(prev => ({ ...prev, [dateStr]: updated }));

    await api.adminOverrideLog(userId, dateStr, updated);
    api.getSquad().then(setSquadMembers).catch(() => {});
  };

  // Admin: Approve Exception
  const approveException = async (userId: string, dateStr: string, comment?: string) => {
    await api.adminReviewException(userId, dateStr, 'approve', comment);
    setPendingExceptions(prev => prev.filter(e => !(e.userId === userId && e.date === dateStr)));
    // reload logs
    const updatedLogs = await api.getLogs(userId);
    setLogs(updatedLogs);
  };

  // Admin: Reject Exception
  const rejectException = async (userId: string, dateStr: string, comment?: string) => {
    await api.adminReviewException(userId, dateStr, 'reject', comment);
    setPendingExceptions(prev => prev.filter(e => !(e.userId === userId && e.date === dateStr)));
    const updatedLogs = await api.getLogs(userId);
    setLogs(updatedLogs);
  };

  // Admin: Update DB Settings
  const updateDbSettings = async (settings: { supabaseUrl: string; supabaseAnonKey?: string }) => {
    const res = await api.adminUpdateDbSettings(settings);
    const info = await api.adminGetDbSettings();
    setDbSettings(info);
    return res;
  };

  // Streak Stats
  const streakStats = useMemo(() => {
    return calculateStreakStats(logs, config, currentUser?.id || 'user_1');
  }, [logs, config, currentUser]);

  const celebrateCompletion = useCallback(() => {
    try {
      sound.playDayComplete();
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#e11d48', '#10b981', '#3b82f6', '#f59e0b', '#ffffff'],
      });
    } catch (e) {}
  }, []);

  const value = {
    config,
    updateConfig,
    currentUser,
    users,
    isAdmin,
    adminOverrideMode,
    setAdminOverrideMode,
    loginChallenger,
    loginAdmin,
    logout,
    adminAddUser,
    adminDeleteUser,
    pendingExceptions,
    approveException,
    rejectException,
    adminUpdateLog,
    dbSettings,
    updateDbSettings,
    logs,
    allUsersLogs,
    currentDate,
    setCurrentDate,
    currentLog,
    updateCurrentLog,
    streakStats,
    squadMembers,
    isEditable,
    isToday: isTodayDate,
    celebrateCompletion,
    setCurrentUserId,
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold tracking-wider uppercase text-slate-400">Loading 75 HARD System...</p>
        </div>
      </div>
    );
  }

  return <ChallengeContext.Provider value={value}>{children}</ChallengeContext.Provider>;
};

export const useChallenge = (): ChallengeContextType => {
  const context = useContext(ChallengeContext);
  if (!context) {
    throw new Error('useChallenge must be used within a ChallengeProvider');
  }
  return context;
};
