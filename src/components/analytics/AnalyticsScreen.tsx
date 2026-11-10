import React, { useMemo } from 'react';
import {
  Flame,
  ShieldCheck,
  AlertTriangle,
  Award,
  BookOpen,
  Footprints,
  Dumbbell,
  Camera,
  Users,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';

export const AnalyticsScreen: React.FC = () => {
  const { logs, config, streakStats, currentUser, isAdmin } = useChallenge();

  // Aggregate stats across all recorded days
  const aggregated = useMemo(() => {
    let totalPages = 0;
    let totalWorkouts = 0;
    let totalSteps = 0;
    let totalPhotos = 0;
    let totalFamilyMinutes = 0;

    const habitCounts: Record<string, { done: number; total: number }> = {
      wakeUp: { done: 0, total: 0 },
      noMasturbation: { done: 0, total: 0 },
      noSmokingAlcohol: { done: 0, total: 0 },
      reading: { done: 0, total: 0 },
      gym: { done: 0, total: 0 },
      physicalActivity: { done: 0, total: 0 },
      diet: { done: 0, total: 0 },
      progressPhoto: { done: 0, total: 0 },
      learning: { done: 0, total: 0 },
      health: { done: 0, total: 0 },
      family: { done: 0, total: 0 },
    };

    const logList = Object.values(logs);

    logList.forEach(log => {
      // Accumulate aggregates
      totalPages += log.tasks.reading.pagesRead || 0;
      if (log.tasks.gym.completed) totalWorkouts++;
      if (log.tasks.physicalActivity.type === 'steps') {
        totalSteps += log.tasks.physicalActivity.value || 0;
      }
      if (log.tasks.progressPhoto.photoUrl) totalPhotos++;
      totalFamilyMinutes += log.tasks.family.minutes || 0;

      // Habit checks
      if (log.tasks.wakeUp.completed) habitCounts.wakeUp.done++;
      habitCounts.wakeUp.total++;

      if (log.tasks.noMasturbation.completed) habitCounts.noMasturbation.done++;
      habitCounts.noMasturbation.total++;

      if (log.tasks.noSmokingAlcohol.completed) habitCounts.noSmokingAlcohol.done++;
      habitCounts.noSmokingAlcohol.total++;

      if (log.tasks.reading.completed || (log.tasks.reading.pagesRead >= config.readingMinPages)) habitCounts.reading.done++;
      habitCounts.reading.total++;

      if (log.tasks.gym.completed) habitCounts.gym.done++;
      habitCounts.gym.total++;

      if (log.tasks.physicalActivity.completed) habitCounts.physicalActivity.done++;
      habitCounts.physicalActivity.total++;

      if (log.tasks.diet.completed && log.tasks.diet.cleanDietChecked) habitCounts.diet.done++;
      habitCounts.diet.total++;

      if (log.tasks.progressPhoto.photoUrl) habitCounts.progressPhoto.done++;
      habitCounts.progressPhoto.total++;

      if (log.tasks.learning.completed) habitCounts.learning.done++;
      habitCounts.learning.total++;

      if (log.tasks.health.completed) habitCounts.health.done++;
      habitCounts.health.total++;

      if (log.tasks.family.completed || log.tasks.family.minutes >= config.familyTargetMinutes) habitCounts.family.done++;
      habitCounts.family.total++;
    });

    return {
      totalPages,
      totalWorkouts,
      totalSteps,
      totalPhotos,
      totalFamilyMinutes,
      habitCounts,
      recordedDaysCount: logList.length,
    };
  }, [logs, config]);

  const milestones = [
    { day: 1, title: 'Day 1: First Blood', desc: 'Commitment initiated', icon: '🔥' },
    { day: 7, title: 'Day 7: Iron Week', desc: 'First full week completed', icon: '🛡️' },
    { day: 14, title: 'Day 14: Habit Forming', desc: 'Resistance begins to yield', icon: '⚡' },
    { day: 21, title: 'Day 21: Neural Rewiring', desc: 'Mindset shifts permanently', icon: '🧠' },
    { day: 30, title: 'Day 30: The Crucible', desc: 'Month one conquered', icon: '⚔️' },
    { day: 50, title: 'Day 50: Halfway Beast', desc: 'In sight of the summit', icon: '⛰️' },
    { day: 75, title: 'Day 75: 75 HARD CHAMPION', desc: 'Mental toughness absolute', icon: '👑' },
  ];

  return (
    <div className="space-y-4 pb-8 text-xs">
      {/* Title */}
      <div>
        <div className="flex items-center space-x-2">
          <span className="text-sm">{currentUser?.avatar || '🔥'}</span>
          <h2 className="text-base font-extrabold text-white">Performance ({currentUser?.name || 'Challenger'})</h2>
        </div>
        <p className="text-slate-400 mt-0.5">Deep analytics of your 75 HARD mental toughness journey.</p>
      </div>

      {/* Deposit Status Card (Challengers Only) */}
      {!isAdmin ? (
        <div className={`p-4 rounded-2xl border ${
          streakStats.depositStatus === 'forfeited'
            ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
            : 'glass-card border-white/[0.08] text-white'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className={`p-2 rounded-xl ${streakStats.depositStatus === 'forfeited' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {streakStats.depositStatus === 'forfeited' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Deposit Accountability</span>
                <h3 className="text-lg font-black tracking-tight">
                  {config.currencySymbol}{currentUser?.depositAmount !== undefined ? currentUser.depositAmount : config.depositAmount} Deposit
                </h3>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
              streakStats.depositStatus === 'forfeited'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {streakStats.depositStatus === 'forfeited' ? 'FORFEITED' : 'PROTECTED'}
            </span>
          </div>

          <p className="mt-2 text-slate-400 leading-relaxed text-[11px]">
            {streakStats.depositStatus === 'forfeited'
              ? 'A day had incomplete tasks without an approved medical exemption. Count was reset to 0 in strict 75 Hard style.'
              : 'Your pledge is completely intact. Continue executing all 11 habits daily to claim victory at Day 75!'}
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-2xl glass-card border border-purple-500/30 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">Referee / Admin</span>
                <h3 className="text-lg font-black tracking-tight text-white">
                  Zero Deposit Required
                </h3>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              REFEREE
            </span>
          </div>
          <p className="mt-2 text-slate-400 leading-relaxed text-[11px]">
            As the referee, you oversee the challengers' deposit pool and review medical exception requests. You have no personal deposit pledge.
          </p>
        </div>
      )}

      {/* Streak & Completion Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl glass-card border border-white/[0.08] text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Current Streak</span>
          <div className="text-xl font-black text-amber-400 mt-0.5 flex items-center justify-center space-x-1">
            <Flame className="w-4 h-4 fill-amber-400" />
            <span>{streakStats.currentStreak}d</span>
          </div>
        </div>

        <div className="p-3 rounded-xl glass-card border border-white/[0.08] text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Longest Streak</span>
          <div className="text-xl font-black text-emerald-400 mt-0.5">
            {streakStats.longestStreak}d
          </div>
        </div>

        <div className="p-3 rounded-xl glass-card border border-white/[0.08] text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Resets</span>
          <div className="text-xl font-black text-rose-400 mt-0.5">
            {streakStats.resetsCount}
          </div>
        </div>
      </div>

      {/* Cumulative Totals */}
      <div className="p-4 rounded-xl glass-card border border-white/[0.08] space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Cumulative Volume
        </h3>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.05] flex items-center space-x-2.5">
            <BookOpen className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <span className="text-sm font-extrabold text-white">{aggregated.totalPages.toLocaleString()}</span>
              <p className="text-[10px] text-slate-400">Pages Read</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.05] flex items-center space-x-2.5">
            <Dumbbell className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-sm font-extrabold text-white">{aggregated.totalWorkouts}</span>
              <p className="text-[10px] text-slate-400">Gym Sessions</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.05] flex items-center space-x-2.5">
            <Footprints className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <span className="text-sm font-extrabold text-white">{aggregated.totalSteps.toLocaleString()}</span>
              <p className="text-[10px] text-slate-400">Steps Tracked</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.05] flex items-center space-x-2.5">
            <Camera className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-sm font-extrabold text-white">{aggregated.totalPhotos}</span>
              <p className="text-[10px] text-slate-400">Physique Photos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Habit Consistency Breakdown */}
      <div className="p-4 rounded-xl glass-card border border-white/[0.08] space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Habit Consistency
        </h3>

        <div className="space-y-2">
          {Object.entries(aggregated.habitCounts).map(([key, data]) => {
            const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
            const titles: Record<string, string> = {
              wakeUp: 'Wake Up Target',
              noMasturbation: 'No Masturbation',
              noSmokingAlcohol: 'No Smoking / Alcohol',
              reading: 'Reading (5–10 pages)',
              gym: 'Gym Workout',
              physicalActivity: 'Physical Activity',
              diet: 'Clean Diet',
              progressPhoto: 'Progress Photo',
              learning: 'Learning',
              health: 'Mental & Physical Health',
              family: 'Family Time (10m)',
            };

            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">{titles[key] || key}</span>
                  <span className="text-slate-400 font-bold">{data.done}/{data.total} ({pct}%)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 75 Hard Milestones */}
      <div className="p-4 rounded-xl glass-card border border-white/[0.08] space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Challenge Milestones</span>
        </h3>

        <div className="space-y-2">
          {milestones.map(m => {
            const isUnlocked = streakStats.longestStreak >= m.day;

            return (
              <div
                key={m.day}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  isUnlocked
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-black/30 border-white/[0.05] text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className="text-xl">{m.icon}</span>
                  <div>
                    <h4 className={`font-bold text-xs ${isUnlocked ? 'text-amber-300' : 'text-slate-400'}`}>
                      {m.title}
                    </h4>
                    <p className="text-[10px] text-slate-400">{m.desc}</p>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isUnlocked ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-500'
                }`}>
                  {isUnlocked ? 'Conquered' : `Day ${m.day}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

