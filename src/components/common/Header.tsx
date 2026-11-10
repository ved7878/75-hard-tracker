import React from 'react';
import { Flame, ShieldCheck, AlertTriangle, Calendar, ChevronLeft, ChevronRight, Lock, Users } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { formatDate, parseDate, getDayNumber } from '../../services/rulesEngine';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const {
    currentDate,
    setCurrentDate,
    streakStats,
    config,
    users,
    currentUser,
    setCurrentUserId,
    squadMembers,
    isEditable,
    isToday,
  } = useChallenge();

  const handlePrevDay = () => {
    const cur = parseDate(currentDate);
    cur.setDate(cur.getDate() - 1);
    setCurrentDate(formatDate(cur));
  };

  const handleNextDay = () => {
    const cur = parseDate(currentDate);
    cur.setDate(cur.getDate() + 1);
    setCurrentDate(formatDate(cur));
  };

  const handleTodayClick = () => {
    setCurrentDate(formatDate(new Date()));
  };

  const dayNumber = getDayNumber(currentDate, config.startDate);
  const isChallengeDay = dayNumber >= 1 && dayNumber <= config.durationDays;

  const formattedDisplayDate = new Date(currentDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0c]/95 backdrop-blur-md border-b border-white/[0.08] safe-top px-3 py-2">
      <div className="max-w-md mx-auto space-y-2">
        {/* Top Line: Brand, User Info, Badges */}
        <div className="flex items-center justify-between">
          {/* Brand & Active Day */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center space-x-2 text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center font-black text-white text-xs tracking-wider shadow-glow-red">
              75H
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white">75 HARD</span>
                {isChallengeDay ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    Day {dayNumber}/{config.durationDays}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {dayNumber < 1 ? 'Starts Nov 11' : 'Completed'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate max-w-[110px]">
                {currentUser.name}
              </p>
            </div>
          </button>

          {/* Badges: Deposit & Streak */}
          <div className="flex items-center space-x-1.5">
            {/* Deposit Badge */}
            <div
              onClick={() => setActiveTab('analytics')}
              className={`cursor-pointer px-2 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1 border transition-all ${
                streakStats.depositStatus === 'forfeited'
                  ? 'bg-rose-950/60 text-rose-300 border-rose-700/50'
                  : 'bg-emerald-950/50 text-emerald-300 border-emerald-700/40'
              }`}
              title={`Deposit: ${config.currencySymbol}${config.depositAmount}`}
            >
              {streakStats.depositStatus === 'forfeited' ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>Lost {config.currencySymbol}{config.depositAmount}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>{config.currencySymbol}{config.depositAmount} Safe</span>
                </>
              )}
            </div>

            {/* Streak Flame */}
            <div
              onClick={() => setActiveTab('analytics')}
              className="cursor-pointer flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold"
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-flame" />
              <span>{streakStats.currentStreak}d</span>
            </div>
          </div>
        </div>

        {/* 3 CHALLENGERS SQUAD SWITCHER BAR */}
        <div className="bg-black/40 rounded-xl p-1 border border-white/[0.06] flex items-center justify-between gap-1">
          {squadMembers.map(member => {
            const isSelected = member.user.id === currentUser.id;
            return (
              <button
                key={member.user.id}
                onClick={() => setCurrentUserId(member.user.id)}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between min-w-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-sm ring-1 ring-white/20'
                    : 'bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <span className="text-sm shrink-0">{member.user.avatar}</span>
                  <span className="truncate text-[11px] font-bold">{member.user.name}</span>
                </div>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-black ml-1 shrink-0 ${
                    member.todayAllCompleted
                      ? 'bg-emerald-500 text-black font-extrabold'
                      : isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-black/40 text-slate-500'
                  }`}
                  title={`${member.todayCompletedCount}/${member.todayTotalCount} completed today`}
                >
                  {member.todayAllCompleted ? '✓' : `${member.todayCompletedCount}/11`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Date Navigator Bar */}
        <div className="pt-1 flex items-center justify-between">
          <button
            onClick={handlePrevDay}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleTodayClick}
              className={`text-xs font-semibold px-2 py-0.5 rounded transition-all flex items-center space-x-1.5 ${
                isToday
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>{formattedDisplayDate}</span>
              {isToday ? (
                <span className="text-[10px] bg-white/20 px-1 rounded font-bold">TODAY</span>
              ) : (
                <span className="text-[10px] bg-amber-500/30 px-1 rounded font-bold flex items-center space-x-0.5">
                  <Lock className="w-2.5 h-2.5" />
                  <span>LOCKED</span>
                </span>
              )}
            </button>
          </div>

          <button
            onClick={handleNextDay}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
