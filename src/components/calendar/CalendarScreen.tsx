import React, { useState, useMemo } from 'react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  formatDate,
  createDefaultLog,
  computeDayStatus,
  addDays,
  formatPrettyDate,
  parseDate,
  getDayNumber,
} from '../../services/rulesEngine';
import { DayDetailModal } from './DayDetailModal';
import { DailyLog } from '../../types';
import { ScreenTitle, Card, ProgressBar } from '../ui';

interface CalendarScreenProps {
  onNavigateToDate: (date: string) => void;
}

type CellState = 'done' | 'exempt' | 'missed' | 'today' | 'upcoming';

const cellClass: Record<CellState, string> = {
  done: 'bg-emerald-500 text-ink-950 font-bold',
  exempt: 'bg-sky-500/80 text-ink-950 font-bold',
  missed: 'bg-rose-500/20 text-rose-300',
  today: 'bg-ink-850 text-white ring-2 ring-rose-500 font-bold',
  upcoming: 'bg-white/[0.04] text-zinc-500',
};

const legend: Array<[string, string]> = [
  ['bg-emerald-500', 'Done'],
  ['bg-rose-500/40', 'Missed'],
  ['bg-sky-500/80', 'Exempt'],
  ['ring-2 ring-rose-500 bg-ink-850', 'Today'],
  ['bg-white/[0.08]', 'Upcoming'],
];

export const CalendarScreen: React.FC<CalendarScreenProps> = ({ onNavigateToDate }) => {
  const { logs, config, setCurrentDate, currentUser } = useChallenge();
  const [selected, setSelected] = useState<DailyLog | null>(null);
  const todayStr = formatDate(new Date());

  const days = useMemo(() => {
    return Array.from({ length: config.durationDays }, (_, i) => {
      const dateStr = addDays(config.startDate, i);
      const log = logs[dateStr] || createDefaultLog(dateStr, config, currentUser?.id);
      const status = computeDayStatus(log, config);
      const isToday = dateStr === todayStr;
      let state: CellState = 'upcoming';
      if (status === 'completed') state = 'done';
      else if (status === 'exempt') state = 'exempt';
      else if (isToday) state = 'today';
      else if (dateStr < todayStr) state = 'missed';
      return { dayNumber: i + 1, dateStr, log: { ...log, dayNumber: getDayNumber(dateStr, config.startDate) }, state, isToday };
    });
  }, [logs, config, todayStr, currentUser?.id]);

  const counts = days.reduce(
    (acc, d) => {
      acc[d.state]++;
      return acc;
    },
    { done: 0, exempt: 0, missed: 0, today: 0, upcoming: 0 } as Record<CellState, number>
  );
  const secured = counts.done + counts.exempt;

  // Pad the grid so day 1 sits under the right weekday (Monday first)
  const startWeekday = (parseDate(config.startDate).getDay() + 6) % 7;
  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="space-y-4">
      <ScreenTitle
        title="Calendar"
        subtitle={`${formatPrettyDate(config.startDate, { day: 'numeric', month: 'short' })} – ${formatPrettyDate(config.endDate, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}`}
      />

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] text-zinc-500">Days secured</p>
            <p className="text-3xl font-bold text-white tabular">
              {secured}
              <span className="text-base font-semibold text-zinc-500">/{config.durationDays}</span>
            </p>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <p className="text-lg font-bold text-rose-400 tabular">{counts.missed}</p>
              <p className="text-[12px] text-zinc-500">Missed</p>
            </div>
            <div>
              <p className="text-lg font-bold text-sky-400 tabular">{counts.exempt}</p>
              <p className="text-[12px] text-zinc-500">Exempt</p>
            </div>
          </div>
        </div>
        <ProgressBar value={(secured / config.durationDays) * 100} tone="emerald" className="mt-3" />
      </Card>

      <Card padded={false} className="p-3">
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {weekdays.map((w, i) => (
            <span key={i} className="text-center text-2xs font-semibold text-zinc-600">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: startWeekday }).map((_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {days.map(d => {
            const date = parseDate(d.dateStr);
            const showMonth = d.dayNumber === 1 || date.getDate() === 1;
            return (
              <button
                key={d.dateStr}
                onClick={() => setSelected(d.log)}
                aria-label={`Day ${d.dayNumber}, ${formatPrettyDate(d.dateStr)}`}
                className={`relative aspect-square rounded-lg flex items-center justify-center text-[13px] tabular active:scale-90 transition ${cellClass[d.state]} ${
                  d.isToday && d.state !== 'today' ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-900' : ''
                }`}
              >
                {date.getDate()}
                {showMonth && (
                  <span className="absolute top-0.5 inset-x-0 text-center text-[8px] leading-none font-bold uppercase opacity-80">
                    {date.toLocaleDateString('en-IN', { month: 'short' })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[12px] text-zinc-400">
        {legend.map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded ${c}`} /> {l}
          </span>
        ))}
      </div>
      <p className="text-center text-[12px] text-zinc-600">Tap a day to see details</p>

      <DayDetailModal
        log={selected}
        config={config}
        onClose={() => setSelected(null)}
        onJumpToDate={date => {
          setCurrentDate(date);
          onNavigateToDate(date);
        }}
      />
    </div>
  );
};
