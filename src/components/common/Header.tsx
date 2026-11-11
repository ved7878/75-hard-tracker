import React from 'react';
import { Flame, ShieldCheck } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { formatDate, formatPrettyDate, getChallengePhase } from '../../services/rulesEngine';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { config, currentUser, setCurrentUserId, squadMembers, isAdmin, pendingExceptions, streakStats } = useChallenge();

  const todayStr = formatDate(new Date());
  const phase = getChallengePhase(todayStr, config);

  const subtitle =
    phase.phase === 'before'
      ? `Starts ${formatPrettyDate(config.startDate, { day: 'numeric', month: 'short' })} · ${phase.daysUntilStart} day${
          phase.daysUntilStart === 1 ? '' : 's'
        } to go`
      : phase.phase === 'finished'
      ? 'Challenge complete'
      : `Day ${phase.dayNumber} of ${config.durationDays} · ${formatPrettyDate(todayStr, { day: 'numeric', month: 'short' })}`;

  const isViewingChallenger = currentUser && currentUser.id !== 'admin';
  const showSwitcher = isAdmin && squadMembers.length > 0 && ['dashboard', 'tracker', 'calendar', 'analytics'].includes(activeTab);

  return (
    <header className="sticky top-0 z-40 bg-ink-950/85 backdrop-blur-xl border-b border-white/[0.05] pt-safe">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2.5 min-w-0 text-left">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-[13px] font-black text-white shrink-0">
            75
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-white leading-tight truncate">
              {isAdmin && !isViewingChallenger ? 'Referee' : currentUser?.name}
            </span>
            <span className="block text-[12px] text-zinc-400 leading-tight truncate">{subtitle}</span>
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              aria-label="Admin panel"
              className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition ${
                activeTab === 'admin' ? 'bg-violet-500 text-white' : 'bg-violet-500/15 text-violet-300'
              }`}
            >
              <ShieldCheck className="w-[18px] h-[18px]" />
              {pendingExceptions.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-ink-950 text-2xs font-bold flex items-center justify-center">
                  {pendingExceptions.length}
                </span>
              )}
            </button>
          )}
          {(!isAdmin || isViewingChallenger) && (
            <button
              onClick={() => setActiveTab('analytics')}
              className="h-9 px-3 rounded-xl bg-amber-500/10 text-amber-300 flex items-center gap-1.5 text-sm font-bold tabular"
              aria-label="Current streak"
            >
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
              {streakStats.currentStreak}
            </button>
          )}
        </div>
      </div>

      {showSwitcher && (
        <div className="max-w-md mx-auto px-4 pb-2.5">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {squadMembers.map(m => {
              const selected = m.user.id === currentUser?.id;
              return (
                <button
                  key={m.user.id}
                  onClick={() => setCurrentUserId(m.user.id)}
                  className={`h-8 pl-2 pr-2.5 rounded-full flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap transition ${
                    selected ? 'bg-white text-ink-950' : 'bg-white/[0.06] text-zinc-300'
                  }`}
                >
                  <span>{m.user.avatar}</span>
                  {m.user.name}
                  <span className={`text-2xs font-bold tabular ${selected ? 'text-zinc-500' : m.todayAllCompleted ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {m.todayCompletedCount}/{m.todayTotalCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
