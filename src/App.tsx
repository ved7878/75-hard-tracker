import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ChallengeProvider, useChallenge } from './context/ChallengeContext';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { DailyTrackerScreen } from './components/tracker/DailyTrackerScreen';
import { CalendarScreen } from './components/calendar/CalendarScreen';
import { TravelSicknessScreen } from './components/travel/TravelSicknessScreen';
import { AnalyticsScreen } from './components/analytics/AnalyticsScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { AdminPanelScreen } from './components/admin/AdminPanelScreen';
import { LoginScreen } from './components/auth/LoginScreen';
import { TaskState } from './types';

const SUB_SCREENS = ['travel', 'admin'];
const TAB_LABELS: Record<string, string> = {
  dashboard: 'Today',
  tracker: 'Checklist',
  calendar: 'Calendar',
  analytics: 'Stats',
  settings: 'More',
};

const MainAppContent: React.FC = () => {
  const { currentUser, isAdmin } = useChallenge();
  const [activeTab, setActiveTabState] = useState<string>('dashboard');
  const [focusTaskId, setFocusTaskId] = useState<keyof TaskState | undefined>(undefined);
  const [returnTab, setReturnTab] = useState<string>('settings');

  // Reset to Today on a new login. Admin previewing different challengers keeps the same
  // session key, so switching people doesn't kick the admin out of the current screen.
  const sessionKey = isAdmin ? 'admin' : currentUser?.id;
  useEffect(() => {
    setActiveTabState('dashboard');
  }, [sessionKey]);

  // Security guard: non-admins can never land on the admin screen
  useEffect(() => {
    if (!isAdmin && activeTab === 'admin') setActiveTabState('dashboard');
  }, [isAdmin, activeTab]);

  const setActiveTab = (tab: string) => {
    if (tab !== 'tracker') setFocusTaskId(undefined);
    // Remember where a sub-screen was opened from so "Back" goes there
    if (SUB_SCREENS.includes(tab) && !SUB_SCREENS.includes(activeTab)) setReturnTab(activeTab);
    setActiveTabState(tab);
    window.scrollTo({ top: 0 });
  };

  if (!currentUser) {
    return <LoginScreen />;
  }

  const openTask = (taskId?: keyof TaskState) => {
    setFocusTaskId(taskId);
    setActiveTabState('tracker');
    if (!taskId) window.scrollTo({ top: 0 });
  };

  const parent = SUB_SCREENS.includes(activeTab) ? returnTab : undefined;

  return (
    <div className="min-h-[100dvh] bg-ink-950 text-zinc-100 flex flex-col font-sans">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-nav">
        {parent && (
          <button
            onClick={() => setActiveTab(parent)}
            className="-ml-1 mb-2 h-8 pr-2 inline-flex items-center gap-0.5 text-sm font-medium text-zinc-400 active:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
            {TAB_LABELS[parent] || 'Back'}
          </button>
        )}

        {activeTab === 'dashboard' && <DashboardScreen onNavigateTab={setActiveTab} onOpenTaskDetails={openTask} />}
        {activeTab === 'tracker' && <DailyTrackerScreen focusTaskId={focusTaskId} onNavigateTab={setActiveTab} />}
        {activeTab === 'calendar' && <CalendarScreen onNavigateToDate={() => setActiveTab('tracker')} />}
        {activeTab === 'travel' && <TravelSicknessScreen />}
        {activeTab === 'analytics' && <AnalyticsScreen />}
        {activeTab === 'settings' && <SettingsScreen onNavigateTab={setActiveTab} />}
        {activeTab === 'admin' && isAdmin && <AdminPanelScreen onNavigateTab={setActiveTab} />}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export const App: React.FC = () => (
  <ChallengeProvider>
    <MainAppContent />
  </ChallengeProvider>
);

export default App;
