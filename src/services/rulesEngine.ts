import {
  ChallengeConfig,
  DailyLog,
  DayStatus,
  StreakStats,
  TaskState,
  UserProfile,
  SquadDepositLedger,
  SquadDepositTransaction,
  ChallengerDepositBalance,
} from '../types';

export const DEFAULT_CONFIG: ChallengeConfig = {
  startDate: '2026-11-11',
  durationDays: 75,
  endDate: '2027-01-24',
  depositAmount: 2000,
  currencySymbol: '₹',
  wakeUpTarget: '06:00',
  wakeUpTravelTarget: '08:00',
  travelThresholdHours: 4,
  readingMinPages: 5,
  readingMaxPages: 10,
  stepsTarget: 10000,
  runTargetKm: 3.0,
  floorsTarget: 20,
  travelSubstituteSteps: 15000,
  travelSubstituteRunKm: 5.0,
  familyTargetMinutes: 10,
  reminderTime: '21:00',
  reminderEnabled: true,
  strictResetOnMiss: true,
  lockPastDays: true,
  adminPin: '7575',
  requireLogin: false,
  autoSyncSupabase: false,
};

/**
 * Format a Date to YYYY-MM-DD using local time
 */
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD string to local Date object at 00:00:00
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Get difference in calendar days between two dates
 */
export function getDaysDiff(fromStr: string, toStr: string): number {
  const d1 = parseDate(fromStr);
  const d2 = parseDate(toStr);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate Day X of 75 for a given date
 */
export function getDayNumber(dateStr: string, startDateStr: string = DEFAULT_CONFIG.startDate): number {
  return getDaysDiff(startDateStr, dateStr) + 1;
}

/**
 * Check if dateStr is today's local date
 */
export function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

/**
 * Strictly check if a date is editable:
 * 75 HARD rule: Edits are ONLY allowed for TODAY for challengers!
 * Admin has override authority to edit past and future days.
 */
export function isDateEditable(dateStr: string, config: ChallengeConfig = DEFAULT_CONFIG, isAdmin: boolean = false): boolean {
  if (isAdmin) return true; // Admin has power override!
  if (!config.lockPastDays) return true;
  return dateStr === formatDate(new Date());
}

/**
 * Check if dateStr is in the past compared to today
 */
export function isPastDate(dateStr: string): boolean {
  const todayStr = formatDate(new Date());
  return dateStr < todayStr;
}

/**
 * Generate default empty task state for a date
 */
export function createDefaultTasks(config: ChallengeConfig = DEFAULT_CONFIG): TaskState {
  return {
    wakeUp: {
      completed: false,
      actualTime: '',
      effectiveTarget: config.wakeUpTarget,
    },
    noMasturbation: { completed: false },
    noSmokingAlcohol: { completed: false },
    reading: {
      completed: false,
      pagesRead: 0,
      bookTitle: '',
      keyTakeaway: '',
    },
    gym: {
      completed: false,
      isSubstituted: false,
      substituteType: 'steps',
      substituteValue: 0,
      workoutNotes: '',
    },
    physicalActivity: {
      completed: false,
      type: 'steps',
      value: 0,
    },
    diet: {
      completed: false,
      cleanDietChecked: false,
      notes: '',
    },
    progressPhoto: {
      completed: false,
      photoUrl: '',
    },
    learning: {
      completed: false,
      topic: '',
      notes: '',
    },
    health: {
      completed: false,
      waterLiters: 0,
      mentalHealthMaintained: false,
      notes: '',
    },
    family: {
      completed: false,
      minutes: 0,
      notes: '',
    },
  };
}

/**
 * Create default log for a specific date and user
 */
export function createDefaultLog(
  dateStr: string,
  config: ChallengeConfig = DEFAULT_CONFIG,
  userId: string = 'user_1'
): DailyLog {
  const dayNum = getDayNumber(dateStr, config.startDate);
  const todayStr = formatDate(new Date());
  let status: DayStatus = 'future';

  if (dateStr < todayStr) {
    status = 'incomplete';
  } else if (dateStr === todayStr) {
    status = 'incomplete';
  }

  return {
    id: `${userId}_${dateStr}`,
    date: dateStr,
    userId,
    dayNumber: dayNum,
    travel: {
      isTravelling: false,
      hours: 0,
      gymAvailable: true,
      destination: '',
      notes: '',
    },
    sickness: {
      isSick: false,
      hasMedicalProof: false,
      medicalProofUrl: '',
      doctorNotes: '',
      isExempt: false,
      status: 'none',
    },
    tasks: createDefaultTasks(config),
    sport: {
      participated: false,
      sportName: '',
      durationMinutes: 0,
      improvementNotes: '',
    },
    journalNotes: '',
    status,
    failedTasks: [],
    isLocked: dateStr < todayStr,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Determine dynamic wake up target:
 * Travel > 4 hours gives exemption to 8:00 AM instead of 6:00 AM.
 */
export function getEffectiveWakeUpTarget(travelHours: number, isTravelling: boolean, config: ChallengeConfig): string {
  if (isTravelling && travelHours > config.travelThresholdHours) {
    return config.wakeUpTravelTarget; // '08:00'
  }
  return config.wakeUpTarget; // '06:00'
}

/**
 * Evaluates whether Gym is satisfied:
 * - If normal: workout completed = true.
 * - If travel > 4h AND gym unavailable: substitute with 15k steps OR 5km run.
 */
export function evaluateGymCompletion(
  gym: TaskState['gym'],
  travel: DailyLog['travel'],
  config: ChallengeConfig
): { satisfied: boolean; isSubstituted: boolean; reason: string } {
  // If travel > 4h and gym not available
  if (travel.isTravelling && travel.hours > config.travelThresholdHours && !travel.gymAvailable) {
    const isStepSubMet = gym.substituteType === 'steps' && (gym.substituteValue || 0) >= config.travelSubstituteSteps;
    const isRunSubMet = gym.substituteType === 'run' && (gym.substituteValue || 0) >= config.travelSubstituteRunKm;

    if (gym.completed || isStepSubMet || isRunSubMet) {
      return {
        satisfied: true,
        isSubstituted: true,
        reason: `Substituted with ${gym.substituteType === 'steps' ? `${gym.substituteValue} steps (req. ${config.travelSubstituteSteps})` : `${gym.substituteValue} km run (req. ${config.travelSubstituteRunKm} km)`}`,
      };
    }
    return {
      satisfied: false,
      isSubstituted: true,
      reason: `Travel substitute required: 15,000 steps OR 5 KM run (Gym unavailable due to travel)`,
    };
  }

  // Normal gym rule
  return {
    satisfied: gym.completed,
    isSubstituted: false,
    reason: gym.completed ? 'Gym workout completed' : 'Gym workout required',
  };
}

/**
 * Evaluates Physical Activity completion:
 * Target: 10K steps OR 3K run/walk OR 20 floors
 */
export function evaluatePhysicalActivity(
  pa: TaskState['physicalActivity'],
  config: ChallengeConfig
): { satisfied: boolean; reason: string } {
  if (pa.type === 'steps' && pa.value >= config.stepsTarget) {
    return { satisfied: true, reason: `${pa.value.toLocaleString()} / ${config.stepsTarget.toLocaleString()} steps` };
  }
  if (pa.type === 'run' && pa.value >= config.runTargetKm) {
    return { satisfied: true, reason: `${pa.value} / ${config.runTargetKm} KM run/walk` };
  }
  if (pa.type === 'floors' && pa.value >= config.floorsTarget) {
    return { satisfied: true, reason: `${pa.value} / ${config.floorsTarget} floors stairs` };
  }
  return {
    satisfied: false,
    reason: `Target: ${config.stepsTarget.toLocaleString()} steps OR ${config.runTargetKm} KM run OR ${config.floorsTarget} floors`,
  };
}

export interface TaskValidationItem {
  id: keyof TaskState;
  title: string;
  isCompleted: boolean;
  requirementDesc: string;
}

/**
 * Check all 11 required habits for a given day log against configured rules
 */
export function validateDayTasks(log: DailyLog, config: ChallengeConfig): {
  items: TaskValidationItem[];
  allCompleted: boolean;
  completedCount: number;
  totalCount: number;
  failedNames: string[];
} {
  const { tasks, travel } = log;
  const effectiveWakeTarget = getEffectiveWakeUpTarget(travel.hours, travel.isTravelling, config);
  const gymEval = evaluateGymCompletion(tasks.gym, travel, config);
  const paEval = evaluatePhysicalActivity(tasks.physicalActivity, config);

  // 1. Wake Up
  const wakeUpValid = tasks.wakeUp.completed && (
    !tasks.wakeUp.actualTime || tasks.wakeUp.actualTime <= effectiveWakeTarget
  );

  // 2. No Masturbation
  const noMasturbationValid = tasks.noMasturbation.completed;

  // 3. No Smoking / Alcohol
  const noSmokingAlcoholValid = tasks.noSmokingAlcohol.completed;

  // 4. Reading
  const readingValid = tasks.reading.completed || tasks.reading.pagesRead >= config.readingMinPages;

  // 5. Gym
  const gymValid = gymEval.satisfied;

  // 6. Physical Activity
  const paValid = tasks.physicalActivity.completed || paEval.satisfied;

  // 7. Diet
  const dietValid = tasks.diet.completed && tasks.diet.cleanDietChecked;

  // 8. Progress Photo
  const photoValid = tasks.progressPhoto.completed && Boolean(tasks.progressPhoto.photoUrl && tasks.progressPhoto.photoUrl.trim().length > 0);

  // 9. Learning
  const learningValid = tasks.learning.completed;

  // 10. Health
  const healthValid = tasks.health.completed && tasks.health.mentalHealthMaintained;

  // 11. Family
  const familyValid = tasks.family.completed || tasks.family.minutes >= config.familyTargetMinutes;

  const items: TaskValidationItem[] = [
    {
      id: 'wakeUp',
      title: 'Wake Up',
      isCompleted: wakeUpValid,
      requirementDesc: `By ${effectiveWakeTarget} AM${travel.isTravelling && travel.hours > 4 ? ' (Travel >4h exemption)' : ''}`,
    },
    {
      id: 'noMasturbation',
      title: 'No Masturbation',
      isCompleted: noMasturbationValid,
      requirementDesc: 'Strict discipline',
    },
    {
      id: 'noSmokingAlcohol',
      title: 'No Smoking / Alcohol',
      isCompleted: noSmokingAlcoholValid,
      requirementDesc: 'Zero tolerance',
    },
    {
      id: 'reading',
      title: 'Reading',
      isCompleted: readingValid,
      requirementDesc: `${config.readingMinPages}–${config.readingMaxPages} pages non-fiction/growth`,
    },
    {
      id: 'gym',
      title: 'Gym Workout',
      isCompleted: gymValid,
      requirementDesc: gymEval.isSubstituted
        ? 'Travel Sub: 15K steps OR 5 KM run'
        : 'Daily dedicated workout',
    },
    {
      id: 'physicalActivity',
      title: 'Physical Activity',
      isCompleted: paValid,
      requirementDesc: `${(config.stepsTarget / 1000).toFixed(0)}K steps / ${config.runTargetKm}K run / ${config.floorsTarget} floors`,
    },
    {
      id: 'diet',
      title: 'Clean Diet',
      isCompleted: dietValid,
      requirementDesc: 'No added sugar, low oil, no junk',
    },
    {
      id: 'progressPhoto',
      title: 'Daily Progress Photo',
      isCompleted: photoValid,
      requirementDesc: '1 full body progress picture',
    },
    {
      id: 'learning',
      title: 'Learn Something New',
      isCompleted: learningValid,
      requirementDesc: 'Daily knowledge / skill acquisition',
    },
    {
      id: 'health',
      title: 'Physical & Mental Health',
      isCompleted: healthValid,
      requirementDesc: 'Maintain mental clarity & physical care',
    },
    {
      id: 'family',
      title: 'Family Time',
      isCompleted: familyValid,
      requirementDesc: `${config.familyTargetMinutes} minutes quality connection`,
    },
  ];

  const completedCount = items.filter(i => i.isCompleted).length;
  const totalCount = items.length;
  const allCompleted = completedCount === totalCount;
  const failedNames = items.filter(i => !i.isCompleted).map(i => i.title);

  return {
    items,
    allCompleted,
    completedCount,
    totalCount,
    failedNames,
  };
}

/**
 * Determine a day's final status based on date, tasks, and sickness
 */
export function computeDayStatus(log: DailyLog, config: ChallengeConfig): DayStatus {
  // Sickness condition:
  // "At home: No exceptions. Genuine sickness: Exception allowed with valid medical proof."
  if (log.sickness.isSick && log.sickness.hasMedicalProof && log.sickness.isExempt) {
    return 'exempt';
  }

  const { allCompleted } = validateDayTasks(log, config);
  const todayStr = formatDate(new Date());

  if (allCompleted) {
    return 'completed';
  }

  if (log.date > todayStr) {
    return 'future';
  }

  return 'incomplete';
}

/**
 * Calculates current streak, longest streak, and strict 75-Hard resets.
 * 75 Hard rule: If any non-exempt day prior to today (or completed today) failed to complete all tasks,
 * count resets to 0!
 */
export function calculateStreakStats(
  logs: Record<string, DailyLog>,
  config: ChallengeConfig = DEFAULT_CONFIG,
  userId: string = 'user_1'
): StreakStats {
  const todayStr = formatDate(new Date());
  const startD = parseDate(config.startDate);
  const totalDays = config.durationDays;

  let currentStreak = 0;
  let longestStreak = 0;
  let resetsCount = 0;
  let totalCompletedDays = 0;
  let totalExemptDays = 0;
  let totalFailedDays = 0;
  let lastResetDate: string | undefined = undefined;

  // We iterate day by day from startDate for durationDays
  for (let i = 0; i < totalDays; i++) {
    const curDate = new Date(startD);
    curDate.setDate(curDate.getDate() + i);
    const dateStr = formatDate(curDate);

    // If future date, stop streak calculation for today's active streak
    if (dateStr > todayStr) {
      break;
    }

    const log = logs[dateStr] || createDefaultLog(dateStr, config, userId);
    const status = computeDayStatus(log, config);

    if (dateStr === todayStr) {
      // Today: if completed, streak increments. If incomplete so far, streak holds current value
      if (status === 'completed' || status === 'exempt') {
        currentStreak++;
        if (status === 'completed') totalCompletedDays++;
        if (status === 'exempt') totalExemptDays++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      }
      // If incomplete today, streak doesn't reset until today has ended (midnight)
      break;
    }

    // Past days (strictly evaluated)
    if (status === 'completed') {
      currentStreak++;
      totalCompletedDays++;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else if (status === 'exempt') {
      // Sickness exemption maintains streak!
      currentStreak++;
      totalExemptDays++;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else {
      // Missed / Incomplete day in the past -> RESET TO 0!
      totalFailedDays++;
      if (config.strictResetOnMiss && currentStreak > 0) {
        resetsCount++;
        lastResetDate = dateStr;
      }
      currentStreak = 0; // Strict 75-Hard reset!
    }
  }

  // Deposit Status calculation
  const depositStatus: 'safe' | 'forfeited' | 'at_risk' =
    resetsCount > 0 ? 'forfeited' : (totalFailedDays > 0 ? 'forfeited' : 'safe');

  const depositForfeitedAmount = resetsCount > 0 ? config.depositAmount : 0;
  const depositProtectedAmount = resetsCount === 0 ? config.depositAmount : 0;

  const currentDayNum = Math.max(1, Math.min(totalDays, getDayNumber(todayStr, config.startDate)));
  const completionRate = Math.min(100, Math.round(((totalCompletedDays + totalExemptDays) / totalDays) * 100));

  return {
    currentStreak,
    longestStreak,
    resetsCount,
    depositStatus,
    depositForfeitedAmount,
    depositProtectedAmount,
    lastResetDate,
    totalCompletedDays,
    totalExemptDays,
    totalFailedDays,
    completionRate,
    currentDayNumber: currentDayNum,
  };
}

/**
 * Peer-Accountability Deposit Transfer Engine
 * Rules:
 * - When 1 person misses any task on a day: ₹200 deducted from them, ₹100 added to each of the 2 survivors.
 * - When 2 persons miss on a day: ₹200 deducted from each (₹400 total), ₹400 added to the 1 survivor.
 * - When all miss: don't change anything.
 * - When none miss: don't change anything.
 * Total squad pool remains constant (e.g. ₹6,000 for 3 challengers).
 */
export function calculateSquadDepositLedger(
  allUsersLogs: Record<string, Record<string, DailyLog>>,
  users: UserProfile[],
  config: ChallengeConfig
): SquadDepositLedger {
  const challengers = users.filter(u => u.role !== 'admin');
  const balances: Record<string, ChallengerDepositBalance> = {};
  const PENALTY_PER_MISSER = 200;

  challengers.forEach(u => {
    const init = u.depositAmount !== undefined ? u.depositAmount : config.depositAmount;
    balances[u.id] = {
      userId: u.id,
      name: u.name,
      avatar: u.avatar,
      initialDeposit: init,
      currentDeposit: init,
      netChange: 0,
      penaltiesPaid: 0,
      bountiesEarned: 0,
      missCount: 0,
      status: 'safe',
    };
  });

  const transactions: SquadDepositTransaction[] = [];
  const startD = parseDate(config.startDate);
  const todayStr = formatDate(new Date());

  // Evaluate past days from startDate up to yesterday
  for (let i = 0; i < config.durationDays; i++) {
    const d = new Date(startD);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d);

    // Stop if day is today or in the future
    if (dateStr >= todayStr) break;

    const missers: Array<{ id: string; name: string; avatar: string }> = [];
    const survivors: Array<{ id: string; name: string; avatar: string }> = [];

    challengers.forEach(u => {
      const userLogs = allUsersLogs[u.id] || {};
      const log = userLogs[dateStr] || createDefaultLog(dateStr, config, u.id);
      const status = computeDayStatus(log, config);

      if (status === 'completed' || status === 'exempt') {
        survivors.push({ id: u.id, name: u.name, avatar: u.avatar });
      } else {
        missers.push({ id: u.id, name: u.name, avatar: u.avatar });
      }
    });

    // When someone misses and someone survives:
    if (missers.length > 0 && survivors.length > 0 && missers.length < challengers.length) {
      const totalDeducted = missers.length * PENALTY_PER_MISSER;
      const awardedPerSurvivor = Math.floor(totalDeducted / survivors.length);

      // Deduct ₹200 from each misser
      missers.forEach(m => {
        if (balances[m.id]) {
          balances[m.id].currentDeposit -= PENALTY_PER_MISSER;
          balances[m.id].penaltiesPaid += PENALTY_PER_MISSER;
          balances[m.id].missCount += 1;
        }
      });

      // Award to survivors
      survivors.forEach(s => {
        if (balances[s.id]) {
          balances[s.id].currentDeposit += awardedPerSurvivor;
          balances[s.id].bountiesEarned += awardedPerSurvivor;
        }
      });

      const desc =
        missers.length === 1 && survivors.length === 2
          ? `${missers[0].name} missed Day ${i + 1}: ₹200 deducted (-₹200) → ₹100 added to ${survivors[0].name} & ₹100 added to ${survivors[1].name}`
          : missers.length === 2 && survivors.length === 1
          ? `${missers[0].name} & ${missers[1].name} missed Day ${i + 1}: ₹200 deducted each (-₹400) → ₹400 added to ${survivors[0].name}`
          : `${missers.map(m => m.name).join(', ')} missed Day ${i + 1}: ₹${totalDeducted} transferred to survivors (+₹${awardedPerSurvivor} each)`;

      transactions.push({
        date: dateStr,
        dayNumber: i + 1,
        missers,
        survivors,
        deductedPerMisser: PENALTY_PER_MISSER,
        awardedPerSurvivor,
        totalTransferred: totalDeducted,
        description: desc,
      });
    }
  }

  // Finalize balances
  let totalPool = 0;
  Object.values(balances).forEach(b => {
    b.netChange = b.currentDeposit - b.initialDeposit;
    if (b.netChange > 0) b.status = 'profited';
    else if (b.netChange < 0) b.status = 'deducted';
    else b.status = 'safe';
    totalPool += b.currentDeposit;
  });

  return {
    balances,
    transactions: transactions.reverse(), // latest first
    totalPool,
  };
}
