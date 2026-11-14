import React from 'react';
import { ChevronLeft, ChevronRight, Lock, PlaneTakeoff, Stethoscope, ShieldCheck, Pencil } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  validateDayTasks,
  formatDate,
  parseDate,
  formatPrettyDate,
  getChallengePhase,
  isGymUnavailable,
  describeNoGymTargets,
} from '../../services/rulesEngine';
import { Card, Notice, ProgressBar } from '../ui';
import { DayEditor } from '../day/DayEditor';

interface DailyTrackerScreenProps {
  focusTaskId?: string;
  onNavigateTab: (tab: string) => void;
  /** Referee: open this person's day in Admin → Edit day (the only place the referee edits) */
  onEditDay?: (userId: string, date: string) => void;
}

export const DailyTrackerScreen: React.FC<DailyTrackerScreenProps> = ({ focusTaskId, onNavigateTab, onEditDay }) => {
  const { currentLog, updateCurrentLog, config, isEditable, isToday, currentDate, setCurrentDate, currentUser, isAdmin } =
    useChallenge();

  const { travel, sickness } = currentLog;
  const { completedCount, totalCount, allCompleted } = validateDayTasks(currentLog, config);
  const phase = getChallengePhase(currentDate, config);
  const noGym = isGymUnavailable(travel);

  if (isAdmin && currentUser?.id === 'admin') {
    return (
      <Card className="text-center py-10 space-y-2">
        <ShieldCheck className="w-9 h-9 text-violet-400 mx-auto" />
        <p className="text-[15px] font-semibold text-white">Pick a challenger</p>
        <p className="text-sm text-zinc-400">Choose someone from the bar at the top to see their checklist.</p>
      </Card>
    );
  }

  const shiftDay = (delta: number) => {
    const d = parseDate(currentDate);
    d.setDate(d.getDate() + delta);
    setCurrentDate(formatDate(d));
  };

  return (
    <div className="space-y-4">
      {/* Date navigator */}
      <Card padded={false} className="p-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => shiftDay(-1)}
            aria-label="Previous day"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-zinc-300 active:bg-white/[0.06]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setCurrentDate(formatDate(new Date()))} className="text-center px-2 min-w-0">
            <span className="block text-[15px] font-semibold text-white">
              {isToday ? 'Today' : formatPrettyDate(currentDate)}
            </span>
            <span className="block text-[12px] text-zinc-500">
              {isToday && `${formatPrettyDate(currentDate)} · `}
              {phase.phase === 'active'
                ? `Day ${phase.dayNumber} of ${config.durationDays}`
                : phase.phase === 'before'
                ? 'Before challenge start'
                : 'After challenge end'}
            </span>
          </button>
          <button
            onClick={() => shiftDay(1)}
            aria-label="Next day"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-zinc-300 active:bg-white/[0.06]"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="px-2 pb-1.5 pt-1">
          <div className="flex items-center justify-between text-[12px] mb-1.5">
            <span className="text-zinc-400">
              <span className="font-semibold text-white tabular">{completedCount}</span> of {totalCount} done
            </span>
            {allCompleted ? (
              <span className="text-emerald-400 font-semibold">Day complete</span>
            ) : (
              <span className="text-zinc-500 tabular">{Math.round((completedCount / totalCount) * 100)}%</span>
            )}
          </div>
          <ProgressBar value={(completedCount / totalCount) * 100} tone={allCompleted ? 'emerald' : 'rose'} />
        </div>
      </Card>

      {isAdmin ? (
        <Notice
          tone="violet"
          icon={ShieldCheck}
          title={`Viewing ${currentUser?.name}'s checklist`}
          action={
            onEditDay && currentUser ? (
              <button onClick={() => onEditDay(currentUser.id, currentDate)} className="btn-primary btn-sm">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            ) : undefined
          }
        >
          Read-only. Referee changes are made in Admin → Edit day.
        </Notice>
      ) : !isEditable && (
        <Notice
          tone="amber"
          icon={Lock}
          title="Read-only day"
          action={
            <button onClick={() => setCurrentDate(formatDate(new Date()))} className="btn-secondary btn-sm">
              Today
            </button>
          }
        >
          75 HARD only lets you log today.
        </Notice>
      )}

      {/* Conditions */}
      {sickness.isExempt ? (
        <Notice tone="blue" icon={Stethoscope} title="Medical exemption approved">
          Your streak is protected for this day.
        </Notice>
      ) : (
        <button
          onClick={() => onNavigateTab('travel')}
          className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-white/[0.1] px-4 py-3 text-left active:bg-white/[0.03]"
        >
          <PlaneTakeoff className={`w-5 h-5 shrink-0 ${travel.isTravelling ? 'text-amber-400' : 'text-zinc-500'}`} />
          <span className="flex-1 min-w-0 text-sm">
            {travel.isTravelling ? (
              <span className="text-amber-200">
                Travelling {travel.hours} h{noGym ? ' · no gym' : ''}{sickness.isSick ? ' · sick day requested' : ''}
              </span>
            ) : sickness.isSick ? (
              <span className="text-sky-300">
                Sick day · {sickness.status === 'pending' ? 'waiting for referee' : 'proof needed'}
                {noGym ? ' · no gym' : ''}
              </span>
            ) : noGym ? (
              <span className="text-violet-300">No gym today · {describeNoGymTargets(config)}</span>
            ) : (
              <span className="text-zinc-400">{isToday ? 'Travelling or sick today?' : 'Travel or sick day?'}</span>
            )}
          </span>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>
      )}

      <DayEditor
        log={currentLog}
        config={config}
        onUpdate={updateCurrentLog}
        editable={isEditable}
        isToday={isToday}
        userId={currentUser?.id || 'user_1'}
        focusTaskId={focusTaskId}
      />
    </div>
  );
};
