import React from 'react';

interface DayProgressRingProps {
  completed: number;
  total: number;
  dayNumber: number;
  totalDays: number;
  allDone: boolean;
  isExempt: boolean;
}

export const DayProgressRing: React.FC<DayProgressRingProps> = ({
  completed,
  total,
  dayNumber,
  totalDays,
  allDone,
  isExempt,
}) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const radius = 70;
  const stroke = 10;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <div className="relative w-44 h-44 flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          {/* Background Track */}
          <circle
            stroke="#1a1c24"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress Indicator */}
          <circle
            stroke={allDone ? '#10b981' : isExempt ? '#3b82f6' : '#e11d48'}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{
              strokeDashoffset,
              transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {isExempt ? (
            <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full mb-1">
              MEDICAL EXEMPT
            </span>
          ) : (
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              {dayNumber >= 1 && dayNumber <= totalDays ? `DAY ${dayNumber} OF ${totalDays}` : 'CHALLENGE'}
            </span>
          )}

          <div className="flex items-baseline space-x-0.5">
            <span className={`text-3xl font-black tracking-tight ${allDone ? 'text-emerald-400' : 'text-white'}`}>
              {percentage}%
            </span>
          </div>

          <span className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {completed}/{total} tasks done
          </span>
        </div>
      </div>

      <div className="mt-2 text-center">
        {allDone ? (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <span>🎉 Day Complete! Keep the Momentum!</span>
          </div>
        ) : isExempt ? (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold">
            <span>🩺 Doctor-Verified Exemption Active</span>
          </div>
        ) : (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
            <span>{total - completed} required habit{total - completed === 1 ? '' : 's'} remaining</span>
          </div>
        )}
      </div>
    </div>
  );
};

