import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { validateDayTasks, isWakeUpCheckInOpen, getWakeUpDeadline, formatTime12 } from '../../services/rulesEngine';
import { useNow } from '../../hooks/useNow';
import { toggleTask, isLateWakeUp } from '../../services/taskActions';
import { getTaskIcon } from '../common/taskMeta';
import { CheckButton, SectionHeader } from '../ui';

interface QuickTasksListProps {
  onOpenDetails: (taskId?: string) => void;
}

export const QuickTasksList: React.FC<QuickTasksListProps> = ({ onOpenDetails }) => {
  const { currentLog, updateCurrentLog, config, isEditable, isAdmin } = useChallenge();
  const now = useNow();
  // After the wake-up buffer (e.g. 6:10 AM) only the admin can change wake-up for the day
  const wakeLocked = !isAdmin && !isWakeUpCheckInOpen(currentLog, config, now);
  const { items, completedCount, totalCount } = validateDayTasks(currentLog, config);

  const onToggle = (taskId: string) => {
    // The photo can't be ticked without a photo – take the user to the uploader instead
    if (taskId === 'progressPhoto' && !currentLog.tasks.progressPhoto.photoUrl) {
      onOpenDetails('progressPhoto');
      return;
    }
    // A late wake-up can't be ticked – open the wake-up card itself, not the photo uploader
    if (taskId === 'wakeUp' && isLateWakeUp(currentLog, config)) {
      onOpenDetails('wakeUp');
      return;
    }
    updateCurrentLog(prev => toggleTask(prev, taskId, config));
  };

  return (
    <section>
      <SectionHeader
        title={`Habits · ${completedCount}/${totalCount}`}
        action={
          <button onClick={() => onOpenDetails()} className="text-[13px] font-semibold text-rose-400 flex items-center gap-0.5">
            Open checklist <ChevronRight className="w-4 h-4" />
          </button>
        }
      />
      <div className="card overflow-hidden divide-y divide-white/[0.05]">
        {items.map(item => {
          const Icon = getTaskIcon(item.id, config.habits?.find(h => h.id === item.id)?.icon);
          const done = item.isCompleted;
          return (
            <div
              key={item.id}
              onClick={() => onOpenDetails(item.id)}
              className="flex items-center gap-3 px-4 py-3 min-h-[60px] cursor-pointer active:bg-white/[0.03] transition"
            >
              <span
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  done ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.05] text-zinc-400'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-[15px] font-semibold leading-snug ${done ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-white'}`}>
                  {item.title}
                </span>
                <span className="block text-[13px] text-zinc-500 leading-snug line-clamp-2">{item.id === 'wakeUp' && wakeLocked && !done
                    ? `Missed · closed at ${formatTime12(getWakeUpDeadline(currentLog, config))}`
                    : item.requirementDesc}</span>
              </span>
              <CheckButton
                checked={done}
                disabled={!isEditable || (item.id === 'wakeUp' && wakeLocked)}
                onClick={() => onToggle(item.id)}
                label={`Mark ${item.title} ${done ? 'not done' : 'done'}`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
};
