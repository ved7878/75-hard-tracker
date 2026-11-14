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
  Plus,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { formatDate, getDayNumber, getEndDate, formatPrettyDate, DEFAULT_HABITS } from '../../services/rulesEngine';
import { UserProfile, ChallengeConfig, HabitConfig } from '../../types';
import { AddUserModal } from './AddUserModal';
import { AdminDayEditor } from './AdminDayEditor';
import { SUPABASE_SETUP_SQL } from '../../services/supabase';
import { Card, Chip, Notice, ScreenTitle, SectionHeader, Sheet, Switch } from '../ui';
import { AVAILABLE_HABIT_ICONS, getTaskIcon } from '../common/taskMeta';

type AdminTab = 'requests' | 'squad' | 'habits' | 'editday' | 'rules' | 'data';

interface AdminPanelScreenProps {
  onNavigateTab: (tab: string) => void;
  /** Open Edit day for this challenger + date (sent from the Checklist / Calendar / Today screens) */
  dayTarget?: { userId: string; date: string; nonce: number };
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

export const AdminPanelScreen: React.FC<AdminPanelScreenProps> = ({ dayTarget }) => {
  const {
    isAdmin,
    users,
    pendingExceptions,
    approveException,
    rejectException,
    adminDeleteUser,
    adminResetPassword,
    config,
    updateConfig,
    dbSettings,
    updateDbSettings,
    depositLedger,
  } = useChallenge();

  const challengers = users.filter(u => u.role !== 'admin');
  const [tab, setTab] = useState<AdminTab>(dayTarget ? 'editday' : pendingExceptions.length > 0 ? 'requests' : 'editday');
  const [selectedUserId, setSelectedUserId] = useState<string>(dayTarget?.userId || challengers[0]?.id || 'user_1');
  const [selectedDate, setSelectedDate] = useState<string>(dayTarget?.date || formatDate(new Date()));
  // "Edit" pressed on another screen: jump straight to that person's day
  useEffect(() => {
    if (!dayTarget) return;
    setTab('editday');
    setSelectedUserId(dayTarget.userId);
    setSelectedDate(dayTarget.date);
  }, [dayTarget?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
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

  // Habit management - the ONLY place habits are defined. Every change is saved straight
  // away (no separate "Save" step that was easy to miss, losing a newly added habit).
  const [isHabitSheetOpen, setIsHabitSheetOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Partial<HabitConfig> | null>(null);
  const [habitMsg, setHabitMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [habitSaving, setHabitSaving] = useState(false);

  const habitList: HabitConfig[] = config.habits && config.habits.length > 0 ? config.habits : DEFAULT_HABITS;

  const saveHabits = async (updated: HabitConfig[], doneText: string) => {
    setHabitSaving(true);
    setHabitMsg(null);
    const res = await updateConfig({ habits: updated });
    setHabitSaving(false);
    setHabitMsg(res.success ? { ok: true, text: doneText } : { ok: false, text: `Saved on this device only. ${res.message || ''}` });
  };

  const handleOpenAddHabit = () => {
    setEditingHabit({
      id: '',
      name: '',
      description: '',
      enabled: true,
      required: true,
      category: 'custom',
      targetType: 'checkbox',
      icon: 'Target',
    });
    setIsHabitSheetOpen(true);
  };

  const handleOpenEditHabit = (habit: HabitConfig) => {
    setEditingHabit({ ...habit });
    setIsHabitSheetOpen(true);
  };

  const handleSaveHabitModal = async () => {
    if (!editingHabit || !editingHabit.name?.trim()) return;
    const current = [...habitList];
    let updated: HabitConfig[];
    const name = editingHabit.name.trim();
    if (editingHabit.id) {
      updated = current.map(h =>
        h.id === editingHabit.id
          ? ({ ...h, ...editingHabit, name, description: editingHabit.description?.trim() || '' } as HabitConfig)
          : h
      );
    } else {
      const newHabit: HabitConfig = {
        id: `custom_${Date.now()}`,
        name,
        description: editingHabit.description?.trim() || '',
        enabled: editingHabit.enabled ?? true,
        required: editingHabit.required ?? true,
        category: 'custom',
        targetType: editingHabit.targetType || 'checkbox',
        targetValue: editingHabit.targetValue,
        targetUnit: editingHabit.targetUnit,
        icon: editingHabit.icon || 'Sparkles',
      };
      updated = [...current, newHabit];
    }
    setIsHabitSheetOpen(false);
    setEditingHabit(null);
    await saveHabits(updated, editingHabit.id ? `"${name}" updated.` : `"${name}" added - it's on everyone's checklist now.`);
  };

  const handleToggleHabitEnabled = (id: string, enabled: boolean) => {
    const h = habitList.find(x => x.id === id);
    const updated = habitList.map(x => (x.id === id ? { ...x, enabled } : x));
    saveHabits(updated, `"${h?.name || 'Habit'}" ${enabled ? 'switched on' : 'switched off'}.`);
  };

  const handleDeleteHabit = (id: string) => {
    const h = habitList.find(x => x.id === id);
    if (window.confirm(`Delete "${h?.name || 'this habit'}"? It disappears from every checklist. Past ticks stay in the logs.`)) {
      saveHabits(habitList.filter(x => x.id !== id), `"${h?.name || 'Habit'}" deleted.`);
    }
  };

  if (!isAdmin) {
    return (
      <Card className="text-center py-10 space-y-2">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Referee only</h2>
        <p className="text-sm text-zinc-400">This area is restricted to the admin.</p>
      </Card>
    );
  }

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
    // Habits are saved from the Habits tab - never overwrite them with this form's copy
    const { habits: _habits, ...rules } = form;
    const res = await updateConfig(rules);
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
    { id: 'editday', label: 'Edit day' },
    { id: 'habits', label: 'Habits' },
    { id: 'squad', label: 'Squad' },
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
                      @{c.username}
                      {config.penaltyEnabled !== false && (
                        <>
                          {' '}·{' '}
                          <span className={net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : ''}>
                            {config.currencySymbol}
                            {(bal?.currentDeposit ?? c.depositAmount ?? config.depositAmount).toLocaleString('en-IN')}
                          </span>
                        </>
                      )}
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

      {/* HABITS */}
      {tab === 'habits' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold text-white">
                Challenge Habits ({habitList.filter(h => h.enabled !== false).length} active)
              </p>
              <p className="text-[13px] text-zinc-400">
                {habitSaving ? 'Saving…' : 'Changes save instantly and apply to every checklist.'}
              </p>
            </div>
            <button onClick={handleOpenAddHabit} className="btn-primary btn-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Habit
            </button>
          </div>

          {habitMsg && (
            <Notice tone={habitMsg.ok ? 'emerald' : 'amber'} icon={habitMsg.ok ? CircleCheck : ShieldAlert} title={habitMsg.text} />
          )}

          <div className="card overflow-hidden divide-y divide-white/[0.05]">
            {habitList.map(h => {
              const IconComp = getTaskIcon(h.id, h.icon);
              const isCustom = h.category === 'custom' || h.id.startsWith('custom_');
              const isEnabled = h.enabled !== false;
              return (
                <div
                  key={h.id}
                  className={`flex items-center gap-3 px-4 py-3 transition ${
                    isEnabled ? '' : 'opacity-50 bg-black/20'
                  }`}
                >
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isEnabled ? 'bg-white/[0.07] text-white' : 'bg-white/[0.03] text-zinc-500'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-semibold text-white leading-snug">{h.name}</span>
                      {isCustom ? <Chip tone="violet">Custom</Chip> : <Chip tone="neutral">Core</Chip>}
                      {h.required !== false ? <Chip tone="rose">Required</Chip> : <Chip tone="blue">Optional</Chip>}
                      {!isEnabled && <Chip tone="neutral">Disabled</Chip>}
                    </div>
                    <p className="text-[13px] text-zinc-400 truncate">
                      {h.description || 'No description'}
                    </p>
                    {h.targetType === 'number' && h.targetValue && (
                      <p className="text-[12px] text-zinc-500">
                        Target: {h.targetValue} {h.targetUnit || 'units'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      tone="emerald"
                      label={`Toggle ${h.name}`}
                      checked={isEnabled}
                      onChange={checked => handleToggleHabitEnabled(h.id, checked)}
                    />
                    <button
                      onClick={() => handleOpenEditHabit(h)}
                      aria-label={`Edit ${h.name}`}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 active:bg-white/[0.06]"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {isCustom && (
                      <button
                        onClick={() => handleDeleteHabit(h.id)}
                        aria-label={`Delete ${h.name}`}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 active:bg-rose-500/10 active:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EDIT DAY - the single place the referee edits a challenger's day */}
      {tab === 'editday' && (
        <AdminDayEditor
          challengers={challengers}
          userId={selectedUserId}
          date={selectedDate}
          onChangeUser={setSelectedUserId}
          onChangeDate={setSelectedDate}
        />
      )}

      {/* RULES & DATES */}
      {tab === 'rules' && (
        <div className="space-y-4">
          <section>
            <SectionHeader title="Peer Penalties & Financial Stakes" />
            <Card className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-white">Peer Penalty Redistribution</p>
                  <p className="text-[13px] text-zinc-400">
                    When active, missed days incur penalties redistributed among successful challengers. When disabled, all money/deposit features are completely hidden across the app for pure habit tracking.
                  </p>
                </div>
                <Switch
                  tone="emerald"
                  checked={form.penaltyEnabled !== false}
                  onChange={v => patchForm({ penaltyEnabled: v })}
                  label="Peer penalty enabled"
                />
              </div>
              {form.penaltyEnabled !== false && (
                <NumberField
                  label="Deposit per person"
                  suffix={config.currencySymbol}
                  value={form.depositAmount}
                  onChange={n => patchForm({ depositAmount: n })}
                />
              )}
            </Card>
          </section>

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
        </div>
      )}

      {/* STICKY SAVE BAR FOR RULES */}
      {tab === 'rules' && (
        <div className="space-y-3">
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

      <Sheet
        open={isHabitSheetOpen}
        onClose={() => {
          setIsHabitSheetOpen(false);
          setEditingHabit(null);
        }}
        title={editingHabit?.id ? `Edit ${editingHabit.name || 'Habit'}` : 'Add New Habit'}
        subtitle={editingHabit?.category === 'custom' || !editingHabit?.id ? 'Custom Challenge Habit' : 'Core Habit'}
        footer={
          <div className="flex gap-2 w-full">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => {
                setIsHabitSheetOpen(false);
                setEditingHabit(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!editingHabit?.name?.trim()}
              onClick={handleSaveHabitModal}
            >
              Save Habit
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Habit Name *</label>
            <input
              className="input"
              value={editingHabit?.name || ''}
              onChange={e => setEditingHabit(h => ({ ...h, name: e.target.value }))}
              placeholder="e.g. Cold Shower, Meditate 10m"
            />
          </div>

          <div>
            <label className="field-label">Description / Instructions</label>
            <textarea
              rows={2}
              className="input"
              value={editingHabit?.description || ''}
              onChange={e => setEditingHabit(h => ({ ...h, description: e.target.value }))}
              placeholder="Short instructions for challengers"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-ink-850 border border-white/[0.05]">
            <div>
              <p className="text-sm font-semibold text-white">Required for daily pass</p>
              <p className="text-[12px] text-zinc-400">If disabled, this habit is tracked as optional</p>
            </div>
            <Switch
              tone="rose"
              label="Habit required"
              checked={editingHabit?.required !== false}
              onChange={req => setEditingHabit(h => ({ ...h, required: req }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-ink-850 border border-white/[0.05]">
            <div>
              <p className="text-sm font-semibold text-white">Active in challenge</p>
              <p className="text-[12px] text-zinc-400">Turn off to temporarily hide from the daily checklist</p>
            </div>
            <Switch
              tone="emerald"
              label="Habit enabled"
              checked={editingHabit?.enabled !== false}
              onChange={en => setEditingHabit(h => ({ ...h, enabled: en }))}
            />
          </div>

          {editingHabit?.id && editingHabit.category !== 'custom' && !editingHabit.id.startsWith('custom_') ? (
            <p className="text-[12px] text-zinc-500 rounded-xl bg-ink-850 border border-white/[0.05] px-3 py-2.5">
              Targets for core habits (pages, steps, minutes…) are set in Rules &amp; dates.
            </p>
          ) : (
          <>
          <div>
            <label className="field-label">Tracking Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditingHabit(h => ({ ...h, targetType: 'checkbox' }))}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border ${
                  editingHabit?.targetType !== 'number'
                    ? 'bg-white text-ink-950 border-white'
                    : 'bg-ink-850 text-zinc-400 border-white/[0.08]'
                }`}
              >
                Yes / No Checkbox
              </button>
              <button
                type="button"
                onClick={() => setEditingHabit(h => ({ ...h, targetType: 'number' }))}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border ${
                  editingHabit?.targetType === 'number'
                    ? 'bg-white text-ink-950 border-white'
                    : 'bg-ink-850 text-zinc-400 border-white/[0.08]'
                }`}
              >
                Numeric Target
              </button>
            </div>
          </div>

          {editingHabit?.targetType === 'number' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Target Number</label>
                <input
                  type="number"
                  className="input"
                  value={editingHabit?.targetValue ?? ''}
                  onChange={e => setEditingHabit(h => ({ ...h, targetValue: parseFloat(e.target.value) || 0 }))}
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <label className="field-label">Unit</label>
                <input
                  className="input"
                  value={editingHabit?.targetUnit || ''}
                  onChange={e => setEditingHabit(h => ({ ...h, targetUnit: e.target.value }))}
                  placeholder="e.g. mins, reps, ml"
                />
              </div>
            </div>
          )}
          </>
          )}

          <div>
            <label className="field-label">Choose Icon</label>
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
              {AVAILABLE_HABIT_ICONS.map(ic => {
                const IconComp = ic.icon;
                const isSelected = editingHabit?.icon === ic.id;
                return (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setEditingHabit(h => ({ ...h, icon: ic.id }))}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-400'
                        : 'border-white/[0.06] bg-ink-850 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <IconComp className="w-5 h-5 mb-1" />
                    <span className="text-[10px] truncate max-w-full">{ic.label.split('/')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Sheet>

      {previewProofUrl && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-3" onClick={() => setPreviewProofUrl(null)}>
          <img src={previewProofUrl} alt="Medical proof" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
};
