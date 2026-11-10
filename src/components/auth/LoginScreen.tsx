import React, { useState } from 'react';
import { ShieldAlert, KeyRound, Lock, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';

export const LoginScreen: React.FC = () => {
  const { users, loginChallenger, loginAdmin } = useChallenge();
  const [isAdminTab, setIsAdminTab] = useState(false);

  // Challenger form state
  const challengers = users.filter(u => u.role !== 'admin');
  const [selectedUsername, setSelectedUsername] = useState(challengers[0]?.username || 'challenger1');
  const [customUsername, setCustomUsername] = useState('');
  const [pin, setPin] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChallengerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const userToLogin = customUsername.trim() || selectedUsername;
    const res = await loginChallenger(userToLogin, pin);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid credentials. Please check your PIN.');
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const res = await loginAdmin(adminPin);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid Admin PIN.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col justify-center items-center px-4 py-8 font-sans selection:bg-rose-600">
      {/* Background glowing athletic backdrop */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-rose-600/10 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="w-full max-w-sm relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 items-center justify-center font-black text-2xl tracking-wider text-white shadow-glow-red mb-1">
            75H
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">75 HARD</h1>
          <p className="text-xs text-slate-400 font-medium">
            Mental Toughness • Authenticate to access your tracker
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl glass-card border border-white/[0.08] shadow-2xl overflow-hidden text-xs">
          {/* Tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-black/60 border-b border-white/[0.06] gap-1">
            <button
              type="button"
              onClick={() => { setIsAdminTab(false); setErrorMsg(''); }}
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
              onClick={() => { setIsAdminTab(true); setErrorMsg(''); }}
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
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold block">Select Challenger:</label>
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
                            setPin(c.pin || '');
                          }}
                          className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-rose-950/40 border-rose-500 text-white shadow-sm'
                              : 'bg-black/30 border-white/[0.06] text-slate-400 hover:border-white/20'
                          }`}
                        >
                          <span className="text-xl mb-0.5">{c.avatar}</span>
                          <span className="font-bold text-[10px] truncate w-full text-center">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold block">4-Digit PIN / Password:</label>
                    <span className="text-[10px] text-slate-500">
                      Default: {challengers.find(c => c.username === selectedUsername)?.pin || '1111'}
                    </span>
                  </div>
                  <input
                    type="password"
                    maxLength={10}
                    required
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    placeholder="Enter 4-digit PIN"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-rose-500"
                  />
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
                  <h3 className="font-bold text-white text-sm">Referee / Admin Access</h3>
                  <p className="text-[11px] text-slate-400">
                    Add new users, approve sickness exceptions, and modify system rules.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold block">Admin PIN:</label>
                    <span className="text-[10px] text-slate-500">Default: 7575</span>
                  </div>
                  <input
                    type="password"
                    maxLength={10}
                    required
                    autoFocus
                    value={adminPin}
                    onChange={e => setAdminPin(e.target.value)}
                    placeholder="Enter Admin PIN (7575)"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-purple-500"
                  />
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

        <p className="text-center text-[10px] text-slate-500">
          75 HARD is a test of iron discipline. No compromises, no excuses.
        </p>
      </div>
    </div>
  );
};
