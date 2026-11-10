import React from 'react';
import { Flame, AlertOctagon, ShieldCheck, RefreshCw } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';

interface StreakBannerProps {
  onGoToTracker: () => void;
}

export const StreakBanner: React.FC<StreakBannerProps> = ({ onGoToTracker }) => {
  const { streakStats, config } = useChallenge();
  const isReset = streakStats.resetsCount > 0 && streakStats.currentStreak === 0;

  return (
    <div className="w-full">
      {isReset ? (
        <div className="rounded-xl bg-gradient-to-r from-rose-950/70 to-red-950/50 border border-rose-600/40 p-4 shadow-glow-red">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-rose-600/20 text-rose-400 shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-rose-400 uppercase tracking-wider">
                  Streak Reset to 0!
                </h4>
                <span className="text-[11px] font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded">
                  {config.currencySymbol}{config.depositAmount} Forfeited
                </span>
              </div>
              <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                75 Hard Rule: Missing any required task resets your count back to Day 1. Rebuild your mental toughness now!
              </p>
              <div className="mt-2.5 flex items-center space-x-2">
                <button
                  onClick={onGoToTracker}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all active:scale-95 flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Start New Run Today</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl glass-card p-3.5 flex items-center justify-between border border-white/[0.08]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Flame className="w-5 h-5 text-amber-500 animate-flame fill-amber-500" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-base font-black text-white">{streakStats.currentStreak} Days</span>
                <span className="text-xs text-amber-400 font-semibold">Active Streak</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Best Run: {streakStats.longestStreak} days • Resets: {streakStats.resetsCount}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{config.currencySymbol}{config.depositAmount} Protected</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Zero compromise rule</p>
          </div>
        </div>
      )}
    </div>
  );
};

