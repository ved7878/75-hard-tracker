import React, { useState } from 'react';
import { Eye, EyeOff, CircleAlert, ArrowRight, Loader2 } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { supabaseService } from '../../services/supabaseService';

export const LoginScreen: React.FC = () => {
  const { login } = useChallenge();
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const isCloud = supabaseService.isConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!username.trim()) return setErrorMsg('Enter your username.');
    if (!password) return setErrorMsg('Enter your password or PIN.');
    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);
    if (!res.success) setErrorMsg(res.error || 'Wrong username or password.');
  };

  return (
    <div className="min-h-[100dvh] bg-ink-950 text-white flex flex-col px-5 pt-safe pb-safe relative overflow-hidden">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-rose-600/15 blur-[110px] pointer-events-none" />

      <div className="relative flex-1 flex flex-col justify-center w-full max-w-sm mx-auto py-10">
        <div className="mb-10">
          <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-2xl font-black shadow-glow mb-6">
            75
          </div>
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">
            Welcome back.
            <br />
            <span className="text-zinc-500">Win the day.</span>
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              className="input h-12"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-medium text-zinc-400" htmlFor="login-password">
                Password or PIN
              </label>
              <button type="button" onClick={() => setIsForgotOpen(true)} className="text-[13px] font-semibold text-rose-400">
                Forgot?
              </button>
            </div>
            <div className="relative">
              <input
                id="login-password"
                className="input h-12 pr-12"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-zinc-400"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/25 px-3.5 py-3 text-sm text-rose-300">
              <CircleAlert className="w-4 h-4 shrink-0" /> {errorMsg}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full h-12 text-base">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign in <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>
      </div>

      <p className="relative text-center text-[12px] text-zinc-600 pb-6">
        {isCloud ? 'Synced with the squad' : 'Offline mode · data stays on this device'}
      </p>

      <ForgotPasswordModal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
        defaultUsername={username}
        onSuccess={un => {
          setUsername(un);
          setPassword('');
        }}
      />
    </div>
  );
};
