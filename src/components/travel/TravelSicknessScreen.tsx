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
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { formatDate, formatPrettyDate, formatTime12 } from '../../services/rulesEngine';
import { supabaseService } from '../../services/supabaseService';
import { compressImage } from '../../services/imageCompression';
import { Card, Notice, ScreenTitle, Segmented, Switch } from '../ui';

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
  } = useChallenge();

  const proofInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { travel, sickness } = currentLog;
  const isLongTravel = travel.isTravelling && travel.hours > config.travelThresholdHours;
  const disabled = !isEditable;

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

      {/* Travel */}
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
            <h3 className="text-[15px] font-semibold text-white">Travelling today</h3>
            <p className="text-[13px] text-zinc-500">Long trips adjust wake-up and gym</p>
          </div>
          <Switch
            tone="amber"
            label="Travelling today"
            disabled={disabled}
            checked={travel.isTravelling}
            onChange={checked =>
              updateCurrentLog(prev => ({
                ...prev,
                travel: { ...prev.travel, isTravelling: checked, hours: checked ? Math.max(prev.travel.hours, 2) : 0, gymAvailable: checked ? prev.travel.gymAvailable : true },
              }))
            }
          />
        </div>

        {travel.isTravelling && (
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
                disabled={disabled}
                value={travel.hours}
                onChange={e => {
                  const hours = parseFloat(e.target.value);
                  updateCurrentLog(prev => ({ ...prev, travel: { ...prev.travel, hours } }));
                }}
                className="w-full h-2 accent-amber-500 disabled:opacity-50"
              />
              <div className="flex justify-between text-[12px] text-zinc-600 mt-1">
                <span>1 h</span>
                <span>{config.travelThresholdHours} h threshold</span>
                <span>18 h</span>
              </div>
            </div>

            <div className={`rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${isLongTravel ? 'bg-amber-500/10 text-amber-200' : 'bg-white/[0.04] text-zinc-400'}`}>
              {isLongTravel ? (
                <>
                  Over {config.travelThresholdHours} h: wake up by <b>{formatTime12(config.wakeUpTravelTarget)}</b> instead of{' '}
                  {formatTime12(config.wakeUpTarget)}.
                </>
              ) : (
                <>
                  {config.travelThresholdHours} h or less: normal rules apply (wake up by {formatTime12(config.wakeUpTarget)}).
                </>
              )}
            </div>

            {isLongTravel && (
              <div>
                <p className="text-sm text-zinc-400 mb-2">Gym available where you are?</p>
                <Segmented
                  disabled={disabled}
                  value={travel.gymAvailable ? 'yes' : 'no'}
                  onChange={v => updateCurrentLog(prev => ({ ...prev, travel: { ...prev.travel, gymAvailable: v === 'yes' } }))}
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                />
                {!travel.gymAvailable && (
                  <p className="text-[13px] text-amber-200/80 mt-2">
                    Swap the gym for {config.travelSubstituteSteps.toLocaleString('en-IN')} steps or a {config.travelSubstituteRunKm} km
                    run. Log it in the checklist.
                  </p>
                )}
              </div>
            )}

            <input
              className="input"
              disabled={disabled}
              placeholder="Where are you going? (optional)"
              value={travel.destination || ''}
              onChange={e => {
                const destination = e.target.value;
                updateCurrentLog(prev => ({ ...prev, travel: { ...prev.travel, destination } }));
              }}
            />
          </div>
        )}
      </Card>

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
