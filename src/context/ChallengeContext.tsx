import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  ChallengeConfig,
  DailyLog,
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
import { supabaseService } from '../services/supabaseService';
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
  loginChallenger: (usernameOrEmail: string, passwordOrPin: string) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (passwordOrPin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  // Admin user management
  adminAddUser: (userData: {
    name: string;
    username: string;
    email?: string;
    password?: string;
    pin: string;
    avatar: string;
    depositAmount: number;
  }) => Promise<{ success: boolean; error?: string }>;
  adminResetPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  adminDeleteUser: (id: string) => Promise<boolean>;
  // Admin Time-Machine & Exceptions
  pendingExceptions: PendingExceptionItem[];
  approveException: (userId: string, dateStr: string, comment?: string) => Promise<void>;
  rejectException: (userId: string, dateStr: string, comment?: string) => Promise<void>;
  adminUpdateLog: (userId: string, dateStr: string, updater: (prev: DailyLog) => DailyLog) => Promise<void>;
  // DB settings on backend / Supabase
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
  reloadData: () => Promise<void>;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = '75hard_active_user_id';

export const ChallengeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfigState] = useState<ChallengeConfig>(DEFAULT_CONFIG);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allUsersLogs, setAllUsersLogs] = useState<Record<string, Record<string, DailyLog>>>({});
  const [currentDate, setCurrentDate] = useState<string>(() => formatDate(new Date()));
  const [adminOverrideMode, setAdminOverrideMode] = useState<boolean>(false);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  const todayStr = formatDate(new Date());
  const isTodayDate = currentDate === todayStr;
  const isAdmin = currentUser?.role === 'admin';
  const isEditable = isDateEditable(currentDate, config, isAdmin || adminOverrideMode);

  // Active user's logs
  const logs = useMemo(() => {
    if (!currentUser) return {};
    return allUsersLogs[currentUser.id] || {};
  }, [allUsersLogs, currentUser]);

  // Compute Squad members
  const squadMembers = useMemo<SquadMemberStatus[]>(() => {
    const challengers = users.filter(u => u.role !== 'admin');
    return challengers.map(u => {
      const uLogs = allUsersLogs[u.id] || {};
      const todayLog = uLogs[todayStr] || createDefaultLog(todayStr, config, u.id);
      const { completedCount, totalCount, allCompleted } = validateDayTasks(todayLog, config);
      const streakStats = calculateStreakStats(uLogs, config, u.id);
      const hasPending = Object.values(uLogs).some(
        l => l.sickness?.isSick && l.sickness?.status === 'pending'
      );

      return {
        user: u,
        todayCompletedCount: completedCount,
        todayTotalCount: totalCount,
        todayAllCompleted: allCompleted,
        currentStreak: streakStats.currentStreak,
        depositStatus: streakStats.depositStatus,
        hasPendingException: hasPending,
        depositAmount: u.depositAmount || config.depositAmount,
      };
    });
  }, [users, allUsersLogs, todayStr, config]);

  // Compute Pending Exceptions for Admin Queue
  const pendingExceptions = useMemo<PendingExceptionItem[]>(() => {
    const list: PendingExceptionItem[] = [];
    const challengers = users.filter(u => u.role !== 'admin');

    challengers.forEach(u => {
      const uLogs = allUsersLogs[u.id] || {};
      Object.values(uLogs).forEach(l => {
        if (l.sickness && l.sickness.isSick && l.sickness.status === 'pending') {
          list.push({
            userId: u.id,
            userName: u.name,
            userAvatar: u.avatar,
            date: l.date,
            dayNumber: l.dayNumber,
            doctorNotes: l.sickness.doctorNotes,
            medicalProofUrl: l.sickness.medicalProofUrl,
            medicalProofName: l.sickness.medicalProofName,
            submittedAt: l.updatedAt,
          });
        }
      });
    });

    return list;
  }, [users, allUsersLogs]);

  // DB Settings status
  const dbSettings = useMemo(() => {
    const creds = supabaseService.getCredentials();
    return {
      supabaseUrl: creds.url,
      hasKey: Boolean(creds.key),
      isConnected: supabaseService.isConfigured(),
    };
  }, []);

  // Reload all data
  const reloadData = useCallback(async () => {
    try {
      const [fetchedConfig, fetchedUsers, fetchedLogs] = await Promise.all([
        supabaseService.getConfig(),
        supabaseService.getUsers(),
        supabaseService.fetchAllLogs(),
      ]);

      if (fetchedConfig) setConfigState(fetchedConfig);
      if (fetchedUsers) setUsers(fetchedUsers);
      if (fetchedLogs) setAllUsersLogs(fetchedLogs);
    } catch (err) {
      console.warn('Error loading initial data:', err);
    }
  }, []);

  // Check saved session on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsLoadingSession(true);
      await reloadData();

      const savedUserId = localStorage.getItem(AUTH_STORAGE_KEY);
      if (savedUserId) {
        const allU = await supabaseService.getUsers();
        const found = allU.find(u => u.id === savedUserId);
        if (found) {
          setCurrentUser(found);
          if (found.role === 'admin') {
            setAdminOverrideMode(true);
          }
        }
      }
      setIsLoadingSession(false);
    };

    initAuth();
  }, [reloadData]);

  // 9 PM reminder
  useEffect(() => {
    setupDailyReminder(config.reminderTime, config.reminderEnabled);
  }, [config.reminderTime, config.reminderEnabled]);

  // Challenger Login
  const loginChallenger = async (usernameOrEmail: string, passwordOrPin: string) => {
    const res = await supabaseService.login(usernameOrEmail, passwordOrPin);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      localStorage.setItem(AUTH_STORAGE_KEY, res.user.id);
      await reloadData();
      return { success: true };
    }
    return { success: false, error: res.message || 'Invalid username or password.' };
  };

  // Admin Login
  const loginAdmin = async (passwordOrPin: string) => {
    const cleanSecret = passwordOrPin.trim();
    const adminPin = config.adminPin || '7575';
    const adminPass = config.adminPassword || 'admin7575';

    if (cleanSecret === adminPin || cleanSecret === adminPass) {
      const adminUser: UserProfile = {
        id: 'admin',
        username: 'admin',
        name: 'Referee / Admin',
        role: 'admin',
        avatar: '⚖️',
        color: 'from-purple-600 to-indigo-800',
        depositAmount: 0,
      };
      setCurrentUser(adminUser);
      localStorage.setItem(AUTH_STORAGE_KEY, 'admin');
      setAdminOverrideMode(true);
      await reloadData();
      return { success: true };
    }

    return { success: false, error: 'Invalid Admin Password or PIN.' };
  };

  // Logout
  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setCurrentUser(null);
    setAdminOverrideMode(false);
  };

  // Switch challenger view (if admin)
  const setCurrentUserId = (id: string) => {
    if (isAdmin) {
      const found = users.find(u => u.id === id);
      if (found) {
        setCurrentUser({ ...found, role: 'admin' }); // Keep admin privileges while previewing
      }
    }
  };

  // Current active date's log
  const currentLog = useMemo(() => {
    if (logs[currentDate]) {
      return logs[currentDate];
    }
    return createDefaultLog(currentDate, config, currentUser?.id || 'user_1');
  }, [logs, currentDate, config, currentUser]);

  // Update current date's log
  const updateCurrentLog = useCallback(
    async (updater: (prev: DailyLog) => DailyLog): Promise<boolean> => {
      if (!currentUser) return false;

      // Restrict challengers to editing today only!
      if (!isAdmin && !adminOverrideMode && currentDate !== todayStr) {
        alert('75 HARD Rule Violation: Incomplete days cannot be retro-filled! You can only edit TODAY.');
        return false;
      }

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

      // Update state
      setAllUsersLogs(prev => ({
        ...prev,
        [currentUser.id]: {
          ...(prev[currentUser.id] || {}),
          [currentDate]: updated,
        },
      }));

      // Persist to Supabase / Storage
      await supabaseService.saveLog(currentUser.id, updated);
      return true;
    },
    [currentUser, logs, currentDate, config, isAdmin, adminOverrideMode, todayStr]
  );

  // Admin: Update System Config
  const updateConfig = async (patch: Partial<ChallengeConfig>) => {
    const updated = { ...config, ...patch };
    setConfigState(updated);
    await supabaseService.saveConfig(updated);
  };

  // Admin: Add Challenger
  const adminAddUser = async (userData: {
    name: string;
    username: string;
    email?: string;
    password?: string;
    pin: string;
    avatar: string;
    depositAmount: number;
  }) => {
    const res = await supabaseService.createUser(userData);
    if (res.success && res.user) {
      setUsers(prev => [...prev, res.user!]);
      return { success: true };
    }
    return { success: false, error: res.message || 'Failed to add challenger.' };
  };

  // Admin: Reset Password for any challenger
  const adminResetPassword = async (userId: string, newPassword: string) => {
    const res = await supabaseService.updateUser(userId, { password: newPassword });
    if (res.success) {
      await reloadData();
      return { success: true, message: 'Password updated successfully!' };
    }
    return { success: false, message: res.message || 'Failed to update password.' };
  };

  // Admin: Delete Challenger
  const adminDeleteUser = async (id: string) => {
    const res = await supabaseService.deleteUser(id);
    if (res.success) {
      setUsers(prev => prev.filter(u => u.id !== id));
      return true;
    }
    return false;
  };

  // Admin: Time-Machine Override (Modify any past or future day)
  const adminUpdateLog = async (userId: string, dateStr: string, updater: (prev: DailyLog) => DailyLog) => {
    const userLogs = allUsersLogs[userId] || {};
    const existing = userLogs[dateStr] || createDefaultLog(dateStr, config, userId);
    const updated = updater(existing);

    updated.userId = userId;
    updated.id = `${userId}_${dateStr}`;
    updated.status = computeDayStatus(updated, config);
    const { failedNames } = validateDayTasks(updated, config);
    updated.failedTasks = failedNames;
    updated.updatedAt = new Date().toISOString();

    setAllUsersLogs(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [dateStr]: updated,
      },
    }));

    await supabaseService.saveLog(userId, updated);
  };

  // Admin: Approve Exception
  const approveException = async (userId: string, dateStr: string, comment?: string) => {
    await adminUpdateLog(userId, dateStr, prev => ({
      ...prev,
      status: 'exempt',
      sickness: {
        ...prev.sickness,
        isSick: true,
        isExempt: true,
        status: 'approved',
        reviewedBy: 'Admin',
        reviewedAt: new Date().toISOString(),
        adminComment: comment || 'Medical certificate verified and approved by Admin.',
      },
    }));
  };

  // Admin: Reject Exception
  const rejectException = async (userId: string, dateStr: string, comment?: string) => {
    await adminUpdateLog(userId, dateStr, prev => ({
      ...prev,
      sickness: {
        ...prev.sickness,
        isSick: true,
        isExempt: false,
        status: 'rejected',
        reviewedBy: 'Admin',
        reviewedAt: new Date().toISOString(),
        adminComment: comment || 'Medical proof rejected by Admin.',
      },
    }));
  };

  // Admin: Update DB Settings (Supabase)
  const updateDbSettings = async (settings: { supabaseUrl: string; supabaseAnonKey?: string }) => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
      return { success: false, message: 'URL and Key are required.' };
    }
    const res = await supabaseService.setCredentials(settings.supabaseUrl, settings.supabaseAnonKey);
    if (res.success) {
      await reloadData();
    }
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
    adminResetPassword,
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
    reloadData,
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
