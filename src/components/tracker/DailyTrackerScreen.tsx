import React, { useRef, useState } from 'react';
import {
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
  Trophy,
  BookMarked,
  CheckCircle2,
  Circle,
  Plus,
  Minus,
  Upload,
  Lock,
  Calendar,
  PlaneTakeoff,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  getEffectiveWakeUpTarget,
  evaluateGymCompletion,
  evaluatePhysicalActivity,
  validateDayTasks,
  formatDate,
} from '../../services/rulesEngine';
import { TaskState, ActivityType } from '../../types';
import { supabaseService } from '../../services/supabaseService';

interface DailyTrackerScreenProps {
  initialTaskId?: keyof TaskState;
}

export const DailyTrackerScreen: React.FC<DailyTrackerScreenProps> = () => {
  const {
    currentLog,
    updateCurrentLog,
    config,
    celebrateCompletion,
    isEditable,
    isToday,
    currentDate,
    setCurrentDate,
    currentUser,
    isAdmin,
    adminOverrideMode,
  } = useChallenge();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(currentLog.tasks.progressPhoto.photoUrl || null);

  const { tasks, travel, sickness } = currentLog;
  const effectiveWakeTarget = getEffectiveWakeUpTarget(travel.hours, travel.isTravelling, config);
  const gymEval = evaluateGymCompletion(tasks.gym, travel, config);
  const paEval = evaluatePhysicalActivity(tasks.physicalActivity, config);
  const { allCompleted, completedCount, totalCount } = validateDayTasks(currentLog, config);

  // Photo uploader
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditable) {
      alert("🔒 LOCKED: You can only upload progress photos for TODAY'S checklist.");
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setPhotoPreview(base64);

        let finalUrl = base64;
        try {
          const cloudUrl = await supabaseService.uploadMedia(
            file,
            file.name,
            'progress-photos',
            currentUser?.id || 'user_1'
          );
          if (cloudUrl) finalUrl = cloudUrl;
        } catch (err) {
          console.warn('Fallback to base64 for photo:', err);
        }

        updateCurrentLog(prev => ({
          ...prev,
          tasks: {
            ...prev.tasks,
            progressPhoto: {
              completed: true,
              photoUrl: finalUrl,
              takenAt: new Date().toISOString(),
            },
          },
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const updateTaskField = <K extends keyof TaskState>(key: K, data: Partial<TaskState[K]>) => {
    if (!isEditable) {
      alert("🔒 LOCKED: In 75 HARD, you can only make changes to TODAY'S checklist.");
      return;
    }
    updateCurrentLog(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [key]: {
          ...prev.tasks[key],
          ...data,
        },
      },
    }));
  };

  return (
    <div className="space-y-4 pb-8">
      {/* ADMIN OVERRIDE BANNER */}
      {(isAdmin || adminOverrideMode) && !isToday && (
        <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/50 flex items-center justify-between text-xs text-purple-200">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <span className="font-bold text-purple-300">Admin Override Mode Active ({currentDate})</span>
              <p className="text-[11px] text-purple-200/80">
                You have master permissions to edit past and future tasks for {currentUser?.name || 'Challenger'}.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentDate(formatDate(new Date()))}
            className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] shrink-0"
          >
            Today
          </button>
        </div>
      )}

      {/* LOCKED PAST/FUTURE DAY NOTICE FOR STANDARD USERS */}
      {!isEditable && !isAdmin && !adminOverrideMode && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-300">
                Read-Only Log ({currentDate})
              </span>
              <p className="text-[11px] text-amber-200/80 leading-tight">
                75 HARD rules strictly permit editing <strong>TODAY'S</strong> checklist only. Login as Admin to unlock past/future days.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentDate(formatDate(new Date()))}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] shrink-0 transition-all active:scale-95 shadow-sm"
          >
            Go to Today
          </button>
        </div>
      )}

      {/* Top Completion Header */}
      <div className="rounded-xl glass-card p-3.5 border border-white/[0.08] flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm">{currentUser?.avatar || '🔥'}</span>
            <h2 className="text-base font-extrabold text-white">{currentUser?.name || 'Challenger'}'s Checklist</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {completedCount} of {totalCount} completed • {allCompleted ? 'Sealed & Victorious!' : isToday ? 'Keep pushing today' : 'Historical record'}
          </p>
        </div>
        {allCompleted && (
          <button
            onClick={() => celebrateCompletion()}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-glow-green active:scale-95 flex items-center space-x-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Celebrate!</span>
          </button>
        )}
      </div>

      {/* Dynamic Rule Alert if Travel or Sickness */}
      {travel.isTravelling && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200">
          <div className="flex items-center space-x-2 font-bold text-amber-300 mb-0.5">
            <PlaneTakeoff className="w-4 h-4" />
            <span>Travel Rule Active ({travel.hours} hrs)</span>
          </div>
          {travel.hours > 4 ? (
            <p>Wake up allowed until 8:00 AM. Gym is mandatory or substituted if unavailable.</p>
          ) : (
            <p>Travel is ≤4 hours. All standard targets apply without exceptions.</p>
          )}
        </div>
      )}

      {sickness.isExempt && (
        <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs text-blue-200">
          <div className="flex items-center space-x-2 font-bold text-blue-300 mb-0.5">
            <AlertCircle className="w-4 h-4" />
            <span>Medical Exemption Approved</span>
          </div>
          <p>Doctor prescription verified. Your 75-day streak is safely preserved.</p>
        </div>
      )}

      {/* 1. Wake Up */}
      <div className={`p-4 rounded-xl border transition-all ${
        tasks.wakeUp.completed ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${tasks.wakeUp.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <AlarmClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">1. Wake Up</h3>
              <p className="text-xs text-slate-400">
                Target: by <span className="text-rose-400 font-bold">{effectiveWakeTarget} AM</span>
                {travel.isTravelling && travel.hours > 4 && ' (Travel >4h adjusted)'}
              </p>
            </div>
          </div>
          <button
            disabled={!isEditable}
            onClick={() => updateTaskField('wakeUp', { completed: !tasks.wakeUp.completed })}
            className={`p-1.5 rounded-lg transition-transform active:scale-90 ${
              !isEditable ? 'cursor-not-allowed opacity-70' : tasks.wakeUp.completed ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tasks.wakeUp.completed ? <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" /> : <Circle className="w-6 h-6" />}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center space-x-3">
          <label className="text-xs text-slate-400">Actual Wake Time:</label>
          <input
            type="time"
            disabled={!isEditable}
            value={tasks.wakeUp.actualTime || ''}
            onChange={e => {
              const val = e.target.value;
              updateTaskField('wakeUp', {
                actualTime: val,
                completed: Boolean(val && val <= effectiveWakeTarget),
              });
            }}
            className={`border rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none ${
              !isEditable ? 'bg-black/20 border-white/5 cursor-not-allowed text-slate-400' : 'bg-black/40 border-white/10 focus:border-rose-500'
            }`}
          />
          {tasks.wakeUp.actualTime && (
            <span className={`text-[11px] font-semibold ${
              tasks.wakeUp.actualTime <= effectiveWakeTarget ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {tasks.wakeUp.actualTime <= effectiveWakeTarget ? '✓ On Target' : '⚠ Late Wakeup'}
            </span>
          )}
        </div>
      </div>

      {/* 2. No Masturbation */}
      <div className={`p-4 rounded-xl border transition-all ${
        tasks.noMasturbation.completed ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${tasks.noMasturbation.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">2. No Masturbation</h3>
              <p className="text-xs text-slate-400">Semen retention & dopamine control</p>
            </div>
          </div>
          <button
            disabled={!isEditable}
            onClick={() => updateTaskField('noMasturbation', { completed: !tasks.noMasturbation.completed })}
            className={`p-1.5 rounded-lg transition-transform active:scale-90 ${
              !isEditable ? 'cursor-not-allowed opacity-70' : tasks.noMasturbation.completed ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tasks.noMasturbation.completed ? <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" /> : <Circle className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* 3. No Smoking / Alcohol */}
      <div className={`p-4 rounded-xl border transition-all ${
        tasks.noSmokingAlcohol.completed ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${tasks.noSmokingAlcohol.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <WineOff className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">3. No Smoking / Alcohol</h3>
              <p className="text-xs text-slate-400">Zero substance consumption</p>
            </div>
          </div>
          <button
            disabled={!isEditable}
            onClick={() => updateTaskField('noSmokingAlcohol', { completed: !tasks.noSmokingAlcohol.completed })}
            className={`p-1.5 rounded-lg transition-transform active:scale-90 ${
              !isEditable ? 'cursor-not-allowed opacity-70' : tasks.noSmokingAlcohol.completed ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tasks.noSmokingAlcohol.completed ? <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" /> : <Circle className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* 4. Reading */}
      <div className={`p-4 rounded-xl border transition-all ${
        tasks.reading.completed || tasks.reading.pagesRead >= config.readingMinPages ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${tasks.reading.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">4. Reading</h3>
              <p className="text-xs text-slate-400">
                Target: <span className="text-rose-400 font-bold">{config.readingMinPages}–{config.readingMaxPages} pages</span> of non-fiction
              </p>
            </div>
          </div>
          <button
            disabled={!isEditable}
            onClick={() => updateTaskField('reading', {
              completed: !tasks.reading.completed,
              pagesRead: !tasks.reading.completed ? Math.max(tasks.reading.pagesRead, config.readingMinPages) : tasks.reading.pagesRead,
            })}
            className={`p-1.5 rounded-lg transition-transform active:scale-90 ${
              !isEditable ? 'cursor-not-allowed opacity-70' : tasks.reading.completed || tasks.reading.pagesRead >= config.readingMinPages ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tasks.reading.completed || tasks.reading.pagesRead >= config.readingMinPages ? (
              <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" />
            ) : (
              <Circle className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Counter and book inputs */}
        <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Pages Read Today:</span>
            <div className="flex items-center space-x-2">
              <button
                disabled={!isEditable}
                onClick={() => {
                  const val = Math.max(0, tasks.reading.pagesRead - 1);
                  updateTaskField('reading', {
                    pagesRead: val,
                    completed: val >= config.readingMinPages,
                  });
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
                  !isEditable ? 'bg-white/5 opacity-50 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 active:scale-95'
                }`}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold text-white w-8 text-center">{tasks.reading.pagesRead}</span>
              <button
                disabled={!isEditable}
                onClick={() => {
                  const val = tasks.reading.pagesRead + 1;
                  updateTaskField('reading', {
                    pagesRead: val,
                    completed: val >= config.readingMinPages,
                  });
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-rose-300 ${
                  !isEditable ? 'bg-white/5 opacity-50 cursor-not-allowed' : 'bg-rose-600/30 hover:bg-rose-600/50 active:scale-95'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <input
            type="text"
            disabled={!isEditable}
            placeholder="Book Title (e.g. Can't Hurt Me)"
            value={tasks.reading.bookTitle || ''}
            onChange={e => updateTaskField('reading', { bookTitle: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-60"
          />
          <input
            type="text"
            disabled={!isEditable}
            placeholder="Key takeaway / quote from today's reading..."
            value={tasks.reading.keyTakeaway || ''}
            onChange={e => updateTaskField('reading', { keyTakeaway: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* 5. Gym Workout */}
      <div className={`p-4 rounded-xl border transition-all ${
        gymEval.satisfied ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${gymEval.satisfied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">5. Gym Workout</h3>
                {gymEval.isSubstituted && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                    Travel Sub Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{gymEval.reason}</p>
            </div>
          </div>
          <button
            disabled={!isEditable}
            onClick={() => updateTaskField('gym', { completed: !tasks.gym.completed })}
            className={`p-1.5 rounded-lg transition-transform active:scale-90 ${
              !isEditable ? 'cursor-not-allowed opacity-70' : gymEval.satisfied ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {gymEval.satisfied ? <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" /> : <Circle className="w-6 h-6" />}
          </button>
        </div>

        {/* Travel substitution form if gym unavailable on >4h travel */}
        {travel.isTravelling && travel.hours > config.travelThresholdHours && !travel.gymAvailable ? (
          <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2">
            <p className="text-xs text-amber-300 font-semibold">
              Gym unavailable during travel. Choose substitution:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!isEditable}
                onClick={() => updateTaskField('gym', { substituteType: 'steps' })}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                  tasks.gym.substituteType === 'steps'
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                    : 'bg-black/30 text-slate-400 border-white/5'
                }`}
              >
                15,000 Steps
              </button>
              <button
                type="button"
                disabled={!isEditable}
                onClick={() => updateTaskField('gym', { substituteType: 'run' })}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                  tasks.gym.substituteType === 'run'
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                    : 'bg-black/30 text-slate-400 border-white/5'
                }`}
              >
                5.0 KM Run
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="number"
                disabled={!isEditable}
                placeholder={tasks.gym.substituteType === 'steps' ? 'Steps (min 15000)' : 'KM (min 5.0)'}
                value={tasks.gym.substituteValue || ''}
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  const satisfied =
                    tasks.gym.substituteType === 'steps'
                      ? val >= config.travelSubstituteSteps
                      : val >= config.travelSubstituteRunKm;
                  updateTaskField('gym', {
                    substituteValue: val,
                    completed: satisfied,
                    isSubstituted: true,
                  });
                }}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-white/[0.05]">
            <input
              type="text"
              disabled={!isEditable}
              placeholder="Workout notes (e.g. Chest & Triceps, 50 min heavy)..."
              value={tasks.gym.workoutNotes || ''}
              onChange={e => updateTaskField('gym', { workoutNotes: e.target.value })}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-60"
            />
          </div>
        )}
      </div>

      {/* 6. Physical Activity */}
      <div className={`p-4 rounded-xl border transition-all ${
        paEval.satisfied || tasks.physicalActivity.completed ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${paEval.satisfied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <Footprints className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">6. Physical Activity</h3>
              <p className="text-xs text-slate-400">{paEval.reason}</p>
            </div>
          </div>
          <button
            disabled={!isEditable}
            onClick={() => updateTaskField('physicalActivity', { completed: !tasks.physicalActivity.completed })}
            className={`p-1.5 rounded-lg transition-transform active:scale-90 ${
              !isEditable ? 'cursor-not-allowed opacity-70' : paEval.satisfied || tasks.physicalActivity.completed ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {paEval.satisfied || tasks.physicalActivity.completed ? (
              <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" />
            ) : (
              <Circle className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Choice selector */}
        <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {(['steps', 'run', 'floors'] as ActivityType[]).map(type => (
              <button
                key={type}
                type="button"
                disabled={!isEditable}
                onClick={() => updateTaskField('physicalActivity', { type })}
                className={`py-1 rounded-lg text-xs font-semibold capitalize border transition-all ${
                  tasks.physicalActivity.type === type
                    ? 'bg-rose-600/20 text-rose-300 border-rose-500/50 font-bold'
                    : 'bg-black/30 text-slate-400 border-white/5'
                }`}
              >
                {type === 'steps' ? '10K Steps' : type === 'run' ? '3K Run' : '20 Floors'}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="number"
              disabled={!isEditable}
              placeholder={`Enter logged ${tasks.physicalActivity.type}...`}
              value={tasks.physicalActivity.value || ''}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0;
                let done = false;
                if (tasks.physicalActivity.type === 'steps' && val >= config.stepsTarget) done = true;
                if (tasks.physicalActivity.type === 'run' && val >= config.runTargetKm) done = true;
                if (tasks.physicalActivity.type === 'floors' && val >= config.floorsTarget) done = true;

                updateTaskField('physicalActivity', {
                  value: val,
                  completed: done,
                });
              }}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* 7. Clean Diet */}
      <div className={`p-4 rounded-xl border transition-all ${
        tasks.diet.completed && tasks.diet.cleanDietChecked ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${tasks.diet.cleanDietChecked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <Salad className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">7. Clean Diet</h3>
              <p className="text-xs text-slate-400">No added sugar • Low oil • Zero junk food</p>
            </div>
          </div>
          <button
            disabled={!isEditable}
            onClick={() => {
              const next = !tasks.diet.cleanDietChecked;
              updateTaskField('diet', { cleanDietChecked: next, completed: next });
            }}
            className={`p-1.5 rounded-lg transition-transform active:scale-90 ${
              !isEditable ? 'cursor-not-allowed opacity-70' : tasks.diet.cleanDietChecked ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tasks.diet.cleanDietChecked ? <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" /> : <Circle className="w-6 h-6" />}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.05]">
          <input
            type="text"
            disabled={!isEditable}
            placeholder="Today's meals log (e.g. Oats, Chicken breast, Salad, Nuts)..."
            value={tasks.diet.notes || ''}
            onChange={e => updateTaskField('diet', { notes: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* 8. Progress Photo */}
      <div className={`p-4 rounded-xl border transition-all ${
        tasks.progressPhoto.photoUrl ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${tasks.progressPhoto.photoUrl ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">8. Daily Progress Photo</h3>
              <p className="text-xs text-slate-400">1 Full body physique picture</p>
            </div>
          </div>
          <div className="text-right">
            {tasks.progressPhoto.photoUrl ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Uploaded</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-rose-400">Required</span>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.05]">
          {photoPreview || tasks.progressPhoto.photoUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/50 aspect-video max-h-48 flex items-center justify-center">
              <img
                src={photoPreview || tasks.progressPhoto.photoUrl}
                alt="Today Progress"
                className="w-full h-full object-cover"
              />
              {isEditable && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 px-2.5 py-1 rounded bg-black/70 hover:bg-black text-[11px] font-bold text-white backdrop-blur flex items-center space-x-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>Replace</span>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={!isEditable}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${
                !isEditable
                  ? 'border-white/5 opacity-50 cursor-not-allowed text-slate-600'
                  : 'border-white/15 hover:border-rose-500/50 text-slate-400 hover:text-white bg-white/[0.02]'
              }`}
            >
              <Upload className="w-6 h-6 mb-1 text-rose-500" />
              <span className="text-xs font-bold">Snap or Upload Photo</span>
              <span className="text-[10px] text-slate-500">{isEditable ? 'Camera / Gallery support' : 'Locked for historical days'}</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>
      </div>

      {/* 9. Learn Something New */}
      <div className={`p-4 rounded-xl border transition-all ${
        tasks.learning.completed ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${tasks.learning.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">9. Learn Something New</h3>
              <p className="text-xs text-slate-400">Skill, knowledge, or intellectual growth</p>
            </div>
          </div>
          <button
            disabled={!isEditable}
            onClick={() => updateTaskField('learning', { completed: !tasks.learning.completed })}
            className={`p-1.5 rounded-lg transition-transform active:scale-90 ${
              !isEditable ? 'cursor-not-allowed opacity-70' : tasks.learning.completed ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tasks.learning.completed ? <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" /> : <Circle className="w-6 h-6" />}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2">
          <input
            type="text"
            disabled={!isEditable}
            placeholder="Topic (e.g. Distributed Systems, Public Speaking)..."
            value={tasks.learning.topic || ''}
            onChange={e => updateTaskField('learning', { topic: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-60"
          />
          <input
            type="text"
            disabled={!isEditable}
            placeholder="What key lesson did you absorb today?..."
            value={tasks.learning.notes || ''}
            onChange={e => updateTaskField('learning', { notes: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* 10. Physical & Mental Health */}
      <div className={`p-4 rounded-xl border transition-all ${
        tasks.health.completed && tasks.health.mentalHealthMaintained ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${tasks.health.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">10. Physical & Mental Health</h3>
              <p className="text-xs text-slate-400">Hydration, posture, meditation, recovery</p>
            </div>
          </div>
          <button
            disabled={!isEditable}
            onClick={() => {
              const next = !tasks.health.mentalHealthMaintained;
              updateTaskField('health', { mentalHealthMaintained: next, completed: next });
            }}
            className={`p-1.5 rounded-lg transition-transform active:scale-90 ${
              !isEditable ? 'cursor-not-allowed opacity-70' : tasks.health.mentalHealthMaintained ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tasks.health.mentalHealthMaintained ? <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" /> : <Circle className="w-6 h-6" />}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Water Hydration (Liters):</span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={!isEditable}
                onClick={() => updateTaskField('health', { waterLiters: Math.max(0, (tasks.health.waterLiters || 0) - 0.5) })}
                className={`w-6 h-6 rounded flex items-center justify-center text-white ${
                  !isEditable ? 'bg-white/5 opacity-50 cursor-not-allowed' : 'bg-white/5 active:scale-95'
                }`}
              >
                -
              </button>
              <span className="font-bold text-white w-10 text-center">{tasks.health.waterLiters || 0} L</span>
              <button
                type="button"
                disabled={!isEditable}
                onClick={() => updateTaskField('health', { waterLiters: (tasks.health.waterLiters || 0) + 0.5 })}
                className={`w-6 h-6 rounded flex items-center justify-center text-rose-300 ${
                  !isEditable ? 'bg-white/5 opacity-50 cursor-not-allowed' : 'bg-rose-600/30 active:scale-95'
                }`}
              >
                +
              </button>
            </div>
          </div>
          <input
            type="text"
            disabled={!isEditable}
            placeholder="Mental health check-in notes (e.g. 10m breathwork, calm focus)..."
            value={tasks.health.notes || ''}
            onChange={e => updateTaskField('health', { notes: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* 11. Family */}
      <div className={`p-4 rounded-xl border transition-all ${
        tasks.family.completed || tasks.family.minutes >= config.familyTargetMinutes ? 'bg-emerald-950/20 border-emerald-500/30' : 'glass-card border-white/[0.08]'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${tasks.family.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">11. Family Connection</h3>
              <p className="text-xs text-slate-400">
                Target: at least <span className="text-rose-400 font-bold">{config.familyTargetMinutes} minutes</span> dedicated conversation
              </p>
            </div>
          </div>
          <button
            disabled={!isEditable}
            onClick={() => updateTaskField('family', {
              completed: !tasks.family.completed,
              minutes: !tasks.family.completed ? Math.max(tasks.family.minutes, config.familyTargetMinutes) : tasks.family.minutes,
            })}
            className={`p-1.5 rounded-lg transition-transform active:scale-90 ${
              !isEditable ? 'cursor-not-allowed opacity-70' : tasks.family.completed || tasks.family.minutes >= config.familyTargetMinutes ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tasks.family.completed || tasks.family.minutes >= config.familyTargetMinutes ? (
              <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" />
            ) : (
              <Circle className="w-6 h-6" />
            )}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Minutes Spent:</span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={!isEditable}
                onClick={() => {
                  const m = Math.max(0, tasks.family.minutes - 5);
                  updateTaskField('family', { minutes: m, completed: m >= config.familyTargetMinutes });
                }}
                className={`w-6 h-6 rounded flex items-center justify-center text-white ${
                  !isEditable ? 'bg-white/5 opacity-50 cursor-not-allowed' : 'bg-white/5 active:scale-95'
                }`}
              >
                -
              </button>
              <span className="font-bold text-white w-12 text-center">{tasks.family.minutes} min</span>
              <button
                type="button"
                disabled={!isEditable}
                onClick={() => {
                  const m = tasks.family.minutes + 5;
                  updateTaskField('family', { minutes: m, completed: m >= config.familyTargetMinutes });
                }}
                className={`w-6 h-6 rounded flex items-center justify-center text-rose-300 ${
                  !isEditable ? 'bg-white/5 opacity-50 cursor-not-allowed' : 'bg-rose-600/30 active:scale-95'
                }`}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Optional: Sport Improvement */}
      <div className="p-4 rounded-xl glass-card border border-white/[0.08]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="text-sm font-bold text-white">Sport Tracking</h3>
                <span className="text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded font-medium">Optional</span>
              </div>
              <p className="text-xs text-slate-400">Track improvement in any sport</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 mt-2">
          <input
            type="text"
            disabled={!isEditable}
            placeholder="Sport Name (e.g. Boxing, Swimming, Badminton, Football)..."
            value={currentLog.sport?.sportName || ''}
            onChange={e => {
              const val = e.target.value;
              updateCurrentLog(prev => ({
                ...prev,
                sport: {
                  ...prev.sport,
                  sportName: val,
                  participated: Boolean(val.trim()),
                },
              }));
            }}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-60"
          />
          <input
            type="text"
            disabled={!isEditable}
            placeholder="What skill or metric improved today?..."
            value={currentLog.sport?.improvementNotes || ''}
            onChange={e => {
              const val = e.target.value;
              updateCurrentLog(prev => ({
                ...prev,
                sport: {
                  ...prev.sport,
                  improvementNotes: val,
                },
              }));
            }}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Daily Journal / Notes */}
      <div className="p-4 rounded-xl glass-card border border-white/[0.08]">
        <div className="flex items-center space-x-2.5 mb-2">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Daily Journal</h3>
            <p className="text-xs text-slate-400">Reflections, mindset & obstacles conquered</p>
          </div>
        </div>
        <textarea
          rows={3}
          disabled={!isEditable}
          placeholder="How did you fight resistance today? What challenged your discipline?..."
          value={currentLog.journalNotes || ''}
          onChange={e => updateCurrentLog(prev => ({ ...prev, journalNotes: e.target.value }))}
          className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none disabled:opacity-60"
        />
      </div>
    </div>
  );
};
