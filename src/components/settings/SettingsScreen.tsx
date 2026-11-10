import React, { useState } from 'react';
import {
  Bell,
  Volume2,
  VolumeX,
  LogOut,
  ShieldAlert,
  Smartphone,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Flame,
  CheckCircle,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { sendLocalNotification, requestNotificationPermission } from '../../services/notifications';
import { sound } from '../../services/audio';

export const SettingsScreen: React.FC = () => {
  const { config, updateConfig, currentUser, isAdmin, logout } = useChallenge();
  const [soundEnabled, setSoundEnabled] = useState(sound.getSoundEnabled());

  const handleTestNotification = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      sendLocalNotification('75 HARD – 9:00 PM Accountability Check', {
        body: 'Discipline check! Log your workouts, reading, diet, and progress photo before midnight.',
      });
      alert('Notification sent! Check your notification panel.');
    } else {
      alert('Notifications are blocked or not allowed in your browser settings.');
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.setSoundEnabled(next);
    if (next) sound.playTaskCheck();
  };

  return (
    <div className="space-y-4 pb-8 text-xs">
      {/* Page Title */}
      <div>
        <h2 className="text-base font-extrabold text-white">Challenger Preferences</h2>
        <p className="text-slate-400">
          Personal notifications, audio feedback, and profile settings.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{currentUser?.avatar}</span>
          <div>
            <h3 className="text-sm font-black text-white">{currentUser?.name}</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Username: <strong className="text-slate-300">@{currentUser?.username || 'user'}</strong>
            </p>
            <span className="text-[10px] text-emerald-400 font-bold">
              ₹{currentUser?.depositAmount || config.depositAmount} Deposit Pledge
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold border border-rose-600/30 flex items-center space-x-1.5 transition-all active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </div>

      {/* ADMIN PANEL SHORTCUT (IF ADMIN) */}
      {isAdmin && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/70 to-indigo-950/50 border border-purple-500/40 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-purple-400" />
              <h3 className="font-extrabold text-white text-sm">System & Task Modification Engine</h3>
            </div>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-black">
              ADMIN ONLY
            </span>
          </div>
          <p className="text-[11px] text-purple-200/80 leading-relaxed">
            All challenge rules, habit targets (wake-up time, reading pages, steps target, gym substitutes, dates, deposit amount), user additions, and exception approvals are managed exclusively in the Admin Panel.
          </p>
        </div>
      )}

      {/* NOTIFICATION PREFERENCES */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Daily 9:00 PM Reminder</h3>
              <p className="text-[11px] text-slate-400">Notification alert to seal tasks before midnight</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.reminderEnabled}
              onChange={e => updateConfig({ reminderEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
          <div>
            <label className="text-slate-400 font-semibold block mb-1">Reminder Time:</label>
            <input
              type="time"
              value={config.reminderTime}
              onChange={e => updateConfig({ reminderTime: e.target.value })}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white font-mono"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleTestNotification}
              className="w-full p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all active:scale-95"
            >
              Test Notification
            </button>
          </div>
        </div>
      </div>

      {/* AUDIO HAPTICS FEEDBACK */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-xl ${soundEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Tactile Athletic Audio</h3>
            <p className="text-[11px] text-slate-400">Click sounds and completion chimes</p>
          </div>
        </div>

        <button
          onClick={toggleSound}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            soundEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-slate-400'
          }`}
        >
          {soundEnabled ? 'Enabled' : 'Muted'}
        </button>
      </div>

      {/* PWA INSTALLATION GUIDE */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-2">
        <div className="flex items-center space-x-2">
          <Smartphone className="w-4 h-4 text-rose-500" />
          <h3 className="font-bold text-white text-xs uppercase tracking-wider">Install App on Phone (PWA)</h3>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Open this website in Safari (iOS) or Chrome (Android) and tap <strong>"Add to Home Screen"</strong> for a native, standalone full-screen experience with instant offline logging.
        </p>
      </div>
    </div>
  );
};
