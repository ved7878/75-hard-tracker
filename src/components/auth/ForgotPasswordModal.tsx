import React, { useEffect, useState } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { useChallenge } from '../../context/ChallengeContext';
import { Sheet } from '../ui';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUsername?: string;
  onSuccess?: (username: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose, defaultUsername = '', onSuccess }) => {
  const { reloadData } = useChallenge();
  const [username, setUsername] = useState(defaultUsername);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername(defaultUsername);
      setMsg(null);
    }
  }, [isOpen, defaultUsername]);

  const submit = async () => {
    setMsg(null);
    if (!username.trim()) return setMsg({ ok: false, text: 'Enter your username.' });
    if (!recoveryKey.trim()) return setMsg({ ok: false, text: 'Enter the recovery key from your referee.' });
    if (newPassword.length < 4) return setMsg({ ok: false, text: 'New password needs at least 4 characters.' });
    if (newPassword !== confirmPassword) return setMsg({ ok: false, text: "Passwords don't match." });

    setLoading(true);
    try {
      const result = await supabaseService.forgotPassword(username.trim(), recoveryKey.trim(), newPassword.trim());
      setMsg({ ok: result.success, text: result.message });
      if (result.success) {
        await reloadData();
        setTimeout(() => {
          onClose();
          onSuccess?.(username.trim());
          setRecoveryKey('');
          setNewPassword('');
          setConfirmPassword('');
        }, 1200);
      }
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title="Reset password"
      subtitle="Ask your referee for the recovery key."
      footer={
        <button disabled={loading} onClick={submit} className="btn-primary w-full">
          {loading ? 'Resetting…' : 'Set new password'}
        </button>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="field-label">Username</label>
          <input className="input" autoCapitalize="off" value={username} onChange={e => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Recovery key</label>
          <input className="input font-mono" autoCapitalize="off" value={recoveryKey} onChange={e => setRecoveryKey(e.target.value)} />
        </div>
        <div>
          <label className="field-label">New password</label>
          <input className="input" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Confirm new password</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</p>}
      </div>
    </Sheet>
  );
};
