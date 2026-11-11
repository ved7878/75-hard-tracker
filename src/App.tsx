import React, { useState, useEffect } from 'react';
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

const MainAppContent: React.FC = () => {
  const { currentUser, isAdmin } = useChallenge();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeTaskId, setActiveTaskId] = useState<keyof TaskState | undefined>(undefined);

  // Reset tab to dashboard whenever user changes or logs in
  useEffect(() => {
    setActiveTab('dashboard');
  }, [currentUser?.id]);

  // Security guard: If a non-admin user lands on or attempts to view 'admin', immediately redirect to 'dashboard'
  useEffect(() => {
    if (!isAdmin && activeTab === 'admin') {
      setActiveTab('dashboard');
    }
  }, [isAdmin, activeTab]);

  // AUTHENTICATION GATE: User must log in first before ANY content is visible!
  if (!currentUser) {
    return <LoginScreen />;
  }

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
        {activeTab === 'admin' && isAdmin && <AdminPanelScreen />}
        {activeTab === 'admin' && !isAdmin && (
          <DashboardScreen
            onNavigateTab={setActiveTab}
            onOpenTaskDetails={handleOpenTaskDetails}
          />
        )}
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
