import React, { useMemo, useState } from 'react';
import { BookOpen, Dumbbell, Footprints, Camera, Images, ArrowRightLeft, Flame, Beef } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { addDays, createDefaultLog, formatDate, formatPrettyDate, validateDayTasks } from '../../services/rulesEngine';
import { TASK_ICONS, TASK_ORDER } from '../common/taskMeta';
import { Card, ListGroup, ListRow, ProgressBar, ScreenTitle, SectionHeader, Stat } from '../ui';
import { PhotoGalleryModal } from '../gallery/PhotoGalleryModal';

const MILESTONES = [
  { day: 1, title: 'First day', icon: '🔥' },
  { day: 7, title: 'One week', icon: '🛡️' },
  { day: 14, title: 'Two weeks', icon: '⚡' },
  { day: 21, title: 'Habit formed', icon: '🧠' },
  { day: 30, title: 'One month', icon: '⚔️' },
  { day: 50, title: 'Fifty days', icon: '⛰️' },
  { day: 75, title: 'Champion', icon: '👑' },
];

export const AnalyticsScreen: React.FC = () => {
  const { logs, config, streakStats, currentUser, isAdmin, depositLedger } = useChallenge();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const isRefereeSelf = isAdmin && currentUser?.id === 'admin';
  const balance = currentUser ? depositLedger.balances[currentUser.id] : undefined;
  const net = balance?.netChange ?? 0;

  // Evaluate every challenge day up to today with the real rules (empty days count as missed)
  const stats = useMemo(() => {
    const todayStr = formatDate(new Date());
    const perHabit: Record<string, { done: number; title: string }> = {};
    let daysElapsed = 0;
    let pages = 0;
    let workouts = 0;
    let steps = 0;
    let photos = 0;
    let kcalSum = 0;
    let kcalDays = 0;
    let proteinSum = 0;
    let proteinDays = 0;
    let proteinHitDays = 0;

    for (let i = 0; i < config.durationDays; i++) {
      const date = addDays(config.startDate, i);
      if (date > todayStr) break;
      daysElapsed++;
      const log = logs[date] || createDefaultLog(date, config, currentUser?.id);
      const { items } = validateDayTasks(log, config);
      items.forEach(item => {
        perHabit[item.id] = perHabit[item.id] || { done: 0, title: item.title };
        if (item.isCompleted) perHabit[item.id].done++;
      });
      pages += log.tasks.reading.pagesRead || 0;
      if (items.find(x => x.id === 'gym')?.isCompleted) workouts++;
      if (log.tasks.physicalActivity.type === 'steps') steps += log.tasks.physicalActivity.value || 0;
      if (log.tasks.progressPhoto.photoUrl) photos++;
      const kcal = log.tasks.diet.calories || 0;
      const protein = log.tasks.diet.proteinGrams || 0;
      if (kcal > 0) {
        kcalSum += kcal;
        kcalDays++;
      }
      if (protein > 0) {
        proteinSum += protein;
        proteinDays++;
        if (protein >= config.proteinTargetG) proteinHitDays++;
      }
    }
    return {
      perHabit,
      daysElapsed,
      pages,
      workouts,
      steps,
      photos,
      avgKcal: kcalDays ? Math.round(kcalSum / kcalDays) : 0,
      avgProtein: proteinDays ? Math.round(proteinSum / proteinDays) : 0,
      nutritionDays: Math.max(kcalDays, proteinDays),
      proteinHitDays,
    };
  }, [logs, config, currentUser?.id]);

  return (
    <div className="space-y-5">
      <ScreenTitle title="Stats" subtitle={isRefereeSelf ? 'Squad overview' : `${currentUser?.avatar} ${currentUser?.name}`} />

      {!isRefereeSelf && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Streak" value={streakStats.currentStreak} hint={streakStats.currentStreak === 1 ? 'day' : 'days'} tone="amber" />
            <Stat label="Best" value={streakStats.longestStreak} hint={streakStats.longestStreak === 1 ? 'day' : 'days'} tone="emerald" />
            <Stat
              label="Resets"
              value={streakStats.resetsCount}
              hint={streakStats.resetsCount === 1 ? 'time' : 'times'}
              tone={streakStats.resetsCount ? 'rose' : 'white'}
            />
          </div>

          {/* Deposit */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] text-zinc-500">Deposit balance</p>
                <p className="text-3xl font-bold text-white tabular mt-0.5">
                  {config.currencySymbol}
                  {(balance?.currentDeposit ?? config.depositAmount).toLocaleString('en-IN')}
                </p>
              </div>
              <span
                className={`chip mt-1 ${
                  net > 0 ? 'bg-emerald-500/15 text-emerald-300' : net < 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-white/[0.06] text-zinc-300'
                }`}
              >
                {net > 0 ? `+${config.currencySymbol}${net}` : net < 0 ? `−${config.currencySymbol}${Math.abs(net)}` : 'No change'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              {[
                ['Pledged', `${config.currencySymbol}${(balance?.initialDeposit ?? config.depositAmount).toLocaleString('en-IN')}`, 'text-zinc-200'],
                [
                  'Penalties',
                  balance?.penaltiesPaid ? `−${config.currencySymbol}${balance.penaltiesPaid}` : `${config.currencySymbol}0`,
                  balance?.penaltiesPaid ? 'text-rose-300' : 'text-zinc-400',
                ],
                [
                  'Won',
                  balance?.bountiesEarned ? `+${config.currencySymbol}${balance.bountiesEarned}` : `${config.currencySymbol}0`,
                  balance?.bountiesEarned ? 'text-emerald-300' : 'text-zinc-400',
                ],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-xl bg-white/[0.04] py-2.5">
                  <p className={`text-[15px] font-semibold tabular ${color}`}>{value}</p>
                  <p className="text-[12px] text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Habit consistency */}
          <section>
            <SectionHeader
              title="Habit consistency"
              action={<span className="text-[12px] text-zinc-500">{stats.daysElapsed} day{stats.daysElapsed === 1 ? '' : 's'} so far</span>}
            />
            <Card className="space-y-3.5">
              {stats.daysElapsed === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">
                  Stats begin on {formatPrettyDate(config.startDate)}.
                </p>
              ) : (
                TASK_ORDER.map(id => {
                  const h = stats.perHabit[id];
                  if (!h) return null;
                  const pct = Math.round((h.done / stats.daysElapsed) * 100);
                  const Icon = TASK_ICONS[id];
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[13px] mb-1.5">
                          <span className="text-zinc-300 truncate">{h.title}</span>
                          <span className="text-zinc-500 tabular shrink-0 ml-2">{pct}%</span>
                        </div>
                        <ProgressBar value={pct} tone={pct === 100 ? 'emerald' : pct >= 70 ? 'amber' : 'rose'} />
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
          </section>

          {/* Nutrition */}
          <section>
            <SectionHeader
              title="Nutrition"
              action={
                <span className="text-[12px] text-zinc-500">
                  {stats.nutritionDays} day{stats.nutritionDays === 1 ? '' : 's'} logged
                </span>
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <Card className="p-3.5">
                <p className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> Avg calories
                </p>
                <p className="text-xl font-bold text-white tabular mt-1">
                  {stats.avgKcal ? stats.avgKcal.toLocaleString('en-IN') : '—'}
                  <span className="text-sm font-medium text-zinc-500"> kcal</span>
                </p>
                <ProgressBar
                  value={config.calorieTarget ? (stats.avgKcal / config.calorieTarget) * 100 : 0}
                  tone="amber"
                  className="mt-2"
                />
                <p className="text-[12px] text-zinc-500 mt-1.5 tabular">Goal {config.calorieTarget.toLocaleString('en-IN')}</p>
              </Card>
              <Card className="p-3.5">
                <p className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                  <Beef className="w-3.5 h-3.5 text-emerald-400" /> Avg protein
                </p>
                <p className="text-xl font-bold text-white tabular mt-1">
                  {stats.avgProtein || '—'}
                  <span className="text-sm font-medium text-zinc-500"> g</span>
                </p>
                <ProgressBar
                  value={config.proteinTargetG ? (stats.avgProtein / config.proteinTargetG) * 100 : 0}
                  tone="emerald"
                  className="mt-2"
                />
                <p className="text-[12px] text-zinc-500 mt-1.5 tabular">
                  Goal hit {stats.proteinHitDays}/{stats.nutritionDays || 0} days
                </p>
              </Card>
            </div>
          </section>

          {/* Totals */}
          <section>
            <SectionHeader title="Totals" />
            <div className="grid grid-cols-2 gap-2">
              {[
                [BookOpen, stats.pages.toLocaleString('en-IN'), 'Pages read'],
                [Dumbbell, stats.workouts, 'Workouts'],
                [Footprints, stats.steps.toLocaleString('en-IN'), 'Steps logged'],
                [Camera, stats.photos, 'Photos'],
              ].map(([Icon, value, label]: any) => (
                <Card key={label} className="flex items-center gap-3 p-3.5">
                  <Icon className="w-5 h-5 text-zinc-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-white tabular leading-tight">{value}</p>
                    <p className="text-[12px] text-zinc-500">{label}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      <ListGroup>
        <ListRow
          icon={Images}
          iconTone="amber"
          title="Progress photos"
          subtitle="See your transformation"
          onClick={() => setGalleryOpen(true)}
          chevron
        />
      </ListGroup>

      {/* Milestones */}
      {!isRefereeSelf && (
        <section>
          <SectionHeader title="Milestones" />
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {MILESTONES.map(m => {
              const unlocked = streakStats.longestStreak >= m.day;
              return (
                <div
                  key={m.day}
                  className={`card shrink-0 w-[104px] p-3 text-center ${unlocked ? 'border-amber-500/30' : 'opacity-50'}`}
                >
                  <div className={`text-2xl ${unlocked ? '' : 'grayscale'}`}>{m.icon}</div>
                  <p className="text-[13px] font-semibold text-white mt-1.5">Day {m.day}</p>
                  <p className="text-[12px] text-zinc-500 leading-tight">{m.title}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Squad ledger */}
      <section>
        <SectionHeader
          title="Squad money moves"
          action={
            <span className="text-[12px] text-zinc-500 tabular">
              Pool {config.currencySymbol}
              {depositLedger.totalPool.toLocaleString('en-IN')}
            </span>
          }
        />
        {depositLedger.transactions.length === 0 ? (
          <Card className="text-center py-6">
            <p className="text-sm text-zinc-400">No penalties yet. Everyone's on track.</p>
          </Card>
        ) : (
          <div className="card divide-y divide-white/[0.05] overflow-hidden">
            {depositLedger.transactions.map((tx, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-white">Day {tx.dayNumber}</span>
                  <span className="text-zinc-500">{formatPrettyDate(tx.date)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[13px] flex-wrap">
                  <span className="text-rose-300">
                    {tx.missers.map(m => `${m.avatar} ${m.name}`).join(', ')} −{config.currencySymbol}
                    {tx.deductedPerMisser}
                  </span>
                  <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-emerald-300">
                    {tx.survivors.map(s => `${s.avatar} ${s.name}`).join(', ')} +{config.currencySymbol}
                    {tx.awardedPerSurvivor}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[12px] text-zinc-500 leading-relaxed mt-2 px-1">
          Miss any habit: −{config.currencySymbol}200, shared among those who completed the day. If everyone misses, nothing moves.
        </p>
      </section>

      <PhotoGalleryModal isOpen={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </div>
  );
};
