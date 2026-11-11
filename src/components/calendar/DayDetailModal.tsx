import React from 'react';
import { Check, X as XIcon, PlaneTakeoff, Stethoscope, Pencil, Eye } from 'lucide-react';
import { DailyLog, ChallengeConfig } from '../../types';
import { validateDayTasks, isToday, formatPrettyDate, getDayNumber } from '../../services/rulesEngine';
import { useChallenge } from '../../context/ChallengeContext';
import { Sheet, Chip, Notice } from '../ui';

interface DayDetailModalProps {
  log: DailyLog | null;
  config: ChallengeConfig;
  onClose: () => void;
  onJumpToDate: (date: string) => void;
}

export const DayDetailModal: React.FC<DayDetailModalProps> = ({ log, config, onClose, onJumpToDate }) => {
  const { isAdmin } = useChallenge();
  if (!log) return null;

  const { items, allCompleted, completedCount, totalCount } = validateDayTasks(log, config);
  const dayNumber = getDayNumber(log.date, config.startDate);
  const todayDate = isToday(log.date);
  const canEdit = todayDate || isAdmin;

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          Day {dayNumber}
          {log.sickness.isExempt ? (
            <Chip tone="blue">Exempt</Chip>
          ) : allCompleted ? (
            <Chip tone="emerald">Complete</Chip>
          ) : (
            <Chip tone="neutral">
              {completedCount}/{totalCount}
            </Chip>
          )}
        </span>
      }
      subtitle={formatPrettyDate(log.date, { weekday: 'long', day: 'numeric', month: 'long' })}
      footer={
        <button
          className={canEdit ? 'btn-primary w-full' : 'btn-secondary w-full'}
          onClick={() => {
            onClose();
            onJumpToDate(log.date);
          }}
        >
          {canEdit ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {todayDate ? 'Open today' : canEdit ? 'Edit this day' : 'View in checklist'}
        </button>
      }
    >
      <div className="space-y-3">
        {log.travel.isTravelling && (
          <Notice tone="amber" icon={PlaneTakeoff} title={`Travelled ${log.travel.hours} h`}>
            Gym {log.travel.gymAvailable ? 'available' : 'unavailable – substitute used'}
          </Notice>
        )}
        {log.sickness.isSick && (
          <Notice
            tone="blue"
            icon={Stethoscope}
            title={log.sickness.isExempt ? 'Medical exemption approved' : `Sick day · ${log.sickness.status}`}
          >
            {log.sickness.doctorNotes}
          </Notice>
        )}

        {log.tasks.progressPhoto.photoUrl && (
          <div className="rounded-2xl overflow-hidden bg-black aspect-[4/3]">
            <img src={log.tasks.progressPhoto.photoUrl} alt="Progress" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="rounded-2xl bg-ink-850 divide-y divide-white/[0.05]">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  item.isCompleted ? 'bg-emerald-500 text-ink-950' : 'bg-rose-500/15 text-rose-400'
                }`}
              >
                {item.isCompleted ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <XIcon className="w-3.5 h-3.5" strokeWidth={3} />}
              </span>
              <span className={`text-sm flex-1 ${item.isCompleted ? 'text-zinc-200' : 'text-zinc-400'}`}>{item.title}</span>
            </div>
          ))}
        </div>

        {log.journalNotes && (
          <div className="rounded-2xl bg-ink-850 p-3.5">
            <p className="section-label mb-1">Journal</p>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{log.journalNotes}</p>
          </div>
        )}
      </div>
    </Sheet>
  );
};
