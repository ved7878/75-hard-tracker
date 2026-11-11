import type { ChallengeConfig, DailyLog, TaskState } from '../types';
import { getEffectiveWakeUpTarget, getWakeUpDeadline, validateDayTasks } from './rulesEngine';

export function isLateWakeUp(log: DailyLog, config: ChallengeConfig): boolean {
  return Boolean(log.tasks.wakeUp.actualTime && log.tasks.wakeUp.actualTime > getWakeUpDeadline(log, config));
}

/**
 * One-tap toggle for a habit. Fills in the minimum values a habit needs to count as done
 * (or clears them when unticking), so the quick checkbox and the detailed form agree.
 */
export function toggleTask(log: DailyLog, taskId: keyof TaskState, config: ChallengeConfig): DailyLog {
  const tasks = { ...log.tasks };
  const isDone = validateDayTasks(log, config).items.find(i => i.id === taskId)?.isCompleted ?? false;
  const next = !isDone;

  switch (taskId) {
    case 'wakeUp': {
      const target = getEffectiveWakeUpTarget(log.travel.hours, log.travel.isTravelling, config);
      // A logged late wake-up can't be "ticked away" – the time has to be corrected instead
      if (next && isLateWakeUp(log, config)) return log;
      tasks.wakeUp = {
        ...tasks.wakeUp,
        completed: next,
        actualTime: next ? tasks.wakeUp.actualTime || target : '',
      };
      break;
    }
    case 'reading':
      tasks.reading = {
        ...tasks.reading,
        completed: next,
        pagesRead: next ? Math.max(tasks.reading.pagesRead, config.readingMinPages) : 0,
      };
      break;
    case 'physicalActivity': {
      const pa = tasks.physicalActivity;
      const target = pa.type === 'run' ? config.runTargetKm : pa.type === 'floors' ? config.floorsTarget : config.stepsTarget;
      tasks.physicalActivity = { ...pa, completed: next, value: next ? Math.max(pa.value || 0, target) : 0 };
      break;
    }
    case 'gym': {
      const t = log.travel;
      const substituteMode = t.isTravelling && t.hours > config.travelThresholdHours && !t.gymAvailable;
      if (substituteMode) {
        // Travel day with no gym: the tick means "I did the substitute" – record the
        // required steps / km so the 15K steps / 5 km rule is actually reflected.
        const type = tasks.gym.substituteType || 'steps';
        const target = type === 'run' ? config.travelSubstituteRunKm : config.travelSubstituteSteps;
        tasks.gym = {
          ...tasks.gym,
          completed: next,
          isSubstituted: true,
          substituteType: type,
          substituteValue: next ? Math.max(tasks.gym.substituteValue || 0, target) : 0,
        };
      } else {
        tasks.gym = {
          ...tasks.gym,
          completed: next,
          substituteValue: next ? tasks.gym.substituteValue : 0,
        };
      }
      break;
    }
    case 'diet':
      tasks.diet = { ...tasks.diet, completed: next, cleanDietChecked: next };
      break;
    case 'health':
      tasks.health = { ...tasks.health, completed: next, mentalHealthMaintained: next };
      break;
    case 'family':
      tasks.family = {
        ...tasks.family,
        completed: next,
        minutes: next ? Math.max(tasks.family.minutes, config.familyTargetMinutes) : 0,
      };
      break;
    case 'progressPhoto':
      // A photo is required – the checkbox alone can't complete it.
      if (next && !tasks.progressPhoto.photoUrl) return log;
      tasks.progressPhoto = { ...tasks.progressPhoto, completed: next };
      break;
    default:
      (tasks as any)[taskId] = { ...(tasks as any)[taskId], completed: next };
  }

  return { ...log, tasks };
}
