import React, { useState } from 'react';
import {
  ShieldAlert,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Database,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { supabaseService } from '../../services/supabaseService';

export const LoginScreen: React.FC = () => {
  const { users, loginChallenger, loginAdmin } = useChallenge();
  const [isAdminTab, setIsAdminTab] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Challenger form state
  const challengers = users.filter(u => u.role !== 'admin');
  const [selectedUsername, setSelectedUsername] = useState(challengers[0]?.username || 'vedant');
  const [customUsername, setCustomUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminPasswordOrPin, setAdminPasswordOrPin] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const isCloudConnected = supabaseService.isConfigured();

  const handleChallengerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const userToLogin = customUsername.trim() || selectedUsername;
    const res = await loginChallenger(userToLogin, password);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid username or password. Check credentials or use Forgot Password.');
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const res = await loginAdmin(adminPasswordOrPin);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid Admin Password or PIN.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col justify-center items-center px-4 py-8 font-sans selection:bg-rose-600">
      {/* Background glowing athletic backdrop */}
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
            Mental Toughness Challenge • Authenticate to enter
          </p>

          {/* Database & Hosting Status Badge */}
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

        {/* Auth Card */}
        <div className="rounded-2xl glass-card border border-white/[0.08] shadow-2xl overflow-hidden text-xs">
          {/* Tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-black/60 border-b border-white/[0.06] gap-1">
            <button
              type="button"
              onClick={() => {
                setIsAdminTab(false);
                setErrorMsg('');
              }}
              className={`py-2 rounded-xl font-bold transition-all flex items-center justify-center space-x-1.5 ${
                !isAdminTab
                  ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Challenger Login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAdminTab(true);
                setErrorMsg('');
              }}
              className={`py-2 rounded-xl font-bold transition-all flex items-center justify-center space-x-1.5 ${
                isAdminTab
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Admin Portal</span>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {!isAdminTab ? (
              /* CHALLENGER LOGIN FORM */
              <form onSubmit={handleChallengerSubmit} className="space-y-4">
                {/* 1-Tap Challenger Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold block">Select Challenger:</label>
                    <span className="text-[10px] text-slate-500">Quick Profile Select</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {challengers.map(c => {
                      const isSelected = selectedUsername === c.username;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedUsername(c.username || '');
                            setCustomUsername('');
                            setPassword(c.password || c.pin || '');
                          }}
                          className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-rose-950/40 border-rose-500 text-white shadow-sm ring-1 ring-rose-500/30'
                              : 'bg-black/30 border-white/[0.06] text-slate-400 hover:border-white/20'
                          }`}
                        >
                          <span className="text-xl mb-0.5">{c.avatar}</span>
                          <span className="font-bold text-[10px] truncate w-full text-center">
                            {c.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Username or Email */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block text-[11px]">User ID / Username:</label>
                  <input
                    type="text"
                    value={customUsername || selectedUsername}
                    onChange={e => {
                      setCustomUsername(e.target.value);
                      setSelectedUsername(e.target.value);
                    }}
                    placeholder="Enter username (e.g. vedant)"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Password / PIN input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold block text-[11px]">Password or 4-Digit PIN:</label>
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
                      placeholder="Enter password or 4-digit PIN"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
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
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-xs shadow-glow-red transition-all active:scale-95 flex items-center justify-center space-x-1.5"
                >
                  <span>{loading ? 'Authenticating...' : 'Enter 75 HARD Tracker'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              /* ADMIN LOGIN FORM */
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div className="space-y-1 text-center pb-1">
                  <span className="inline-block p-2 rounded-xl bg-purple-500/20 text-purple-400 mb-1">
                    <KeyRound className="w-5 h-5" />
                  </span>
                  <h3 className="font-bold text-white text-sm">Referee / Admin Portal</h3>
                  <p className="text-[11px] text-slate-400">
                    User creation, rule configuration, sickness reviews & time overrides.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold block">Admin Password or PIN:</label>
                    <span className="text-[10px] text-slate-500">Default PIN: 7575</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={adminPasswordOrPin}
                      onChange={e => setAdminPasswordOrPin(e.target.value)}
                      placeholder="Enter Admin PIN (7575) or Password"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-center text-xs font-mono tracking-widest text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-1.5"
                >
                  <span>{loading ? 'Verifying...' : 'Unlock Admin Panel'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
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
        defaultUsername={customUsername || selectedUsername}
        onSuccess={un => {
          setSelectedUsername(un);
          setPassword('');
        }}
      />
    </div>
  );
};
