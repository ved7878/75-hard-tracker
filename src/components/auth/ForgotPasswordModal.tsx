import React, { useState } from 'react';
import { X, KeyRound, Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { useChallenge } from '../../context/ChallengeContext';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUsername?: string;
  onSuccess?: (username: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  defaultUsername = '',
  onSuccess,
}) => {
  const { reloadData } = useChallenge();
  const [username, setUsername] = useState(defaultUsername);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim()) {
      setErrorMsg('Please enter your username or email.');
      return;
    }
    if (!recoveryKey.trim()) {
      setErrorMsg('Please enter the Admin Master PIN or Squad Recovery Key.');
      return;
    }
    if (newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await supabaseService.forgotPassword(
        username.trim(),
        recoveryKey.trim(),
        newPassword.trim()
      );

      if (result.success) {
        setSuccessMsg(result.message);
        await reloadData();
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess(username.trim());
        }, 1500);
      } else {
        setErrorMsg(result.message || 'Password reset failed.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error occurred during reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in text-xs">
      <div className="w-full max-w-sm bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-black/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm">Reset Password</h3>
              <p className="text-[11px] text-slate-400">Squad & Referee Recovery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleResetSubmit} className="p-4 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-center space-x-2 text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="text-[11px] font-semibold">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-center space-x-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="text-[11px] font-semibold">{successMsg}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-slate-300 font-bold block text-[11px]">Username or Email:</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. vedant, vedansh, aryaman"
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-bold block text-[11px]">Recovery Key or Admin PIN:</label>
              <span className="text-[10px] text-slate-500">Default PIN: 7575</span>
            </div>
            <input
              type="text"
              value={recoveryKey}
              onChange={e => setRecoveryKey(e.target.value)}
              placeholder="Ask Admin or enter 7575"
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-xs font-mono"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Enter Admin Master PIN (<code className="text-rose-400 font-bold">7575</code>) or Squad Key (<code className="text-purple-400 font-bold">75hard</code>).
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-bold block text-[11px]">New Password:</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3 py-2 pr-9 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-bold block text-[11px]">Confirm New Password:</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-xs font-mono"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-semibold text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-xs shadow-glow-red transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Set New Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

