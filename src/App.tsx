import React, { useState } from 'react';
import { ChallengeProvider, useChallenge } from './context/ChallengeContext';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { DailyTrackerScreen } from './components/tracker/DailyTrackerScreen';
import { CalendarScreen } from './components/calendar/CalendarScreen';
import { TravelSicknessScreen } from './components/travel/TravelSicknessScreen';
import { AnalyticsScreen } from './components/analytics/AnalyticsScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { TaskState } from './types';

const MainAppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeTaskId, setActiveTaskId] = useState<keyof TaskState | undefined>(undefined);

  const handleOpenTaskDetails = (taskId?: keyof TaskState) => {
    setActiveTaskId(taskId);
    setActiveTab('tracker');
  };

  const handleNavigateToDate = (dateStr: string) => {
    setActiveTab('tracker');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Screen Container - Highly Mobile Optimized */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-3 safe-bottom">
        {activeTab === 'dashboard' && (
          <DashboardScreen
            onNavigateTab={setActiveTab}
            onOpenTaskDetails={handleOpenTaskDetails}
          />
        )}
        {activeTab === 'tracker' && (
          <DailyTrackerScreen initialTaskId={activeTaskId} />
        )}
        {activeTab === 'calendar' && (
          <CalendarScreen onNavigateToDate={handleNavigateToDate} />
        )}
        {activeTab === 'travel' && <TravelSicknessScreen />}
        {activeTab === 'analytics' && <AnalyticsScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ChallengeProvider>
      <MainAppContent />
    </ChallengeProvider>
  );
};

export default App;
