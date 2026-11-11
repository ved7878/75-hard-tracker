import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  ChallengeConfig,
  DailyLog,
  StreakStats,
  UserProfile,
  SquadMemberStatus,
  PendingExceptionItem,
  SquadDepositLedger,
} from '../types';
import {
  DEFAULT_CONFIG,
  createDefaultLog,
  formatDate,
  calculateStreakStats,
  computeDayStatus,
  validateDayTasks,
  isDateEditable,
  calculateSquadDepositLedger,
  getDayNumber,
  normalizeConfig,
  isWakeUpCheckInOpen,
  currentTimeHHMM,
} from '../services/rulesEngine';
import { supabaseService } from '../services/supabaseService';
import { sound } from '../services/audio';
import { setupDailyReminder, getReminderPrefs } from '../services/notifications';

interface ChallengeContextType {
  config: ChallengeConfig;
  updateConfig: (patch: Partial<ChallengeConfig>) => Promise<{ success: boolean; message?: string }>;
  // Auth & Multi-user
  currentUser: UserProfile | null;
  users: UserProfile[];
  isAdmin: boolean;
  adminOverrideMode: boolean;
  setAdminOverrideMode: (val: boolean) => void;
  login: (usernameOrEmail: string, passwordOrPin: string) => Promise<{ success: boolean; error?: string }>;
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
  depositLedger: SquadDepositLedger;
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
  const [rawLogs, setAllUsersLogs] = useState<Record<string, Record<string, DailyLog>>>({});
  const [currentDate, setCurrentDate] = useState<string>(() => formatDate(new Date()));
  const [adminOverrideMode, setAdminOverrideMode] = useState<boolean>(false);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  // The account that actually signed in (currentUser changes while the referee previews someone)
  const signedInUserRef = useRef<UserProfile | null>(null);

  // Always-current copy of the logs, so async callers (photo uploads, quick double taps)
  // build on the latest data instead of the snapshot from when they started.
  const rawLogsRef = useRef(rawLogs);
  rawLogsRef.current = rawLogs;
  const setLogsNow = (updater: (prev: Record<string, Record<string, DailyLog>>) => Record<string, Record<string, DailyLog>>) => {
    rawLogsRef.current = updater(rawLogsRef.current);
    setAllUsersLogs(rawLogsRef.current);
  };

  // Calendar day tick: the app can stay open (or sit in the background) past midnight.
  // Without this, "today" stays stuck on yesterday – edits land on the wrong day and the
  // morning wake-up check-in shows as closed.
  const [todayStr, setTodayStr] = useState<string>(() => formatDate(new Date()));
  const todayRef = useRef(todayStr);
  useEffect(() => {
    const tick = () => {
      const now = formatDate(new Date());
      if (now !== todayRef.current) {
        const previous = todayRef.current;
        todayRef.current = now;
        setTodayStr(now);
        // Move forward only if the user was looking at "today" (don't yank them off a past day)
        setCurrentDate(d => (d === previous ? now : d));
      }
    };
    const id = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, []);

  const isTodayDate = currentDate === todayStr;
  const isAdmin = currentUser?.role === 'admin';
  const isEditable = isDateEditable(currentDate, config, isAdmin || adminOverrideMode);

  // Day numbers stored inside logs were computed with whatever start date was active when the
  // log was written. Always recompute them from the CURRENT start date so changing the start
  // date in the admin panel is reflected everywhere immediately.
  const allUsersLogs = useMemo(() => {
    const out: Record<string, Record<string, DailyLog>> = {};
    Object.entries(rawLogs).forEach(([uid, uLogs]) => {
      const fixed: Record<string, DailyLog> = {};
      Object.entries(uLogs || {}).forEach(([date, log]) => {
        fixed[date] = { ...log, dayNumber: getDayNumber(log.date || date, config.startDate) };
      });
      out[uid] = fixed;
    });
    return out;
  }, [rawLogs, config.startDate]);

  // Push queued cloud saves when the app goes to the background / tab closes
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') supabaseService.flushPendingSaves();
      // Coming back to the app: pull the latest data so the referee's approvals/edits
      // aren't overwritten by this phone's stale copy on the next save.
      else if (document.visibilityState === 'visible') reloadDataRef.current?.();
    };
    const onPageHide = () => supabaseService.flushPendingSaves();
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  // Active user's logs
  const logs = useMemo(() => {
    if (!currentUser) return {};
    return allUsersLogs[currentUser.id] || {};
  }, [allUsersLogs, currentUser]);

  // Squad Deposit & Penalty Transfer Ledger
  const depositLedger = useMemo<SquadDepositLedger>(() => {
    return calculateSquadDepositLedger(allUsersLogs, users, config);
  }, [allUsersLogs, users, config]);

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
      const balanceInfo = depositLedger.balances[u.id];

      return {
        user: u,
        todayCompletedCount: completedCount,
        todayTotalCount: totalCount,
        todayAllCompleted: allCompleted,
        currentStreak: streakStats.currentStreak,
        depositStatus: streakStats.depositStatus,
        hasPendingException: hasPending,
        depositAmount: u.depositAmount !== undefined ? u.depositAmount : config.depositAmount,
        currentDeposit: balanceInfo?.currentDeposit ?? (u.depositAmount !== undefined ? u.depositAmount : config.depositAmount),
        netDepositChange: balanceInfo?.netChange ?? 0,
      };
    });
  }, [users, allUsersLogs, todayStr, config, depositLedger]);

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

      if (fetchedConfig) setConfigState(normalizeConfig(fetchedConfig));
      if (fetchedUsers) setUsers(fetchedUsers);
      if (fetchedLogs) setLogsNow(() => fetchedLogs);
    } catch (err) {
      console.warn('Error loading initial data:', err);
    }
  }, []);

  // Throttled refresh used when the app returns to the foreground
  const lastReloadRef = useRef(0);
  const reloadDataRef = useRef<() => void>();
  reloadDataRef.current = () => {
    if (Date.now() - lastReloadRef.current < 15_000) return;
    lastReloadRef.current = Date.now();
    reloadData();
  };

  // Check saved session on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsLoadingSession(true);

      if (supabaseService.isConfigured()) {
        // Cloud: the database checks the stored session token – a hand-edited
        // localStorage value can't sign anyone in.
        const res = await supabaseService.restoreSession();
        if (res.status === 'signed-out') {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } else {
          signedInUserRef.current = res.user;
          setCurrentUser(res.user);
          localStorage.setItem(AUTH_STORAGE_KEY, res.user.id);
          if (res.user.role === 'admin') setAdminOverrideMode(true);
        }
        await reloadData();
      } else {
        // Local single-device mode
        await reloadData();
        const savedUserId = localStorage.getItem(AUTH_STORAGE_KEY);
        if (savedUserId) {
          const allU = await supabaseService.getUsers();
          const found = allU.find(u => u.id === savedUserId);
          if (found) {
            signedInUserRef.current = found;
            setCurrentUser(found);
            if (found.role === 'admin') setAdminOverrideMode(true);
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      }
      setIsLoadingSession(false);
    };

    initAuth();
  }, [reloadData]);

  // 9 PM reminder
  useEffect(() => {
    const prefs = getReminderPrefs({ enabled: config.reminderEnabled, time: config.reminderTime });
    setupDailyReminder(prefs.time, prefs.enabled);
  }, [config.reminderTime, config.reminderEnabled]);

  // Unified login for challengers and the referee. In cloud mode the database checks the
  // password / PIN (they never reach the browser); there are no built-in admin credentials.
  const login = async (usernameOrEmail: string, passwordOrPin: string) => {
    const res = await supabaseService.login(usernameOrEmail.trim().toLowerCase(), passwordOrPin.trim());
    if (res.success && res.user) {
      signedInUserRef.current = res.user;
      setCurrentUser(res.user);
      localStorage.setItem(AUTH_STORAGE_KEY, res.user.id);
      setAdminOverrideMode(res.user.role === 'admin');
      await reloadData();
      return { success: true };
    }
    return { success: false, error: res.message || 'Invalid username, password, or PIN.' };
  };

  // Challenger Login (alias to unified login)
  const loginChallenger = async (usernameOrEmail: string, passwordOrPin: string) => {
    return login(usernameOrEmail, passwordOrPin);
  };

  // Admin Login
  const loginAdmin = async (passwordOrPin: string) => {
    return login('admin', passwordOrPin);
  };

  // Logout
  const logout = () => {
    supabaseService.flushPendingSaves();
    supabaseService.logout(); // revokes the session token on the server
    signedInUserRef.current = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setCurrentUser(null);
    setAdminOverrideMode(false);
  };

  // If the signed-in challenger (or the one the admin is previewing) gets removed from the
  // squad, don't keep editing a profile that no longer exists.
  useEffect(() => {
    if (!currentUser || currentUser.id === 'admin' || users.length === 0) return;
    if (users.some(u => u.id === currentUser.id)) return;
    if (signedInUserRef.current?.role === 'admin') {
      // Referee was previewing the removed challenger – go back to the referee's own view
      setCurrentUser(signedInUserRef.current);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setCurrentUser(null);
      setAdminOverrideMode(false);
    }
  }, [users, currentUser]);

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
      if (!isEditable) {
        return false;
      }

      // Read the LATEST log (not this render's snapshot): a photo upload that finishes after
      // the user ticked other habits must not wipe those ticks.
      const existing =
        rawLogsRef.current[currentUser.id]?.[currentDate] || createDefaultLog(currentDate, config, currentUser.id);
      const before = validateDayTasks(existing, config);
      const updated = updater(existing);

      // Wake-up check-in window: challengers can only check in until target + buffer
      // (e.g. 6:10 AM), and the time recorded is the real clock time – not a typed one.
      // After the window closes, only the admin can change the wake-up habit.
      if (!isAdmin && JSON.stringify(existing.tasks.wakeUp) !== JSON.stringify(updated.tasks.wakeUp)) {
        if (!isWakeUpCheckInOpen(updated, config)) {
          updated.tasks = { ...updated.tasks, wakeUp: existing.tasks.wakeUp };
        } else if (updated.tasks.wakeUp.completed) {
          updated.tasks = { ...updated.tasks, wakeUp: { ...updated.tasks.wakeUp, actualTime: currentTimeHHMM() } };
        } else {
          updated.tasks = { ...updated.tasks, wakeUp: { ...updated.tasks.wakeUp, actualTime: '' } };
        }
      }

      updated.userId = currentUser.id;
      updated.id = `${currentUser.id}_${currentDate}`;
      updated.dayNumber = getDayNumber(currentDate, config.startDate);
      updated.status = computeDayStatus(updated, config);
      const { failedNames, allCompleted, completedCount } = validateDayTasks(updated, config);
      updated.failedTasks = allCompleted ? [] : failedNames;

      // Feedback only when progress actually changes (not on every keystroke)
      if (allCompleted && !before.allCompleted) {
        if (!updated.completedAt) updated.completedAt = new Date().toISOString();
        sound.playDayComplete();
        try {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ['#f43f5e', '#10b981', '#f59e0b', '#ffffff'] });
        } catch (e) {}
      } else if (completedCount > before.completedCount) {
        sound.playTaskCheck();
      }
      updated.updatedAt = new Date().toISOString();

      // Update state
      setLogsNow(prev => ({
        ...prev,
        [currentUser.id]: {
          ...(prev[currentUser.id] || {}),
          [currentDate]: updated,
        },
      }));

      // Persist locally now, cloud write is batched
      supabaseService.saveLogDebounced(currentUser.id, updated);
      return true;
    },
    [currentUser, currentDate, config, isEditable, isAdmin]
  );

  // Admin: Update System Config
  const updateConfig = async (patch: Partial<ChallengeConfig>) => {
    const updated = normalizeConfig({ ...config, ...patch });
    setConfigState(updated);
    return supabaseService.saveConfig(updated);
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
    // A debounced save still queued for this day (e.g. notes typed a moment ago) would
    // fire after this one and undo the admin's change – drop it, we save the merged log now.
    supabaseService.cancelPendingSave(userId, dateStr);
    const existing = rawLogsRef.current[userId]?.[dateStr] || createDefaultLog(dateStr, config, userId);
    const updated = updater(existing);

    updated.userId = userId;
    updated.id = `${userId}_${dateStr}`;
    updated.dayNumber = getDayNumber(dateStr, config.startDate);
    updated.status = computeDayStatus(updated, config);
    const { failedNames } = validateDayTasks(updated, config);
    updated.failedTasks = failedNames;
    updated.updatedAt = new Date().toISOString();

    setLogsNow(prev => ({
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
        // The referee has verified it – without this flag the day is still scored as a miss
        hasMedicalProof: true,
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
    login,
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
    depositLedger,
    isEditable,
    isToday: isTodayDate,
    celebrateCompletion,
    setCurrentUserId,
    reloadData,
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-[100dvh] bg-ink-950 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center font-black text-lg mx-auto animate-pulse">
            75
          </div>
          <p className="text-sm font-medium text-slate-400">Loading your challenge…</p>
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
