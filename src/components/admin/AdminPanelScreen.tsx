import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  CircleCheck,
  KeyRound,
  UserPlus,
  Trash2,
  Copy,
  Check,
  Database,
  Stethoscope,
  ExternalLink,
  Save,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  formatDate,
  createDefaultLog,
  validateDayTasks,
  getDayNumber,
  getEndDate,
  formatPrettyDate,
} from '../../services/rulesEngine';
import { toggleTask } from '../../services/taskActions';
import { UserProfile, ChallengeConfig } from '../../types';
import { AddUserModal } from './AddUserModal';
import { SUPABASE_SETUP_SQL } from '../../services/supabase';
import { Card, CheckButton, Chip, Notice, ScreenTitle, SectionHeader, Sheet, Switch } from '../ui';
import { TASK_ICONS } from '../common/taskMeta';

type AdminTab = 'requests' | 'squad' | 'editday' | 'rules' | 'data';

interface AdminPanelScreenProps {
  onNavigateTab: (tab: string) => void;
}

/** PDF proofs come back as data: URLs offline, but as https://…/file.pdf from Supabase Storage. */
const isPdfProof = (url?: string, name?: string) =>
  Boolean(url && (url.startsWith('data:application/pdf') || /\.pdf($|\?)/i.test(url) || /\.pdf$/i.test(name || '')));

const NumberField: React.FC<{ label: string; value: number; onChange: (n: number) => void; step?: string; suffix?: string }> = ({
  label,
  value,
  onChange,
  step,
  suffix,
}) => (
  <div>
    <label className="field-label">{label}</label>
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={e => onChange(Number(e.target.value))}
        className={`input ${suffix ? 'pr-12' : ''}`}
      />
      {suffix && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">{suffix}</span>}
    </div>
  </div>
);

export const AdminPanelScreen: React.FC<AdminPanelScreenProps> = ({ onNavigateTab }) => {
  const {
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
    setCurrentUserId,
    setCurrentDate,
    dbSettings,
    updateDbSettings,
    depositLedger,
  } = useChallenge();

  const challengers = users.filter(u => u.role !== 'admin');
  const [tab, setTab] = useState<AdminTab>(pendingExceptions.length > 0 ? 'requests' : 'squad');
  const [selectedUserId, setSelectedUserId] = useState<string>(challengers[0]?.id || 'user_1');
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState<UserProfile | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  // Rules form – kept in sync with the live config until the admin starts editing
  const [form, setForm] = useState<ChallengeConfig>({ ...config });
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!dirty) setForm({ ...config });
  }, [config, dirty]);
  const patchForm = (p: Partial<ChallengeConfig>) => {
    setDirty(true);
    setSaveMsg(null);
    setForm(f => ({ ...f, ...p }));
  };

  const [supabaseUrl, setSupabaseUrl] = useState(dbSettings?.supabaseUrl || '');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [dbMsg, setDbMsg] = useState<{ success?: boolean; text?: string } | null>(null);
  const [testingDb, setTestingDb] = useState(false);

  if (!isAdmin) {
    return (
      <Card className="text-center py-10 space-y-2">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Referee only</h2>
        <p className="text-sm text-zinc-400">This area is restricted to the admin.</p>
      </Card>
    );
  }

  const targetUser = challengers.find(c => c.id === selectedUserId) || challengers[0];
  // Header and edits must agree on WHO is being edited (selected user may have been removed)
  const editUserId = targetUser?.id || selectedUserId;
  const targetLog = (allUsersLogs[editUserId] || {})[selectedDate] || createDefaultLog(selectedDate, config, editUserId);
  const { items, completedCount, totalCount } = validateDayTasks(targetLog, config);
  const targetDayNum = getDayNumber(selectedDate, config.startDate);
  const formEndDate = form.startDate ? getEndDate(form.startDate, form.durationDays || 1) : '';

  const handleSaveRules = async () => {
    if (!form.startDate) {
      setSaveMsg({ ok: false, text: 'Pick a start date.' });
      return;
    }
    if (!form.durationDays || form.durationDays < 1) {
      setSaveMsg({ ok: false, text: 'Duration must be at least 1 day.' });
      return;
    }
    setSaving(true);
    const res = await updateConfig(form);
    setSaving(false);
    setDirty(false);
    setSaveMsg(
      res.success
        ? { ok: true, text: `Saved. Challenge runs ${formatPrettyDate(form.startDate)} – ${formatPrettyDate(formEndDate)}.` }
        : { ok: false, text: `Saved on this device only. ${res.message || ''}` }
    );
  };

  const tabs: Array<{ id: AdminTab; label: string; badge?: number }> = [
    { id: 'requests', label: 'Requests', badge: pendingExceptions.length },
    { id: 'squad', label: 'Squad' },
    { id: 'editday', label: 'Edit a day' },
    { id: 'rules', label: 'Rules & dates' },
    { id: 'data', label: 'Database' },
  ];

  return (
    <div className="space-y-4">
      <ScreenTitle title="Admin" subtitle="Referee controls" />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
              tab === t.id ? 'bg-white text-ink-950' : 'bg-white/[0.06] text-zinc-300'
            }`}
          >
            {t.label}
            {!!t.badge && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-ink-950 text-2xs font-bold flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* REQUESTS */}
      {tab === 'requests' &&
        (pendingExceptions.length === 0 ? (
          <Card className="text-center py-10 space-y-2">
            <CircleCheck className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-[15px] font-semibold text-white">No pending requests</p>
            <p className="text-sm text-zinc-500">Sick-day requests with proof will show up here.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingExceptions.map(req => (
              <Card key={`${req.userId}_${req.date}`} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{req.userAvatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-white">{req.userName}</p>
                    <p className="text-[13px] text-zinc-500">
                      Day {getDayNumber(req.date, config.startDate)} · {formatPrettyDate(req.date)}
                    </p>
                  </div>
                  <Chip tone="amber">Pending</Chip>
                </div>
                {req.doctorNotes && <p className="text-sm text-zinc-300 bg-ink-850 rounded-xl px-3.5 py-2.5">{req.doctorNotes}</p>}
                {req.medicalProofUrl &&
                  (isPdfProof(req.medicalProofUrl, req.medicalProofName) ? (
                    <a href={req.medicalProofUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full">
                      <ExternalLink className="w-4 h-4" /> Open PDF proof
                    </a>
                  ) : (
                    <button onClick={() => setPreviewProofUrl(req.medicalProofUrl || null)} className="block w-full rounded-xl overflow-hidden bg-black">
                      <img src={req.medicalProofUrl} alt="Medical proof" className="w-full max-h-72 object-contain" />
                    </button>
                  ))}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => rejectException(req.userId, req.date)} className="btn-secondary text-rose-300">
                    Reject
                  </button>
                  <button onClick={() => approveException(req.userId, req.date)} className="btn bg-emerald-600 text-white">
                    Approve
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {/* SQUAD */}
      {tab === 'squad' && (
        <div className="space-y-3">
          <div className="card overflow-hidden divide-y divide-white/[0.05]">
            {challengers.map(c => {
              const bal = depositLedger.balances[c.id];
              const net = bal?.netChange ?? 0;
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-2xl w-9 text-center">{c.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-white truncate">{c.name}</p>
                    <p className="text-[13px] text-zinc-500 break-all">
                      @{c.username} ·{' '}
                      <span className={net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : ''}>
                        {config.currencySymbol}
                        {(bal?.currentDeposit ?? c.depositAmount ?? config.depositAmount).toLocaleString('en-IN')}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setResettingUser(c);
                      setNewPasswordVal('');
                    }}
                    aria-label={`Reset password for ${c.name}`}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 active:bg-white/[0.06]"
                  >
                    <KeyRound className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Remove ${c.name}? All their logs will be deleted.`)) {
                        adminDeleteUser(c.id).then(ok => {
                          if (!ok) alert(`Could not remove ${c.name} from the cloud database. Check your connection and try again.`);
                        });
                      }
                    }}
                    aria-label={`Remove ${c.name}`}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 active:bg-rose-500/10 active:text-rose-400"
                  >
                    <Trash2 className="w-[18px] h-[18px]" />
                  </button>
                </div>
              );
            })}
          </div>
          <button onClick={() => setIsAddUserOpen(true)} className="btn-secondary w-full">
            <UserPlus className="w-4 h-4" /> Add challenger
          </button>
        </div>
      )}

      {/* EDIT A DAY */}
      {tab === 'editday' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Challenger</label>
              <select value={editUserId} onChange={e => setSelectedUserId(e.target.value)} className="input">
                {challengers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.avatar} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Date</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input" />
            </div>
          </div>

          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
              <div>
                <p className="text-[15px] font-semibold text-white">
                  {targetUser?.name} · Day {targetDayNum}
                </p>
                <p className="text-[13px] text-zinc-500">
                  {completedCount}/{totalCount} done · {formatPrettyDate(selectedDate)}
                </p>
              </div>
              <button
                onClick={() => {
                  setCurrentUserId(editUserId);
                  setCurrentDate(selectedDate);
                  onNavigateTab('tracker');
                }}
                className="btn-secondary btn-sm"
              >
                Open
              </button>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {items.map(item => {
                const Icon = TASK_ICONS[item.id];
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-zinc-200">{item.title}</span>
                      {item.id === 'progressPhoto' && !targetLog.tasks.progressPhoto.photoUrl && (
                        <span className="block text-[12px] text-zinc-500">Upload via “Open” to complete</span>
                      )}
                    </span>
                    <CheckButton
                      checked={item.isCompleted}
                      disabled={item.id === 'progressPhoto' && !targetLog.tasks.progressPhoto.photoUrl}
                      onClick={() => adminUpdateLog(editUserId, selectedDate, prev => toggleTask(prev, item.id, config))}
                      label={item.title}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-t border-white/[0.05]">
              <Stethoscope className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="flex-1 text-sm text-zinc-200">Medical exemption</span>
              <Switch
                tone="blue"
                label="Medical exemption"
                checked={targetLog.sickness.isExempt}
                onChange={next =>
                  adminUpdateLog(editUserId, selectedDate, prev => ({
                    ...prev,
                    sickness: {
                      ...prev.sickness,
                      isSick: next,
                      isExempt: next,
                      hasMedicalProof: next ? true : prev.sickness.hasMedicalProof,
                      status: next ? 'approved' : 'none',
                      reviewedBy: 'Admin',
                      reviewedAt: new Date().toISOString(),
                    },
                  }))
                }
              />
            </div>
          </Card>
        </div>
      )}

      {/* RULES & DATES */}
      {tab === 'rules' && (
        <div className="space-y-4">
          <section>
            <SectionHeader title="Schedule" />
            <Card className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Start date</label>
                  <input type="date" value={form.startDate} onChange={e => patchForm({ startDate: e.target.value })} className="input" />
                </div>
                <NumberField label="Duration" suffix="days" value={form.durationDays} onChange={n => patchForm({ durationDays: n })} />
              </div>
              <div className="rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-sm text-zinc-300">
                Ends <span className="font-semibold text-white">{formEndDate ? formatPrettyDate(formEndDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                <span className="block text-[12px] text-zinc-500 mt-0.5">Worked out from the start date and duration.</span>
              </div>
              <NumberField
                label={`Deposit per person`}
                suffix={config.currencySymbol}
                value={form.depositAmount}
                onChange={n => patchForm({ depositAmount: n })}
              />
            </Card>
          </section>

          <section>
            <SectionHeader title="Targets" />
            <Card className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Wake up by</label>
                  <input type="time" value={form.wakeUpTarget} onChange={e => patchForm({ wakeUpTarget: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="field-label">On travel days</label>
                  <input
                    type="time"
                    value={form.wakeUpTravelTarget}
                    onChange={e => patchForm({ wakeUpTravelTarget: e.target.value })}
                    className="input"
                  />
                </div>
                <NumberField
                  label="Wake-up buffer"
                  suffix="min"
                  value={form.wakeUpGraceMinutes}
                  onChange={n => patchForm({ wakeUpGraceMinutes: n })}
                />
                <div />
                <NumberField label="Min pages" value={form.readingMinPages} onChange={n => patchForm({ readingMinPages: n })} />
                <NumberField label="Max pages" value={form.readingMaxPages} onChange={n => patchForm({ readingMaxPages: n })} />
                <NumberField label="Steps" value={form.stepsTarget} onChange={n => patchForm({ stepsTarget: n })} />
                <NumberField label="Run / walk" suffix="km" step="0.5" value={form.runTargetKm} onChange={n => patchForm({ runTargetKm: n })} />
                <NumberField label="Floors" value={form.floorsTarget} onChange={n => patchForm({ floorsTarget: n })} />
                <NumberField label="Family time" suffix="min" value={form.familyTargetMinutes} onChange={n => patchForm({ familyTargetMinutes: n })} />
                <NumberField label="Calories goal" suffix="kcal" value={form.calorieTarget} onChange={n => patchForm({ calorieTarget: n })} />
                <NumberField label="Protein goal" suffix="g" value={form.proteinTargetG} onChange={n => patchForm({ proteinTargetG: n })} />
              </div>
              <p className="text-[12px] text-zinc-500">Calories and protein are tracked for insight only – they don't decide if the diet habit passes.</p>
            </Card>
          </section>

          <section>
            <SectionHeader title="Travel" />
            <Card className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Long trip after" suffix="h" value={form.travelThresholdHours} onChange={n => patchForm({ travelThresholdHours: n })} />
                <NumberField label="Gym swap: steps" value={form.travelSubstituteSteps} onChange={n => patchForm({ travelSubstituteSteps: n })} />
                <NumberField
                  label="Gym swap: run"
                  suffix="km"
                  step="0.5"
                  value={form.travelSubstituteRunKm}
                  onChange={n => patchForm({ travelSubstituteRunKm: n })}
                />
                <NumberField label="Gym swap: floors" value={form.travelSubstituteFloors} onChange={n => patchForm({ travelSubstituteFloors: n })} />
              </div>
              <p className="text-[12px] text-zinc-500">On a no-gym day (travel, sick, gym closed) Physical Activity must hit these instead.</p>
            </Card>
          </section>

          <section>
            <SectionHeader title="Strictness" />
            <div className="card divide-y divide-white/[0.05]">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-[15px] text-zinc-100">Only today is editable</p>
                  <p className="text-[13px] text-zinc-500">No back-filling missed days</p>
                </div>
                <Switch checked={form.lockPastDays} onChange={v => patchForm({ lockPastDays: v })} label="Lock past days" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-[15px] text-zinc-100">Reset streak on a miss</p>
                  <p className="text-[13px] text-zinc-500">Any missed habit sends you back to 0</p>
                </div>
                <Switch checked={form.strictResetOnMiss} onChange={v => patchForm({ strictResetOnMiss: v })} label="Strict reset" />
              </div>
            </div>
          </section>

          {saveMsg && (
            <Notice tone={saveMsg.ok ? 'emerald' : 'amber'} icon={saveMsg.ok ? CircleCheck : ShieldAlert} title={saveMsg.text} />
          )}

          <div className="sticky z-10 -mx-4 px-4 py-3 bg-ink-950/90 backdrop-blur" style={{ bottom: 'calc(var(--safe-bottom) + 64px)' }}>
            <div className="flex gap-2">
              {dirty && (
                <button
                  onClick={() => {
                    setDirty(false);
                    setSaveMsg(null);
                    setForm({ ...config });
                  }}
                  className="btn-secondary"
                >
                  Discard
                </button>
              )}
              <button onClick={handleSaveRules} disabled={!dirty || saving} className="btn-primary flex-1">
                <Save className="w-4 h-4" /> {saving ? 'Saving…' : dirty ? 'Save changes' : 'All changes saved'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DATABASE */}
      {tab === 'data' && (
        <div className="space-y-3">
          <Notice
            tone={dbSettings?.isConnected ? 'emerald' : 'amber'}
            icon={Database}
            title={dbSettings?.isConnected ? 'Connected to Supabase' : 'Local mode'}
          >
            {dbSettings?.isConnected
              ? 'Data syncs across everyone’s phones.'
              : 'Data is only saved on this device. Connect Supabase to share it with the squad.'}
          </Notice>

          <Card className="space-y-3">
            <div>
              <label className="field-label">Project URL</label>
              <input
                className="input font-mono text-sm"
                placeholder="https://xyz.supabase.co"
                value={supabaseUrl}
                onChange={e => setSupabaseUrl(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <div>
              <label className="field-label">Anon key</label>
              <input
                className="input font-mono text-sm"
                type="password"
                placeholder={dbSettings?.hasKey ? '•••••••••• (saved)' : 'Paste anon public key'}
                value={supabaseKey}
                onChange={e => setSupabaseKey(e.target.value)}
              />
            </div>
            {dbMsg && <p className={`text-sm ${dbMsg.success ? 'text-emerald-400' : 'text-rose-400'}`}>{dbMsg.text}</p>}
            <button
              disabled={testingDb}
              onClick={async () => {
                setTestingDb(true);
                setDbMsg(null);
                const res = await updateDbSettings({ supabaseUrl, supabaseAnonKey: supabaseKey });
                setTestingDb(false);
                setDbMsg({ success: res.success, text: res.message });
              }}
              className="btn-primary w-full"
            >
              {testingDb ? 'Testing connection…' : 'Test & connect'}
            </button>
          </Card>

          <Card className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-white">Database setup SQL</p>
              <p className="text-[13px] text-zinc-500">Run once in the Supabase SQL editor.</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2500);
              }}
              className="btn-secondary btn-sm"
            >
              {copiedSql ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedSql ? 'Copied' : 'Copy'}
            </button>
          </Card>
        </div>
      )}

      <AddUserModal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} />

      <Sheet
        open={Boolean(resettingUser)}
        onClose={() => setResettingUser(null)}
        title={`Reset ${resettingUser?.name}'s password`}
        subtitle={`@${resettingUser?.username}`}
        footer={
          <button
            className="btn-primary w-full"
            disabled={newPasswordVal.trim().length < 6}
            onClick={async () => {
              if (!resettingUser) return;
              const res = await adminResetPassword(resettingUser.id, newPasswordVal.trim());
              alert(res.message);
              if (res.success) {
                setResettingUser(null);
                setNewPasswordVal('');
              }
            }}
          >
            Save new password
          </button>
        }
      >
        <label className="field-label">New password</label>
        <input
          className="input font-mono"
          value={newPasswordVal}
          onChange={e => setNewPasswordVal(e.target.value)}
          placeholder="At least 6 characters"
          autoCapitalize="off"
        />
      </Sheet>

      {previewProofUrl && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-3" onClick={() => setPreviewProofUrl(null)}>
          <img src={previewProofUrl} alt="Medical proof" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
};
