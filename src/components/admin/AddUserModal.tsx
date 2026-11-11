import React, { useState } from 'react';
import { useChallenge } from '../../context/ChallengeContext';
import { Sheet } from '../ui';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMOJIS = ['🦁', '🐺', '🦅', '⚡', '🥊', '🦍', '🥋', '🔥', '⚔️', '🏆', '💎', '🎯'];

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose }) => {
  const { adminAddUser, config } = useChallenge();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [avatar, setAvatar] = useState('🦁');
  const [depositAmount, setDepositAmount] = useState(config.depositAmount || 2000);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setName('');
    setUsername('');
    setPassword('');
    setPin('');
    setAvatar('🦁');
    setErrorMsg('');
  };

  const handleSubmit = async () => {
    setErrorMsg('');
    if (!name.trim() || !username.trim()) return setErrorMsg('Name and username are required.');
    if (pin && !/^\d{4,6}$/.test(pin)) return setErrorMsg('PIN must be 4–6 digits.');

    const cleanUsername = username.trim().toLowerCase();
    const finalPassword = password.trim() || `${cleanUsername}123`;
    const finalPin = pin.trim() || '1234';

    setLoading(true);
    const res = await adminAddUser({
      name: name.trim(),
      username: cleanUsername,
      email: `${cleanUsername}@75hard.local`,
      password: finalPassword,
      pin: finalPin,
      avatar,
      depositAmount: Number(depositAmount) || config.depositAmount,
    });
    setLoading(false);

    if (res.success) {
      alert(`${name.trim()} added.\nUsername: ${cleanUsername}\nPassword: ${finalPassword}\nPIN: ${finalPin}`);
      reset();
      onClose();
    } else {
      setErrorMsg(res.error || 'Could not add challenger.');
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title="Add challenger"
      footer={
        <button disabled={loading} onClick={handleSubmit} className="btn-primary w-full">
          {loading ? 'Adding…' : 'Add to squad'}
        </button>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="field-label">Avatar</label>
          <div className="grid grid-cols-6 gap-1.5">
            {EMOJIS.map(em => (
              <button
                key={em}
                type="button"
                onClick={() => setAvatar(em)}
                className={`aspect-square rounded-xl text-xl flex items-center justify-center transition ${
                  avatar === em ? 'bg-rose-500/20 ring-2 ring-rose-500' : 'bg-ink-850'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="field-label">Name</label>
          <input className="input" placeholder="e.g. Alex" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Username</label>
          <input
            className="input font-mono"
            placeholder="e.g. alex"
            autoCapitalize="off"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Password</label>
            <input className="input font-mono" placeholder="username123" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="field-label">PIN</label>
            <input
              className="input font-mono text-center tracking-widest"
              inputMode="numeric"
              maxLength={6}
              placeholder="1234"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
        <div>
          <label className="field-label">Deposit ({config.currencySymbol})</label>
          <input
            type="number"
            inputMode="numeric"
            className="input"
            value={depositAmount}
            onChange={e => setDepositAmount(Number(e.target.value))}
          />
        </div>
        {errorMsg && <p className="text-sm text-rose-400">{errorMsg}</p>}
      </div>
    </Sheet>
  );
};
