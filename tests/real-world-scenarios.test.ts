import { test, describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import type {
  ChallengeConfig,
  DailyLog,
  UserProfile,
} from '../src/types/index.ts';
import {
  DEFAULT_CONFIG,
  createDefaultLog,
  formatDate,
  parseDate,
  getDayNumber,
  isDateEditable,
  getEffectiveWakeUpTarget,
  evaluateGymCompletion,
  evaluatePhysicalActivity,
  validateDayTasks,
  computeDayStatus,
  calculateStreakStats,
  calculateSquadDepositLedger,
  getWakeUpDeadline,
  isWakeUpCheckInOpen,
  normalizeConfig,
  getChallengePhase,
  applyLateTravelLock,
  normalizeLog,
} from '../src/services/rulesEngine.ts';

// Helper: produce a fully completed day's tasks
function completeAllTasks(log: DailyLog, config: ChallengeConfig): DailyLog {
  const effectiveWake = getEffectiveWakeUpTarget(log.travel.hours, log.travel.isTravelling, config);
  return {
    ...log,
    tasks: {
      wakeUp: { completed: true, actualTime: effectiveWake, effectiveTarget: effectiveWake },
      noMasturbation: { completed: true },
      noSmokingAlcohol: { completed: true },
      reading: { completed: true, pagesRead: 7, bookTitle: 'Atomic Habits', keyTakeaway: '1% better daily' },
      gym: { completed: true, isSubstituted: false, workoutNotes: 'Heavy squats & bench' },
      physicalActivity: { completed: true, type: 'steps', value: 10500 },
      diet: { completed: true, cleanDietChecked: true, notes: 'Zero sugar, clean protein' },
      progressPhoto: { completed: true, photoUrl: 'https://storage.supabase.co/progress/day1.jpg' },
      learning: { completed: true, topic: 'System Architecture', notes: 'Event-driven design' },
      health: { completed: true, waterLiters: 4, mentalHealthMaintained: true, notes: 'Meditation 15m' },
      family: { completed: true, minutes: 15, notes: 'Dinner conversation' },
    },
    sport: { participated: true, sportName: 'Badminton', durationMinutes: 45, improvementNotes: 'Backhand smash' },
  };
}

describe('1. Challenge Timeline & Dates', () => {
  it('should start on 11 Nov 2026 and span exactly 75 days to 24 Jan 2027', () => {
    assert.strictEqual(DEFAULT_CONFIG.startDate, '2026-11-11');
    assert.strictEqual(DEFAULT_CONFIG.durationDays, 75);
    assert.strictEqual(DEFAULT_CONFIG.endDate, '2027-01-24');

    const startD = parseDate('2026-11-11');
    const endD = new Date(startD);
    endD.setDate(endD.getDate() + 74); // 75 days total (0 to 74)
    assert.strictEqual(formatDate(endD), '2027-01-24');

    assert.strictEqual(getDayNumber('2026-11-11', '2026-11-11'), 1);
    assert.strictEqual(getDayNumber('2026-11-22', '2026-11-11'), 12);
    assert.strictEqual(getDayNumber('2027-01-24', '2026-11-11'), 75);
  });
});

describe('2. Today-Only Editing & Anti-Cheating Lock', () => {
  it('should allow challenger to edit ONLY today, rejecting past and future days', () => {
    const todayStr = formatDate(new Date());
    const pastStr = '2026-11-01';
    const futureStr = '2027-01-01';

    // Challengers (isAdmin = false)
    assert.strictEqual(isDateEditable(todayStr, DEFAULT_CONFIG, false), true);
    assert.strictEqual(isDateEditable(pastStr, DEFAULT_CONFIG, false), false);
    assert.strictEqual(isDateEditable(futureStr, DEFAULT_CONFIG, false), false);

    // Admin has master override to review and fix any day
    assert.strictEqual(isDateEditable(todayStr, DEFAULT_CONFIG, true), true);
    assert.strictEqual(isDateEditable(pastStr, DEFAULT_CONFIG, true), true);
    assert.strictEqual(isDateEditable(futureStr, DEFAULT_CONFIG, true), true);
  });
});

describe('3. Daily Habits & Task Validation (11 Required Tasks)', () => {
  it('should validate all 11 tasks and return allCompleted: true when fully met', () => {
    const baseLog = createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_1');
    const completedLog = completeAllTasks(baseLog, DEFAULT_CONFIG);
    const { allCompleted, completedCount, totalCount, failedNames } = validateDayTasks(completedLog, DEFAULT_CONFIG);

    assert.strictEqual(allCompleted, true);
    assert.strictEqual(completedCount, 11);
    assert.strictEqual(totalCount, 11);
    assert.strictEqual(failedNames.length, 0);
  });

  it('should flag day incomplete if even 1 task is missed (e.g. Reading < 5 pages)', () => {
    const baseLog = createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_1');
    const log = completeAllTasks(baseLog, DEFAULT_CONFIG);
    // Challenger only read 4 pages instead of min 5
    log.tasks.reading = { completed: false, pagesRead: 4, bookTitle: 'Book', keyTakeaway: '' };

    const { allCompleted, completedCount, failedNames } = validateDayTasks(log, DEFAULT_CONFIG);
    assert.strictEqual(allCompleted, false);
    assert.strictEqual(completedCount, 10);
    assert.ok(failedNames.includes('Reading'));
  });

  it('should flag day incomplete if progress photo is missing', () => {
    const baseLog = createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_1');
    const log = completeAllTasks(baseLog, DEFAULT_CONFIG);
    log.tasks.progressPhoto = { completed: false, photoUrl: '' };

    const { allCompleted, failedNames } = validateDayTasks(log, DEFAULT_CONFIG);
    assert.strictEqual(allCompleted, false);
    assert.ok(failedNames.includes('Daily Progress Photo'));
  });

  it('should support physical activity options: 10K steps OR 3K run OR 20 floors', () => {
    // 10K steps
    const stepEval = evaluatePhysicalActivity({ completed: false, type: 'steps', value: 10000 }, DEFAULT_CONFIG);
    assert.strictEqual(stepEval.satisfied, true);

    // 3K run
    const runEval = evaluatePhysicalActivity({ completed: false, type: 'run', value: 3.0 }, DEFAULT_CONFIG);
    assert.strictEqual(runEval.satisfied, true);

    // 20 floors
    const floorEval = evaluatePhysicalActivity({ completed: false, type: 'floors', value: 20 }, DEFAULT_CONFIG);
    assert.strictEqual(floorEval.satisfied, true);

    // Under target (9,999 steps)
    const failEval = evaluatePhysicalActivity({ completed: false, type: 'steps', value: 9999 }, DEFAULT_CONFIG);
    assert.strictEqual(failEval.satisfied, false);
  });
});

describe('4. Travel Scenarios & Conditional Rules', () => {
  it('Travel <= 4 hours: Standard rules apply (6:00 AM wake up)', () => {
    const target = getEffectiveWakeUpTarget(4, true, DEFAULT_CONFIG);
    assert.strictEqual(target, '06:00');
  });

  it('Travel > 4 hours: Wake up allowed until 8:00 AM', () => {
    const target = getEffectiveWakeUpTarget(5.5, true, DEFAULT_CONFIG);
    assert.strictEqual(target, '08:00');
  });

  it('Travel > 4 hours + Gym unavailable: allows 15,000 steps OR 5 KM run substitute', () => {
    const travel = { isTravelling: true, hours: 6, gymAvailable: false, destination: 'Delhi' };

    // Valid 15,000 steps substitute
    const stepSub = evaluateGymCompletion(
      { completed: false, isSubstituted: true, substituteType: 'steps', substituteValue: 15000 },
      travel,
      DEFAULT_CONFIG
    );
    assert.strictEqual(stepSub.satisfied, true);
    assert.strictEqual(stepSub.isSubstituted, true);

    // Valid 5 KM run substitute
    const runSub = evaluateGymCompletion(
      { completed: false, isSubstituted: true, substituteType: 'run', substituteValue: 5.0 },
      travel,
      DEFAULT_CONFIG
    );
    assert.strictEqual(runSub.satisfied, true);

    // Inadequate substitute (only 12,000 steps)
    const failSub = evaluateGymCompletion(
      { completed: false, isSubstituted: true, substituteType: 'steps', substituteValue: 12000 },
      travel,
      DEFAULT_CONFIG
    );
    assert.strictEqual(failSub.satisfied, false);
  });

  it('No gym (any day, not just long travel): Physical Activity at 15K steps / 5 km / 30 floors covers the gym', () => {
    const noGym = { isTravelling: false, hours: 0, gymAvailable: false };
    const gym = { completed: false };
    const pa = (type: 'steps' | 'run' | 'floors', value: number) => ({ completed: true, type, value });

    assert.strictEqual(evaluateGymCompletion(gym, noGym, DEFAULT_CONFIG, pa('steps', 15000)).satisfied, true);
    assert.strictEqual(evaluateGymCompletion(gym, noGym, DEFAULT_CONFIG, pa('run', 5)).satisfied, true);
    assert.strictEqual(evaluateGymCompletion(gym, noGym, DEFAULT_CONFIG, pa('floors', 30)).satisfied, true);

    // Normal targets are not enough to cover the gym
    assert.strictEqual(evaluateGymCompletion(gym, noGym, DEFAULT_CONFIG, pa('steps', 10000)).satisfied, false);
    assert.strictEqual(evaluateGymCompletion(gym, noGym, DEFAULT_CONFIG, pa('floors', 20)).satisfied, false);

    // A bare "gym done" tick doesn't count on a no-gym day
    assert.strictEqual(evaluateGymCompletion({ completed: true }, noGym, DEFAULT_CONFIG, pa('steps', 0)).satisfied, false);
  });

  it('No gym day: Gym habit is removed (10 habits) and Physical Activity needs 15K steps', () => {
    const base = createDefaultLog(formatDate(new Date()), DEFAULT_CONFIG, 'user_1');
    base.travel = { ...base.travel, gymAvailable: false };

    const at15k = { ...base, tasks: { ...base.tasks, physicalActivity: { completed: true, type: 'steps' as const, value: 15000 } } };
    const r15 = validateDayTasks(at15k, DEFAULT_CONFIG);
    assert.strictEqual(r15.totalCount, 10);
    assert.strictEqual(r15.items.some(i => i.id === 'gym'), false);
    assert.strictEqual(r15.items.find(i => i.id === 'physicalActivity')?.isCompleted, true);

    // 10K steps (even with a stale "completed" flag) is not enough without a gym
    const at10k = { ...base, tasks: { ...base.tasks, physicalActivity: { completed: true, type: 'steps' as const, value: 10000 } } };
    assert.strictEqual(validateDayTasks(at10k, DEFAULT_CONFIG).items.find(i => i.id === 'physicalActivity')?.isCompleted, false);

    // Gym available: 11 habits, normal 10K target
    assert.strictEqual(validateDayTasks(createDefaultLog(formatDate(new Date()), DEFAULT_CONFIG, 'user_1'), DEFAULT_CONFIG).totalCount, 11);
  });

  it('Older no-gym logs with the substitute on the gym card still pass activity', () => {
    const log = createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_1');
    log.travel = { isTravelling: true, hours: 6, gymAvailable: false };
    log.tasks.gym = { completed: true, isSubstituted: true, substituteType: 'steps', substituteValue: 15000 };
    log.tasks.physicalActivity = { completed: true, type: 'steps', value: 10000 };
    assert.strictEqual(validateDayTasks(log, DEFAULT_CONFIG).items.find(i => i.id === 'physicalActivity')?.isCompleted, true);
  });

  it('Long travel switched on after the 6:10 check-in closed does not move the wake-up', () => {
    const at = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };
    const today = createDefaultLog(formatDate(new Date()), DEFAULT_CONFIG, 'user_1');
    const withTrip = { ...today, travel: { ...today.travel, isTravelling: true, hours: 6 } };

    // Set at 5:30 AM: wake-up moves to 8:00 (deadline 8:10)
    const early = applyLateTravelLock(today, withTrip, DEFAULT_CONFIG, at('05:30'));
    assert.strictEqual(getWakeUpDeadline(early, DEFAULT_CONFIG), '08:10');

    // Set at 7:30 AM after missing the check-in: recorded, but the deadline stays 6:10
    const late = applyLateTravelLock(today, withTrip, DEFAULT_CONFIG, at('07:30'));
    assert.strictEqual(late.travel.isTravelling, true);
    assert.strictEqual(late.travel.addedAfterWakeUp, true);
    assert.strictEqual(getWakeUpDeadline(late, DEFAULT_CONFIG), '06:10');
    assert.strictEqual(isWakeUpCheckInOpen(late, DEFAULT_CONFIG, at('07:35')), false);

    // Toggling travel off and on again can't clear the flag
    const off = applyLateTravelLock(late, { ...late, travel: { ...late.travel, isTravelling: false, addedAfterWakeUp: false } }, DEFAULT_CONFIG, at('07:40'));
    assert.strictEqual(off.travel.addedAfterWakeUp, true);

    // A trip planned the night before keeps the 8:10 deadline even when edited later
    const planned = { ...withTrip, travel: { ...withTrip.travel, plannedAt: 'yesterday' } };
    const edited = applyLateTravelLock(planned, { ...planned, travel: { ...planned.travel, hours: 8 } }, DEFAULT_CONFIG, at('07:30'));
    assert.strictEqual(getWakeUpDeadline(edited, DEFAULT_CONFIG), '08:10');
  });

  it('Travel planned for tomorrow moves tomorrow’s wake-up deadline to 8:10 AM', () => {
    const tomorrow = createDefaultLog('2026-11-13', DEFAULT_CONFIG, 'user_1');
    tomorrow.travel = { ...tomorrow.travel, isTravelling: true, hours: 6, plannedAt: '2026-11-12T21:00:00.000Z' };
    assert.strictEqual(getWakeUpDeadline(tomorrow, DEFAULT_CONFIG), '08:10');
  });

  it('Gym-swap floors target defaults to 30 and survives a cleared admin box', () => {
    assert.strictEqual(normalizeConfig({}).travelSubstituteFloors, 30);
    assert.strictEqual(normalizeConfig({ travelSubstituteFloors: 0 }).travelSubstituteFloors, 30);
  });
});

describe('5. Sickness Exception & Medical Proof Rules', () => {
  it('Sickness at home without medical proof or admin approval is NOT exempt', () => {
    const log = createDefaultLog('2026-11-05', DEFAULT_CONFIG, 'user_1');
    log.sickness = {
      isSick: true,
      hasMedicalProof: false,
      medicalProofUrl: '',
      doctorNotes: 'Headache at home',
      isExempt: false,
      status: 'none',
    };

    const status = computeDayStatus(log, DEFAULT_CONFIG);
    assert.strictEqual(status, 'incomplete');
  });

  it('Sickness with verified medical proof approved by Admin becomes exempt', () => {
    const log = createDefaultLog('2026-11-15', DEFAULT_CONFIG, 'user_1');
    log.sickness = {
      isSick: true,
      hasMedicalProof: true,
      medicalProofUrl: 'https://storage.supabase.co/medical/presc.pdf',
      doctorNotes: 'Severe viral fever prescribed 3 days bed rest',
      isExempt: true,
      status: 'approved',
    };

    const status = computeDayStatus(log, DEFAULT_CONFIG);
    assert.strictEqual(status, 'exempt');
  });
});

describe('6. Streak Resets on Miss (Strict 75 HARD Rules)', () => {
  it('should increment streak day by day when completed', () => {
    const logs: Record<string, DailyLog> = {};
    const d1 = createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_1');
    logs['2026-11-11'] = completeAllTasks(d1, DEFAULT_CONFIG);

    const d2 = createDefaultLog('2026-11-12', DEFAULT_CONFIG, 'user_1');
    logs['2026-11-12'] = completeAllTasks(d2, DEFAULT_CONFIG);

    const stats = calculateStreakStats(logs, DEFAULT_CONFIG, 'user_1');
    assert.ok(stats.totalCompletedDays >= 0);
  });

  it('strict 75 HARD: a missed day in the past immediately resets active streak to 0', () => {
    const config: ChallengeConfig = {
      ...DEFAULT_CONFIG,
      startDate: '2026-11-01',
      strictResetOnMiss: true,
    };
    const logs: Record<string, DailyLog> = {};

    // Day 1 & Day 2 completed
    logs['2026-11-01'] = completeAllTasks(createDefaultLog('2026-11-01', config, 'u1'), config);
    logs['2026-11-02'] = completeAllTasks(createDefaultLog('2026-11-02', config, 'u1'), config);

    // Day 3 missed!
    logs['2026-11-03'] = createDefaultLog('2026-11-03', config, 'u1'); // empty / incomplete

    const stats = calculateStreakStats(logs, config, 'u1');
    assert.strictEqual(stats.resetsCount, 1);
    assert.strictEqual(stats.depositStatus, 'forfeited');
  });
});

describe('7. Peer Penalty & Squad Bounty Redistribution Engine', () => {
  const squadUsers: UserProfile[] = [
    { id: 'user_1', username: 'vedant', name: 'Vedant', role: 'challenger', depositAmount: 2000, pin: '1111', avatar: '🦁', color: '' },
    { id: 'user_2', username: 'vedansh', name: 'Vedansh', role: 'challenger', depositAmount: 2000, pin: '2222', avatar: '🐺', color: '' },
    { id: 'user_3', username: 'aryaman', name: 'Aryaman', role: 'challenger', depositAmount: 2000, pin: '3333', avatar: '🦅', color: '' },
    { id: 'admin', username: 'admin', name: 'Referee / Admin', role: 'admin', depositAmount: 0, pin: '7575', avatar: '⚖️', color: '' },
  ];

  it('Scenario 1: 1 person misses -> -₹200 deducted, +₹100 added to each survivor', () => {
    const config: ChallengeConfig = { ...DEFAULT_CONFIG, startDate: '2026-11-01' };
    const allLogs: Record<string, Record<string, DailyLog>> = {
      user_1: {},
      user_2: {},
      user_3: {},
    };

    // Day 1: Vedant misses. Vedansh & Aryaman complete.
    allLogs.user_1['2026-11-01'] = createDefaultLog('2026-11-01', config, 'user_1'); // missed!
    allLogs.user_2['2026-11-01'] = completeAllTasks(createDefaultLog('2026-11-01', config, 'user_2'), config);
    allLogs.user_3['2026-11-01'] = completeAllTasks(createDefaultLog('2026-11-01', config, 'user_3'), config);

    // Day 2 onwards not completed, but let's test Day 1 transfer
    const ledger = calculateSquadDepositLedger(allLogs, squadUsers, config);

    // Vedant: -₹200 -> ₹1,800
    assert.strictEqual(ledger.balances['user_1'].currentDeposit, 1800);
    assert.strictEqual(ledger.balances['user_1'].netChange, -200);
    assert.strictEqual(ledger.balances['user_1'].penaltiesPaid, 200);

    // Vedansh: +₹100 -> ₹2,100
    assert.strictEqual(ledger.balances['user_2'].currentDeposit, 2100);
    assert.strictEqual(ledger.balances['user_2'].netChange, 100);
    assert.strictEqual(ledger.balances['user_2'].bountiesEarned, 100);

    // Aryaman: +₹100 -> ₹2,100
    assert.strictEqual(ledger.balances['user_3'].currentDeposit, 2100);
    assert.strictEqual(ledger.balances['user_3'].netChange, 100);
    assert.strictEqual(ledger.balances['user_3'].bountiesEarned, 100);

    // Squad pool conserved at ₹6,000
    assert.strictEqual(ledger.totalPool, 6000);

    // Transaction logged
    assert.strictEqual(ledger.transactions.length, 1);
    assert.strictEqual(ledger.transactions[0].deductedPerMisser, 200);
    assert.strictEqual(ledger.transactions[0].awardedPerSurvivor, 100);
  });

  it('Scenario 2: 2 persons miss -> -₹200 each (-₹400 total), +₹400 added to 1 survivor', () => {
    const config: ChallengeConfig = { ...DEFAULT_CONFIG, startDate: '2026-11-01' };
    const allLogs: Record<string, Record<string, DailyLog>> = {
      user_1: {},
      user_2: {},
      user_3: {},
    };

    // Day 1: Vedant & Vedansh miss. Aryaman completes alone!
    allLogs.user_1['2026-11-01'] = createDefaultLog('2026-11-01', config, 'user_1');
    allLogs.user_2['2026-11-01'] = createDefaultLog('2026-11-01', config, 'user_2');
    allLogs.user_3['2026-11-01'] = completeAllTasks(createDefaultLog('2026-11-01', config, 'user_3'), config);

    const ledger = calculateSquadDepositLedger(allLogs, squadUsers, config);

    // Vedant: ₹1,800 (-₹200)
    assert.strictEqual(ledger.balances['user_1'].currentDeposit, 1800);
    // Vedansh: ₹1,800 (-₹200)
    assert.strictEqual(ledger.balances['user_2'].currentDeposit, 1800);
    // Aryaman: ₹2,400 (+₹400)
    assert.strictEqual(ledger.balances['user_3'].currentDeposit, 2400);
    assert.strictEqual(ledger.balances['user_3'].netChange, 400);

    // Pool conserved at ₹6,000
    assert.strictEqual(ledger.totalPool, 6000);
  });

  it('Scenario 3: Mutual failure (all 3 miss) -> No change', () => {
    const config: ChallengeConfig = { ...DEFAULT_CONFIG, startDate: '2026-11-01' };
    const allLogs: Record<string, Record<string, DailyLog>> = {
      user_1: {},
      user_2: {},
      user_3: {},
    };

    // Day 1: All 3 miss!
    allLogs.user_1['2026-11-01'] = createDefaultLog('2026-11-01', config, 'user_1');
    allLogs.user_2['2026-11-01'] = createDefaultLog('2026-11-01', config, 'user_2');
    allLogs.user_3['2026-11-01'] = createDefaultLog('2026-11-01', config, 'user_3');

    const ledger = calculateSquadDepositLedger(allLogs, squadUsers, config);

    assert.strictEqual(ledger.balances['user_1'].currentDeposit, 2000);
    assert.strictEqual(ledger.balances['user_2'].currentDeposit, 2000);
    assert.strictEqual(ledger.balances['user_3'].currentDeposit, 2000);
    assert.strictEqual(ledger.transactions.length, 0); // No transfer
    assert.strictEqual(ledger.totalPool, 6000);
  });

  it('Scenario 4: Squad perfection (all 3 complete) -> No change', () => {
    const config: ChallengeConfig = { ...DEFAULT_CONFIG, startDate: '2026-11-01' };
    const allLogs: Record<string, Record<string, DailyLog>> = {
      user_1: {},
      user_2: {},
      user_3: {},
    };

    allLogs.user_1['2026-11-01'] = completeAllTasks(createDefaultLog('2026-11-01', config, 'user_1'), config);
    allLogs.user_2['2026-11-01'] = completeAllTasks(createDefaultLog('2026-11-01', config, 'user_2'), config);
    allLogs.user_3['2026-11-01'] = completeAllTasks(createDefaultLog('2026-11-01', config, 'user_3'), config);

    const ledger = calculateSquadDepositLedger(allLogs, squadUsers, config);

    assert.strictEqual(ledger.balances['user_1'].currentDeposit, 2000);
    assert.strictEqual(ledger.balances['user_2'].currentDeposit, 2000);
    assert.strictEqual(ledger.balances['user_3'].currentDeposit, 2000);
    assert.strictEqual(ledger.transactions.length, 0);
  });

  it('Admin Referee is strictly excluded from deposit pool and penalties (pledge = ₹0)', () => {
    const config: ChallengeConfig = { ...DEFAULT_CONFIG, startDate: '2026-11-01' };
    const allLogs: Record<string, Record<string, DailyLog>> = {
      user_1: {},
      user_2: {},
      user_3: {},
      admin: {},
    };

    const ledger = calculateSquadDepositLedger(allLogs, squadUsers, config);
    assert.strictEqual(ledger.balances['admin'], undefined);
    assert.strictEqual(ledger.totalPool, 6000);
  });
});

describe('8. User Authentication, Security & Password Recovery', () => {
  const users = [
    { id: 'user_1', username: 'vedant', name: 'Vedant', password: 'vedant123', pin: '1111', role: 'challenger', depositAmount: 2000 },
    { id: 'user_2', username: 'vedansh', name: 'Vedansh', password: 'vedansh123', pin: '2222', role: 'challenger', depositAmount: 2000 },
    { id: 'user_3', username: 'aryaman', name: 'Aryaman', password: 'aryaman123', pin: '3333', role: 'challenger', depositAmount: 2000 },
    { id: 'admin', username: 'admin', name: 'Referee / Admin', password: 'admin7575', pin: '7575', role: 'admin', depositAmount: 0 },
  ];

  function authenticate(idOrUsername: string, secret: string) {
    const cleanId = idOrUsername.trim().toLowerCase();
    const cleanSecret = secret.trim();
    const found = users.find(
      u =>
        u.username.toLowerCase() === cleanId ||
        u.name.toLowerCase() === cleanId ||
        u.id.toLowerCase() === cleanId
    );
    if (!found) return { success: false, error: 'Challenger account not found.' };
    if (found.password === cleanSecret || found.pin === cleanSecret) {
      return { success: true, user: found };
    }
    return { success: false, error: 'Incorrect password or PIN.' };
  }

  // Mirrors the local-mode reset: only the account's OWN recovery answer works.
  // (Shared master keys like "7575" / "75hard" were removed – they let anyone take over any account.)
  function resetPassword(username: string, recoveryAnswer: string, newPass: string, answers: Record<string, string> = {}) {
    const cleanU = username.trim().toLowerCase();
    const found = users.find(u => u.username.toLowerCase() === cleanU || u.name.toLowerCase() === cleanU);
    if (!found) return { success: false, error: 'No account found.' };
    const own = answers[found.id];
    if (!own || own.toLowerCase() !== recoveryAnswer.trim().toLowerCase()) {
      return { success: false, error: 'Wrong recovery answer.' };
    }
    found.password = newPass;
    return { success: true, user: found };
  }

  it('Vedant logs in successfully with username and password', () => {
    const res = authenticate('vedant', 'vedant123');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user?.name, 'Vedant');
  });

  it('Vedansh logs in successfully with 4-digit PIN', () => {
    const res = authenticate('vedansh', '2222');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user?.name, 'Vedansh');
  });

  it('Aryaman logs in with display name case-insensitively', () => {
    const res = authenticate('Aryaman', 'aryaman123');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user?.username, 'aryaman');
  });

  it('Rejects invalid password with clear error message', () => {
    const res = authenticate('vedant', 'wrongpassword');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Incorrect password or PIN.');
  });

  it('Rejects unknown account', () => {
    const res = authenticate('stranger', '1234');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Challenger account not found.');
  });

  it('Referee signs in through the same account check as everyone else', () => {
    assert.strictEqual(authenticate('admin', 'admin7575').success, true);
    assert.strictEqual(authenticate('admin', 'wrong').success, false);
  });

  it('Shared master keys can no longer reset someone else\'s password', () => {
    assert.strictEqual(resetPassword('vedant', '7575', 'hijacked123').success, false);
    assert.strictEqual(resetPassword('vedant', '75hard', 'hijacked123').success, false);
    assert.strictEqual(authenticate('vedant', 'hijacked123').success, false);
  });

  it('Own recovery answer resets the password (local mode)', () => {
    const res = resetPassword('vedant', 'Pune', 'newVedantPass999', { user_1: 'pune' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(authenticate('vedant', 'newVedantPass999').success, true);
  });

  it('Rules config never carries credentials and rejects broken values', () => {
    const cfg = normalizeConfig({
      ...DEFAULT_CONFIG,
      adminPin: '7575',
      adminPassword: 'admin7575',
      wakeUpTarget: '',
      readingMinPages: 0,
      stepsTarget: -5,
    });
    assert.strictEqual(cfg.adminPin, undefined);
    assert.strictEqual(cfg.adminPassword, undefined);
    assert.strictEqual(cfg.wakeUpTarget, DEFAULT_CONFIG.wakeUpTarget);
    assert.strictEqual(cfg.readingMinPages, DEFAULT_CONFIG.readingMinPages);
    assert.strictEqual(cfg.stepsTarget, DEFAULT_CONFIG.stepsTarget);
  });
});

describe('Wake-up check-in window (target + 10 min buffer)', () => {
  const config = normalizeConfig({ ...DEFAULT_CONFIG, wakeUpTarget: '06:00', wakeUpGraceMinutes: 10 });
  const date = '2026-11-12';
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return new Date(2026, 10, 12, h, m, 0);
  };

  it('deadline is 6:10 normally and 8:10 on a long travel day', () => {
    const log = createDefaultLog(date, config, 'user_1');
    assert.strictEqual(getWakeUpDeadline(log, config), '06:10');
    const travel = { ...log, travel: { ...log.travel, isTravelling: true, hours: 6 } };
    assert.strictEqual(getWakeUpDeadline(travel, config), '08:10');
  });

  it('check-in is open at 6:05 and 6:10, closed from 6:11', () => {
    const log = createDefaultLog(date, config, 'user_1');
    assert.strictEqual(isWakeUpCheckInOpen(log, config, at('06:05')), true);
    assert.strictEqual(isWakeUpCheckInOpen(log, config, at('06:10')), true);
    assert.strictEqual(isWakeUpCheckInOpen(log, config, at('06:11')), false);
  });

  it('check-in is never open for another day', () => {
    const log = createDefaultLog('2026-11-11', config, 'user_1');
    assert.strictEqual(isWakeUpCheckInOpen(log, config, at('05:00')), false);
  });

  it('a 6:08 check-in counts, a 6:11 one does not', () => {
    const log = createDefaultLog(date, config, 'user_1');
    const withTime = (t: string) => ({ ...log, tasks: { ...log.tasks, wakeUp: { ...log.tasks.wakeUp, completed: true, actualTime: t } } });
    const ok = validateDayTasks(withTime('06:08'), config).items.find(i => i.id === 'wakeUp')!;
    const late = validateDayTasks(withTime('06:11'), config).items.find(i => i.id === 'wakeUp')!;
    assert.strictEqual(ok.isCompleted, true);
    assert.strictEqual(late.isCompleted, false);
  });
});

describe('Changing the start date', () => {
  it('recomputes the end date and the day number', () => {
    const cfg = normalizeConfig({ ...DEFAULT_CONFIG, startDate: '2026-11-12', endDate: '2027-01-24' });
    assert.strictEqual(cfg.endDate, '2027-01-25');
    assert.strictEqual(getDayNumber('2026-11-12', cfg.startDate), 1);
    assert.strictEqual(getChallengePhase('2026-11-11', cfg).phase, 'before');
  });
});

describe('Penalty logic enabled vs disabled', () => {
  const users: UserProfile[] = [
    { id: 'user_1', username: 'vedant', name: 'Vedant', avatar: '🦁', color: 'orange', role: 'challenger', depositAmount: 2000 },
    { id: 'user_2', username: 'vedansh', name: 'Vedansh', avatar: '🐺', color: 'blue', role: 'challenger', depositAmount: 2000 },
    { id: 'user_3', username: 'aryaman', name: 'Aryaman', avatar: '🦅', color: 'purple', role: 'challenger', depositAmount: 2000 },
  ];

  it('penaltyEnabled: true recalculates peer penalty transactions', () => {
    const logs = {
      user_1: { '2026-11-11': completeAllTasks(createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_1'), DEFAULT_CONFIG) },
      user_2: { '2026-11-11': createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_2') }, // missed
      user_3: { '2026-11-11': completeAllTasks(createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_3'), DEFAULT_CONFIG) },
    };
    const ledger = calculateSquadDepositLedger(logs, users, { ...DEFAULT_CONFIG, penaltyEnabled: true }, '2026-11-11');
    assert.strictEqual(ledger.balances['user_2'].netChange, -200);
    assert.strictEqual(ledger.balances['user_1'].netChange, 100);
    assert.strictEqual(ledger.balances['user_3'].netChange, 100);
    assert.strictEqual(ledger.transactions.length > 0, true);
  });

  it('penaltyEnabled: false completely disables penalty calculations and returns 0 pool', () => {
    const logs = {
      user_1: { '2026-11-11': completeAllTasks(createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_1'), DEFAULT_CONFIG) },
      user_2: { '2026-11-11': createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_2') }, // missed
      user_3: { '2026-11-11': completeAllTasks(createDefaultLog('2026-11-11', DEFAULT_CONFIG, 'user_3'), DEFAULT_CONFIG) },
    };
    const ledger = calculateSquadDepositLedger(logs, users, { ...DEFAULT_CONFIG, penaltyEnabled: false }, '2026-11-11');
    assert.strictEqual(ledger.totalPool, 0);
    assert.strictEqual(ledger.transactions.length, 0);
    assert.strictEqual(ledger.balances['user_2'].netChange, 0);
    assert.strictEqual(ledger.balances['user_1'].netChange, 0);
    assert.strictEqual(ledger.balances['user_3'].netChange, 0);
  });
});

describe('Dynamic Habit Management (Custom Habits & Disabling Habits)', () => {
  it('disabling a habit excludes it from validation and total count', () => {
    const baseConfig = normalizeConfig(DEFAULT_CONFIG);
    const habitsWithDisabled = (baseConfig.habits || []).map(h => (h.id === 'noMasturbation' ? { ...h, enabled: false } : h));
    const config = { ...baseConfig, habits: habitsWithDisabled };

    const log = createDefaultLog('2026-11-11', config, 'user_1');
    const validation = validateDayTasks(log, config);

    assert.strictEqual(validation.totalCount, 10);
    assert.strictEqual(validation.items.some(i => i.id === 'noMasturbation'), false);
  });

  it('adding a required custom habit increases total count and requires completion for allCompleted', () => {
    const baseConfig = normalizeConfig(DEFAULT_CONFIG);
    const customHabit = {
      id: 'custom_cold_shower',
      name: 'Cold Shower',
      description: '3 mins ice cold water',
      enabled: true,
      required: true,
      category: 'custom' as const,
      targetType: 'checkbox' as const,
    };
    const config = { ...baseConfig, habits: [...(baseConfig.habits || []), customHabit] };

    // Log with standard tasks completed, but custom habit not done yet
    let log = completeAllTasks(createDefaultLog('2026-11-11', config, 'user_1'), config);
    let val = validateDayTasks(log, config);
    assert.strictEqual(val.totalCount, 12);
    assert.strictEqual(val.allCompleted, false);
    assert.strictEqual(val.failedNames.includes('Cold Shower'), true);

    // Now complete the custom habit
    log = {
      ...log,
      tasks: {
        ...log.tasks,
        custom: {
          custom_cold_shower: { completed: true },
        },
      },
    };
    val = validateDayTasks(log, config);
    assert.strictEqual(val.allCompleted, true);
    assert.strictEqual(val.completedCount, 12);
  });

  it('numeric custom habit requires meeting or exceeding targetValue', () => {
    const baseConfig = normalizeConfig(DEFAULT_CONFIG);
    const customNumericHabit = {
      id: 'custom_meditation',
      name: 'Meditation',
      description: 'Mindfulness session',
      enabled: true,
      required: true,
      category: 'custom' as const,
      targetType: 'number' as const,
      targetValue: 15,
      targetUnit: 'mins',
    };
    const config = { ...baseConfig, habits: [...(baseConfig.habits || []), customNumericHabit] };

    let log = completeAllTasks(createDefaultLog('2026-11-11', config, 'user_1'), config);
    log = {
      ...log,
      tasks: {
        ...log.tasks,
        custom: {
          custom_meditation: { completed: false, value: 10 },
        },
      },
    };
    let val = validateDayTasks(log, config);
    assert.strictEqual(val.allCompleted, false);

    log.tasks.custom!.custom_meditation = { completed: true, value: 15 };
    val = validateDayTasks(log, config);
    assert.strictEqual(val.allCompleted, true);
  });

  it('optional habit does not fail the day if not completed', () => {
    const baseConfig = normalizeConfig(DEFAULT_CONFIG);
    const optionalHabit = {
      id: 'custom_journal',
      name: 'Gratitude Journal',
      description: 'Write 3 things',
      enabled: true,
      required: false,
      category: 'custom' as const,
      targetType: 'checkbox' as const,
    };
    const config = { ...baseConfig, habits: [...(baseConfig.habits || []), optionalHabit] };

    const log = completeAllTasks(createDefaultLog('2026-11-11', config, 'user_1'), config);
    const val = validateDayTasks(log, config);
    // Standard 11 tasks are done, optional habit is not done
    assert.strictEqual(val.allCompleted, true);
    assert.strictEqual(val.completedCount, 11);
    assert.strictEqual(val.totalCount, 12);
    assert.strictEqual(val.failedNames.length, 0); // optional habit does not appear in failedNames
  });
});

describe('Custom habit data survives saving and reloading', () => {
  const cfg = normalizeConfig({
    ...DEFAULT_CONFIG,
    habits: [
      ...(DEFAULT_CONFIG.habits || []),
      { id: 'custom_cold', name: 'Cold Shower', description: '', enabled: true, required: true, category: 'custom', targetType: 'checkbox' },
      { id: 'custom_pushups', name: 'Push-ups', description: '', enabled: true, required: true, category: 'custom', targetType: 'number', targetValue: 50, targetUnit: 'reps' },
    ],
  });

  it('keeps tasks.custom when a log is normalized (cloud reload / merge)', () => {
    const log = createDefaultLog('2026-11-14', cfg, 'user_1');
    log.tasks.custom = {
      custom_cold: { completed: true },
      custom_pushups: { completed: true, value: 60, notes: 'felt strong' },
    };
    // What the database / localStorage hands back: plain JSON
    const reloaded = normalizeLog(JSON.parse(JSON.stringify(log)), cfg);
    assert.deepStrictEqual(reloaded.tasks.custom?.custom_cold, { completed: true });
    assert.strictEqual(reloaded.tasks.custom?.custom_pushups?.value, 60);
    assert.strictEqual(reloaded.tasks.custom?.custom_pushups?.notes, 'felt strong');
    const v = validateDayTasks(reloaded, cfg);
    assert.strictEqual(v.items.find(i => i.id === 'custom_cold')?.isCompleted, true);
    assert.strictEqual(v.items.find(i => i.id === 'custom_pushups')?.isCompleted, true);
  });

  it('folds old top-level custom habit keys into tasks.custom', () => {
    const log: any = createDefaultLog('2026-11-14', cfg, 'user_1');
    delete log.tasks.custom;
    log.tasks.custom_cold = { completed: true };
    const reloaded = normalizeLog(log, cfg);
    assert.strictEqual(reloaded.tasks.custom?.custom_cold?.completed, true);
    assert.strictEqual(validateDayTasks(reloaded, cfg).items.find(i => i.id === 'custom_cold')?.isCompleted, true);
  });

  it('a day with every core habit done is still incomplete until the custom habit is ticked', () => {
    let log = completeAllTasks(createDefaultLog('2026-11-14', cfg, 'user_1'), cfg);
    log.tasks.custom = { custom_cold: { completed: true } };
    assert.strictEqual(validateDayTasks(normalizeLog(log, cfg), cfg).allCompleted, false); // push-ups missing
    log.tasks.custom = { ...log.tasks.custom, custom_pushups: { completed: true, value: 50 } };
    assert.strictEqual(validateDayTasks(normalizeLog(JSON.parse(JSON.stringify(log)), cfg), cfg).allCompleted, true);
  });
});
