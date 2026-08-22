import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Bot,
  Menu,
  Award,
  GraduationCap
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const { currentView, setCurrentView, drives, currentRole } = useApp();

  const activeDrivesCount = (drives || []).filter(d => d.status === 'Active' || d.status === 'Ongoing').length;

  const tabs = [
    {
      id: currentRole === 'student' ? 'student-portal' : currentRole === 'recruiter' ? 'recruiter-portal' : 'dashboard',
      label: currentRole === 'student' ? 'Portal' : 'Home',
      icon: currentRole === 'student' ? GraduationCap : LayoutDashboard,
      badge: null
    },
    {
      id: 'drives',
      label: 'Drives',
      icon: Briefcase,
      badge: activeDrivesCount > 0 ? `${activeDrivesCount}` : null
    },
    {
      id: 'students',
      label: 'Students',
      icon: Users,
      badge: null
    },
    {
      id: 'ai',
      label: 'AI Copilot',
      icon: Bot,
      badge: 'AI'
    }
  ];

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl transition-colors duration-200"
    >
      <div className="flex items-center justify-around px-2 py-1.5 max-w-md mx-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id || (tab.id === 'dashboard' && currentView === 'dashboard');

          return (
            <button
              key={tab.id}
              id={`mobile-bottom-tab-${tab.id}`}
              onClick={() => setCurrentView(tab.id as any)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-xl transition-all min-h-[48px] touch-manipulation ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 bg-blue-600 text-white text-[9px] font-mono font-bold rounded-full border border-white dark:border-slate-900 shadow-2xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}

        {/* Menu Tab button that triggers full mobile drawer */}
        <button
          id="mobile-bottom-tab-menu"
          onClick={onOpenMenu}
          className="relative flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all min-h-[48px] touch-manipulation"
        >
          <div className="relative flex items-center justify-center">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium whitespace-nowrap">
            More
          </span>
        </button>
      </div>
    </nav>
  );
};
