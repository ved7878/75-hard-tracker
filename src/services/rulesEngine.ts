import type {
  ActivityType,
  ChallengeConfig,
  DailyLog,
  DayStatus,
  HabitConfig,
  StreakStats,
  TaskState,
  UserProfile,
  SquadDepositLedger,
  SquadDepositTransaction,
  ChallengerDepositBalance,
} from '../types/index.ts';

export const DEFAULT_HABITS: HabitConfig[] = [
  { id: 'wakeUp', name: 'Wake Up', description: 'Early morning discipline', enabled: true, required: true, category: 'core', targetType: 'checkbox', icon: 'AlarmClock' },
  { id: 'noMasturbation', name: 'No Masturbation', description: 'Strict discipline', enabled: true, required: true, category: 'core', targetType: 'checkbox', icon: 'Ban' },
  { id: 'noSmokingAlcohol', name: 'No Smoking / Alcohol', description: 'Zero tolerance', enabled: true, required: true, category: 'core', targetType: 'checkbox', icon: 'WineOff' },
  { id: 'reading', name: 'Reading', description: '5–10 pages, non-fiction', enabled: true, required: true, category: 'core', targetType: 'number', targetValue: 5, targetUnit: 'pages', icon: 'BookOpen' },
  { id: 'gym', name: 'Gym Workout', description: 'Daily dedicated workout', enabled: true, required: true, category: 'core', targetType: 'checkbox', icon: 'Dumbbell' },
  { id: 'physicalActivity', name: 'Physical Activity', description: '10K steps / 3 km / 20 floors', enabled: true, required: true, category: 'core', targetType: 'checkbox', icon: 'Footprints' },
  { id: 'diet', name: 'Clean Diet', description: 'No sugar, junk or excess oil', enabled: true, required: true, category: 'core', targetType: 'checkbox', icon: 'Salad' },
  { id: 'progressPhoto', name: 'Daily Progress Photo', description: 'One full-body picture', enabled: true, required: true, category: 'core', targetType: 'checkbox', icon: 'Camera' },
  { id: 'learning', name: 'Learn Something', description: 'One new skill or idea', enabled: true, required: true, category: 'core', targetType: 'text', icon: 'GraduationCap' },
  { id: 'health', name: 'Health & Mind', description: 'Water, rest, calm mind', enabled: true, required: true, category: 'core', targetType: 'checkbox', icon: 'HeartPulse' },
  { id: 'family', name: 'Family Time', description: '10 min quality time', enabled: true, required: true, category: 'core', targetType: 'number', targetValue: 10, targetUnit: 'mins', icon: 'Users' },
];

export const DEFAULT_CONFIG: ChallengeConfig = {
  startDate: '2026-11-11',
  durationDays: 75,
  endDate: '2027-01-24',
  depositAmount: 2000,
  currencySymbol: '₹',
  penaltyEnabled: true,
  habits: DEFAULT_HABITS,
  wakeUpTarget: '06:00',
  wakeUpTravelTarget: '08:00',
  wakeUpGraceMinutes: 10,
  travelThresholdHours: 4,
  readingMinPages: 5,
  readingMaxPages: 10,
  stepsTarget: 10000,
  runTargetKm: 3.0,
  floorsTarget: 20,
  travelSubstituteSteps: 15000,
  travelSubstituteRunKm: 5.0,
  travelSubstituteFloors: 30,
  familyTargetMinutes: 10,
  calorieTarget: 2200,
  proteinTargetG: 120,
  reminderTime: '21:00',
  reminderEnabled: true,
  strictResetOnMiss: true,
  lockPastDays: true,
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
 * Add N calendar days to a YYYY-MM-DD string
 */
export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * The end date is always derived from start date + duration, so it can never drift
 * out of sync when the admin changes the start date.
 */
export function getEndDate(startDate: string, durationDays: number): string {
  return addDays(startDate, Math.max(1, durationDays) - 1);
}

/**
 * Normalise a config loaded from storage / cloud: guarantees a valid start date and
 * recomputes the end date from start + duration.
 */
export function normalizeConfig(config: Partial<ChallengeConfig>): ChallengeConfig {
  const merged: ChallengeConfig = { ...DEFAULT_CONFIG, ...config };
  // Never keep credentials in the rules config: it is readable by everyone and cached on every phone
  delete merged.adminPin;
  delete merged.adminPassword;
  delete merged.recoveryKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(merged.startDate || '')) {
    merged.startDate = DEFAULT_CONFIG.startDate;
  }
  merged.durationDays = Number(merged.durationDays) > 0 ? Number(merged.durationDays) : DEFAULT_CONFIG.durationDays;
  merged.endDate = getEndDate(merged.startDate, merged.durationDays);

  // A cleared time box ('') would make the wake-up deadline "NaN:NaN" (always open)
  (['wakeUpTarget', 'wakeUpTravelTarget', 'reminderTime'] as const).forEach(k => {
    if (!/^\d{1,2}:\d{2}$/.test(String(merged[k] || ''))) merged[k] = DEFAULT_CONFIG[k];
  });

  // Targets must be positive numbers – a cleared/0/negative box would let everyone pass
  (
    [
      'readingMinPages',
      'readingMaxPages',
      'stepsTarget',
      'runTargetKm',
      'floorsTarget',
      'travelSubstituteSteps',
      'travelSubstituteRunKm',
      'travelSubstituteFloors',
      'familyTargetMinutes',
      'travelThresholdHours',
      'calorieTarget',
      'proteinTargetG',
    ] as const
  ).forEach(k => {
    const n = Number(merged[k]);
    merged[k] = Number.isFinite(n) && n > 0 ? n : DEFAULT_CONFIG[k];
  });
  const grace = Number(merged.wakeUpGraceMinutes);
  merged.wakeUpGraceMinutes = Number.isFinite(grace) && grace >= 0 ? grace : DEFAULT_CONFIG.wakeUpGraceMinutes;
  const deposit = Number(merged.depositAmount);
  merged.depositAmount = Number.isFinite(deposit) && deposit >= 0 ? deposit : DEFAULT_CONFIG.depositAmount;
  merged.penaltyEnabled = config.penaltyEnabled !== false;

  if (!Array.isArray(config.habits) || config.habits.length === 0) {
    merged.habits = DEFAULT_HABITS.map(h => ({ ...h }));
  } else {
    merged.habits = config.habits.map(h => ({
      id: String(h.id),
      name: String(h.name || h.id),
      description: String(h.description || ''),
      enabled: h.enabled !== false,
      required: h.required !== false,
      category: h.category || (DEFAULT_HABITS.some(d => d.id === h.id) ? 'core' : 'custom'),
      targetType: h.targetType || 'checkbox',
      targetValue: h.targetValue,
      targetUnit: h.targetUnit,
      icon: h.icon,
    }));
  }
  return merged;
}

/**
 * Human readable date, e.g. "Thu, 12 Nov"
 */
export function formatPrettyDate(
  dateStr: string,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
): string {
  return parseDate(dateStr).toLocaleDateString('en-IN', opts);
}

/**
 * "06:00" -> "6:00 AM"
 */
export function formatTime12(time: string): string {
  if (!time || !/^\d{1,2}:\d{2}/.test(time)) return time || '';
  const [hStr, m] = time.split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.slice(0, 2)} ${suffix}`;
}

export interface ChallengePhase {
  phase: 'before' | 'active' | 'finished';
  dayNumber: number; // can be <= 0 before start
  daysUntilStart: number; // 0 when started
  daysLeft: number; // remaining days incl. the given day, 0 when finished
}

/**
 * Where a given date sits relative to the challenge window.
 */
export function getChallengePhase(dateStr: string, config: ChallengeConfig): ChallengePhase {
  const dayNumber = getDayNumber(dateStr, config.startDate);
  if (dayNumber < 1) {
    return { phase: 'before', dayNumber, daysUntilStart: 1 - dayNumber, daysLeft: config.durationDays };
  }
  if (dayNumber > config.durationDays) {
    return { phase: 'finished', dayNumber, daysUntilStart: 0, daysLeft: 0 };
  }
  return { phase: 'active', dayNumber, daysUntilStart: 0, daysLeft: config.durationDays - dayNumber + 1 };
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
      calories: 0,
      proteinGrams: 0,
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

/** "06:00" + 10 -> "06:10" (clamped to the same day) */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + (Number(minutes) || 0)));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Current local time as "HH:MM" */
export function currentTimeHHMM(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Long trip (over the threshold) that would move the wake-up to the travel target */
export function isLongTravel(travel: DailyLog['travel'], config: ChallengeConfig): boolean {
  return Boolean(travel?.isTravelling && travel.hours > config.travelThresholdHours);
}

/**
 * Wake-up target for a specific day. A long trip only moves it to 8:00 if it was set
 * before the normal check-in closed (or planned the day before) – travel switched on
 * after a missed 6:10 check-in doesn't rescue the wake-up.
 */
export function getLogWakeUpTarget(log: DailyLog, config: ChallengeConfig): string {
  if (log.travel?.addedAfterWakeUp) return config.wakeUpTarget;
  return getEffectiveWakeUpTarget(log.travel.hours, log.travel.isTravelling, config);
}

/** Normal check-in close (6:00 + 10 min -> 6:10), ignoring travel */
export function getNormalWakeUpDeadline(config: ChallengeConfig): string {
  return addMinutesToTime(config.wakeUpTarget, config.wakeUpGraceMinutes ?? 10);
}

/**
 * Last moment a wake-up check-in still counts: target + grace buffer
 * (6:00 + 10 min -> 6:10, or 8:10 on long travel days).
 */
export function getWakeUpDeadline(log: DailyLog, config: ChallengeConfig): string {
  return addMinutesToTime(getLogWakeUpTarget(log, config), config.wakeUpGraceMinutes ?? 10);
}

/**
 * Challenger edits to today's travel: a long trip switched on (or stretched past the
 * threshold) after the normal check-in has closed is recorded, but flagged so it doesn't
 * push the wake-up target back. Trips planned the night before or set before 6:10 keep it.
 */
export function applyLateTravelLock(
  existing: DailyLog,
  updated: DailyLog,
  config: ChallengeConfig,
  now: Date = new Date()
): DailyLog {
  const becameLong = isLongTravel(updated.travel, config) && !isLongTravel(existing.travel, config);
  const isThatDay = updated.date === formatDate(now);
  if (becameLong && isThatDay && currentTimeHHMM(now) > getNormalWakeUpDeadline(config)) {
    return { ...updated, travel: { ...updated.travel, addedAfterWakeUp: true } };
  }
  // Once flagged, the flag stays for the day (toggling travel off and on can't clear it)
  if (existing.travel?.addedAfterWakeUp && !updated.travel?.addedAfterWakeUp) {
    return { ...updated, travel: { ...updated.travel, addedAfterWakeUp: true } };
  }
  return updated;
}

/**
 * Challengers can only check in on the day itself, before the deadline.
 * After that the wake-up habit is locked for the day (only the admin can change it).
 */
export function isWakeUpCheckInOpen(log: DailyLog, config: ChallengeConfig, now: Date = new Date()): boolean {
  if (log.date !== formatDate(now)) return false;
  return currentTimeHHMM(now) <= getWakeUpDeadline(log, config);
}

/**
 * No gym today (travel, sick day, gym closed…) – set on the Travel & sick days screen.
 * Independent of trip length.
 */
export function isGymUnavailable(travel: DailyLog['travel']): boolean {
  return travel?.gymAvailable === false;
}

/** Normal activity targets: 10K steps / 3 km / 20 floors */
export function getNormalActivityTarget(type: ActivityType, config: ChallengeConfig): number {
  return type === 'run' ? config.runTargetKm : type === 'floors' ? config.floorsTarget : config.stepsTarget;
}

/** Bumped activity targets when there's no gym: 15K steps / 5 km / 30 floors */
export function getNoGymActivityTarget(type: ActivityType, config: ChallengeConfig): number {
  return type === 'run'
    ? config.travelSubstituteRunKm
    : type === 'floors'
    ? config.travelSubstituteFloors
    : config.travelSubstituteSteps;
}

/** Target the Physical Activity card should aim for on this day */
export function getActivityTarget(type: ActivityType, travel: DailyLog['travel'], config: ChallengeConfig): number {
  return isGymUnavailable(travel) ? getNoGymActivityTarget(type, config) : getNormalActivityTarget(type, config);
}

/** "15K steps · 5 km · 30 floors" */
export function describeNoGymTargets(config: ChallengeConfig): string {
  return `${(config.travelSubstituteSteps / 1000).toFixed(0)}K steps · ${config.travelSubstituteRunKm} km · ${config.travelSubstituteFloors} floors`;
}

const BUMPED_MET = 'No gym – bumped activity target met';

/**
 * Evaluates whether Gym is satisfied:
 * - Gym available: workout completed = true.
 * - Gym unavailable: the day's Physical Activity must hit the bumped targets
 *   (15K steps OR 5 km OR 30 floors) – one activity covers both habits.
 */
export function evaluateGymCompletion(
  gym: TaskState['gym'],
  travel: DailyLog['travel'],
  config: ChallengeConfig,
  physicalActivity?: TaskState['physicalActivity']
): { satisfied: boolean; isSubstituted: boolean; reason: string } {
  if (isGymUnavailable(travel)) {
    const pa = physicalActivity;
    const paMet = Boolean(pa && (pa.value || 0) >= getNoGymActivityTarget(pa.type, config));
    // Older logs recorded the substitute on the gym card itself
    const subType = gym.substituteType;
    const legacyMet =
      Boolean(subType) && (gym.substituteValue || 0) >= getNoGymActivityTarget(subType as ActivityType, config);

    // A plain "gym done" tick doesn't count here – the bumped target is the rule
    if (paMet) return { satisfied: true, isSubstituted: true, reason: BUMPED_MET };
    if (legacyMet) return { satisfied: true, isSubstituted: true, reason: 'No gym – substitute logged on the gym card' };
    return {
      satisfied: false,
      isSubstituted: true,
      reason: `No gym: ${describeNoGymTargets(config)}`,
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
  id: string;
  title: string;
  isCompleted: boolean;
  requirementDesc: string;
  required?: boolean;
}

/**
 * Check the required habits for a given day log against configured rules
 * (11 normally, 10 on a no-gym day where Physical Activity carries the bumped target,
 * or dynamically adjusted according to admin-configured habits)
 */
export function validateDayTasks(log: DailyLog, config: ChallengeConfig): {
  items: TaskValidationItem[];
  allCompleted: boolean;
  completedCount: number;
  totalCount: number;
  failedNames: string[];
} {
  const { tasks, travel } = log;
  const effectiveWakeTarget = getLogWakeUpTarget(log, config);
  const wakeDeadline = getWakeUpDeadline(log, config);
  const gymEval = evaluateGymCompletion(tasks.gym, travel, config, tasks.physicalActivity);
  const paEval = evaluatePhysicalActivity(tasks.physicalActivity, config);
  const noGym = isGymUnavailable(travel);

  // 1. Wake Up
  const wakeUpValid = tasks.wakeUp.completed && (
    !tasks.wakeUp.actualTime || tasks.wakeUp.actualTime <= wakeDeadline
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
  // No gym: the Gym habit is dropped for the day and activity must hit the bumped target
  // (15K steps / 5 km / 30 floors). Older logs that recorded the substitute on the gym card
  // still count when the normal activity target was also met.
  const normalPaValid = tasks.physicalActivity.completed || paEval.satisfied;
  const paValid = noGym ? gymEval.satisfied && (gymEval.reason === BUMPED_MET || normalPaValid) : normalPaValid;

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

  const coreEvals: Record<string, { isCompleted: boolean; defaultDesc: string }> = {
    wakeUp: {
      isCompleted: wakeUpValid,
      defaultDesc: `Check in by ${formatTime12(wakeDeadline)}${effectiveWakeTarget !== config.wakeUpTarget ? ' (travel)' : ''}`,
    },
    noMasturbation: {
      isCompleted: noMasturbationValid,
      defaultDesc: 'Strict discipline',
    },
    noSmokingAlcohol: {
      isCompleted: noSmokingAlcoholValid,
      defaultDesc: 'Zero tolerance',
    },
    reading: {
      isCompleted: readingValid,
      defaultDesc: `${config.readingMinPages}–${config.readingMaxPages} pages, non-fiction`,
    },
    gym: {
      isCompleted: gymValid,
      defaultDesc: 'Daily dedicated workout',
    },
    physicalActivity: {
      isCompleted: paValid,
      defaultDesc: noGym
        ? `No gym today · ${describeNoGymTargets(config)}`
        : `${(config.stepsTarget / 1000).toFixed(0)}K steps · ${config.runTargetKm} km · ${config.floorsTarget} floors`,
    },
    diet: {
      isCompleted: dietValid,
      defaultDesc: 'No sugar, junk or excess oil',
    },
    progressPhoto: {
      isCompleted: photoValid,
      defaultDesc: 'One full-body picture',
    },
    learning: {
      isCompleted: learningValid,
      defaultDesc: 'One new skill or idea',
    },
    health: {
      isCompleted: healthValid,
      defaultDesc: 'Water, rest, calm mind',
    },
    family: {
      isCompleted: familyValid,
      defaultDesc: `${config.familyTargetMinutes} min quality time`,
    },
  };

  const habitList = config.habits && config.habits.length > 0 ? config.habits : DEFAULT_HABITS;
  const items: TaskValidationItem[] = [];

  habitList.forEach(h => {
    // If habit is disabled/removed by admin, skip it completely
    if (h.enabled === false) return;
    // On no-gym day, gym habit is dropped
    if (h.id === 'gym' && noGym) return;

    if (coreEvals[h.id]) {
      items.push({
        id: h.id,
        title: h.name,
        isCompleted: coreEvals[h.id].isCompleted,
        requirementDesc: h.description || coreEvals[h.id].defaultDesc,
        required: h.required !== false,
      });
    } else {
      // Custom habit
      const isCustomDone = Boolean(
        log.tasks.custom?.[h.id]?.completed ||
        (log.tasks as any)[h.id]?.completed
      );
      items.push({
        id: h.id,
        title: h.name,
        isCompleted: isCustomDone,
        requirementDesc: h.description || 'Custom daily requirement',
        required: h.required !== false,
      });
    }
  });

  const completedCount = items.filter(i => i.isCompleted).length;
  const totalCount = items.length;
  const requiredItems = items.filter(i => i.required !== false);
  const allCompleted = requiredItems.length > 0 ? requiredItems.every(i => i.isCompleted) : (totalCount > 0 ? completedCount === totalCount : true);
  const failedNames = requiredItems.filter(i => !i.isCompleted).map(i => i.title);

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

  if (config.penaltyEnabled === false) {
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
    return {
      balances,
      transactions: [],
      totalPool: 0,
    };
  }

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
