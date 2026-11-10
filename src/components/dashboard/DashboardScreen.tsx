import React from 'react';
import {
  PlaneTakeoff,
  AlertCircle,
  Bell,
  BellOff,
  Flame,
  CheckCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { DayProgressRing } from './DayProgressRing';
import { StreakBanner } from './StreakBanner';
import { QuickTasksList } from './QuickTasksList';
import { validateDayTasks } from '../../services/rulesEngine';
import { TaskState } from '../../types';
import { requestNotificationPermission } from '../../services/notifications';

interface DashboardScreenProps {
  onNavigateTab: (tab: string) => void;
  onOpenTaskDetails: (taskId?: keyof TaskState) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateTab,
  onOpenTaskDetails,
}) => {
  const { currentLog, config, updateConfig, streakStats } = useChallenge();
  const { completedCount, totalCount, allCompleted } = validateDayTasks(currentLog, config);

  const toggleReminder = async () => {
    if (!config.reminderEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        updateConfig({ reminderEnabled: true });
      } else {
        alert('Please allow notification permissions in your browser to receive the 9:00 PM reminder.');
      }
    } else {
      updateConfig({ reminderEnabled: false });
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Travel or Sickness Banner if active today */}
      {currentLog.travel.isTravelling && (
        <div 
          onClick={() => onNavigateTab('travel')}
          className="cursor-pointer p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between"
        >
          <div className="flex items-center space-x-2.5">
            <PlaneTakeoff className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-amber-300">
                Travel Mode Active ({currentLog.travel.hours} hrs)
              </span>
              <p className="text-[11px] text-amber-200/80">
                {currentLog.travel.hours > 4
                  ? 'Wake up allowed up to 8:00 AM • Gym rules dynamically adjusted'
                  : '≤4 hrs travel: all standard 75 Hard rules apply'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
        </div>
      )}

      {currentLog.sickness.isSick && (
        <div 
          onClick={() => onNavigateTab('travel')}
          className="cursor-pointer p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-between"
        >
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-blue-300">
                Sickness Exemption {currentLog.sickness.isExempt ? 'Verified' : 'Pending Proof'}
              </span>
              <p className="text-[11px] text-blue-200/80">
                {currentLog.sickness.isExempt
                  ? 'Streak preserved via doctor medical proof. Health is priority!'
                  : 'Medical proof required for valid exemption (No at-home excuses).'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
        </div>
      )}

      {/* Progress Ring Card */}
      <div className="rounded-2xl glass-card border border-white/[0.08] shadow-card relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-600/10 blur-3xl pointer-events-none rounded-full" />
        
        <DayProgressRing
          completed={completedCount}
          total={totalCount}
          dayNumber={currentLog.dayNumber}
          totalDays={config.durationDays}
          allDone={allCompleted}
          isExempt={currentLog.sickness.isExempt}
        />

        {/* Quick reminder status bar */}
        <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Bell className="w-3.5 h-3.5 text-rose-400" />
            <span>9:00 PM Accountability Alert</span>
          </div>
          <button
            onClick={toggleReminder}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
              config.reminderEnabled
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-white/5 text-slate-400 border border-white/10'
            }`}
          >
            {config.reminderEnabled ? 'Active' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Streak and Deposit status */}
      <StreakBanner onGoToTracker={() => onNavigateTab('tracker')} />

      {/* Quick Habit Checklist */}
      <QuickTasksList onOpenDetails={onOpenTaskDetails} />

      {/* Mental Toughness Quote */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-start space-x-2.5 text-xs text-slate-400">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="italic text-slate-300">
            "75 HARD is not a fitness challenge. It is an iron-clad mental toughness program. Win the day or start from zero."
          </p>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 block font-mono">
            — Discipline Equals Freedom
          </span>
        </div>
      </div>
    </div>
  );
};
