import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { MobileNavigationDrawer } from './components/common/MobileNavigationDrawer';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { ToastContainer } from './components/common/ToastContainer';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { StudentsPage } from './components/students/StudentsPage';
import { CompaniesPage } from './components/companies/CompaniesPage';
import { DrivesPage } from './components/drives/DrivesPage';
import { CreateDriveModal } from './components/drives/CreateDriveModal';
import { EligibilityResultsModal } from './components/drives/EligibilityResultsModal';
import { ApplicationsPage } from './components/applications/ApplicationsPage';
import { OffersPage } from './components/offers/OffersPage';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { NirfReportsPage } from './components/nirf/NirfReportsPage';
import { AiAssistantPage } from './components/ai/AiAssistantPage';
import { StudentPortal } from './components/student/StudentPortal';
import { RecruiterPortal } from './components/recruiter/RecruiterPortal';
import { SupabaseSettingsPage } from './components/settings/SupabaseSettingsPage';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl font-black">
              !
            </div>
            <h2 className="text-lg font-bold">Something went wrong</h2>
            <p className="text-xs text-slate-400">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div className="pt-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Reload Platform
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const { currentView, setCurrentView } = useApp();
  const [isCreateDriveModalOpen, setIsCreateDriveModalOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Standalone public pages
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-500 selection:text-white transition-colors duration-200">
        <LandingPage />
        <ToastContainer />
      </div>
    );
  }

  if (currentView === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-500 selection:text-white transition-colors duration-200">
        <LoginPage />
        <ToastContainer />
      </div>
    );
  }

  const handleOpenCreateDrive = () => {
    setIsCreateDriveModalOpen(true);
  };

  // Authenticated Platform Dashboard Shell
  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white transition-colors duration-200">
      <Header
        onOpenCreateDrive={handleOpenCreateDrive}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />

      <div className="flex flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 gap-6 pb-24 lg:pb-8 items-start relative">
        <Sidebar onOpenCreateDrive={handleOpenCreateDrive} />

        <main id="primary-app-main-view" className="flex-1 min-w-0 w-full relative">
          {currentView === 'dashboard' && <AdminDashboard onOpenCreateDrive={handleOpenCreateDrive} />}
          {currentView === 'students' && <StudentsPage />}
          {currentView === 'companies' && <CompaniesPage />}
          {currentView === 'drives' && <DrivesPage />}
          {currentView === 'create-drive' && <DrivesPage />}
          {currentView === 'eligibility-results' && <EligibilityResultsModal />}
          {currentView === 'applications' && <ApplicationsPage />}
          {currentView === 'offers' && <OffersPage />}
          {currentView === 'analytics' && <AnalyticsPage />}
          {(currentView === 'nirf' || currentView === 'nirf-reports') && <NirfReportsPage />}
          {(currentView === 'ai' || currentView === 'ai-assistant') && <AiAssistantPage />}
          {currentView === 'student-portal' && <StudentPortal />}
          {currentView === 'recruiter-portal' && <RecruiterPortal />}
          {(currentView === 'database-settings' || currentView === 'settings') && <SupabaseSettingsPage />}
        </main>
      </div>

      <CreateDriveModal
        isOpen={isCreateDriveModalOpen}
        onClose={() => setIsCreateDriveModalOpen(false)}
      />

      {/* Mobile Drawer & Bottom Navigation */}
      <MobileNavigationDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        onOpenCreateDrive={handleOpenCreateDrive}
      />

      <MobileBottomNav
        onOpenMenu={() => setIsMobileDrawerOpen(true)}
      />

      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
