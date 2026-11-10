import React from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PlaneTakeoff,
  AlertCircle,
  Calendar,
  Lock,
} from 'lucide-react';
import { DailyLog, ChallengeConfig } from '../../types';
import { validateDayTasks, isToday } from '../../services/rulesEngine';
import { useChallenge } from '../../context/ChallengeContext';

interface DayDetailModalProps {
  log: DailyLog;
  config: ChallengeConfig;
  isOpen: boolean;
  onClose: () => void;
  onJumpToDate: (date: string) => void;
}

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  log,
  config,
  isOpen,
  onClose,
  onJumpToDate,
}) => {
  const { isAdmin, adminOverrideMode } = useChallenge();
  if (!isOpen) return null;

  const { items, allCompleted, completedCount, totalCount } = validateDayTasks(log, config);
  const formattedDate = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isTodayDate = isToday(log.date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-black/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center font-bold text-xs">
              D{log.dayNumber}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
                <span>Day {log.dayNumber} of {config.durationDays}</span>
                {allCompleted && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                    Completed
                  </span>
                )}
                {log.sickness.isExempt && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">
                    Exempt
                  </span>
                )}
                {!isTodayDate && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold flex items-center space-x-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Sealed</span>
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">{formattedDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 no-scrollbar text-xs">
          {/* Lock notice for historical days */}
          {!isTodayDate && (
            <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 flex items-center space-x-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Historical 75 HARD record. Only today's checklist is editable.
              </span>
            </div>
          )}

          {/* Progress summary */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/[0.05]">
            <span className="text-slate-400">Execution Score:</span>
            <span className={`font-black text-sm ${allCompleted ? 'text-emerald-400' : 'text-rose-400'}`}>
              {completedCount} / {totalCount} Tasks Done
            </span>
          </div>

          {/* Travel condition info */}
          {log.travel.isTravelling && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-amber-300">
                <PlaneTakeoff className="w-4 h-4" />
                <span>Travel Duration: {log.travel.hours} Hours</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                Gym available: {log.travel.gymAvailable ? 'Yes' : 'No (Substituted with 15k steps / 5k run)'}
              </p>
            </div>
          )}

          {/* Sickness info */}
          {log.sickness.isSick && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-blue-300">
                <AlertCircle className="w-4 h-4" />
                <span>Sickness Claim: {log.sickness.isExempt ? 'Medical Exemption Approved' : 'Proof Required'}</span>
              </div>
              {log.sickness.doctorNotes && (
                <p className="text-[11px] text-blue-200/80">Notes: {log.sickness.doctorNotes}</p>
              )}
            </div>
          )}

          {/* Photo Preview if uploaded */}
          {log.tasks.progressPhoto.photoUrl && (
            <div className="space-y-1">
              <span className="font-bold text-slate-300">Daily Progress Photo</span>
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black max-h-48">
                <img
                  src={log.tasks.progressPhoto.photoUrl}
                  alt="Daily Progress"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Tasks checklist */}
          <div className="space-y-1.5">
            <span className="font-bold text-slate-300">Daily Checklist Breakdown</span>
            <div className="space-y-1">
              {items.map(item => (
                <div
                  key={item.id}
                  className={`p-2 rounded-lg border flex items-center justify-between ${
                    item.isCompleted
                      ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
                      : 'bg-rose-950/20 border-rose-500/20 text-rose-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {item.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-semibold">{item.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{item.requirementDesc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Journal Note */}
          {log.journalNotes && (
            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.05] space-y-1">
              <span className="font-bold text-slate-300">Journal Entry</span>
              <p className="text-[11px] text-slate-400 italic">"{log.journalNotes}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.08] bg-black/40 flex items-center justify-end space-x-2">
          <button
            onClick={() => {
              onClose();
              onJumpToDate(log.date);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all active:scale-95"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {isTodayDate
                ? 'Edit Today in Tracker'
                : isAdmin || adminOverrideMode
                ? 'Edit Day in Tracker (Admin Override)'
                : 'View in Tracker'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
