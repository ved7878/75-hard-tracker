import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, Check } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose }) => {
  const { adminAddUser, config } = useChallenge();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('1234');
  const [avatar, setAvatar] = useState('🦁');
  const [depositAmount, setDepositAmount] = useState(config.depositAmount || 2000);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || !username.trim()) {
      setErrorMsg('Full Name and Username are required.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const finalPassword = password.trim() || `${cleanUsername}123`;
    const finalPin = pin.trim() || '1234';

    setLoading(true);
    const res = await adminAddUser({
      name: name.trim(),
      username: cleanUsername,
      email: email.trim() || `${cleanUsername}@75hard.local`,
      password: finalPassword,
      pin: finalPin,
      avatar,
      depositAmount: Number(depositAmount) || 2000,
    });
    setLoading(false);

    if (res.success) {
      alert(`Challenger "${name}" added successfully!\nUsername: ${cleanUsername}\nPassword: ${finalPassword}\nPIN: ${finalPin}`);
      onClose();
    } else {
      setErrorMsg(res.error || 'Failed to add challenger.');
    }
  };

  const emojiOptions = ['🦁', '🐺', '🦅', '⚡', '🥊', '🦍', '🥋', '🔥', '⚔️', '🏆', '💎', '🎯'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in text-xs">
      <div className="w-full max-w-sm bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-black/50">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm">Add New Challenger</h3>
              <p className="text-[10px] text-slate-400">Add a person to the 75 HARD challenge</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div>
            <label className="text-slate-300 font-bold block mb-1">Full Name:</label>
            <input
              type="text"
              required
              placeholder="e.g. Alex"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 font-semibold"
            />
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">Username (Login ID):</label>
            <input
              type="text"
              required
              placeholder="e.g. alex"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-slate-300 font-bold block mb-1">Password:</label>
              <input
                type="text"
                placeholder="Default: username123"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-slate-300 font-bold block mb-1">4-Digit PIN:</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="1234"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 text-center font-mono tracking-wider font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-slate-300 font-bold block mb-1">Email (Optional):</label>
              <input
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 text-xs"
              />
            </div>
            <div>
              <label className="text-slate-300 font-bold block mb-1">Deposit (₹):</label>
              <input
                type="number"
                required
                value={depositAmount}
                onChange={e => setDepositAmount(Number(e.target.value))}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1.5">Avatar Emoji:</label>
            <div className="grid grid-cols-6 gap-1.5">
              {emojiOptions.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setAvatar(em)}
                  className={`p-2 rounded-xl text-lg flex items-center justify-center border transition-all ${
                    avatar === em ? 'bg-rose-600/30 border-rose-500 shadow-sm scale-110' : 'bg-black/30 border-white/5 hover:border-white/20'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px] flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold transition-all shadow-glow-red active:scale-95"
            >
              {loading ? 'Adding Challenger...' : 'Create Challenger Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

