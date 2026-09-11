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
  ChevronLeft,
  Database,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface SidebarProps {
  onOpenCreateDrive?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCreateDrive }) => {
  const {
    currentView,
    setCurrentView,
    drives,
    applications,
    offers,
    students,
    currentRole,
    activeStudent,
    isSupabaseConfigured,
    supabaseConnected,
    userProfile,
    currentUser,
    logout
  } = useApp();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

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
      label: 'Students',
      icon: Users,
      badge: `${(students || []).length}`
    },
    {
      id: 'companies',
      label: 'Companies',
      icon: Building2,
      badge: null
    },
    {
      id: 'drives',
      label: 'Placement Drives',
      icon: Briefcase,
      badge: activeDrivesCount > 0 ? `${activeDrivesCount}` : null,
      badgeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
    },
    {
      id: 'applications',
      label: 'Applications',
      icon: FileCheck2,
      badge: pendingAppsCount > 0 ? `${pendingAppsCount}` : null
    },
    {
      id: 'offers',
      label: 'Offers & Policy',
      icon: Award,
      badge: `${totalOffersCount}`,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      badge: null
    },
    {
      id: 'nirf',
      label: 'NIRF Reports',
      icon: FileSpreadsheet,
      badge: '5D'
    },
    {
      id: 'ai',
      label: 'AI Assistant',
      icon: Bot,
      badge: 'Smart',
      badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
    },
    {
      id: 'student-portal',
      label: 'Student Portal',
      icon: GraduationCap,
      badge: 'Live'
    }
  ];

  return (
    <aside
      id="desktop-navigation-sidebar"
      aria-label="Desktop Navigation Sidebar"
      className={`hidden lg:flex ${
        isCollapsed ? 'w-16 p-2.5' : 'w-56 xl:w-60 p-3.5'
      } shrink-0 bg-white dark:bg-slate-900 flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl text-slate-700 dark:text-slate-300 transition-all duration-200 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto no-scrollbar relative z-30`}
    >
      <div className="space-y-3">
        {/* Collapse / Expand Toggle Button */}
        <div className="flex items-center justify-between px-1">
          {!isCollapsed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Platform Menu
            </span>
          )}
          <button
            id="sidebar-toggle-collapse-btn"
            onClick={() => setIsCollapsed(prev => !prev)}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mx-auto lg:mx-0 cursor-pointer"
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Create Drive Quick Button */}
        <div>
          <button
            id="sidebar-create-drive-btn"
            onClick={() => {
              if (onOpenCreateDrive) {
                onOpenCreateDrive();
              } else {
                setCurrentView('create-drive');
              }
            }}
            title={isCollapsed ? 'New Placement Drive' : undefined}
            className={`w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-tight shadow-sm shadow-blue-500/25 transition-all group cursor-pointer ${
              isCollapsed ? 'p-2.5 min-h-[38px]' : 'px-3 py-2 min-h-[38px]'
            }`}
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform duration-150 shrink-0" />
            {!isCollapsed && <span className="truncate">New Placement Drive</span>}
          </button>
        </div>

        {/* Navigation items */}
        <nav className="space-y-1">
          {(navItems || []).map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => setCurrentView(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-2.5 py-2'
                } rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-500/30 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                      item.badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isCollapsed && item.badge && (
                  <span className="sr-only">({item.badge})</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile Bento Card at Sidebar Bottom */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 shrink-0">
        <div
          id="sidebar-admin-profile-card"
          className={`bg-slate-50 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 ${
            isCollapsed ? 'p-1.5 justify-center' : 'p-2 justify-between'
          } rounded-xl flex items-center gap-2 shadow-2xs relative overflow-hidden`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0 ring-2 ring-blue-500/20">
              {currentRole === 'student' ? (activeStudent?.name?.charAt(0) || 'S') : 'AD'}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {currentRole === 'student' ? (activeStudent?.name || 'Student') : (userProfile?.role === 'recruiter' ? 'Recruiter' : 'T&P Admin')}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {userProfile?.email || currentUser?.email || 'Placement Governance'}
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              id="sidebar-signout-btn"
              onClick={logout}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Supabase Database Status Indicator */}
        <div
          id="sidebar-supabase-status"
          title={isCollapsed ? (supabaseConnected ? 'Supabase Connected' : 'Supabase Operational') : undefined}
          className={`w-full flex items-center ${
            isCollapsed ? 'justify-center p-2' : 'justify-between p-2'
          } rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs select-none`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            {!isCollapsed && <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">Supabase</span>}
          </div>
          {!isCollapsed && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
              isSupabaseConfigured && supabaseConnected
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                : isSupabaseConfigured
                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}>
              {supabaseConnected ? 'Connected' : 'Active'}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};
