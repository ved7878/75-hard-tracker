import React from 'react';
import { PlaneTakeoff, Stethoscope, CalendarClock, Flame, Wallet, ShieldCheck, ChevronRight, Sparkles } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { DayProgressRing } from './DayProgressRing';
import { QuickTasksList } from './QuickTasksList';
import { validateDayTasks, formatDate, formatPrettyDate, getChallengePhase } from '../../services/rulesEngine';
import { TaskState } from '../../types';
import { Card, Notice, SectionHeader, ProgressBar } from '../ui';

interface DashboardScreenProps {
  onNavigateTab: (tab: string) => void;
  onOpenTaskDetails: (taskId?: keyof TaskState) => void;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigateTab, onOpenTaskDetails }) => {
  const {
    currentLog,
    config,
    currentUser,
    squadMembers,
    isToday,
    currentDate,
    setCurrentDate,
    isAdmin,
    setCurrentUserId,
    streakStats,
    pendingExceptions,
    depositLedger,
  } = useChallenge();

  const { completedCount, totalCount, allCompleted } = validateDayTasks(currentLog, config);
  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const phase = getChallengePhase(currentDate, config);
  const isRefereeSelf = isAdmin && currentUser?.id === 'admin';
  const me = squadMembers.find(m => m.user.id === currentUser?.id);
  const balance = me?.currentDeposit ?? config.depositAmount;
  const net = me?.netDepositChange ?? 0;
  const ringColor = currentLog.sickness.isExempt ? '#38bdf8' : allCompleted ? '#10b981' : '#f43f5e';

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="pt-1">
        <p className="text-sm text-zinc-400">{greeting()},</p>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-white">
          {isRefereeSelf ? 'Referee' : currentUser?.name} {currentUser?.avatar}
        </h1>
      </div>

      {!isToday && (
        <Notice
          tone="amber"
          icon={CalendarClock}
          title={`Viewing ${formatPrettyDate(currentDate)}`}
          action={
            <button onClick={() => setCurrentDate(formatDate(new Date()))} className="btn-secondary btn-sm">
              Today
            </button>
          }
        >
          {isAdmin ? 'Admin override – you can edit this day.' : 'Only today can be edited.'}
        </Notice>
      )}

      {isRefereeSelf ? (
        <>
          <Card className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">You're the referee</p>
              <p className="text-[13px] text-zinc-400">Pick a challenger above to see or edit their day.</p>
            </div>
          </Card>
          {pendingExceptions.length > 0 && (
            <Notice
              tone="amber"
              icon={Stethoscope}
              title={`${pendingExceptions.length} sick-day request${pendingExceptions.length > 1 ? 's' : ''} waiting`}
              onClick={() => onNavigateTab('admin')}
              action={<ChevronRight className="w-5 h-5 text-amber-300" />}
            >
              Review the medical proof and approve or reject.
            </Notice>
          )}
        </>
      ) : (
        <>
          {/* Hero: today's progress */}
          <Card className="relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-rose-600/10 blur-3xl pointer-events-none" />
            {phase.phase === 'before' && (
              <div className="mb-4 flex items-center gap-2 text-[13px] text-sky-300">
                <Sparkles className="w-4 h-4" />
                Starts {formatPrettyDate(config.startDate)} — {phase.daysUntilStart} day{phase.daysUntilStart === 1 ? '' : 's'} to go
              </div>
            )}
            <div className="relative flex items-center gap-5">
              <DayProgressRing value={pct} color={ringColor}>
                <span className="text-[26px] font-bold text-white tabular leading-none">{completedCount}</span>
                <span className="text-[12px] text-zinc-500 mt-1">of {totalCount} done</span>
              </DayProgressRing>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-zinc-400">
                  {phase.phase === 'active' ? 'Challenge day' : phase.phase === 'before' ? 'Practice day' : 'Challenge'}
                </p>
                <p className="text-[34px] leading-none font-bold tracking-tight text-white tabular mt-1">
                  {phase.phase === 'active' ? phase.dayNumber : phase.phase === 'before' ? '0' : config.durationDays}
                  <span className="text-lg font-semibold text-zinc-500">/{config.durationDays}</span>
                </p>
                <p className="text-[13px] mt-2 font-medium">
                  {currentLog.sickness.isExempt ? (
                    <span className="text-sky-300">Medical exemption approved</span>
                  ) : allCompleted ? (
                    <span className="text-emerald-400">Day complete. Well done.</span>
                  ) : (
                    <span className="text-zinc-300">
                      {totalCount - completedCount} habit{totalCount - completedCount === 1 ? '' : 's'} left
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="relative grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => onNavigateTab('analytics')}
                className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-left active:bg-white/[0.07] transition"
              >
                <span className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> Streak
                </span>
                <span className="block text-lg font-bold text-white tabular mt-0.5">
                  {streakStats.currentStreak}{' '}
                  <span className="text-sm font-medium text-zinc-500">{streakStats.currentStreak === 1 ? 'day' : 'days'}</span>
                </span>
              </button>
              <button
                onClick={() => onNavigateTab('analytics')}
                className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-left active:bg-white/[0.07] transition"
              >
                <span className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" /> Deposit
                </span>
                <span className="block text-lg font-bold text-white tabular mt-0.5">
                  {config.currencySymbol}
                  {balance.toLocaleString('en-IN')}
                  {net !== 0 && (
                    <span className={`ml-1.5 text-sm font-semibold ${net > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {net > 0 ? '+' : '−'}
                      {Math.abs(net)}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </Card>

          {/* Context notices */}
          {currentLog.travel.isTravelling && (
            <Notice
              tone="amber"
              icon={PlaneTakeoff}
              title={`Travel day · ${currentLog.travel.hours} h`}
              onClick={() => onNavigateTab('travel')}
              action={<ChevronRight className="w-5 h-5 text-amber-300" />}
            >
              {currentLog.travel.hours > config.travelThresholdHours
                ? 'Later wake-up allowed. Gym can be swapped if unavailable.'
                : `Under ${config.travelThresholdHours} h – normal rules apply.`}
            </Notice>
          )}
          {currentLog.sickness.isSick && !currentLog.sickness.isExempt && (
            <Notice
              tone="blue"
              icon={Stethoscope}
              title={currentLog.sickness.status === 'pending' ? 'Sick day – waiting for referee' : 'Sick day – proof needed'}
              onClick={() => onNavigateTab('travel')}
              action={<ChevronRight className="w-5 h-5 text-sky-300" />}
            >
              {currentLog.sickness.status === 'rejected'
                ? 'Request rejected. All habits still count today.'
                : 'Upload a doctor slip to protect your streak.'}
            </Notice>
          )}

          <QuickTasksList onOpenDetails={onOpenTaskDetails} />
        </>
      )}

      {/* Squad */}
      {squadMembers.length > 0 && (
        <section>
          <SectionHeader
            title="Squad today"
            action={
              <span className="text-[13px] text-zinc-500 tabular">
                Pool {config.currencySymbol}
                {depositLedger.totalPool.toLocaleString('en-IN')}
              </span>
            }
          />
          <div className="card overflow-hidden divide-y divide-white/[0.05]">
            {squadMembers.map(m => {
              const isSelf = m.user.id === currentUser?.id;
              const memberPct = m.todayTotalCount ? (m.todayCompletedCount / m.todayTotalCount) * 100 : 0;
              const memberNet = m.netDepositChange ?? 0;
              const Comp: any = isAdmin ? 'button' : 'div';
              return (
                <Comp
                  key={m.user.id}
                  onClick={isAdmin ? () => setCurrentUserId(m.user.id) : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isAdmin ? 'active:bg-white/[0.03]' : ''} ${
                    isSelf ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <span className="text-2xl w-9 text-center shrink-0">{m.user.avatar}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-semibold text-white truncate">
                        {m.user.name}
                        {isSelf && <span className="ml-1.5 text-2xs font-semibold text-zinc-500">YOU</span>}
                      </span>
                      <span className={`text-[13px] font-semibold tabular ${m.todayAllCompleted ? 'text-emerald-400' : 'text-zinc-400'}`}>
                        {m.todayCompletedCount}/{m.todayTotalCount}
                      </span>
                    </span>
                    <ProgressBar value={memberPct} tone={m.todayAllCompleted ? 'emerald' : 'rose'} className="mt-2" />
                    <span className="flex items-center justify-between mt-1.5 text-[12px] text-zinc-500 tabular">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        {m.currentStreak}-day streak
                      </span>
                      <span className={memberNet > 0 ? 'text-emerald-400' : memberNet < 0 ? 'text-rose-400' : ''}>
                        {config.currencySymbol}
                        {(m.currentDeposit ?? 0).toLocaleString('en-IN')}
                      </span>
                    </span>
                  </span>
                </Comp>
              );
            })}
          </div>
          <p className="text-[12px] text-zinc-500 leading-relaxed mt-2 px-1">
            Miss a day and {config.currencySymbol}200 moves from you to the people who didn't.
          </p>
        </section>
      )}
    </div>
  );
};
