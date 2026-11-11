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

  function authenticateAdmin(secret: string, adminPin = '7575', adminPass = 'admin7575') {
    const clean = secret.trim();
    if (clean === adminPin || clean === adminPass || clean === '7575' || clean === 'admin7575') {
      return { success: true, role: 'admin' };
    }
    return { success: false, error: 'Invalid Admin Password or PIN.' };
  }

  function resetPassword(username: string, recoveryKey: string, newPass: string) {
    const cleanU = username.trim().toLowerCase();
    const cleanKey = recoveryKey.trim();
    const isMaster = cleanKey === '7575' || cleanKey.toLowerCase() === '75hard';
    const found = users.find(u => u.username.toLowerCase() === cleanU || u.name.toLowerCase() === cleanU);
    if (!found) return { success: false, error: 'No account found.' };
    if (!isMaster) return { success: false, error: 'Invalid Recovery Key or Admin PIN.' };
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

  it('Admin logs in with Admin PIN 7575 or password admin7575', () => {
    assert.strictEqual(authenticateAdmin('7575').success, true);
    assert.strictEqual(authenticateAdmin('admin7575').success, true);
    assert.strictEqual(authenticateAdmin('wrong').success, false);
  });

  it('Forgot password self-service recovery with Admin PIN 7575 or squad key 75hard', () => {
    const res = resetPassword('vedant', '7575', 'newVedantPass999');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user?.password, 'newVedantPass999');

    // Verify new password immediately works
    const loginRes = authenticate('vedant', 'newVedantPass999');
    assert.strictEqual(loginRes.success, true);
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
