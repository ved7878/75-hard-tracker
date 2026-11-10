import React, { useState } from 'react';
import { X, ShieldAlert, KeyRound, Check, AlertCircle, LogOut } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessAdmin?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccessAdmin }) => {
  const { users, currentUser, setCurrentUserId, isAdmin, loginAsAdmin, logoutAdmin, config } = useChallenge();
  const [isAdminTab, setIsAdminTab] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = loginAsAdmin(pinInput);
    if (res.success) {
      setPinInput('');
      onClose();
      if (onSuccessAdmin) onSuccessAdmin();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in text-xs">
      <div className="w-full max-w-sm bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header Tabs */}
        <div className="p-3 border-b border-white/[0.08] flex items-center justify-between bg-black/50">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => { setIsAdminTab(false); setErrorMsg(''); }}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                !isAdminTab ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Challengers
            </button>
            <button
              onClick={() => { setIsAdminTab(true); setErrorMsg(''); }}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center space-x-1 ${
                isAdminTab ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </button>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {!isAdminTab ? (
            /* CHALLENGER SELECTION */
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-extrabold text-white">Select Active Challenger</h3>
                <p className="text-slate-400">Log habits and track your 75 HARD journey</p>
              </div>

              <div className="space-y-2">
                {users.filter(u => u.role !== 'admin').map(user => {
                  const isSelected = user.id === currentUser.id;
                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        setCurrentUserId(user.id);
                        onClose();
                      }}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-rose-950/40 border-rose-500/50 shadow-glow-red text-white'
                          : 'bg-black/30 border-white/[0.05] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{user.avatar}</span>
                        <div className="text-left">
                          <span className="font-bold text-sm block">{user.name}</span>
                          <span className="text-[10px] text-slate-400">Challenger Profile</span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-rose-400" />}
                    </button>
                  );
                })}
              </div>

              {isAdmin && (
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-purple-300 font-semibold flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                    <span>Admin Mode Active</span>
                  </span>
                  <button
                    onClick={logoutAdmin}
                    className="text-xs text-rose-400 font-bold hover:underline flex items-center space-x-1"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Exit Admin</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ADMIN LOGIN */
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  <span>Referee / Admin Login</span>
                </h3>
                <p className="text-slate-400">
                  Approve medical exception requests & override past/future logs.
                </p>
              </div>

              {isAdmin ? (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 text-purple-200 space-y-2">
                  <p className="font-bold text-purple-300">✓ You are logged in as Admin</p>
                  <p className="text-[11px] text-purple-200/80">
                    You have master privileges to approve/reject sickness exceptions and make edits to any past or future day.
                  </p>
                  <button
                    onClick={logoutAdmin}
                    className="w-full py-2 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 font-bold transition-all"
                  >
                    Log Out of Admin
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAdminSubmit} className="space-y-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Enter Admin PIN:
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      autoFocus
                      placeholder="Default: 7575"
                      value={pinInput}
                      onChange={e => setPinInput(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-center text-lg tracking-widest text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  {errorMsg && (
                    <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition-all shadow-lg active:scale-95"
                  >
                    Unlock Admin Powers
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
