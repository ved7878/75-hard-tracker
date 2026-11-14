import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CloudOff,
  CircleCheck,
  Loader2,
  PlaneTakeoff,
  Dumbbell,
  Stethoscope,
  TriangleAlert,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  addDays,
  createDefaultLog,
  formatDate,
  formatPrettyDate,
  getChallengePhase,
  validateDayTasks,
} from '../../services/rulesEngine';
import { supabaseService } from '../../services/supabaseService';
import { feedback } from '../../services/feedback';
import { DailyLog, TravelInfo, UserProfile } from '../../types';
import { Card, Chip, ProgressBar, SectionHeader, Switch } from '../ui';
import { DayEditor, LogUpdater } from '../day/DayEditor';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AdminDayEditorProps {
  challengers: UserProfile[];
  userId: string;
  date: string;
  onChangeUser: (id: string) => void;
  onChangeDate: (date: string) => void;
}

/**
 * Admin → Edit day: the ONE place the referee changes a challenger's day – every habit
 * (core and custom), travel / gym access, the sick-day exemption and notes. Every change is
 * saved automatically and the status chip shows whether it reached the cloud.
 */
export const AdminDayEditor: React.FC<AdminDayEditorProps> = ({ challengers, userId, date, onChangeUser, onChangeDate }) => {
  const { allUsersLogs, config, adminUpdateLog, approveException, rejectException } = useChallenge();

  const user = challengers.find(c => c.id === userId) || challengers[0];
  const uid = user?.id || userId;
  const log: DailyLog = (allUsersLogs[uid] || {})[date] || createDefaultLog(date, config, uid);
  const { completedCount, totalCount, allCompleted } = validateDayTasks(log, config);
  const phase = getChallengePhase(date, config);
  const todayStr = formatDate(new Date());
  const cloud = supabaseService.canSyncToCloud();

  // Save status for this screen
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const inFlight = useRef(0);
  useEffect(() => setSaveState('idle'), [uid, date]);

  const apply = (updater: LogUpdater, opts: { debounce?: boolean } = { debounce: true }) => {
    inFlight.current += 1;
    setSaveState('saving');
    return adminUpdateLog(uid, date, updater, opts).then(ok => {
      inFlight.current -= 1;
      if (!ok) {
        feedback.warn();
        setSaveState('error');
      } else if (inFlight.current <= 0) {
        inFlight.current = 0;
        setSaveState(s => (s === 'error' ? s : 'saved'));
      }
      return ok;
    });
  };

  const retry = () => {
    setSaveState('saving');
    inFlight.current = 0;
    apply(prev => prev, { debounce: false });
  };

  const setTravel = (patch: Partial<TravelInfo>) =>
    // A referee change to travel is deliberate, so the "added after wake-up" lock is cleared
    apply(prev => {
      const travel = { ...prev.travel, ...patch, addedAfterWakeUp: false };
      if (!travel.isTravelling) travel.hours = 0;
      return { ...prev, travel };
    });

  const setExempt = (on: boolean) =>
    apply(
      prev => ({
        ...prev,
        sickness: {
          ...prev.sickness,
          isSick: on ? true : prev.sickness.isSick && prev.sickness.status === 'pending',
          isExempt: on,
          hasMedicalProof: on ? true : prev.sickness.hasMedicalProof,
          status: on ? 'approved' : prev.sickness.status === 'approved' ? 'none' : prev.sickness.status,
          reviewedBy: 'Admin',
          reviewedAt: new Date().toISOString(),
          adminComment: on ? 'Exemption set by the referee.' : prev.sickness.adminComment,
        },
      }),
      { debounce: false }
    );

  const statusChip = log.sickness.isExempt ? (
    <Chip tone="blue">Exempt</Chip>
  ) : allCompleted ? (
    <Chip tone="emerald">Complete</Chip>
  ) : date > todayStr ? (
    <Chip tone="neutral">Upcoming</Chip>
  ) : (
    <Chip tone="rose">Incomplete</Chip>
  );

  const saveChip =
    saveState === 'saving' ? (
      <span className="flex items-center gap-1 text-[12px] text-zinc-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
      </span>
    ) : saveState === 'error' ? (
      <button onClick={retry} className="flex items-center gap-1 text-[12px] font-semibold text-rose-300">
        <TriangleAlert className="w-3.5 h-3.5" /> Not saved · Retry <RotateCw className="w-3 h-3" />
      </button>
    ) : saveState === 'saved' ? (
      cloud ? (
        <span className="flex items-center gap-1 text-[12px] text-emerald-400">
          <CircleCheck className="w-3.5 h-3.5" /> Saved
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[12px] text-amber-300">
          <CloudOff className="w-3.5 h-3.5" /> Saved on this device only
        </span>
      )
    ) : (
      <span className="text-[12px] text-zinc-500">Changes save automatically</span>
    );

  if (!user) {
    return <Card className="text-center py-8 text-sm text-zinc-400">Add a challenger in the Squad tab first.</Card>;
  }

  return (
    <div className="space-y-4">
      {/* Who */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {challengers.map(c => (
          <button
            key={c.id}
            onClick={() => onChangeUser(c.id)}
            className={`h-10 pl-2 pr-3.5 rounded-full flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap transition ${
              c.id === uid ? 'bg-white text-ink-950' : 'bg-white/[0.06] text-zinc-300'
            }`}
          >
            <span className="text-lg leading-none">{c.avatar}</span>
            {c.name}
          </button>
        ))}
      </div>

      {/* When */}
      <Card padded={false} className="p-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChangeDate(addDays(date, -1))}
            aria-label="Previous day"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-zinc-300 active:bg-white/[0.06] shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <input
              type="date"
              value={date}
              onChange={e => e.target.value && onChangeDate(e.target.value)}
              aria-label="Day to edit"
              className="bg-transparent text-center text-[15px] font-semibold text-white focus:outline-none w-full [color-scheme:dark]"
            />
            <span className="block text-[12px] text-zinc-500">
              {date === todayStr ? 'Today · ' : ''}
              {phase.phase === 'active'
                ? `Day ${phase.dayNumber} of ${config.durationDays}`
                : phase.phase === 'before'
                ? 'Before challenge start'
                : 'After challenge end'}
            </span>
          </div>
          <button
            onClick={() => onChangeDate(addDays(date, 1))}
            aria-label="Next day"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-zinc-300 active:bg-white/[0.06] shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="px-2 pb-1.5 pt-1">
          <div className="flex items-center justify-between gap-2 text-[12px] mb-1.5">
            <span className="flex items-center gap-2 text-zinc-400">
              <span>
                <span className="font-semibold text-white tabular">{completedCount}</span> of {totalCount} done
              </span>
              {statusChip}
            </span>
            {saveChip}
          </div>
          <ProgressBar value={totalCount ? (completedCount / totalCount) * 100 : 0} tone={allCompleted ? 'emerald' : 'rose'} />
        </div>
        {date !== todayStr && (
          <div className="px-2 pb-1">
            <button onClick={() => onChangeDate(todayStr)} className="text-[12px] font-semibold text-rose-400">
              Jump to today
            </button>
          </div>
        )}
      </Card>

      {/* Conditions */}
      <section>
        <SectionHeader title="Conditions" />
        <div className="card divide-y divide-white/[0.05]">
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              <PlaneTakeoff className={`w-5 h-5 shrink-0 ${log.travel.isTravelling ? 'text-amber-400' : 'text-zinc-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-zinc-100">Travelling</p>
                <p className="text-[12px] text-zinc-500">Over {config.travelThresholdHours} h moves wake-up to the travel time</p>
              </div>
              <Switch tone="amber" label="Travelling" checked={log.travel.isTravelling} onChange={v => setTravel({ isTravelling: v })} />
            </div>
            {log.travel.isTravelling && (
              <div className="flex items-center justify-between gap-3 pl-8">
                <span className="text-sm text-zinc-400">Hours</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  value={log.travel.hours || ''}
                  onChange={e => setTravel({ hours: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="input w-28 text-center"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Dumbbell className={`w-5 h-5 shrink-0 ${log.travel.gymAvailable === false ? 'text-violet-400' : 'text-zinc-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-zinc-100">Gym available</p>
              <p className="text-[12px] text-zinc-500">Off = gym habit dropped, activity target raised</p>
            </div>
            <Switch
              tone="emerald"
              label="Gym available"
              checked={log.travel.gymAvailable !== false}
              onChange={v => setTravel({ gymAvailable: v })}
            />
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              <Stethoscope className={`w-5 h-5 shrink-0 ${log.sickness.isExempt ? 'text-sky-400' : 'text-zinc-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-zinc-100">Medical exemption</p>
                <p className="text-[12px] text-zinc-500">
                  {log.sickness.status === 'pending'
                    ? 'Sick-day request waiting for you'
                    : log.sickness.status === 'rejected'
                    ? 'Request was rejected'
                    : 'Protects the streak for this day'}
                </p>
              </div>
              <Switch tone="blue" label="Medical exemption" checked={log.sickness.isExempt} onChange={setExempt} />
            </div>
            {log.sickness.status === 'pending' && (
              <div className="space-y-2 pl-8">
                {log.sickness.doctorNotes && (
                  <p className="text-sm text-zinc-300 bg-ink-850 rounded-xl px-3 py-2">{log.sickness.doctorNotes}</p>
                )}
                {log.sickness.medicalProofUrl && (
                  <a href={log.sickness.medicalProofUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm w-full">
                    <ExternalLink className="w-4 h-4" /> View proof
                  </a>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSaveState('saving');
                      rejectException(uid, date).then(() => setSaveState('saved'));
                    }}
                    className="btn-secondary btn-sm text-rose-300"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setSaveState('saving');
                      approveException(uid, date).then(() => setSaveState('saved'));
                    }}
                    className="btn btn-sm bg-emerald-600 text-white"
                  >
                    Approve
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Habits + notes – same cards the challenger sees, in referee mode */}
      <DayEditor
        key={`${uid}_${date}`}
        log={log}
        config={config}
        onUpdate={apply}
        editable
        referee
        isToday={date === todayStr}
        userId={uid}
      />
    </div>
  );
};
