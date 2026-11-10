import React, { useState } from 'react';
import { X, Copy, Check, Database, ExternalLink } from 'lucide-react';
import { SUPABASE_SETUP_SQL } from '../../services/supabase';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-black/40">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Supabase SQL Schema</h3>
              <p className="text-xs text-slate-400">1-Click setup script for tables and storage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 no-scrollbar text-xs">
          <p className="text-slate-300 leading-relaxed">
            Paste this SQL script into your <strong>Supabase SQL Editor</strong> (Supabase Dashboard &gt; SQL Editor &gt; New Query) to automatically set up the <code>daily_logs</code> table, storage buckets for progress photos, and security policies.
          </p>

          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/70">
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10">
              <span className="font-mono text-[10px] text-slate-400">schema.sql</span>
              <button
                onClick={copyToClipboard}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center space-x-1 transition-all active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="p-3 font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre max-h-64 no-scrollbar">
              {SUPABASE_SETUP_SQL}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.08] bg-black/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

