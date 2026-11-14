import React from 'react';
import { House, ListChecks, CalendarDays, BarChart3, Menu } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { validateDayTasks } from '../../services/rulesEngine';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const MORE_TABS = ['settings', 'travel', 'admin'];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { currentLog, config, isAdmin, pendingExceptions, isToday, currentUser } = useChallenge();
  const isRefereeSelf = isAdmin && currentUser?.id === 'admin';
  const { completedCount, totalCount } = validateDayTasks(currentLog, config);
  const remaining = totalCount - completedCount;

  const items: Array<{ id: string; label: string; icon: React.ElementType; badge?: string | number | null; dot?: boolean }> = [
    { id: 'dashboard', label: 'Today', icon: House },
    { id: 'tracker', label: 'Checklist', icon: ListChecks, badge: isToday && !isRefereeSelf && remaining > 0 ? remaining : null },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'analytics', label: 'Stats', icon: BarChart3 },
    { id: 'settings', label: 'More', icon: Menu, dot: isAdmin && pendingExceptions.length > 0 },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-ink-950/90 backdrop-blur-xl border-t border-white/[0.06] pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16 px-1">
        {items.map(item => {
          const Icon = item.icon;
          const active = activeTab === item.id || (item.id === 'settings' && MORE_TABS.includes(activeTab));
          return (
            <button data-haptic="selection"
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="relative flex flex-col items-center justify-center gap-1 active:scale-95 transition"
              aria-current={active ? 'page' : undefined}
              aria-label={item.badge != null ? `${item.label}, ${item.badge} left` : item.label}
            >
              <span
                className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
                  active ? 'bg-rose-500/15 text-rose-400' : 'text-zinc-500'
                }`}
              >
                <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 1.9} />
                {item.badge != null && (
                  <span className="absolute -top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-2xs font-bold flex items-center justify-center tabular">
                    {item.badge}
                  </span>
                )}
                {item.dot && <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-amber-400" />}
              </span>
              <span className={`text-2xs font-semibold ${active ? 'text-white' : 'text-zinc-500'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
