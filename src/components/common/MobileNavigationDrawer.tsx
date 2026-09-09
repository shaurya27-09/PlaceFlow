import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  FileCheck2,
  Award,
  BarChart3,
  FileSpreadsheet,
  Bot,
  Settings,
  Sparkles,
  ShieldCheck,
  Plus,
  Layers,
  GraduationCap,
  ChevronRight,
  Database,
  LogOut,
  X,
  Sun,
  Moon,
  Shield,
  User,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { SupabaseModal } from '../database/SupabaseModal';

interface MobileNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateDrive?: () => void;
}

export const MobileNavigationDrawer: React.FC<MobileNavigationDrawerProps> = ({
  isOpen,
  onClose,
  onOpenCreateDrive
}) => {
  const {
    currentView,
    setCurrentView,
    drives,
    applications,
    offers,
    students,
    currentRole,
    setCurrentRole,
    activeStudent,
    setActiveStudentId,
    isSupabaseConfigured,
    supabaseConnected,
    userProfile,
    currentUser,
    darkMode,
    toggleDarkMode,
    logout,
    pullFromSupabase,
    isSyncing
  } = useApp();

  const [showDbModal, setShowDbModal] = React.useState(false);

  if (!isOpen) return null;

  const activeDrivesCount = (drives || []).filter(d => d.status === 'Active' || d.status === 'Ongoing').length;
  const pendingAppsCount = (applications || []).filter(a => a.status === 'Applied' || a.status === 'Interview').length;
  const totalOffersCount = (offers || []).filter(o => o.status === 'Accepted').length;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'students',
      label: 'Students Directory',
      icon: Users,
      badge: `${(students || []).length}`
    },
    {
      id: 'drives',
      label: 'Placement Drives',
      icon: Briefcase,
      badge: activeDrivesCount > 0 ? `${activeDrivesCount} Active` : null,
      badgeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
    },
    {
      id: 'companies',
      label: 'Companies Roster',
      icon: Building2,
      badge: null
    },
    {
      id: 'applications',
      label: 'Applications',
      icon: FileCheck2,
      badge: pendingAppsCount > 0 ? `${pendingAppsCount}` : null
    },
    {
      id: 'offers',
      label: 'Offers & Policy Engine',
      icon: Award,
      badge: `${totalOffersCount}`,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    },
    {
      id: 'analytics',
      label: 'Analytics & Insights',
      icon: BarChart3,
      badge: null
    },
    {
      id: 'nirf',
      label: 'NIRF 5D Reports',
      icon: FileSpreadsheet,
      badge: '5D'
    },
    {
      id: 'ai',
      label: 'AI Placement Copilot',
      icon: Bot,
      badge: 'Smart',
      badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
    },
    {
      id: 'student-portal',
      label: 'Student Portal View',
      icon: GraduationCap,
      badge: 'Live'
    },
    {
      id: 'recruiter-portal',
      label: 'Recruiter Portal View',
      icon: Building2,
      badge: null
    },
    {
      id: 'database-settings',
      label: 'Database & Supabase Settings',
      icon: Database,
      badge: isSupabaseConfigured ? 'Live' : 'Config',
      badgeColor: isSupabaseConfigured ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    }
  ];

  const handleNavigate = (viewId: any) => {
    setCurrentView(viewId);
    onClose();
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] lg:hidden animate-in fade-in duration-200">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Drawer Content */}
        <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-300">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <div className="w-3.5 h-3.5 border-2 border-white rounded-xs" />
              </div>
              <div>
                <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  PlaceFlow
                </span>
                <span className="block text-[10px] text-slate-400 font-mono">
                  TPC Digital Workflow
                </span>
              </div>
            </div>
            <button
              id="mobile-drawer-close-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User & Role Switcher Bar */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {currentRole === 'student' ? (activeStudent?.name?.charAt(0) || 'S') : 'AD'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentRole === 'student' ? (activeStudent?.name || 'Student') : (currentUser?.email ? currentUser.email.split('@')[0] : 'TPC Administrator')}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {userProfile?.email || currentUser?.email || 'Admin Session'}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Role Switcher Buttons */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setCurrentRole('admin')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors min-h-[36px] flex items-center justify-center ${
                  currentRole === 'admin'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentRole('student');
                  handleNavigate('student-portal');
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors min-h-[36px] flex items-center justify-center ${
                  currentRole === 'student'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentRole('recruiter');
                  handleNavigate('recruiter-portal');
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors min-h-[36px] flex items-center justify-center ${
                  currentRole === 'recruiter'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Recruiter
              </button>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="p-4 space-y-2 border-b border-slate-100 dark:border-slate-800">
            {currentRole === 'admin' && (
              <button
                id="mobile-drawer-new-drive-btn"
                onClick={() => {
                  onClose();
                  if (onOpenCreateDrive) {
                    onOpenCreateDrive();
                  } else {
                    setCurrentView('create-drive');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-tight shadow-xs min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>New Placement Drive</span>
              </button>
            )}
          </div>

          {/* Scrollable Navigation List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Navigation
            </div>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  id={`mobile-nav-${item.id}`}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-500/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        item.badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Footer Actions */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold min-h-[44px]"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
                <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>

              {/* Database Status Button */}
              <button
                type="button"
                onClick={() => {
                  setShowDbModal(true);
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 min-h-[44px] ${
                  isSupabaseConfigured
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
                title="Database Settings"
              >
                <Database className="w-4 h-4" />
                <span>DB</span>
              </button>
            </div>

            {/* Logout Button */}
            <button
              id="mobile-drawer-logout-btn"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <SupabaseModal isOpen={showDbModal} onClose={() => setShowDbModal(false)} />
    </>
  );
};
