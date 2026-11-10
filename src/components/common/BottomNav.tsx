import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  PlaneTakeoff,
  BarChart3,
  Settings,
} from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { validateDayTasks } from '../../services/rulesEngine';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { currentLog, config } = useChallenge();
  const { completedCount, totalCount } = validateDayTasks(currentLog, config);
  const remaining = totalCount - completedCount;

  const navItems = [
    { id: 'dashboard', label: 'Today', icon: LayoutDashboard },
    {
      id: 'tracker',
      label: 'Checklist',
      icon: CheckSquare,
      badge: remaining > 0 ? remaining : null,
      badgeColor: 'bg-rose-500',
    },
    { id: 'calendar', label: '75 Days', icon: CalendarDays },
    {
      id: 'travel',
      label: 'Rules & Trips',
      icon: PlaneTakeoff,
      badge: currentLog.travel.isTravelling ? '!' : null,
      badgeColor: 'bg-amber-500',
    },
    { id: 'analytics', label: 'Stats', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0e12]/95 backdrop-blur-lg border-t border-white/[0.08] pb-[env(safe-area-inset-bottom,8px)] pt-1.5 px-2">
      <div className="max-w-md mx-auto grid grid-cols-6 gap-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition-all active:scale-90 ${
                isActive
                  ? 'text-rose-500 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`absolute -top-1 -right-2 px-1 text-[9px] font-black rounded-full text-white ${item.badgeColor || 'bg-rose-500'}`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] tracking-tight mt-0.5 transition-colors ${isActive ? 'text-white font-bold' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-rose-500 mt-0.5 shadow-glow-red" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
