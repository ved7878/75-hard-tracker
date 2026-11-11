import React, { useRef } from 'react';
import {
  PlaneTakeoff,
  Clock,
  Dumbbell,
  AlertTriangle,
  Upload,
  FileCheck,
  ShieldCheck,
  HeartPulse,
  Info,
  CheckCircle2,
  XCircle,
  Lock,
  Hourglass,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { formatDate } from '../../services/rulesEngine';
import { supabaseService } from '../../services/supabaseService';
import { compressImage } from '../../services/imageCompression';

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
    adminOverrideMode,
    approveException,
    rejectException,
  } = useChallenge();

  const medicalProofInputRef = useRef<HTMLInputElement>(null);
  const { travel, sickness } = currentLog;
  const isTravelLong = travel.isTravelling && travel.hours > config.travelThresholdHours;

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditable) {
      alert("🔒 LOCKED: You can only upload medical proof for TODAY'S checklist.");
      return;
    }
    const rawFile = e.target.files?.[0];
    if (rawFile) {
      try {
        const { file, base64 } = await compressImage(rawFile, 1400, 0.85);
        let finalUrl = base64;

        try {
          const cloudUrl = await supabaseService.uploadMedia(
            file,
            file.name,
            'medical-proofs',
            currentUser?.id || 'user_1'
          );
          if (cloudUrl) finalUrl = cloudUrl;
        } catch (err) {
          console.warn('Fallback to base64 for medical proof:', err);
        }

        await updateCurrentLog(prev => ({
          ...prev,
          sickness: {
            ...prev.sickness,
            isSick: true,
            hasMedicalProof: true,
            medicalProofUrl: finalUrl,
            medicalProofName: file.name,
            // If admin is uploading, auto-approve; otherwise it goes to pending review!
            isExempt: isAdmin || adminOverrideMode,
            status: isAdmin || adminOverrideMode ? 'approved' : 'pending',
          },
        }));
      } catch (err) {
        console.error('Medical proof processing error:', err);
      }
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* LOCKED NOTICE IF VIEWING NON-TODAY WITHOUT ADMIN */}
      {!isEditable && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-300">
                Read-Only Rules View ({currentDate})
              </span>
              <p className="text-[11px] text-amber-200/80 leading-tight">
                Challengers can only report conditions for <strong>TODAY</strong>. Log in as Admin to edit past/future days.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentDate(formatDate(new Date()))}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] shrink-0 transition-all active:scale-95"
          >
            Go to Today
          </button>
        </div>
      )}

      {/* Page Title */}
      <div>
        <div className="flex items-center space-x-2">
          <span className="text-sm">{currentUser?.avatar || '🔥'}</span>
          <h2 className="text-base font-extrabold text-white">Travel & Sickness ({currentUser?.name || 'Challenger'})</h2>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Dynamic adjustments & official referee exception requests.
        </p>
      </div>

      {/* TRAVEL MODE SECTION */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl ${travel.isTravelling ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-400'}`}>
              <PlaneTakeoff className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Travel Conditions</h3>
              <p className="text-xs text-slate-400">Transit & commute adjustments</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              disabled={!isEditable}
              checked={travel.isTravelling}
              onChange={e => {
                const checked = e.target.checked;
                updateCurrentLog(prev => ({
                  ...prev,
                  travel: {
                    ...prev.travel,
                    isTravelling: checked,
                    hours: checked ? Math.max(prev.travel.hours, 2) : 0,
                  },
                }));
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 peer-disabled:opacity-50"></div>
          </label>
        </div>

        {travel.isTravelling && (
          <div className="space-y-4 pt-3 border-t border-white/[0.06] animate-fade-in text-xs">
            {/* Travel Hours Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Travel Duration:</span>
                </span>
                <span className="text-sm font-bold text-amber-400">{travel.hours} Hours</span>
              </div>
              <input
                type="range"
                min="1"
                max="18"
                step="0.5"
                disabled={!isEditable}
                value={travel.hours}
                onChange={e => {
                  const hrs = parseFloat(e.target.value);
                  updateCurrentLog(prev => ({
                    ...prev,
                    travel: { ...prev.travel, hours: hrs },
                  }));
                }}
                className="w-full accent-amber-500 cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>1 hr</span>
                <span className="font-bold text-amber-400">4 hrs (Threshold)</span>
                <span>18 hrs</span>
              </div>
            </div>

            {/* Live Impact Card */}
            <div className={`p-3 rounded-xl border ${
              isTravelLong ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-white/5 border-white/10 text-slate-300'
            }`}>
              <div className="flex items-center space-x-2 font-bold mb-1">
                {isTravelLong ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Travel &gt; 4 Hours Active: Wake-Up Allowed Until 8:00 AM</span>
                  </>
                ) : (
                  <>
                    <Info className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Travel &le; 4 Hours: All Normal 75 Hard Rules Apply (Wake up by 6:00 AM)</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isTravelLong
                  ? 'Your wake up target is automatically adjusted from 6:00 AM to 8:00 AM on your daily tracker.'
                  : 'Transit under 4 hours does not grant schedule extensions.'}
              </p>
            </div>

            {/* Gym Availability Toggle */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.05] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Dumbbell className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-white">Is Gym Available at Destination?</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => updateCurrentLog(prev => ({ ...prev, travel: { ...prev.travel, gymAvailable: true } }))}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      travel.gymAvailable ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => updateCurrentLog(prev => ({ ...prev, travel: { ...prev.travel, gymAvailable: false } }))}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      !travel.gymAvailable ? 'bg-rose-600 text-white' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {!travel.gymAvailable && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1">
                  <span className="font-bold block">Gym Workout Substitute Rule Active:</span>
                  <p className="text-amber-200/80">
                    Because gym is unavailable due to travel, you can satisfy this requirement with:
                  </p>
                  <div className="font-semibold pl-2 border-l-2 border-amber-400">
                    • 15,000 Steps OR
                    <br />• 5.0 KM Run
                  </div>
                </div>
              )}
            </div>

            {/* Destination notes */}
            <input
              type="text"
              disabled={!isEditable}
              placeholder="Destination / Flight / Hotel notes..."
              value={travel.destination || ''}
              onChange={e => updateCurrentLog(prev => ({ ...prev, travel: { ...prev.travel, destination: e.target.value } }))}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>
        )}
      </div>

      {/* SICKNESS EXEMPTION SECTION */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl ${sickness.isSick ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-400'}`}>
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Sickness Exception Request</h3>
              <p className="text-xs text-slate-400">Health first • Subject to Admin approval</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              disabled={!isEditable}
              checked={sickness.isSick}
              onChange={e => {
                const checked = e.target.checked;
                updateCurrentLog(prev => ({
                  ...prev,
                  sickness: {
                    ...prev.sickness,
                    isSick: checked,
                    status: checked && prev.sickness.hasMedicalProof ? 'pending' : 'none',
                    isExempt: false,
                  },
                }));
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
          </label>
        </div>

        {/* Strict Medical Exemption Rules Notice */}
        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs text-rose-200 space-y-1">
          <div className="flex items-center space-x-1.5 font-bold text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Strict 75 Hard Exemption Rules</span>
          </div>
          <p className="text-[11px] text-rose-200/80 leading-relaxed">
            • <strong>At home:</strong> Zero exceptions (fatigue, muscle soreness, laziness are not exemptions).
            <br />• <strong>Genuine sickness:</strong> Exception granted <strong>ONLY with valid medical proof</strong> uploaded and approved by the Admin / Referee.
          </p>
        </div>

        {sickness.isSick && (
          <div className="space-y-3.5 pt-3 border-t border-white/[0.06] text-xs">
            {/* Medical Proof Uploader */}
            <div className="space-y-2">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <FileCheck className="w-4 h-4 text-blue-400" />
                <span>Upload Medical Proof / Doctor Slip:</span>
              </span>

              {sickness.medicalProofUrl ? (
                <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <FileCheck className="w-5 h-5 text-blue-400 shrink-0" />
                    <span className="font-semibold text-blue-200 truncate">
                      {sickness.medicalProofName || 'Prescription_Proof.jpg'}
                    </span>
                  </div>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => medicalProofInputRef.current?.click()}
                      className="text-[11px] font-bold text-blue-400 hover:underline shrink-0"
                    >
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!isEditable}
                  onClick={() => medicalProofInputRef.current?.click()}
                  className={`w-full py-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${
                    !isEditable
                      ? 'border-white/5 opacity-50 cursor-not-allowed text-slate-600'
                      : 'border-blue-500/30 hover:border-blue-500/60 text-blue-300 hover:text-white bg-blue-500/5'
                  }`}
                >
                  <Upload className="w-6 h-6 mb-1 text-blue-400" />
                  <span className="text-xs font-bold">Upload Doctor Prescription / Slip</span>
                  <span className="text-[10px] text-slate-500">JPG, PNG, PDF medical certificate</span>
                </button>
              )}

              <input
                ref={medicalProofInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleProofUpload}
              />
            </div>

            {/* Doctor Notes */}
            <div className="space-y-1">
              <span className="font-semibold text-slate-300">Doctor Advice & Symptoms:</span>
              <textarea
                rows={2}
                disabled={!isEditable}
                placeholder="e.g. High fever, doctor advised 2 days bed rest..."
                value={sickness.doctorNotes || ''}
                onChange={e => updateCurrentLog(prev => ({
                  ...prev,
                  sickness: { ...prev.sickness, doctorNotes: e.target.value },
                }))}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none disabled:opacity-60"
              />
            </div>

            {/* Exception Approval Status from Admin */}
            <div className={`p-3 rounded-xl border flex items-center space-x-3 ${
              sickness.status === 'approved'
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                : sickness.status === 'pending'
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                : sickness.status === 'rejected'
                ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                : 'bg-white/5 border-white/10 text-slate-300'
            }`}>
              {sickness.status === 'approved' ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-300">Admin Approved ✓</span>
                    <p className="text-[11px] text-emerald-200/70">
                      Medical proof verified by Admin. 75 Hard streak is protected from reset.
                    </p>
                  </div>
                </>
              ) : sickness.status === 'pending' ? (
                <>
                  <Hourglass className="w-5 h-5 text-amber-400 shrink-0 animate-spin" />
                  <div>
                    <span className="font-bold text-amber-300">⏳ Pending Admin Approval</span>
                    <p className="text-[11px] text-amber-200/70">
                      Your medical document was submitted. The Admin will review and approve it from the Admin Panel.
                    </p>
                  </div>
                </>
              ) : sickness.status === 'rejected' ? (
                <>
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <span className="font-bold text-rose-300">Exemption Rejected</span>
                    <p className="text-[11px] text-rose-200/70">
                      Admin reviewed and rejected this claim. Tasks remain mandatory to avoid streak reset.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-300">Proof Required</span>
                    <p className="text-[11px] text-slate-400">
                      Upload your medical document to submit an exemption request to the Admin.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Admin Quick Action Button if Admin is logged in */}
            {(isAdmin || adminOverrideMode) && sickness.isSick && (
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 space-y-2">
                <span className="font-bold text-purple-300 flex items-center space-x-1.5">
                  <KeyRound className="w-4 h-4" />
                  <span>Admin Quick Controls</span>
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => currentUser && approveException(currentUser.id, currentDate)}
                    className="py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    Direct Approve ✓
                  </button>
                  <button
                    onClick={() => currentUser && rejectException(currentUser.id, currentDate)}
                    className="py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                  >
                    Direct Reject ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
