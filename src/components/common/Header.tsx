import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { SupabaseModal } from '../database/SupabaseModal';
import {
  Sun,
  Moon,
  User,
  Shield,
  GraduationCap,
  Building2,
  Bell,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Award,
  Layers,
  Search,
  Plus,
  ArrowRight,
  Database,
  X,
  Menu,
  CheckCircle2,
  Server,
  ShieldCheck,
  LogOut
} from 'lucide-react';

interface HeaderProps {
  onOpenCreateDrive?: () => void;
  onOpenMobileDrawer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCreateDrive, onOpenMobileDrawer }) => {
  const {
    darkMode,
    toggleDarkMode,
    currentRole,
    currentView,
    setCurrentView,
    activeStudent,
    setActiveStudentId,
    students,
    companies,
    drives,
    offers,
    isSupabaseConfigured,
    supabaseConnected,
    currentUser,
    userProfile,
    isAuthenticated,
    logout
  } = useApp();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const studentDropdownRef = useRef<HTMLDivElement>(null);
  const notificationsDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        userDropdownRef.current && !userDropdownRef.current.contains(target) &&
        roleDropdownRef.current && !roleDropdownRef.current.contains(target)
      ) {
        setShowUserDropdown(false);
      }
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(target)) {
        setShowStudentDropdown(false);
      }
      if (notificationsDropdownRef.current && !notificationsDropdownRef.current.contains(target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeDrivesCount = drives.filter(d => d.status === 'Active' || d.status === 'Ongoing').length;

  const roleLabels: Record<string, { label: string; icon: any; color: string; desc: string }> = {
    admin: {
      label: 'T&P Administrator',
      icon: Shield,
      color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      desc: 'Full cell governance & NIRF'
    },
    student: {
      label: 'Student Portal',
      icon: GraduationCap,
      color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      desc: 'Applications, drives & offers'
    },
    recruiter: {
      label: 'Recruiter View',
      icon: Building2,
      color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      desc: 'Company drive & applicant review'
    }
  };

  const currentRoleInfo = roleLabels[currentRole] || roleLabels.admin;
  const RoleIcon = currentRoleInfo.icon;

  const handleLogout = async () => {
    setShowUserDropdown(false);
    setShowProfileModal(false);
    await logout();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setCurrentView('ai');
  };

  return (
    <header className={`sticky top-0 ${showProfileModal || showSupabaseModal ? 'z-[9999]' : 'z-40'} w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Title with Active Drives Pill */}
        <div className="flex items-center gap-4">
          <button
            id="brand-logo-button"
            onClick={() => setCurrentView(currentRole === 'student' ? 'student-portal' : currentRole === 'recruiter' ? 'recruiter-portal' : 'dashboard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <div className="w-4 h-4 border-2 border-white rounded-xs"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans font-black text-xl text-slate-900 dark:text-white tracking-tight">
                  PlaceFlow
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-full border border-emerald-200 dark:border-emerald-800/60 hidden sm:inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Drives Active ({activeDrivesCount})
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-3">
          {/* Ask PlaceFlow AI Input */}
          <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
            <input
              type="text"
              id="header-search-ai"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Ask PlaceFlow AI..."
              className="bg-slate-100 dark:bg-slate-800/80 border-none rounded-full px-4 py-1.5 text-xs text-slate-900 dark:text-white w-52 lg:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              aria-label="Submit search"
              className="absolute right-3 top-2 text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Action Button: New Drive (Admin Only) */}
          {currentRole === 'admin' && (
            <button
              onClick={() => {
                if (onOpenCreateDrive) {
                  onOpenCreateDrive();
                } else {
                  setCurrentView('create-drive');
                }
              }}
              className="hidden sm:flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Drive</span>
            </button>
          )}

          {/* Authenticated Role Badge */}
          <div className="relative" ref={roleDropdownRef}>
            <button
              id="role-badge-btn"
              onClick={() => {
                setShowUserDropdown(prev => !prev);
                setShowStudentDropdown(false);
                setShowNotifications(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-2xs transition-all cursor-pointer ${currentRoleInfo.color}`}
              title="Authenticated User Session"
              aria-expanded={showUserDropdown}
              aria-haspopup="true"
            >
              <RoleIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{currentRoleInfo.label}</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
          </div>

          {/* If Admin: can switch preview student for diagnostics */}
          {currentRole === 'admin' && (
            <div className="relative hidden md:block" ref={studentDropdownRef}>
              <button
                id="active-student-switcher"
                onClick={() => {
                  setShowStudentDropdown(prev => !prev);
                  setShowUserDropdown(false);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-200 hover:border-slate-300 cursor-pointer"
                title="Inspect student view"
                aria-expanded={showStudentDropdown}
                aria-haspopup="true"
              >
                <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
                  {activeStudent?.name?.charAt(0) || 'S'}
                </div>
                <span className="font-medium truncate max-w-[110px]">{activeStudent?.name || 'Inspect Student'}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showStudentDropdown && (
                <div className="absolute right-0 top-full mt-2 w-72 max-h-72 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50">
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Inspect Student Profile
                  </div>
                  {(students || []).map(std => (
                    <button
                      key={std.id}
                      id={`select-student-${std.id}`}
                      onClick={() => {
                        setActiveStudentId(std.id);
                        setShowStudentDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        activeStudent?.id === std.id ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{std.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{std.branch} • CGPA: {std.cgpa}</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {std.placementStatus}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notifications button */}
          <div className="relative" ref={notificationsDropdownRef}>
            <button
              id="notifications-button"
              onClick={() => {
                setShowNotifications(prev => !prev);
                setShowUserDropdown(false);
                setShowStudentDropdown(false);
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
              title="Notifications"
              aria-label="Notifications"
              aria-expanded={showNotifications}
              aria-haspopup="true"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 z-50 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Recent Notifications</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">3 Unread</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 mt-1 max-h-64 overflow-y-auto">
                  <div className="py-2.5 text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Microsoft Drive Published</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">SDE role at ₹16.5 LPA. Registration closes Aug 25.</p>
                    <span className="text-[10px] text-slate-400">10 mins ago</span>
                  </div>
                  <div className="py-2.5 text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Policy Block Triggered</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Rahul Sharma application to Accenture auto-gated (Existing offer ₹7.20 LPA).</p>
                    <span className="text-[10px] text-slate-400">2 hours ago</span>
                  </div>
                  <div className="py-2.5 text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">NIRF 2025-26 Snapshot Ready</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Institutional placement rate reached 82.08%.</p>
                    <span className="text-[10px] text-slate-400">1 day ago</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Supabase Database Button */}
          <button
            id="supabase-db-button"
            onClick={() => setShowSupabaseModal(true)}
            className={`p-2 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold ${
              isSupabaseConfigured
                ? supabaseConnected
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800'
                  : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 border border-amber-200 dark:border-amber-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
            title="Supabase PostgreSQL Database Configuration & Sync"
            aria-label="Database Settings"
          >
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden lg:inline text-[11px]">
              {isSupabaseConfigured ? (supabaseConnected ? 'Supabase Connected' : 'Supabase (Check)') : 'Database'}
            </span>
          </button>

          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-button"
            onClick={toggleDarkMode}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* User Profile Button & Dropdown Trigger */}
          <div className="relative" ref={userDropdownRef}>
            <button
              id="user-profile-button"
              onClick={() => {
                setShowUserDropdown(prev => !prev);
                setShowStudentDropdown(false);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="View User Profile & Session"
              aria-expanded={showUserDropdown}
              aria-haspopup="true"
            >
              <div className="w-6 h-6 rounded-full bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                {currentRole === 'student' ? (activeStudent?.name?.charAt(0) || 'S') : 'AD'}
              </div>
              <span className="font-semibold hidden sm:inline text-xs">
                {currentRole === 'student' ? (activeStudent?.name?.split(' ')[0] || 'Student') : 'Administrator'}
              </span>
              <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile & Session Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signed in as</div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                    {userProfile?.email || currentUser?.email || 'Authenticated User'}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">
                    Role: {userProfile?.role || currentRole}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowProfileModal(true);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>Account Details</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowSupabaseModal(true);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-emerald-500" />
                    <span>Database Status</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    id="header-logout-btn"
                    onClick={handleLogout}
                    className="w-full px-3 py-2 flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Drawer Toggle Button */}
          {onOpenMobileDrawer && (
            <button
              id="mobile-menu-drawer-btn"
              onClick={onOpenMobileDrawer}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-200 dark:border-slate-800"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Profile / Problem Statement (USICT012) Metadata Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full flex flex-col max-h-[85vh] my-auto animate-in zoom-in-95 overflow-hidden">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  {currentRole === 'student' ? (activeStudent?.name?.charAt(0) || 'S') : 'AD'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                    {currentRole === 'student' ? (activeStudent?.name || 'Student') : 'T&P Cell Administrator'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentRole === 'student' ? `${activeStudent?.branch || 'General'} • ${activeStudent?.enrollmentNumber || 'No ID'}` : 'Head Placement Officer • USICT GGSIPU'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  {currentRole}
                </span>
                <button
                  id="close-profile-modal-icon-btn"
                  onClick={() => setShowProfileModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Modal Content Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4 text-xs">
              {/* Problem ID Card Overview */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Problem Statement Info
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-mono font-bold text-[10px]">
                    SIH 2026: USICT012
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Automated Multi-Tier Campus Placement Management, Real-Time Dynamic Eligibility Evaluation, and NIRF Compliance System.
                </p>
              </div>

              {/* Institution & Governance Details */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Institution:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">University School of ICT (USICT)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">University:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">GGSIPU Main Campus, Dwarka, Delhi</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Academic Session:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">2025 - 2026 Graduating Cohort</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Multi-Tier Policy:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Strict Multiplier 1.5× Rule</span>
                </div>
              </div>

              {/* Live Supabase Database Metrics */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    Supabase PostgreSQL Live Storage
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isSupabaseConfigured && supabaseConnected
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {isSupabaseConfigured ? (supabaseConnected ? '● Live Synced' : '○ Standby') : '○ Local Active'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex justify-between">
                    <span className="text-slate-500">Students Pool:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{students.length} Records</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex justify-between">
                    <span className="text-slate-500">Companies:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{companies.length} Partners</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex justify-between">
                    <span className="text-slate-500">Active Drives:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{drives.length} Drives</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex justify-between">
                    <span className="text-slate-500">Logged Offers:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{offers.length} Offers</span>
                  </div>
                </div>
              </div>

              {/* Student Standing Details (If logged in as student) */}
              {currentRole === 'student' && activeStudent && (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                  <div className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                    <span>Active Student Academic Standing</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-mono">
                      {activeStudent.placementStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-slate-700 dark:text-slate-300 text-[11px]">
                    <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg text-center">
                      <div className="text-slate-400 text-[10px]">CGPA</div>
                      <div className="font-bold text-slate-900 dark:text-white">{activeStudent.cgpa}</div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg text-center">
                      <div className="text-slate-400 text-[10px]">Backlogs</div>
                      <div className={`font-bold ${activeStudent.backlogs > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {activeStudent.backlogs}
                      </div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg text-center">
                      <div className="text-slate-400 text-[10px]">Attendance</div>
                      <div className="font-bold text-slate-900 dark:text-white">{activeStudent.attendance}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/75 dark:bg-slate-900/75 backdrop-blur-xs">
              <button
                type="button"
                id="modal-signout-btn"
                onClick={handleLogout}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    setShowSupabaseModal(true);
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>DB Sync</span>
                </button>
                <button
                  id="close-profile-modal-btn"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Database Modal */}
      <SupabaseModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
      />
    </header>
  );
};
