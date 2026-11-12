import React, { useRef, useState } from 'react';
import {
  PlaneTakeoff,
  Stethoscope,
  Upload,
  FileCheck,
  ShieldCheck,
  Hourglass,
  CircleX,
  Lock,
  Loader2,
  Info,
  CalendarClock,
  Dumbbell,
  AlarmClock,
  Footprints,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  describeNoGymTargets,
  formatDate,
  formatPrettyDate,
  formatTime12,
  getEffectiveWakeUpTarget,
  getWakeUpDeadline,
  getNormalWakeUpDeadline,
} from '../../services/rulesEngine';
import { supabaseService } from '../../services/supabaseService';
import { compressImage } from '../../services/imageCompression';
import { Card, Notice, ScreenTitle, Switch } from '../ui';
import type { ChallengeConfig, TravelInfo } from '../../types';

/** Trip length slider + wake-up rule + destination, shared by today and tomorrow */
const TripFields: React.FC<{
  travel: TravelInfo;
  disabled: boolean;
  config: ChallengeConfig;
  onChange: (patch: Partial<TravelInfo>) => void;
  when?: 'today' | 'tomorrow';
}> = ({ travel, disabled, config, onChange, when = 'today' }) => {
  const isLong = travel.hours > config.travelThresholdHours;
  const lockedOut = when === 'today' && travel.addedAfterWakeUp;
  return (
    <div className="space-y-4 pt-4 border-t border-white/[0.05]">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">Travel time</span>
          <span className="text-[15px] font-semibold text-amber-300 tabular">{travel.hours} hours</span>
        </div>
        <input
          type="range"
          min="1"
          max="18"
          step="0.5"
          aria-label={`Travel hours ${when}`}
          disabled={disabled}
          value={travel.hours}
          onChange={e => onChange({ hours: parseFloat(e.target.value) })}
          className="w-full h-2 accent-amber-500 disabled:opacity-50"
        />
        <div className="flex justify-between text-[12px] text-zinc-600 mt-1">
          <span>1 h</span>
          <span>{config.travelThresholdHours} h threshold</span>
          <span>18 h</span>
        </div>
      </div>

      <div className={`rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${isLong ? 'bg-amber-500/10 text-amber-200' : 'bg-white/[0.04] text-zinc-400'}`}>
        {isLong && lockedOut ? (
          <>
            Turned on after the {formatTime12(getNormalWakeUpDeadline(config))} check-in closed, so today's wake-up stays{' '}
            <b>{formatTime12(config.wakeUpTarget)}</b>. Plan trips the night before in Tomorrow's plan.
          </>
        ) : isLong ? (
          <>
            Over {config.travelThresholdHours} h: wake up by <b>{formatTime12(config.wakeUpTravelTarget)}</b> {when} instead of{' '}
            {formatTime12(config.wakeUpTarget)}.
          </>
        ) : (
          <>
            {config.travelThresholdHours} h or less: normal wake-up ({formatTime12(config.wakeUpTarget)}).
            {when === 'today' && ` A long trip only moves today's wake-up if set before ${formatTime12(getNormalWakeUpDeadline(config))}.`}
          </>
        )}
      </div>

      <input
        className="input"
        disabled={disabled}
        placeholder="Where are you going? (optional)"
        value={travel.destination || ''}
        onChange={e => onChange({ destination: e.target.value })}
      />
    </div>
  );
};

/** Gym access switch. No gym bumps the activity targets, which then cover the gym habit. */
const GymAccessCard: React.FC<{
  title: string;
  gymAvailable: boolean;
  disabled: boolean;
  config: ChallengeConfig;
  onChange: (available: boolean) => void;
}> = ({ title, gymAvailable, disabled, config, onChange }) => (
  <Card className="space-y-4">
    <div className="flex items-center gap-3">
      <span
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          gymAvailable ? 'bg-white/[0.05] text-zinc-400' : 'bg-violet-500/15 text-violet-400'
        }`}
      >
        <Dumbbell className="w-5 h-5" />
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-semibold text-white">{title}</h3>
        <p className="text-[13px] text-zinc-500">Travelling, sick or gym closed? Turn this off</p>
      </div>
      <Switch tone="emerald" label={title} disabled={disabled} checked={gymAvailable} onChange={onChange} />
    </div>
    {!gymAvailable && (
      <div className="rounded-xl bg-violet-500/10 px-3.5 py-3 text-[13px] leading-relaxed text-violet-100">
        No gym: Physical Activity goes up to <b>{(config.travelSubstituteSteps / 1000).toFixed(0)}K steps</b>,{' '}
        <b>{config.travelSubstituteRunKm} km</b> or <b>{config.travelSubstituteFloors} floors</b>, and the Gym habit is
        removed from the checklist for the day.
      </div>
    )}
  </Card>
);

export const TravelSicknessScreen: React.FC = () => {
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
    approveException,
    rejectException,
    tomorrowLog,
    updateTomorrowTravel,
  } = useChallenge();

  const proofInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { travel, sickness } = currentLog;
  const disabled = !isEditable;

  const tomorrow = tomorrowLog.travel;
  const tomorrowWake = getEffectiveWakeUpTarget(tomorrow.hours, tomorrow.isTravelling, config);
  const tomorrowDeadline = getWakeUpDeadline(tomorrowLog, config);
  // Planned from today's view, for a challenger (not the referee's own account)
  const canPlanTomorrow = isToday && Boolean(currentUser) && currentUser?.id !== 'admin';

  const updateTravel = (patch: Partial<TravelInfo>) =>
    updateCurrentLog(prev => ({ ...prev, travel: { ...prev.travel, ...patch } }));

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    e.target.value = '';
    if (!rawFile || !isEditable) return;
    setUploading(true);
    try {
      const { file, base64 } = await compressImage(rawFile, 1400, 0.85);
      let finalUrl = base64;
      try {
        const cloudUrl = await supabaseService.uploadMedia(file, file.name, 'medical-proofs', currentUser?.id || 'user_1');
        if (cloudUrl) finalUrl = cloudUrl;
      } catch (err) {
        console.warn('Falling back to base64 medical proof:', err);
      }
      await updateCurrentLog(prev => ({
        ...prev,
        sickness: {
          ...prev.sickness,
          isSick: true,
          hasMedicalProof: true,
          medicalProofUrl: finalUrl,
          medicalProofName: file.name,
          // Referee uploads are approved straight away; challenger uploads go to the queue
          isExempt: isAdmin,
          status: isAdmin ? 'approved' : 'pending',
        },
      }));
    } catch (err) {
      console.error('Medical proof error:', err);
      alert('Could not read that file. Please try a photo of the slip.');
    } finally {
      setUploading(false);
    }
  };

  const statusNotice = () => {
    switch (sickness.status) {
      case 'approved':
        return (
          <Notice tone="emerald" icon={ShieldCheck} title="Approved by referee">
            Your streak is protected for this day.
          </Notice>
        );
      case 'pending':
        return (
          <Notice tone="amber" icon={Hourglass} title="Waiting for referee">
            Your proof has been sent. The referee will approve or reject it.
          </Notice>
        );
      case 'rejected':
        return (
          <Notice tone="rose" icon={CircleX} title="Request rejected">
            {sickness.adminComment || 'All habits still count today.'}
          </Notice>
        );
      default:
        return (
          <Notice tone="neutral" icon={Info} title="Proof needed">
            Upload a doctor's slip or prescription to send the request.
          </Notice>
        );
    }
  };

  return (
    <div className="space-y-4">
      <ScreenTitle
        title="Travel & sick days"
        subtitle={`${isToday ? 'Today' : formatPrettyDate(currentDate)}${isAdmin ? ` · ${currentUser?.name}` : ''}`}
      />

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
          You can only report conditions for today.
        </Notice>
      )}

      {/* Travel today */}
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              travel.isTravelling ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[0.05] text-zinc-400'
            }`}
          >
            <PlaneTakeoff className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-white">{isToday ? 'Travelling today' : 'Travelling this day'}</h3>
            <p className="text-[13px] text-zinc-500">
              {travel.addedAfterWakeUp && travel.isTravelling
                ? "Added after check-in closed · wake-up unchanged"
                : travel.plannedAt && travel.isTravelling
                ? 'Planned the day before'
                : `Long trips push back the wake-up (set by ${formatTime12(getNormalWakeUpDeadline(config))})`}
            </p>
          </div>
          <Switch
            tone="amber"
            label="Travelling today"
            disabled={disabled}
            checked={travel.isTravelling}
            onChange={checked => updateTravel({ isTravelling: checked, hours: checked ? Math.max(travel.hours, 2) : 0 })}
          />
        </div>

        {travel.isTravelling && (
          <TripFields travel={travel} disabled={disabled} config={config} onChange={updateTravel} />
        )}
      </Card>

      {/* Gym access today */}
      <GymAccessCard
        title={isToday ? 'Gym available today' : 'Gym available this day'}
        gymAvailable={travel.gymAvailable !== false}
        disabled={disabled}
        config={config}
        onChange={gymAvailable => updateTravel({ gymAvailable })}
      />

      {/* Tomorrow's plan: set the night before so tomorrow's wake-up target is right */}
      {canPlanTomorrow && (
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                tomorrow.isTravelling || tomorrow.gymAvailable === false
                  ? 'bg-violet-500/15 text-violet-400'
                  : 'bg-white/[0.05] text-zinc-400'
              }`}
            >
              <CalendarClock className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-white">Tomorrow's plan</h3>
              <p className="text-[13px] text-zinc-500">{formatPrettyDate(tomorrowLog.date)} · set it before you sleep</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.05]">
            <PlaneTakeoff className={`w-5 h-5 shrink-0 ${tomorrow.isTravelling ? 'text-amber-400' : 'text-zinc-500'}`} />
            <span className="flex-1 text-sm text-zinc-200">Travelling tomorrow</span>
            <Switch
              tone="amber"
              label="Travelling tomorrow"
              checked={tomorrow.isTravelling}
              onChange={checked =>
                updateTomorrowTravel({ isTravelling: checked, hours: checked ? Math.max(tomorrow.hours, 2) : 0 })
              }
            />
          </div>

          {tomorrow.isTravelling && (
            <TripFields travel={tomorrow} disabled={false} config={config} onChange={updateTomorrowTravel} when="tomorrow" />
          )}

          <div className="flex items-center gap-3">
            <Dumbbell className={`w-5 h-5 shrink-0 ${tomorrow.gymAvailable === false ? 'text-violet-400' : 'text-zinc-500'}`} />
            <span className="flex-1 text-sm text-zinc-200">Gym available tomorrow</span>
            <Switch
              tone="emerald"
              label="Gym available tomorrow"
              checked={tomorrow.gymAvailable !== false}
              onChange={gymAvailable => updateTomorrowTravel({ gymAvailable })}
            />
          </div>

          <div className="rounded-xl bg-white/[0.04] px-3.5 py-3 space-y-2 text-[13px]">
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-2 text-zinc-400 shrink-0">
                <AlarmClock className="w-4 h-4" /> Wake-up
              </span>
              <span className={`font-semibold text-right tabular ${tomorrowWake !== config.wakeUpTarget ? 'text-amber-300' : 'text-white'}`}>
                {formatTime12(tomorrowWake)}{' '}
                <span className="font-normal text-zinc-500">· check in by {formatTime12(tomorrowDeadline)}</span>
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-2 text-zinc-400 shrink-0">
                <Footprints className="w-4 h-4" /> Activity
              </span>
              <span className={`font-semibold text-right ${tomorrow.gymAvailable === false ? 'text-violet-300' : 'text-white'}`}>
                {tomorrow.gymAvailable === false
                  ? `No gym · ${describeNoGymTargets(config)}`
                  : `Gym + ${(config.stepsTarget / 1000).toFixed(0)}K steps · ${config.runTargetKm} km · ${config.floorsTarget} floors`}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Sickness */}
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              sickness.isSick ? 'bg-sky-500/15 text-sky-400' : 'bg-white/[0.05] text-zinc-400'
            }`}
          >
            <Stethoscope className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-white">I'm sick today</h3>
            <p className="text-[13px] text-zinc-500">Needs medical proof and referee approval</p>
          </div>
          <Switch
            tone="blue"
            label="Sick today"
            disabled={disabled}
            checked={sickness.isSick}
            onChange={checked =>
              updateCurrentLog(prev => ({
                ...prev,
                sickness: {
                  ...prev.sickness,
                  isSick: checked,
                  status: checked && prev.sickness.hasMedicalProof ? 'pending' : 'none',
                  isExempt: false,
                },
              }))
            }
          />
        </div>

        {!sickness.isSick && (
          <p className="text-[13px] text-zinc-500 leading-relaxed">
            Tiredness or soreness doesn't count. Only genuine illness with a doctor's slip can protect your streak.
          </p>
        )}

        {sickness.isSick && (
          <div className="space-y-3 pt-4 border-t border-white/[0.05]">
            {uploading ? (
              <div className="h-20 rounded-xl bg-ink-850 flex items-center justify-center gap-2 text-sm text-zinc-400">
                <Loader2 className="w-5 h-5 animate-spin" /> Uploading…
              </div>
            ) : sickness.medicalProofUrl ? (
              <div className="flex items-center gap-3 rounded-xl bg-sky-500/10 px-3.5 py-3">
                <FileCheck className="w-5 h-5 text-sky-400 shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-sky-100 truncate">{sickness.medicalProofName || 'Medical proof'}</span>
                {isEditable && (
                  <button onClick={() => proofInputRef.current?.click()} className="text-sm font-semibold text-sky-300">
                    Change
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => proofInputRef.current?.click()}
                className="w-full h-28 rounded-xl border-2 border-dashed border-sky-500/30 flex flex-col items-center justify-center gap-1.5 active:bg-sky-500/5 disabled:opacity-40"
              >
                <Upload className="w-6 h-6 text-sky-400" />
                <span className="text-[15px] font-semibold text-white">Upload doctor's slip</span>
                <span className="text-[12px] text-zinc-500">Photo or PDF</span>
              </button>
            )}
            <input ref={proofInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleProofUpload} />

            <textarea
              rows={3}
              className="input"
              disabled={disabled}
              placeholder="Symptoms and doctor's advice"
              value={sickness.doctorNotes || ''}
              onChange={e => {
                const doctorNotes = e.target.value;
                updateCurrentLog(prev => ({ ...prev, sickness: { ...prev.sickness, doctorNotes } }));
              }}
            />

            {statusNotice()}

            {isAdmin && currentUser && currentUser.id !== 'admin' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => approveException(currentUser.id, currentDate)} className="btn bg-emerald-600 text-white">
                  Approve
                </button>
                <button onClick={() => rejectException(currentUser.id, currentDate)} className="btn-secondary text-rose-300">
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
