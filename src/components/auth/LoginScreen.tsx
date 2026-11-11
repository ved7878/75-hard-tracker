import React, { useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Database,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { supabaseService } from '../../services/supabaseService';

export const LoginScreen: React.FC = () => {
  const { login } = useChallenge();
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const isCloudConnected = supabaseService.isConfigured();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim()) {
      setErrorMsg('Please enter your username or email.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password or PIN.');
      return;
    }

    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid credentials. Check your username and password/PIN.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col justify-center items-center px-4 py-8 font-sans selection:bg-rose-600">
      {/* Background athletic neon glow backdrop */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-rose-600/10 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="w-full max-w-sm relative z-10 space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 items-center justify-center font-black text-2xl tracking-wider text-white shadow-glow-red mb-1">
            75H
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">75 HARD</h1>
          <p className="text-xs text-slate-400 font-medium">
            Mental Toughness Challenge • Sign in to continue
          </p>

          {/* Database Status Badge */}
          <div className="flex items-center justify-center space-x-1.5 pt-1">
            <span
              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                isCloudConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-white/5 text-slate-400 border-white/10'
              }`}
            >
              <Database className="w-3 h-3 shrink-0" />
              <span>{isCloudConnected ? 'Supabase Cloud Connected' : 'Vercel Hybrid Mode Active'}</span>
            </span>
          </div>
        </div>

        {/* Unified Authentication Card (No separate module for Admin) */}
        <div className="rounded-2xl glass-card border border-white/[0.08] shadow-2xl overflow-hidden text-xs">
          <form onSubmit={handleLoginSubmit} className="p-5 space-y-4">
            {/* Username / User ID / Admin */}
            <div className="space-y-1">
              <label className="text-slate-300 font-bold block text-[11px]">
                Username / User ID:
              </label>
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. vedant, vedansh, aryaman, admin"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Password / PIN input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-bold block text-[11px]">
                  Password or 4-Digit PIN:
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password or PIN"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px] flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-xs shadow-glow-red transition-all active:scale-95 flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Enter 75 HARD'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between px-2 text-[11px] text-slate-500">
          <span>75 HARD Squad Tracker</span>
          <button
            onClick={() => setIsForgotPasswordOpen(true)}
            className="hover:text-slate-300 transition-colors flex items-center space-x-1"
          >
            <HelpCircle className="w-3 h-3" />
            <span>Need Help?</span>
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        defaultUsername={username}
        onSuccess={un => {
          setUsername(un);
          setPassword('');
        }}
      />
    </div>
  );
};
