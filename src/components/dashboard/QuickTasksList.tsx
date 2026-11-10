import React from 'react';
import {
  CheckCircle2,
  Circle,
  AlarmClock,
  Ban,
  WineOff,
  BookOpen,
  Dumbbell,
  Footprints,
  Salad,
  Camera,
  GraduationCap,
  HeartPulse,
  Users,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { validateDayTasks, getEffectiveWakeUpTarget } from '../../services/rulesEngine';
import { TaskState } from '../../types';

interface QuickTasksListProps {
  onOpenDetails: (taskId?: keyof TaskState) => void;
}

export const QuickTasksList: React.FC<QuickTasksListProps> = ({ onOpenDetails }) => {
  const { currentLog, updateCurrentLog, config, isEditable, isToday, isAdmin, adminOverrideMode } = useChallenge();
  const { items } = validateDayTasks(currentLog, config);

  const taskIcons: Record<keyof TaskState, any> = {
    wakeUp: AlarmClock,
    noMasturbation: Ban,
    noSmokingAlcohol: WineOff,
    reading: BookOpen,
    gym: Dumbbell,
    physicalActivity: Footprints,
    diet: Salad,
    progressPhoto: Camera,
    learning: GraduationCap,
    health: HeartPulse,
    family: Users,
  };

  const toggleTask = (taskId: keyof TaskState, e: React.MouseEvent) => {
    e.stopPropagation();

    const canEdit = isEditable || isAdmin || adminOverrideMode;

    if (!canEdit) {
      alert("🔒 LOCKED: In 75 HARD, you can only make changes to TODAY'S checklist. Login as Admin to edit past or future days.");
      return;
    }

    updateCurrentLog(prev => {
      const tasks = { ...prev.tasks };
      const currentTask = tasks[taskId];

      let newCompleted = !currentTask.completed;

      // Handle specific fields
      if (taskId === 'wakeUp') {
        const effectiveTarget = getEffectiveWakeUpTarget(prev.travel.hours, prev.travel.isTravelling, config);
        tasks.wakeUp = {
          ...tasks.wakeUp,
          completed: newCompleted,
          actualTime: newCompleted ? (tasks.wakeUp.actualTime || effectiveTarget) : '',
        };
      } else if (taskId === 'diet') {
        tasks.diet = {
          ...tasks.diet,
          completed: newCompleted,
          cleanDietChecked: newCompleted,
        };
      } else if (taskId === 'gym') {
        tasks.gym = {
          ...tasks.gym,
          completed: newCompleted,
        };
      } else if (taskId === 'physicalActivity') {
        tasks.physicalActivity = {
          ...tasks.physicalActivity,
          completed: newCompleted,
          value: newCompleted ? (tasks.physicalActivity.value || config.stepsTarget) : tasks.physicalActivity.value,
        };
      } else if (taskId === 'reading') {
        tasks.reading = {
          ...tasks.reading,
          completed: newCompleted,
          pagesRead: newCompleted ? Math.max(tasks.reading.pagesRead, config.readingMinPages) : tasks.reading.pagesRead,
        };
      } else if (taskId === 'health') {
        tasks.health = {
          ...tasks.health,
          completed: newCompleted,
          mentalHealthMaintained: newCompleted,
        };
      } else if (taskId === 'family') {
        tasks.family = {
          ...tasks.family,
          completed: newCompleted,
          minutes: newCompleted ? Math.max(tasks.family.minutes, config.familyTargetMinutes) : tasks.family.minutes,
        };
      } else {
        (tasks[taskId] as any).completed = newCompleted;
      }

      return {
        ...prev,
        tasks,
      };
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-1.5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Daily 11 Habits
          </h3>
          {!isToday && (
            <span className="text-[10px] text-amber-400 bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.2 rounded font-bold flex items-center space-x-0.5">
              <Lock className="w-2.5 h-2.5" />
              <span>Read-Only</span>
            </span>
          )}
        </div>

        <button
          onClick={() => onOpenDetails()}
          className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center space-x-0.5"
        >
          <span>Detailed View</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        {items.map(item => {
          const Icon = taskIcons[item.id] || Circle;
          const isDone = item.isCompleted;

          return (
            <div
              key={item.id}
              onClick={() => onOpenDetails(item.id)}
              className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer select-none active:scale-[0.99] ${
                isDone
                  ? 'bg-[#10b981]/10 border-[#10b981]/30 text-emerald-200'
                  : 'bg-[#121318] border-white/[0.06] text-slate-200 hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <button
                  type="button"
                  disabled={!isEditable && !isAdmin && !adminOverrideMode}
                  onClick={e => toggleTask(item.id, e)}
                  className={`p-1 rounded-lg transition-transform active:scale-90 ${
                    !isEditable && !isAdmin && !adminOverrideMode
                      ? 'cursor-not-allowed opacity-80'
                      : isDone
                      ? 'text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 fill-emerald-500/20" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-4 h-4 shrink-0 ${isDone ? 'text-emerald-400' : 'text-rose-500'}`} />
                    <span className={`text-sm font-bold truncate ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                      {item.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {item.requirementDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0 ml-2 text-slate-400">
                {!isEditable && <Lock className="w-3 h-3 text-slate-500" />}
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
