import React, { useRef, useState } from 'react';
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
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';

export const TravelSicknessScreen: React.FC = () => {
  const { currentLog, updateCurrentLog, config } = useChallenge();
  const medicalProofInputRef = useRef<HTMLInputElement>(null);

  const { travel, sickness } = currentLog;
  const isTravelLong = travel.isTravelling && travel.hours > config.travelThresholdHours;

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        updateCurrentLog(prev => ({
          ...prev,
          sickness: {
            ...prev.sickness,
            isSick: true,
            hasMedicalProof: true,
            medicalProofUrl: base64,
            medicalProofName: file.name,
            isExempt: true, // auto approve exemption once medical document is uploaded
          },
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Page Title */}
      <div>
        <h2 className="text-base font-extrabold text-white">Travel & Sickness Exceptions</h2>
        <p className="text-xs text-slate-400">
          Rules dynamically adapt based on travel duration and verified medical necessity.
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
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
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
                value={travel.hours}
                onChange={e => {
                  const hrs = parseFloat(e.target.value);
                  updateCurrentLog(prev => ({
                    ...prev,
                    travel: { ...prev.travel, hours: hrs },
                  }));
                }}
                className="w-full accent-amber-500 cursor-pointer"
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
                    onClick={() => updateCurrentLog(prev => ({ ...prev, travel: { ...prev.travel, gymAvailable: true } }))}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      travel.gymAvailable ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
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
              placeholder="Destination / Flight / Hotel notes..."
              value={travel.destination || ''}
              onChange={e => updateCurrentLog(prev => ({ ...prev, travel: { ...prev.travel, destination: e.target.value } }))}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
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
              <h3 className="text-sm font-bold text-white">Sickness & Medical Exemption</h3>
              <p className="text-xs text-slate-400">Health and safety take priority</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={sickness.isSick}
              onChange={e => {
                const checked = e.target.checked;
                updateCurrentLog(prev => ({
                  ...prev,
                  sickness: {
                    ...prev.sickness,
                    isSick: checked,
                    isExempt: checked && Boolean(prev.sickness.hasMedicalProof),
                  },
                }));
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Strict Medical Exemption Rules Notice */}
        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs text-rose-200 space-y-1">
          <div className="flex items-center space-x-1.5 font-bold text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Strict 75 Hard Exemption Rules</span>
          </div>
          <p className="text-[11px] text-rose-200/80 leading-relaxed">
            • <strong>At home:</strong> No exceptions (headaches, laziness, fatigue are not exemptions).
            <br />• <strong>Genuine sickness:</strong> Exception granted ONLY with valid medical proof (doctor prescription or hospital certificate).
          </p>
        </div>

        {sickness.isSick && (
          <div className="space-y-3.5 pt-3 border-t border-white/[0.06] text-xs">
            {/* Medical Proof Uploader */}
            <div className="space-y-2">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <FileCheck className="w-4 h-4 text-blue-400" />
                <span>Upload Medical Proof / Prescription:</span>
              </span>

              {sickness.medicalProofUrl ? (
                <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <FileCheck className="w-5 h-5 text-blue-400 shrink-0" />
                    <span className="font-semibold text-blue-200 truncate">
                      {sickness.medicalProofName || 'Prescription_Proof.jpg'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => medicalProofInputRef.current?.click()}
                    className="text-[11px] font-bold text-blue-400 hover:underline shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => medicalProofInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-blue-500/30 hover:border-blue-500/60 rounded-xl flex flex-col items-center justify-center text-blue-300 hover:text-white transition-all bg-blue-500/5"
                >
                  <Upload className="w-6 h-6 mb-1 text-blue-400" />
                  <span className="text-xs font-bold">Upload Doctor Slip or Rx Image</span>
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
              <span className="font-semibold text-slate-300">Doctor Advice & Diagnosis:</span>
              <textarea
                rows={2}
                placeholder="e.g. Acute viral fever, doctor advised complete bed rest for 2 days..."
                value={sickness.doctorNotes || ''}
                onChange={e => updateCurrentLog(prev => ({
                  ...prev,
                  sickness: { ...prev.sickness, doctorNotes: e.target.value },
                }))}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Exemption Approval Status */}
            <div className={`p-3 rounded-xl border flex items-center space-x-3 ${
              sickness.isExempt
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
            }`}>
              {sickness.isExempt ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-300">Exemption Active & Validated</span>
                    <p className="text-[11px] text-emerald-200/70">
                      Medical document on file. 75 Hard streak is protected from reset.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <span className="font-bold text-rose-300">Exemption Inactive</span>
                    <p className="text-[11px] text-rose-200/70">
                      You must attach valid medical proof to grant exemption.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
