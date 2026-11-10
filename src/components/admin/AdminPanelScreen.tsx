import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  Sliders,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Lock,
  Unlock,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  parseDate,
  formatDate,
  createDefaultLog,
  validateDayTasks,
  getDayNumber,
} from '../../services/rulesEngine';
import { TaskState, ActivityType } from '../../types';

export const AdminPanelScreen: React.FC = () => {
  const {
    users,
    allUsersLogs,
    pendingExceptions,
    approveException,
    rejectException,
    adminUpdateLog,
    config,
    updateConfig,
    adminOverrideMode,
    setAdminOverrideMode,
    setCurrentUserId,
    setCurrentDate,
  } = useChallenge();

  // Override editor state
  const challengers = users.filter(u => u.role !== 'admin');
  const [selectedUserId, setSelectedUserId] = useState<string>(challengers[0]?.id || 'user_1');
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [pinChangeMsg, setPinChangeMsg] = useState<string>('');
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  // Get currently selected log for override
  const targetUserLogs = allUsersLogs[selectedUserId] || {};
  const currentTargetLog = targetUserLogs[selectedDate] || createDefaultLog(selectedDate, config, selectedUserId);
  const targetUser = challengers.find(c => c.id === selectedUserId) || challengers[0];
  const { items, allCompleted, completedCount, totalCount } = validateDayTasks(currentTargetLog, config);
  const targetDayNum = getDayNumber(selectedDate, config.startDate);

  // Toggle habit in admin mode
  const handleAdminToggleTask = (taskId: keyof TaskState) => {
    adminUpdateLog(selectedUserId, selectedDate, prev => {
      const tasks = { ...prev.tasks };
      const currentTask = tasks[taskId];
      const newCompleted = !currentTask.completed;

      if (taskId === 'wakeUp') {
        tasks.wakeUp = {
          ...tasks.wakeUp,
          completed: newCompleted,
          actualTime: newCompleted ? config.wakeUpTarget : '',
        };
      } else if (taskId === 'diet') {
        tasks.diet = { ...tasks.diet, completed: newCompleted, cleanDietChecked: newCompleted };
      } else if (taskId === 'reading') {
        tasks.reading = {
          ...tasks.reading,
          completed: newCompleted,
          pagesRead: newCompleted ? config.readingMinPages : 0,
        };
      } else if (taskId === 'physicalActivity') {
        tasks.physicalActivity = {
          ...tasks.physicalActivity,
          completed: newCompleted,
          value: newCompleted ? config.stepsTarget : 0,
        };
      } else {
        (tasks[taskId] as any).completed = newCompleted;
      }

      return { ...prev, tasks };
    });
  };

  // Change Admin PIN
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput.trim().length < 4) {
      setPinChangeMsg('PIN must be at least 4 digits.');
      return;
    }
    updateConfig({ adminPin: adminPinInput.trim() });
    setPinChangeMsg('Admin PIN updated successfully!');
    setAdminPinInput('');
  };

  return (
    <div className="space-y-5 pb-8 text-xs">
      {/* Page Title & Status */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-md">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-white">Referee & Admin Panel</h2>
              <p className="text-[11px] text-slate-400">Master controls for exceptions, audits, and time overrides</p>
            </div>
          </div>
        </div>

        {/* Global Override Mode Toggle */}
        <div className="flex items-center space-x-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
          <span className="text-[10px] font-bold text-slate-300">
            {adminOverrideMode ? 'Override: ON' : 'Override: OFF'}
          </span>
          <button
            onClick={() => setAdminOverrideMode(!adminOverrideMode)}
            className={`p-1 rounded-lg transition-all ${
              adminOverrideMode ? 'bg-amber-500 text-black' : 'bg-white/10 text-slate-400'
            }`}
            title="Toggle time machine override mode"
          >
            {adminOverrideMode ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 1. PENDING EXCEPTION REQUESTS QUEUE */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Pending Medical Exception Requests ({pendingExceptions.length})
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">Requires Doctor Verification</span>
        </div>

        {pendingExceptions.length === 0 ? (
          <div className="p-4 rounded-xl bg-black/30 border border-white/[0.05] text-center text-slate-400 space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="font-semibold text-white">No Pending Claims</p>
            <p className="text-[11px] text-slate-500">All 3 challengers are executing without sickness claims.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingExceptions.map((req, idx) => (
              <div
                key={`${req.userId}_${req.date}_${idx}`}
                className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{req.userAvatar}</span>
                    <div>
                      <h4 className="font-bold text-white text-xs">{req.userName}</h4>
                      <p className="text-[10px] text-amber-300 font-mono">
                        Day {req.dayNumber} ({req.date})
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                    Awaiting Review
                  </span>
                </div>

                {req.doctorNotes && (
                  <p className="text-slate-300 italic bg-black/40 p-2 rounded-lg border border-white/5">
                    "{req.doctorNotes}"
                  </p>
                )}

                {/* Medical Proof Document Preview */}
                {req.medicalProofUrl && (
                  <div className="space-y-1">
                    <span className="font-bold text-slate-300 text-[10px]">Medical Document:</span>
                    <div
                      onClick={() => setPreviewProofUrl(req.medicalProofUrl || null)}
                      className="cursor-pointer max-h-32 rounded-lg overflow-hidden border border-white/10 relative group"
                    >
                      <img
                        src={req.medicalProofUrl}
                        alt="Medical Proof"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <span className="text-[11px] font-bold text-white bg-black/70 px-2 py-1 rounded flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>Inspect High-Res</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Approve / Reject Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-500/20">
                  <button
                    onClick={() => approveException(req.userId, req.date)}
                    className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve (Preserve Streak)</span>
                  </button>

                  <button
                    onClick={() => rejectException(req.userId, req.date)}
                    className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center space-x-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Exemption</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. TIME-MACHINE / EDIT PAST AND FUTURE DAYS */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Time-Machine Editor (Past & Future Days)
            </h3>
          </div>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">
            Admin Power
          </span>
        </div>

        <p className="text-slate-400 text-[11px]">
          As Admin, you can select any challenger and modify any date (past mistakes, retroactive reviews, or future plans).
        </p>

        {/* Challenger & Date Selectors */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
          <div>
            <label className="text-slate-400 block mb-1 font-semibold">Select Challenger:</label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-bold"
            >
              {challengers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.avatar} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-semibold">Select Date to Edit:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono"
            />
          </div>
        </div>

        {/* Day Preview & Tasks Direct Editor */}
        <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <div>
              <span className="font-bold text-white">
                {targetUser.name} • Day {targetDayNum} ({selectedDate})
              </span>
              <p className="text-[10px] text-slate-400">
                Score: {completedCount}/{totalCount} tasks completed
              </p>
            </div>
            <button
              onClick={() => {
                setCurrentUserId(selectedUserId);
                setCurrentDate(selectedDate);
                alert(`Switched active view to ${targetUser.name} on ${selectedDate}. You can now view and edit in the main tracker!`);
              }}
              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center space-x-1"
            >
              <span>Open in Tracker</span>
            </button>
          </div>

          {/* Quick task checklist toggles for this selected date */}
          <div className="space-y-1 max-h-56 overflow-y-auto no-scrollbar">
            {items.map(item => (
              <div
                key={item.id}
                onClick={() => handleAdminToggleTask(item.id)}
                className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all active:scale-95 ${
                  item.isCompleted
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : 'bg-white/[0.02] border-white/[0.06] text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    readOnly
                    className="accent-emerald-500"
                  />
                  <span className="font-semibold">{item.title}</span>
                </div>
                <span className="text-[10px] text-slate-400">{item.requirementDesc}</span>
              </div>
            ))}
          </div>

          {/* Sickness Exemption Direct Toggle */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-slate-300">Grant Medical Exemption for this Day:</span>
            <button
              onClick={() => {
                const next = !currentTargetLog.sickness.isExempt;
                adminUpdateLog(selectedUserId, selectedDate, prev => ({
                  ...prev,
                  sickness: {
                    ...prev.sickness,
                    isSick: next,
                    isExempt: next,
                    status: next ? 'approved' : 'none',
                    reviewedBy: 'Admin',
                    reviewedAt: new Date().toISOString(),
                  },
                }));
              }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                currentTargetLog.sickness.isExempt
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {currentTargetLog.sickness.isExempt ? 'Exemption Granted ✓' : 'Make Exempt'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. SQUAD DEPOSIT & PENALTY LEDGER */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Deposit & Penalty Ledger
            </h3>
          </div>
          <span className="font-extrabold text-emerald-400">
            Total Pool: {config.currencySymbol}{(config.depositAmount * challengers.length).toLocaleString()}
          </span>
        </div>

        <div className="space-y-2 pt-1 border-t border-white/[0.06]">
          {challengers.map(c => {
            const uLogs = allUsersLogs[c.id] || {};
            const misses = Object.values(uLogs).filter(
              l => l.status === 'incomplete' && l.date < formatDate(new Date())
            ).length;

            return (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-black/30 border border-white/[0.05] flex items-center justify-between"
              >
                <div className="flex items-center space-x-2.5">
                  <span className="text-xl">{c.avatar}</span>
                  <div>
                    <h4 className="font-bold text-white text-xs">{c.name}</h4>
                    <p className="text-[10px] text-slate-400">
                      Pledge: {config.currencySymbol}{config.depositAmount} • {misses} missed days
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    misses > 0
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {misses > 0 ? 'FORFEITED' : 'PROTECTED'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. ADMIN SECURITY & PIN */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <KeyRound className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Admin PIN Security
          </h3>
        </div>

        <form onSubmit={handleChangePin} className="space-y-2 pt-1 border-t border-white/[0.06]">
          <div className="flex items-center space-x-2">
            <input
              type="password"
              placeholder="Enter new 4+ digit Admin PIN"
              value={adminPinInput}
              onChange={e => setAdminPinInput(e.target.value)}
              className="flex-1 bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs active:scale-95 transition-all"
            >
              Update PIN
            </button>
          </div>
          {pinChangeMsg && (
            <p className="text-[11px] text-emerald-400 font-semibold">{pinChangeMsg}</p>
          )}
        </form>
      </div>

      {/* Medical Proof High-Res Modal */}
      {previewProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative max-w-lg w-full bg-[#121318] border border-white/10 rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setPreviewProofUrl(null)}
              className="absolute top-3 right-3 p-1 rounded-full bg-black/70 text-white hover:bg-black"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <img src={previewProofUrl} alt="Prescription" className="w-full h-auto rounded-xl max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
