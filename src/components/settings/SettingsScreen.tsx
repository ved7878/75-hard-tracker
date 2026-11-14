import React, { useState } from 'react';
import {
  Bell,
  Volume2,
  LogOut,
  ShieldCheck,
  Smartphone,
  KeyRound,
  PlaneTakeoff,
  BellRing,
  CalendarRange,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  sendLocalNotification,
  requestNotificationPermission,
  getReminderPrefs,
  saveReminderPrefs,
  notificationPermission,
} from '../../services/notifications';
import { sound } from '../../services/audio';
import { supabaseService } from '../../services/supabaseService';
import { formatPrettyDate, formatTime12 } from '../../services/rulesEngine';
import { Card, ListGroup, ListRow, SectionHeader, Sheet, Switch, ScreenTitle, Notice } from '../ui';

interface SettingsScreenProps {
  onNavigateTab: (tab: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigateTab }) => {
  const { config, currentUser, isAdmin, logout, pendingExceptions, squadMembers } = useChallenge();
  const [soundEnabled, setSoundEnabled] = useState(sound.getSoundEnabled());
  const [reminder, setReminder] = useState(() => getReminderPrefs({ enabled: config.reminderEnabled, time: config.reminderTime }));
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isRefereeSelf = isAdmin && currentUser?.id === 'admin';
  const me = squadMembers.find(m => m.user.id === currentUser?.id);

  const updateReminder = async (next: typeof reminder) => {
    if (next.enabled && !reminder.enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        alert('Notifications are blocked. Allow them in your browser settings to get the reminder.');
        return;
      }
    }
    setReminder(next);
    saveReminderPrefs(next);
  };

  const testNotification = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      sendLocalNotification('75 HARD reminder', { body: 'This is how your daily reminder will look.' });
    } else {
      alert('Notifications are blocked or not supported in this browser.');
    }
  };

  const savePassword = async () => {
    if (!currentUser) return;
    if (pw.trim().length < 6) return setPwMsg({ ok: false, text: 'Use at least 6 characters.' });
    if (pw !== pw2) return setPwMsg({ ok: false, text: "Passwords don't match." });
    const res = await supabaseService.updateUser(currentUser.id, { password: pw.trim() });
    setPwMsg({ ok: res.success, text: res.success ? 'Password updated.' : res.message || 'Could not update password.' });
    if (res.success) {
      setTimeout(() => {
        setPwOpen(false);
        setPw('');
        setPw2('');
        setPwMsg(null);
      }, 900);
    }
  };

  return (
    <div className="space-y-5">
      <ScreenTitle title="More" />

      {/* Profile */}
      <Card className="flex items-center gap-4">
        <span className="w-14 h-14 rounded-2xl bg-white/[0.05] flex items-center justify-center text-3xl shrink-0">
          {isRefereeSelf ? '⚖️' : currentUser?.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-white truncate">{isRefereeSelf ? 'Referee' : currentUser?.name}</p>
          <p className="text-[13px] text-zinc-500 truncate">@{currentUser?.username || currentUser?.id}</p>
          {!isRefereeSelf && config.penaltyEnabled !== false && (
            <p className="text-[13px] text-emerald-400 mt-0.5 tabular">
              {config.currencySymbol}
              {(me?.currentDeposit ?? currentUser?.depositAmount ?? config.depositAmount).toLocaleString('en-IN')} deposit
            </p>
          )}
        </div>
      </Card>

      {isAdmin && !isRefereeSelf && (
        <Notice tone="violet" icon={ShieldCheck} title={`Previewing ${currentUser?.name}`}>
          You're signed in as referee. Switch people from the bar at the top of Today.
        </Notice>
      )}

      <section>
        <SectionHeader title="Challenge" />
        <ListGroup>
          {!isRefereeSelf && (
            <ListRow
              icon={PlaneTakeoff}
              iconTone="amber"
              title="Travel & sick days"
              subtitle="Adjust rules or request an exemption"
              onClick={() => onNavigateTab('travel')}
              chevron
            />
          )}
          {isAdmin && (
            <ListRow
              icon={ShieldCheck}
              iconTone="violet"
              title="Admin panel"
              subtitle="Requests, squad, rules, dates"
              onClick={() => onNavigateTab('admin')}
              right={
                pendingExceptions.length > 0 ? (
                  <span className="chip bg-amber-400 text-ink-950">{pendingExceptions.length}</span>
                ) : undefined
              }
              chevron
            />
          )}
          <ListRow
            icon={CalendarRange}
            title="Challenge dates"
            subtitle={`${formatPrettyDate(config.startDate, { day: 'numeric', month: 'short' })} – ${formatPrettyDate(config.endDate, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })} · ${config.durationDays} days`}
          />
        </ListGroup>
      </section>

      <section>
        <SectionHeader title="Notifications & sound" />
        <ListGroup>
          <ListRow
            icon={Bell}
            iconTone="rose"
            title="Daily reminder"
            subtitle={
              reminder.enabled && notificationPermission() !== 'granted'
                ? 'Blocked – allow notifications in your browser'
                : reminder.enabled
                ? `Every day at ${formatTime12(reminder.time)}`
                : 'Off'
            }
            right={<Switch checked={reminder.enabled} onChange={v => updateReminder({ ...reminder, enabled: v })} label="Daily reminder" />}
          />
          {reminder.enabled && (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-[15px] text-zinc-300 pl-12">Time</span>
              <input
                type="time"
                value={reminder.time}
                onChange={e => updateReminder({ ...reminder, time: e.target.value })}
                className="input w-36 text-center"
              />
            </div>
          )}
          <ListRow icon={BellRing} title="Send test notification" onClick={testNotification} chevron />
          <ListRow
            icon={Volume2}
            iconTone="emerald"
            title="Sounds"
            subtitle="Tick and day-complete sounds"
            right={
              <Switch
                checked={soundEnabled}
                tone="emerald"
                label="Sounds"
                onChange={v => {
                  setSoundEnabled(v);
                  sound.setSoundEnabled(v);
                  if (v) sound.playTaskCheck();
                }}
              />
            }
          />
        </ListGroup>
        <p className="text-[12px] text-zinc-500 mt-2 px-1">These settings only apply to this device.</p>
      </section>

      <section>
        <SectionHeader title="Account" />
        <ListGroup>
          {!isRefereeSelf && <ListRow icon={KeyRound} title="Change password" onClick={() => setPwOpen(true)} chevron />}
          <ListRow
            icon={LogOut}
            iconTone="rose"
            title="Log out"
            danger
            onClick={() => {
              if (window.confirm('Log out of 75 HARD?')) logout();
            }}
          />
        </ListGroup>
      </section>

      <Card className="flex gap-3">
        <Smartphone className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
        <p className="text-[13px] text-zinc-400 leading-relaxed">
          <span className="text-zinc-200 font-semibold">Install on your phone:</span> open this site in Safari or Chrome and choose{' '}
          <span className="text-zinc-200">Add to Home Screen</span>.
        </p>
      </Card>

      <Sheet
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change password"
        footer={
          <button className="btn-primary w-full" onClick={savePassword}>
            Save password
          </button>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="field-label" htmlFor="new-pw">
              New password
            </label>
            <input id="new-pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="confirm-pw">
              Confirm password
            </label>
            <input id="confirm-pw" className="input" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} />
          </div>
          {pwMsg && <p className={`text-sm ${pwMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{pwMsg.text}</p>}
        </div>
      </Sheet>
    </div>
  );
};
