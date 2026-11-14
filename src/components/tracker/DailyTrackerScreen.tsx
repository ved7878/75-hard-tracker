import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Lock,
  PlaneTakeoff,
  Stethoscope,
  Upload,
  Trophy,
  NotebookPen,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  getLogWakeUpTarget,
  validateDayTasks,
  formatDate,
  parseDate,
  formatPrettyDate,
  formatTime12,
  getChallengePhase,
  getWakeUpDeadline,
  isWakeUpCheckInOpen,
  isGymUnavailable,
  getNormalActivityTarget,
  getNoGymActivityTarget,
  describeNoGymTargets,
} from '../../services/rulesEngine';
import { useNow } from '../../hooks/useNow';
import { toggleTask, isLateWakeUp } from '../../services/taskActions';
import { TaskState, ActivityType } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { compressImage } from '../../services/imageCompression';
import { TASK_ICONS, getTaskIcon } from '../common/taskMeta';
import { Card, CheckButton, Chip, Notice, ProgressBar, SectionHeader, Segmented, Stepper } from '../ui';

interface DailyTrackerScreenProps {
  focusTaskId?: string;
  onNavigateTab: (tab: string) => void;
}

/* ------------------------------------------------------------------ */

const TaskCard: React.FC<{
  id: string;
  title: string;
  subtitle: React.ReactNode;
  done: boolean;
  onToggle: () => void;
  disabled: boolean;
  expanded: boolean;
  onExpand?: () => void;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ElementType;
}> = ({ id, title, subtitle, done, onToggle, disabled, expanded, onExpand, badge, children, icon: CustomIcon }) => {
  const Icon = CustomIcon || getTaskIcon(id);
  const hasBody = Boolean(children);
  return (
    <div
      id={`task-${id}`}
      className={`card overflow-hidden transition-colors scroll-mt-28 ${done ? 'border-emerald-500/20' : ''}`}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3.5 ${hasBody ? 'cursor-pointer' : ''}`}
        onClick={hasBody ? onExpand : undefined}
      >
        <span
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            done ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.05] text-zinc-300'
          }`}
        >
          <Icon className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-white leading-snug">{title}</h3>
            {badge}
          </div>
          <p className="text-[13px] text-zinc-500 leading-snug line-clamp-2">{subtitle}</p>
        </div>
        {hasBody && (
          <ChevronDown
            className={`hidden min-[360px]:block w-4 h-4 text-zinc-600 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        )}
        <CheckButton checked={done} disabled={disabled} onClick={onToggle} size="lg" label={`Mark ${title}`} />
      </div>
      {hasBody && expanded && <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/[0.04]">{children}</div>}
    </div>
  );
};

const Row: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 pt-3">
    <span className="text-sm text-zinc-400">{label}</span>
    {children}
  </div>
);

/* ------------------------------------------------------------------ */

export const DailyTrackerScreen: React.FC<DailyTrackerScreenProps> = ({ focusTaskId, onNavigateTab }) => {
  const {
    currentLog,
    updateCurrentLog,
    config,
    isEditable,
    isToday,
    currentDate,
    setCurrentDate,
    currentUser,
    isAdmin,
  } = useChallenge();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(focusTaskId ? [focusTaskId] : []));
  const now = useNow();

  // Opening a habit from the Today screen expands it and scrolls it into view
  useEffect(() => {
    if (!focusTaskId) return;
    setExpanded(prev => new Set(prev).add(focusTaskId));
    const t = setTimeout(() => {
      document.getElementById(`task-${focusTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => clearTimeout(t);
  }, [focusTaskId]);

  const { tasks, travel, sickness } = currentLog;
  const wakeTarget = getLogWakeUpTarget(currentLog, config);
  const wakeDeadline = getWakeUpDeadline(currentLog, config);
  const wakeWindowOpen = isWakeUpCheckInOpen(currentLog, config, now);
  const { items, completedCount, totalCount, allCompleted } = validateDayTasks(currentLog, config);
  const done = (id: string) => items.find(i => i.id === id)?.isCompleted ?? false;
  const desc = (id: string) => items.find(i => i.id === id)?.requirementDesc ?? '';
  const title = (id: string) => items.find(i => i.id === id)?.title ?? '';
  const phase = getChallengePhase(currentDate, config);
  // No gym today (set on Travel & sick days): activity targets are bumped and cover the gym habit
  const noGym = isGymUnavailable(travel);
  const disabled = !isEditable;

  if (isAdmin && currentUser?.id === 'admin') {
    return (
      <Card className="text-center py-10 space-y-2">
        <ShieldCheck className="w-9 h-9 text-violet-400 mx-auto" />
        <p className="text-[15px] font-semibold text-white">Pick a challenger</p>
        <p className="text-sm text-zinc-400">Choose someone from the bar at the top to see or edit their checklist.</p>
      </Card>
    );
  }

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const shiftDay = (delta: number) => {
    const d = parseDate(currentDate);
    d.setDate(d.getDate() + delta);
    setCurrentDate(formatDate(d));
  };

  const update = <K extends keyof TaskState>(key: K, data: Partial<TaskState[K]>) => {
    updateCurrentLog(prev => ({ ...prev, tasks: { ...prev.tasks, [key]: { ...prev.tasks[key], ...data } } }));
  };

  const onToggle = (id: string) => {
    if (id === 'progressPhoto' && !tasks.progressPhoto.photoUrl) {
      fileInputRef.current?.click();
      return;
    }
    if (id === 'wakeUp' && isLateWakeUp(currentLog, config)) {
      setExpanded(prev => new Set(prev).add('wakeUp'));
      return;
    }
    updateCurrentLog(prev => toggleTask(prev, id, config));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    e.target.value = '';
    if (!rawFile || !isEditable) return;
    setUploading(true);
    try {
      const { file, base64 } = await compressImage(rawFile, 1200, 0.8);
      let finalUrl = base64;
      try {
        const cloudUrl = await supabaseService.uploadMedia(file, file.name, 'progress-photos', currentUser?.id || 'user_1');
        if (cloudUrl) finalUrl = cloudUrl;
      } catch (err) {
        console.warn('Falling back to compressed base64 photo:', err);
      }
      await updateCurrentLog(prev => ({
        ...prev,
        tasks: { ...prev.tasks, progressPhoto: { completed: true, photoUrl: finalUrl, takenAt: new Date().toISOString() } },
      }));
      setExpanded(prev => new Set(prev).add('progressPhoto'));
    } catch (err) {
      console.error('Photo upload error:', err);
      alert('Could not process that photo. Please try another one.');
    } finally {
      setUploading(false);
    }
  };

  const activityTarget = (t: ActivityType) => (noGym ? getNoGymActivityTarget(t, config) : getNormalActivityTarget(t, config));
  const activityTargets: Record<ActivityType, { label: string; unit: string; target: number; step: string }> = {
    steps: { label: `${(activityTarget('steps') / 1000).toFixed(0)}K steps`, unit: 'steps', target: activityTarget('steps'), step: '100' },
    run: { label: `${activityTarget('run')} km`, unit: 'km', target: activityTarget('run'), step: '0.1' },
    floors: { label: `${activityTarget('floors')} floors`, unit: 'floors', target: activityTarget('floors'), step: '1' },
  };
  const pa = tasks.physicalActivity;
  const paTarget = activityTargets[pa.type] || activityTargets.steps;

  const isHabitEnabled = (id: string) => {
    const h = config.habits?.find(x => x.id === id);
    return h ? h.enabled !== false : true;
  };

  const card = (id: string, extra: Partial<React.ComponentProps<typeof TaskCard>> = {}) => ({
    id,
    title: title(id),
    subtitle: desc(id),
    done: done(id),
    onToggle: () => onToggle(id),
    disabled,
    expanded: expanded.has(id),
    onExpand: () => toggleExpand(id),
    ...extra,
  });

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

      {!isEditable && (
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
      {isAdmin && !isToday && (
        <Notice tone="violet" icon={ShieldCheck} title="Admin override">
          You're editing {currentUser?.name}'s log for {formatPrettyDate(currentDate)}.
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

      {/* Habits */}
      <section className="space-y-2.5">
        <SectionHeader title="Daily habits" className="mb-0" />

        {isHabitEnabled('wakeUp') && (
          <TaskCard
            {...card('wakeUp', {
              subtitle: tasks.wakeUp.actualTime
                ? tasks.wakeUp.actualTime > wakeDeadline
                  ? `Up at ${formatTime12(tasks.wakeUp.actualTime)} · late`
                  : `Checked in at ${formatTime12(tasks.wakeUp.actualTime)}`
                : !isAdmin && !wakeWindowOpen && !done('wakeUp')
                ? `Missed · check-in closed at ${formatTime12(wakeDeadline)}`
                : desc('wakeUp'),
              disabled: disabled || (!isAdmin && !wakeWindowOpen),
            })}
          >
            {isAdmin ? (
              <>
                <Row label="Wake-up time (admin)">
                  <input
                    type="time"
                    disabled={disabled}
                    value={tasks.wakeUp.actualTime || ''}
                    onChange={e => {
                      const val = e.target.value;
                      update('wakeUp', { actualTime: val, completed: Boolean(val && val <= wakeDeadline) });
                    }}
                    className="input w-36 text-center"
                  />
                </Row>
                <p className="text-[13px] text-zinc-500">
                  Counts up to {formatTime12(wakeDeadline)} ({formatTime12(wakeTarget)} + {config.wakeUpGraceMinutes} min buffer).
                </p>
              </>
            ) : done('wakeUp') ? (
              <p className="text-sm text-emerald-400 pt-3">
                Checked in at {formatTime12(tasks.wakeUp.actualTime || '')}.
                {wakeWindowOpen && <span className="text-zinc-500"> You can undo until {formatTime12(wakeDeadline)}.</span>}
              </p>
            ) : wakeWindowOpen ? (
              <div className="pt-3 space-y-2">
                <button type="button" onClick={() => onToggle('wakeUp')} className="btn-primary w-full">
                  I'm up – check in now
                </button>
                <p className="text-[13px] text-zinc-500 text-center">
                  Target {formatTime12(wakeTarget)} · counts until {formatTime12(wakeDeadline)}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-rose-300 pt-3 leading-relaxed">
                {isToday
                  ? `Check-in closed at ${formatTime12(wakeDeadline)}. Only the referee can change this now.`
                  : 'Wake-up can only be checked in on the day itself.'}
              </p>
            )}
          </TaskCard>
        )}

        {isHabitEnabled('noMasturbation') && <TaskCard {...card('noMasturbation')} />}
        {isHabitEnabled('noSmokingAlcohol') && <TaskCard {...card('noSmokingAlcohol')} />}

        {isHabitEnabled('reading') && (
          <TaskCard
            {...card('reading', {
              subtitle: tasks.reading.pagesRead ? `${tasks.reading.pagesRead} pages read` : desc('reading'),
            })}
          >
            <Row label="Pages read">
              <Stepper
                disabled={disabled}
                value={tasks.reading.pagesRead}
                onDec={() => {
                  const v = Math.max(0, tasks.reading.pagesRead - 1);
                  update('reading', { pagesRead: v, completed: v >= config.readingMinPages });
                }}
                onInc={() => {
                  const v = tasks.reading.pagesRead + 1;
                  update('reading', { pagesRead: v, completed: v >= config.readingMinPages });
                }}
              />
            </Row>
            <input
              className="input"
              disabled={disabled}
              placeholder="Book title"
              value={tasks.reading.bookTitle || ''}
              onChange={e => update('reading', { bookTitle: e.target.value })}
            />
            <input
              className="input"
              disabled={disabled}
              placeholder="Key takeaway"
              value={tasks.reading.keyTakeaway || ''}
              onChange={e => update('reading', { keyTakeaway: e.target.value })}
            />
          </TaskCard>
        )}

        {/* No gym today: the Gym habit is dropped and Physical Activity carries the bumped target */}
        {!noGym && isHabitEnabled('gym') && (
          <TaskCard {...card('gym', { subtitle: tasks.gym.workoutNotes || desc('gym') })}>
            <input
              className="input mt-3"
              disabled={disabled}
              placeholder="What did you train? e.g. Push day, 50 min"
              value={tasks.gym.workoutNotes || ''}
              onChange={e => update('gym', { workoutNotes: e.target.value })}
            />
          </TaskCard>
        )}

        {isHabitEnabled('physicalActivity') && (
          <TaskCard
            {...card('physicalActivity', {
              subtitle: pa.value ? `${pa.value.toLocaleString('en-IN')} / ${paTarget.target.toLocaleString('en-IN')} ${paTarget.unit}` : desc('physicalActivity'),
              badge: noGym ? <Chip tone="violet">No gym</Chip> : undefined,
            })}
          >
            {noGym && (
              <p className="text-[13px] text-violet-200/90 pt-3">No gym today, so the Gym habit is off and these targets are higher.</p>
            )}
            <div className="pt-3">
              <Segmented
                disabled={disabled}
                value={pa.type}
                onChange={type => update('physicalActivity', { type, value: 0, completed: false })}
                options={(['steps', 'run', 'floors'] as ActivityType[]).map(t => ({ value: t, label: activityTargets[t].label }))}
              />
            </div>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step={paTarget.step}
                className="input pr-16"
                disabled={disabled}
                placeholder={`Enter ${paTarget.unit}`}
                value={pa.value || ''}
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  update('physicalActivity', { value: val, completed: val >= paTarget.target });
                }}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">{paTarget.unit}</span>
            </div>
            <ProgressBar
              value={paTarget.target ? ((pa.value || 0) / paTarget.target) * 100 : 0}
              tone={done('physicalActivity') ? 'emerald' : 'rose'}
            />
          </TaskCard>
        )}

        {isHabitEnabled('diet') && (
          <TaskCard
            {...card('diet', {
              subtitle:
                tasks.diet.calories || tasks.diet.proteinGrams
                  ? `${(tasks.diet.calories || 0).toLocaleString('en-IN')} kcal · ${tasks.diet.proteinGrams || 0} g protein`
                  : desc('diet'),
            })}
          >
            <div className="grid grid-cols-2 gap-2 pt-3">
              {(
                [
                  { key: 'calories', label: 'Calories', unit: 'kcal', target: config.calorieTarget, quick: [250, 500], tone: 'amber' },
                  { key: 'proteinGrams', label: 'Protein', unit: 'g', target: config.proteinTargetG, quick: [10, 25], tone: 'emerald' },
                ] as const
              ).map(n => {
                const val = Number(tasks.diet[n.key] || 0);
                const pct = n.target ? (val / n.target) * 100 : 0;
                return (
                  <div key={n.key} className="rounded-xl bg-ink-850 border border-white/[0.06] p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] text-zinc-500">{n.label}</span>
                      <span className="text-[12px] text-zinc-600 tabular">/ {n.target.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        disabled={disabled}
                        value={val || ''}
                        placeholder="0"
                        aria-label={`${n.label} today`}
                        onChange={e => update('diet', { [n.key]: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                        className="w-full min-w-0 bg-transparent text-xl font-bold text-white tabular focus:outline-none placeholder:text-zinc-600 disabled:opacity-60"
                      />
                      <span className="text-[13px] text-zinc-500 shrink-0">{n.unit}</span>
                    </div>
                    <ProgressBar value={pct} tone={pct > 110 && n.key === 'calories' ? 'rose' : n.tone} className="mt-2" />
                    <div className="flex gap-1.5 mt-2.5">
                      {n.quick.map(q => (
                        <button
                          key={q}
                          type="button"
                          disabled={disabled}
                          onClick={() => update('diet', { [n.key]: val + q })}
                          className="flex-1 h-8 rounded-lg bg-white/[0.06] text-[12px] font-semibold text-zinc-300 active:bg-white/[0.1] disabled:opacity-40"
                        >
                          +{q}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <input
              className="input"
              disabled={disabled}
              placeholder="What did you eat today?"
              value={tasks.diet.notes || ''}
              onChange={e => update('diet', { notes: e.target.value })}
            />
          </TaskCard>
        )}

        {isHabitEnabled('progressPhoto') && (
          <TaskCard
            {...card('progressPhoto', {
              subtitle: tasks.progressPhoto.photoUrl ? 'Photo added' : desc('progressPhoto'),
            })}
          >
            <div className="pt-3">
              {uploading ? (
                <div className="h-40 rounded-xl bg-ink-850 flex items-center justify-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="w-5 h-5 animate-spin" /> Uploading…
                </div>
              ) : tasks.progressPhoto.photoUrl ? (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/5] max-h-80 mx-auto">
                  <img src={tasks.progressPhoto.photoUrl} alt="Progress" className="w-full h-full object-cover" />
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-3 right-3 btn-sm btn bg-black/70 text-white backdrop-blur"
                    >
                      <Upload className="w-4 h-4" /> Replace
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 rounded-xl border-2 border-dashed border-white/[0.12] flex flex-col items-center justify-center gap-1.5 text-zinc-400 active:bg-white/[0.03] disabled:opacity-40"
                >
                  <Upload className="w-6 h-6 text-rose-400" />
                  <span className="text-[15px] font-semibold text-white">Take or upload photo</span>
                  <span className="text-[12px]">Camera or gallery</span>
                </button>
              )}
            </div>
          </TaskCard>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

        {isHabitEnabled('learning') && (
          <TaskCard {...card('learning', { subtitle: tasks.learning.topic || desc('learning') })}>
            <input
              className="input mt-3"
              disabled={disabled}
              placeholder="Topic"
              value={tasks.learning.topic || ''}
              onChange={e => update('learning', { topic: e.target.value })}
            />
            <input
              className="input"
              disabled={disabled}
              placeholder="What did you learn?"
              value={tasks.learning.notes || ''}
              onChange={e => update('learning', { notes: e.target.value })}
            />
          </TaskCard>
        )}

        {isHabitEnabled('health') && (
          <TaskCard
            {...card('health', {
              subtitle: tasks.health.waterLiters ? `${tasks.health.waterLiters} L water` : desc('health'),
            })}
          >
            <Row label="Water">
              <Stepper
                disabled={disabled}
                value={`${tasks.health.waterLiters || 0} L`}
                onDec={() => update('health', { waterLiters: Math.max(0, (tasks.health.waterLiters || 0) - 0.5) })}
                onInc={() => update('health', { waterLiters: (tasks.health.waterLiters || 0) + 0.5 })}
              />
            </Row>
            <input
              className="input"
              disabled={disabled}
              placeholder="How's your mind today?"
              value={tasks.health.notes || ''}
              onChange={e => update('health', { notes: e.target.value })}
            />
          </TaskCard>
        )}

        {isHabitEnabled('family') && (
          <TaskCard
            {...card('family', {
              subtitle: tasks.family.minutes ? `${tasks.family.minutes} min with family` : desc('family'),
            })}
          >
            <Row label="Minutes">
              <Stepper
                disabled={disabled}
                value={`${tasks.family.minutes} min`}
                onDec={() => {
                  const m = Math.max(0, tasks.family.minutes - 5);
                  update('family', { minutes: m, completed: m >= config.familyTargetMinutes });
                }}
                onInc={() => {
                  const m = tasks.family.minutes + 5;
                  update('family', { minutes: m, completed: m >= config.familyTargetMinutes });
                }}
              />
            </Row>
          </TaskCard>
        )}

        {/* Custom Habits */}
        {((config.habits || []).filter(h => (h.category === 'custom' || h.id.startsWith('custom_')) && h.enabled !== false)).map(habit => {
          const customData = tasks.custom?.[habit.id];
          return (
            <TaskCard
              key={habit.id}
              {...card(habit.id, {
                title: habit.name,
                subtitle:
                  habit.description ||
                  (habit.targetValue && habit.targetUnit
                    ? `Target: ${habit.targetValue} ${habit.targetUnit}`
                    : habit.required === false
                    ? 'Optional habit'
                    : 'Daily habit'),
                icon: getTaskIcon(habit.id, habit.icon),
                badge: habit.required === false ? <Chip tone="neutral">Optional</Chip> : undefined,
              })}
            >
              <div className="pt-3 space-y-2">
                {habit.targetType === 'number' && (
                  <Row label={habit.targetUnit || 'Value'}>
                    <input
                      type="number"
                      disabled={disabled}
                      value={customData?.value ?? ''}
                      placeholder={`Target: ${habit.targetValue || 0}`}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        const reqVal = habit.targetValue ?? 1;
                        updateCurrentLog(prev => ({
                          ...prev,
                          tasks: {
                            ...prev.tasks,
                            custom: {
                              ...prev.tasks?.custom,
                              [habit.id]: {
                                completed: val >= reqVal,
                                value: val,
                                notes: customData?.notes || '',
                              },
                            },
                          },
                        }));
                      }}
                      className="input w-36 text-center"
                    />
                  </Row>
                )}
                <input
                  className="input"
                  disabled={disabled}
                  placeholder="Notes / reflection"
                  value={customData?.notes || ''}
                  onChange={e => {
                    const n = e.target.value;
                    updateCurrentLog(prev => ({
                      ...prev,
                      tasks: {
                        ...prev.tasks,
                        custom: {
                          ...prev.tasks?.custom,
                          [habit.id]: {
                            completed: customData?.completed ?? false,
                            value: customData?.value,
                            notes: n,
                          },
                        },
                      },
                    }));
                  }}
                />
              </div>
            </TaskCard>
          );
        })}
      </section>

      {/* Optional */}
      <section className="space-y-2.5 pt-2">
        <SectionHeader title="Optional" className="mb-0" />
        <Card className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-[15px] font-semibold text-white">Sport</h3>
          </div>
          <input
            className="input"
            disabled={disabled}
            placeholder="Sport, e.g. Badminton"
            value={currentLog.sport?.sportName || ''}
            onChange={e => {
              const val = e.target.value;
              updateCurrentLog(prev => ({ ...prev, sport: { ...prev.sport, sportName: val, participated: Boolean(val.trim()) } }));
            }}
          />
          <input
            className="input"
            disabled={disabled}
            placeholder="What improved today?"
            value={currentLog.sport?.improvementNotes || ''}
            onChange={e => {
              const val = e.target.value;
              updateCurrentLog(prev => ({ ...prev, sport: { ...prev.sport, improvementNotes: val } }));
            }}
          />
        </Card>
        <Card className="space-y-3">
          <div className="flex items-center gap-2.5">
            <NotebookPen className="w-5 h-5 text-sky-400" />
            <h3 className="text-[15px] font-semibold text-white">Journal</h3>
          </div>
          <textarea
            rows={4}
            className="input"
            disabled={disabled}
            placeholder="How did you push through today?"
            value={currentLog.journalNotes || ''}
            onChange={e => {
              const val = e.target.value;
              updateCurrentLog(prev => ({ ...prev, journalNotes: val }));
            }}
          />
        </Card>
      </section>
    </div>
  );
};
