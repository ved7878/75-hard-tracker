import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Calendar,
  Sparkles,
  Info,
  Clock,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import {
  parseDate,
  formatDate,
  createDefaultLog,
  computeDayStatus,
  isToday,
} from '../../services/rulesEngine';
import { DayDetailModal } from './DayDetailModal';
import { DailyLog, DayStatus } from '../../types';

interface CalendarScreenProps {
  onNavigateToDate: (date: string) => void;
}

export const CalendarScreen: React.FC<CalendarScreenProps> = ({ onNavigateToDate }) => {
  const { logs, config, currentDate, setCurrentDate } = useChallenge();
  const [selectedDayLog, setSelectedDayLog] = useState<DailyLog | null>(null);

  // Generate all 75 days based on config
  const daysList = useMemo(() => {
    const list: {
      dayNumber: number;
      dateStr: string;
      displayDate: string;
      log: DailyLog;
      status: DayStatus;
      isTodayDate: boolean;
    }[] = [];

    const startD = parseDate(config.startDate);
    const todayStr = formatDate(new Date());

    for (let i = 0; i < config.durationDays; i++) {
      const d = new Date(startD);
      d.setDate(d.getDate() + i);
      const dateStr = formatDate(d);

      const log = logs[dateStr] || createDefaultLog(dateStr, config);
      const status = computeDayStatus(log, config);
      const isTodayDate = dateStr === todayStr;

      const displayDate = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      list.push({
        dayNumber: i + 1,
        dateStr,
        displayDate,
        log,
        status,
        isTodayDate,
      });
    }

    return list;
  }, [logs, config]);

  // Aggregate stats
  const stats = useMemo(() => {
    let completed = 0;
    let missed = 0;
    let exempt = 0;
    let future = 0;

    daysList.forEach(item => {
      if (item.status === 'completed') completed++;
      else if (item.status === 'exempt') exempt++;
      else if (item.status === 'incomplete' && !item.isTodayDate) missed++;
      else future++;
    });

    return { completed, missed, exempt, future, total: config.durationDays };
  }, [daysList, config.durationDays]);

  return (
    <div className="space-y-4 pb-8">
      {/* Header Info */}
      <div className="p-4 rounded-xl glass-card border border-white/[0.08]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base font-extrabold text-white">75-Day Challenge Matrix</h2>
            <p className="text-xs text-slate-400">
              {config.startDate} to {config.endDate}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-rose-400">Zero Compromise</span>
            <p className="text-[10px] text-slate-500">Every single day matters</p>
          </div>
        </div>

        {/* Status Pills */}
        <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-white/[0.05] text-center">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-xs font-extrabold text-emerald-400">{stats.completed}</span>
            <p className="text-[10px] text-emerald-300/70 font-semibold">Done</p>
          </div>
          <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <span className="text-xs font-extrabold text-rose-400">{stats.missed}</span>
            <p className="text-[10px] text-rose-300/70 font-semibold">Missed</p>
          </div>
          <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="text-xs font-extrabold text-blue-400">{stats.exempt}</span>
            <p className="text-[10px] text-blue-300/70 font-semibold">Exempt</p>
          </div>
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-xs font-extrabold text-slate-300">{stats.future}</span>
            <p className="text-[10px] text-slate-500 font-semibold">Pending</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
        <div className="flex items-center space-x-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span>Missed/Reset</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span>Exempt</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-2.5 h-2.5 rounded-full border border-white" />
          <span>Today</span>
        </div>
      </div>

      {/* 75-Day Grid */}
      <div className="grid grid-cols-5 gap-2">
        {daysList.map(item => {
          const isDone = item.status === 'completed';
          const isExempt = item.status === 'exempt';
          const isMissed = item.status === 'incomplete' && !item.isTodayDate;
          const isFuture = item.status === 'future';

          return (
            <button
              key={item.dayNumber}
              type="button"
              onClick={() => setSelectedDayLog(item.log)}
              className={`relative p-2 rounded-xl flex flex-col items-center justify-between aspect-square border transition-all active:scale-90 ${
                item.isTodayDate
                  ? 'border-2 border-white bg-rose-950/40 shadow-glow-red ring-2 ring-rose-500/50'
                  : isDone
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 hover:border-emerald-500'
                  : isExempt
                  ? 'bg-blue-950/30 border-blue-500/40 text-blue-200 hover:border-blue-500'
                  : isMissed
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 hover:border-rose-500'
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:border-white/20'
              }`}
            >
              {/* Day Badge */}
              <div className="w-full flex items-center justify-between text-[10px]">
                <span className={`font-mono font-bold ${item.isTodayDate ? 'text-white' : ''}`}>
                  D{item.dayNumber}
                </span>
                {item.isTodayDate && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                )}
              </div>

              {/* Status Icon */}
              <div className="my-0.5">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-500/20" />
                ) : isExempt ? (
                  <ShieldAlert className="w-4 h-4 text-blue-400" />
                ) : isMissed ? (
                  <XCircle className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                ) : item.isTodayDate ? (
                  <Clock className="w-4 h-4 text-amber-400" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                )}
              </div>

              {/* Date string */}
              <span className="text-[9px] font-medium text-slate-400 truncate w-full text-center">
                {item.displayDate}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day Modal */}
      {selectedDayLog && (
        <DayDetailModal
          log={selectedDayLog}
          config={config}
          isOpen={Boolean(selectedDayLog)}
          onClose={() => setSelectedDayLog(null)}
          onJumpToDate={date => {
            setCurrentDate(date);
            onNavigateToDate(date);
          }}
        />
      )}
    </div>
  );
};
