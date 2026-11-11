import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Calendar,
  Sliders,
  DollarSign,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound,
  ExternalLink,
  UserPlus,
  Trash2,
  Database,
  Save,
  Clock,
  Copy,
  Check,
  Globe,
  HelpCircle,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  parseDate,
  formatDate,
  createDefaultLog,
  validateDayTasks,
  getDayNumber,
} from '../../services/rulesEngine';
import { TaskState, UserProfile } from '../../types';
import { AddUserModal } from './AddUserModal';
import { SUPABASE_SETUP_SQL } from '../../services/supabase';

export const AdminPanelScreen: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    users,
    allUsersLogs,
    pendingExceptions,
    approveException,
    rejectException,
    adminUpdateLog,
    adminDeleteUser,
    adminResetPassword,
    config,
    updateConfig,
    adminOverrideMode,
    setAdminOverrideMode,
    setCurrentUserId,
    setCurrentDate,
    dbSettings,
    updateDbSettings,
    depositLedger,
  } = useChallenge();

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-[#131418] border border-red-500/30 rounded-2xl space-y-3">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-2" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-sm text-slate-400">
          This area is strictly restricted to the 75 HARD Referee &amp; Admin.
        </p>
      </div>
    );
  }

  const challengers = users.filter(u => u.role !== 'admin');
  const [selectedUserId, setSelectedUserId] = useState<string>(challengers[0]?.id || 'user_1');
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState<UserProfile | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  // System & Task Config Form State
  const [configForm, setConfigForm] = useState({ ...config });
  const [configSaveMsg, setConfigSaveMsg] = useState('');

  // DB Settings State
  const [supabaseUrl, setSupabaseUrl] = useState(dbSettings?.supabaseUrl || '');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [dbMsg, setDbMsg] = useState<{ success?: boolean; text?: string } | null>(null);
  const [testingDb, setTestingDb] = useState(false);

  // Target log for Time-Machine override
  const targetUserLogs = allUsersLogs[selectedUserId] || {};
  const currentTargetLog = targetUserLogs[selectedDate] || createDefaultLog(selectedDate, config, selectedUserId);
  const targetUser = challengers.find(c => c.id === selectedUserId) || challengers[0];
  const { items, completedCount, totalCount } = validateDayTasks(currentTargetLog, config);
  const targetDayNum = getDayNumber(selectedDate, config.startDate);

  // Admin Habit Direct Toggle
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

  const handleSaveSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaveMsg('Saving system rules to backend...');
    await updateConfig(configForm);
    setConfigSaveMsg('✓ System & Task rules updated successfully!');
    setTimeout(() => setConfigSaveMsg(''), 3000);
  };

  const handleSaveDbSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingDb(true);
    setDbMsg(null);
    const res = await updateDbSettings({ supabaseUrl, supabaseAnonKey: supabaseKey });
    setTestingDb(false);
    setDbMsg({ success: res.success, text: res.message });
  };

  return (
    <div className="space-y-5 pb-8 text-xs">
      {/* Page Title & Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-md">
            <ShieldAlert className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-white">Referee & Admin Panel</h2>
            <p className="text-[11px] text-slate-400">Exclusive master controls for 75 HARD system & users</p>
          </div>
        </div>

        {/* Global Override Mode Toggle */}
        <div className="flex items-center space-x-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
          <span className="text-[10px] font-bold text-slate-300">
            {adminOverrideMode ? 'Override: ON' : 'Override: OFF'}
          </span>
          <button
            onClick={() => setAdminOverrideMode(!adminOverrideMode)}
            className={`p-1.5 rounded-lg transition-all ${adminOverrideMode ? 'bg-amber-500 text-black' : 'bg-white/10 text-slate-400'
              }`}
            title="Toggle time-machine override mode"
          >
            {adminOverrideMode ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 1. USER MANAGEMENT: ADD & MANAGE CHALLENGERS */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Challenger Accounts ({challengers.length})
            </h3>
          </div>
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1 shadow-glow-red transition-all active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Challenger</span>
          </button>
        </div>

        <div className="space-y-2">
          {challengers.map(c => (
            <div
              key={c.id}
              className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{c.avatar}</span>
                <div>
                  <h4 className="font-bold text-white text-xs">{c.name}</h4>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-mono mt-0.5">
                    <span>ID: <strong className="text-slate-200">{c.username}</strong></span>
                    <span>•</span>
                    <span className="text-emerald-400/90 font-medium">● Credentials Protected</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${(depositLedger?.balances[c.id]?.netChange ?? 0) < 0
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                    : (depositLedger?.balances[c.id]?.netChange ?? 0) > 0
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : 'bg-white/5 text-slate-300 border-white/10'
                  }`}>
                  {config.currencySymbol}{(depositLedger?.balances[c.id]?.currentDeposit ?? c.depositAmount ?? 2000).toLocaleString()}
                </span>

                <button
                  onClick={() => {
                    setResettingUser(c);
                    setNewPasswordVal(`${c.username}2026`);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-950/30 transition-all"
                  title="Reset Password"
                >
                  <KeyRound className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete ${c.name}? Their 75 Hard logs will be wiped.`)) {
                      adminDeleteUser(c.id);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-all"
                  title="Remove Challenger"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. SYSTEM & TASK MODIFICATION (ADMIN PANEL ONLY!) */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              System & Task Modification (Admin Only)
            </h3>
          </div>
          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">
            Master Rules
          </span>
        </div>

        <form onSubmit={handleSaveSystemConfig} className="space-y-3 pt-1 border-t border-white/[0.06]">
          {/* Challenge Schedule */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-slate-400 block mb-1">Challenge Start Date:</label>
              <input
                type="date"
                value={configForm.startDate}
                onChange={e => setConfigForm({ ...configForm, startDate: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Challenge End Date:</label>
              <input
                type="date"
                value={configForm.endDate}
                onChange={e => setConfigForm({ ...configForm, endDate: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Duration (Days):</label>
              <input
                type="number"
                value={configForm.durationDays}
                onChange={e => setConfigForm({ ...configForm, durationDays: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Deposit Amount (₹):</label>
              <input
                type="number"
                value={configForm.depositAmount}
                onChange={e => setConfigForm({ ...configForm, depositAmount: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white"
              />
            </div>
          </div>

          {/* Habit Targets */}
          <div className="pt-2 border-t border-white/[0.06]">
            <h4 className="font-bold text-slate-300 mb-2">Habit Execution Targets:</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-400 block mb-1">Standard Wake Up:</label>
                <input
                  type="time"
                  value={configForm.wakeUpTarget}
                  onChange={e => setConfigForm({ ...configForm, wakeUpTarget: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Travel Wake Up (&gt;4h):</label>
                <input
                  type="time"
                  value={configForm.wakeUpTravelTarget}
                  onChange={e => setConfigForm({ ...configForm, wakeUpTravelTarget: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Reading Pages (Min):</label>
                <input
                  type="number"
                  value={configForm.readingMinPages}
                  onChange={e => setConfigForm({ ...configForm, readingMinPages: Number(e.target.value) })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Steps Target:</label>
                <input
                  type="number"
                  value={configForm.stepsTarget}
                  onChange={e => setConfigForm({ ...configForm, stepsTarget: Number(e.target.value) })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Travel Sub. Steps:</label>
                <input
                  type="number"
                  value={configForm.travelSubstituteSteps}
                  onChange={e => setConfigForm({ ...configForm, travelSubstituteSteps: Number(e.target.value) })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Travel Sub. Run (KM):</label>
                <input
                  type="number"
                  step="0.5"
                  value={configForm.travelSubstituteRunKm}
                  onChange={e => setConfigForm({ ...configForm, travelSubstituteRunKm: Number(e.target.value) })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Strict Rules */}
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-black/40">
              <span className="text-slate-300">Lock Checklist to TODAY Only (Zero Backfilling):</span>
              <input
                type="checkbox"
                checked={configForm.lockPastDays}
                onChange={e => setConfigForm({ ...configForm, lockPastDays: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-black/40">
              <span className="text-slate-300">Strict Streak Reset to 0 on Miss:</span>
              <input
                type="checkbox"
                checked={configForm.strictResetOnMiss}
                onChange={e => setConfigForm({ ...configForm, strictResetOnMiss: e.target.checked })}
                className="w-4 h-4 accent-rose-500"
              />
            </div>
          </div>

          {configSaveMsg && (
            <p className="text-xs text-emerald-400 font-bold">{configSaveMsg}</p>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center space-x-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save System & Task Modifications</span>
          </button>
        </form>
      </div>

      {/* 3. PENDING EXCEPTION REQUESTS QUEUE */}
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
            <p className="text-[11px] text-slate-500">All challengers are executing without sickness claims.</p>
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

                {req.medicalProofUrl && (
                  <div className="space-y-1">
                    <span className="font-bold text-slate-300 text-[10px]">Medical Proof Image:</span>
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

      {/* 4. TIME MACHINE: EDIT PAST AND FUTURE DAYS */}
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
                className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all active:scale-95 ${item.isCompleted
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
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${currentTargetLog.sickness.isExempt
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-slate-400 hover:text-white'
                }`}
            >
              {currentTargetLog.sickness.isExempt ? 'Exemption Granted ✓' : 'Make Exempt'}
            </button>
          </div>
        </div>
      </div>

      {/* 5. DATABASE CONFIGURATION & VERCEL HOSTING */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Supabase DB & Vercel Hosting
            </h3>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${dbSettings?.isConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
            {dbSettings?.isConnected ? 'Cloud Connected' : 'Vercel Hybrid Mode'}
          </span>
        </div>

        <p className="text-slate-400 text-[11px] leading-relaxed">
          The app is fully optimized for <strong>Vercel</strong> deployment with <strong>Supabase</strong> PostgreSQL. You can configure Supabase credentials via Vercel Environment Variables or live in the form below.
        </p>

        {/* 1-Click Copy Supabase SQL */}
        <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between">
          <div>
            <span className="font-bold text-purple-300 text-xs block">1. Supabase SQL Schema Setup</span>
            <p className="text-[10px] text-purple-200/70">
              Run this script once in your Supabase SQL Editor to create tables, buckets, and seed data.
            </p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
              setCopiedSql(true);
              setTimeout(() => setCopiedSql(false), 3000);
            }}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[11px] shrink-0 transition-all active:scale-95 flex items-center space-x-1"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Schema'}</span>
          </button>
        </div>

        {/* Supabase Connection Form */}
        <form onSubmit={handleSaveDbSettings} className="space-y-2.5 pt-1 border-t border-white/[0.06]">
          <div>
            <label className="text-slate-400 block mb-1">Supabase Project URL:</label>
            <input
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Supabase Anon Key:</label>
            <input
              type="password"
              placeholder={dbSettings?.hasKey ? '••••••••••••••••••••••••' : 'Enter Supabase Key'}
              value={supabaseKey}
              onChange={e => setSupabaseKey(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-[11px]"
            />
          </div>

          {dbMsg && (
            <p className={`text-xs font-bold ${dbMsg.success ? 'text-emerald-400' : 'text-rose-400'}`}>
              {dbMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={testingDb}
            className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all active:scale-95"
          >
            {testingDb ? 'Testing Connection...' : 'Save & Link Supabase Database'}
          </button>
        </form>

        {/* Vercel Deployment Checklist */}
        <div className="pt-2 border-t border-white/[0.06] space-y-1.5 text-[11px]">
          <span className="font-bold text-slate-300 flex items-center space-x-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Vercel Deployment Checklist</span>
          </span>
          <ul className="space-y-1 text-slate-400 pl-4 list-disc text-[10px]">
            <li>Root contains <code className="text-rose-400">vercel.json</code> configured with SPA rewrites.</li>
            <li>In Vercel Project Settings &gt; Environment Variables, add <code className="text-emerald-400">VITE_SUPABASE_URL</code> and <code className="text-emerald-400">VITE_SUPABASE_ANON_KEY</code>.</li>
            <li>Deploy with 1-click on Vercel — zero backend servers to keep alive!</li>
          </ul>
        </div>
      </div>

      {/* Add User Modal */}
      <AddUserModal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} />

      {/* Admin Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in text-xs">
          <div className="w-full max-w-sm bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{resettingUser.avatar}</span>
                <div>
                  <h3 className="font-bold text-white text-xs">Reset Password for {resettingUser.name}</h3>
                  <p className="text-[10px] text-slate-400">Username: {resettingUser.username}</p>
                </div>
              </div>
              <button
                onClick={() => setResettingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-bold block text-[11px]">New Password:</label>
              <input
                type="text"
                value={newPasswordVal}
                onChange={e => setNewPasswordVal(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newPasswordVal.trim()) return;
                  await adminResetPassword(resettingUser.id, newPasswordVal.trim());
                  alert(`Password for ${resettingUser.name} updated to "${newPasswordVal.trim()}"!`);
                  setResettingUser(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-all active:scale-95"
              >
                Save New Password
              </button>
            </div>
          </div>
        </div>
      )}

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
