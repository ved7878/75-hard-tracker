import React, { useState, useRef } from 'react';
import {
  Settings,
  Database,
  Bell,
  Sliders,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code,
  ShieldAlert,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { storage } from '../../services/storage';
import { testSupabaseConnection } from '../../services/supabase';
import { sendLocalNotification, requestNotificationPermission } from '../../services/notifications';
import { SupabaseModal } from './SupabaseModal';

export const SettingsScreen: React.FC = () => {
  const { config, updateConfig, syncState, syncToCloud, pullFromCloud, resetChallenge } = useChallenge();
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestMsg, setSupabaseTestMsg] = useState<{ success?: boolean; text?: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Form state for challenge settings
  const handleConfigChange = (key: string, value: any) => {
    updateConfig({ [key]: value });
  };

  const handleTestSupabase = async () => {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      setSupabaseTestMsg({ success: false, text: 'Please enter both Supabase URL and Anon Key.' });
      return;
    }
    setTestingSupabase(true);
    setSupabaseTestMsg(null);
    const res = await testSupabaseConnection(config.supabaseUrl, config.supabaseAnonKey);
    setTestingSupabase(false);
    setSupabaseTestMsg({ success: res.success, text: res.message });
  };

  const handleTestNotification = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      sendLocalNotification('75 HARD – 9:00 PM Reminder Preview', {
        body: 'Discipline check! Log your workouts, reading, diet, and progress photo before midnight.',
      });
      alert('Notification sent! Check your notification panel.');
    } else {
      alert('Notifications are blocked or not allowed in your browser settings.');
    }
  };

  const handleExportData = () => {
    const jsonStr = storage.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `75_HARD_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        const text = event.target?.result as string;
        const res = storage.importBackup(text);
        if (res.success) {
          alert('Backup imported successfully! Page will reload.');
          window.location.reload();
        } else {
          alert('Import failed: ' + res.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleResetChallenge = () => {
    if (window.confirm('Are you sure you want to completely reset all daily logs and restart 75 HARD? This cannot be undone.')) {
      resetChallenge();
      alert('Challenge reset to Day 1.');
    }
  };

  return (
    <div className="space-y-5 pb-8 text-xs">
      {/* Page Title */}
      <div>
        <h2 className="text-base font-extrabold text-white">Config & System Settings</h2>
        <p className="text-slate-400">
          Fully configure challenge dates, habit thresholds, 9 PM alert, and Supabase cloud sync.
        </p>
      </div>

      {/* 1. CHALLENGE SCHEDULE & RULES */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Configurable Challenge Rules</h3>
            <p className="text-[11px] text-slate-400">Customize targets without code modifications</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
          <div>
            <label className="text-slate-400 font-semibold block mb-1">Start Date:</label>
            <input
              type="date"
              value={config.startDate}
              onChange={e => handleConfigChange('startDate', e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">End Date:</label>
            <input
              type="date"
              value={config.endDate}
              onChange={e => handleConfigChange('endDate', e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">Duration (Days):</label>
            <input
              type="number"
              value={config.durationDays}
              onChange={e => handleConfigChange('durationDays', parseInt(e.target.value) || 75)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">Deposit Amount (₹):</label>
            <input
              type="number"
              value={config.depositAmount}
              onChange={e => handleConfigChange('depositAmount', parseInt(e.target.value) || 2000)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Strict Reset Toggle */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
          <div className="space-y-0.5 pr-2">
            <span className="font-bold text-white">Strict 75 Hard Reset Rule</span>
            <p className="text-[11px] text-slate-400 leading-tight">
              Reset streak count to 0 and forfeit ₹{config.depositAmount} if ANY daily task is missed.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={config.strictResetOnMiss}
              onChange={e => handleConfigChange('strictResetOnMiss', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
          </label>
        </div>

        {/* Habit Target Adjustments */}
        <div className="space-y-3 pt-2">
          <h4 className="font-bold text-slate-300">Habit Target Thresholds</h4>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-slate-400 block mb-1">Standard Wake Up:</label>
              <input
                type="time"
                value={config.wakeUpTarget}
                onChange={e => handleConfigChange('wakeUpTarget', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Travel Wake Up (&gt;4h):</label>
              <input
                type="time"
                value={config.wakeUpTravelTarget}
                onChange={e => handleConfigChange('wakeUpTravelTarget', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Reading Pages (Min):</label>
              <input
                type="number"
                value={config.readingMinPages}
                onChange={e => handleConfigChange('readingMinPages', parseInt(e.target.value) || 5)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Steps Target:</label>
              <input
                type="number"
                value={config.stepsTarget}
                onChange={e => handleConfigChange('stepsTarget', parseInt(e.target.value) || 10000)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Travel Sub. Steps:</label>
              <input
                type="number"
                value={config.travelSubstituteSteps}
                onChange={e => handleConfigChange('travelSubstituteSteps', parseInt(e.target.value) || 15000)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Travel Sub. Run (KM):</label>
              <input
                type="number"
                step="0.5"
                value={config.travelSubstituteRunKm}
                onChange={e => handleConfigChange('travelSubstituteRunKm', parseFloat(e.target.value) || 5.0)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. 9 PM NOTIFICATION REMINDER */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Daily Accountability Reminder</h3>
              <p className="text-[11px] text-slate-400">Daily 9:00 PM alert to complete checklist</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.reminderEnabled}
              onChange={e => handleConfigChange('reminderEnabled', e.target.checked)}
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
              onChange={e => handleConfigChange('reminderTime', e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white"
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

      {/* 3. SUPABASE CLOUD SYNC */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Supabase Cloud Sync</h3>
              <p className="text-[11px] text-slate-400">Multi-device real-time PostgreSQL sync</p>
            </div>
          </div>

          <button
            onClick={() => setIsSqlModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 flex items-center space-x-1"
          >
            <Code className="w-3.5 h-3.5" />
            <span>SQL Schema</span>
          </button>
        </div>

        <div className="space-y-3 pt-2 border-t border-white/[0.06]">
          <div>
            <label className="text-slate-400 font-semibold block mb-1">Supabase Project URL:</label>
            <input
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={config.supabaseUrl || ''}
              onChange={e => handleConfigChange('supabaseUrl', e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">Supabase Anon Key:</label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={config.supabaseAnonKey || ''}
              onChange={e => handleConfigChange('supabaseAnonKey', e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white font-mono text-[11px]"
            />
          </div>

          {/* Auto-sync toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-black/40">
            <span className="text-slate-300">Auto-sync on habit check</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoSyncSupabase}
                onChange={e => handleConfigChange('autoSyncSupabase', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Test & Sync Action Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={handleTestSupabase}
              disabled={testingSupabase}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-all text-center"
            >
              {testingSupabase ? 'Testing...' : 'Test Link'}
            </button>
            <button
              onClick={syncToCloud}
              disabled={syncState.syncing}
              className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all text-center"
            >
              {syncState.syncing ? 'Pushing...' : 'Push to Cloud'}
            </button>
            <button
              onClick={pullFromCloud}
              disabled={syncState.syncing}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all text-center"
            >
              {syncState.syncing ? 'Pulling...' : 'Pull Cloud'}
            </button>
          </div>

          {supabaseTestMsg && (
            <div className={`p-2.5 rounded-lg text-xs flex items-center space-x-1.5 ${
              supabaseTestMsg.success ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/30 text-rose-300 border border-rose-500/30'
            }`}>
              {supabaseTestMsg.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{supabaseTestMsg.text}</span>
            </div>
          )}

          {syncState.lastSynced && (
            <p className="text-[11px] text-slate-400 text-center">
              Last synced: {syncState.lastSynced}
            </p>
          )}
        </div>
      </div>

      {/* 4. BACKUP & DANGER ZONE */}
      <div className="rounded-2xl glass-card border border-white/[0.08] p-4 space-y-4">
        <h3 className="text-sm font-bold text-white">Data Portability & Reset</h3>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
          <button
            onClick={handleExportData}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center space-x-1.5 border border-white/10 transition-all active:scale-95"
          >
            <Download className="w-4 h-4 text-rose-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={() => importInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center space-x-1.5 border border-white/10 transition-all active:scale-95"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Import JSON</span>
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>

        {/* Danger Reset */}
        <div className="pt-2 border-t border-rose-950/40">
          <button
            onClick={handleResetChallenge}
            className="w-full p-2.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 font-bold border border-rose-600/30 flex items-center justify-center space-x-2 transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart 75 HARD (Clear Logs)</span>
          </button>
        </div>
      </div>

      {/* Supabase Schema Modal */}
      <SupabaseModal isOpen={isSqlModalOpen} onClose={() => setIsSqlModalOpen(false)} />
    </div>
  );
};
