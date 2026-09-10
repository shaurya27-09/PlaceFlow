import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { RegisterView } from './RegisterView';
import { Shield, GraduationCap, Building2, ArrowRight, Layers, Sparkles, Lock, Mail, Sun, Moon, AlertCircle, Loader2 } from 'lucide-react';
import { UserRole } from '../../types';

export const LoginPage: React.FC = () => {
  const {
    login,
    setCurrentView,
    darkMode,
    toggleDarkMode,
    setCurrentRole,
    setActiveStudentId,
    setSelectedCompanyId,
    addToast
  } = useApp();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedRoleHint, setSelectedRoleHint] = useState<UserRole>('admin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRoleHintSelection = (role: UserRole) => {
    setSelectedRoleHint(role);
    setErrorMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const email = emailInput.trim();
    const password = passwordInput;

    if (!email || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Direct Supabase Authentication using @supabase/supabase-js
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data?.user) {
        const errorMsg = error?.message || 'Invalid email or password.';
        if (errorMsg.toLowerCase().includes('email not confirmed')) {
          setErrorMessage('Email not confirmed. Please confirm the user email in Supabase Dashboard -> Authentication -> Users.');
        } else {
          setErrorMessage(errorMsg);
        }
        return;
      }

      // Delegate session profile hydration and navigation to AppContext
      await login(email, password);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors relative">
      {/* Top Bar with theme toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          id="login-theme-toggle-btn"
          onClick={toggleDarkMode}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand header */}
        <button
          id="login-brand-back-btn"
          onClick={() => setCurrentView('landing')}
          className="inline-flex items-center gap-2 group mb-4"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Layers className="w-6 h-6" />
          </div>
          <span className="font-display font-extrabold text-2xl text-slate-900 dark:text-white tracking-tight">
            PlaceFlow
          </span>
        </button>

        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {authMode === 'login' ? 'Sign in to University Placement Cell' : 'Create your PlaceFlow account'}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          {authMode === 'login'
            ? 'Smart India Hackathon 2026 • Authenticated Portal Access'
            : 'Smart India Hackathon 2026 • Secure Supabase Auth'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
          {/* Top Auth Mode Tabs */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/60 dark:border-slate-700/50">
            <button
              type="button"
              id="auth-mode-login-tab"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              id="auth-mode-register-tab"
              onClick={() => {
                setAuthMode('register');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {authMode === 'register' ? (
            <RegisterView onBackToLogin={() => setAuthMode('login')} />
          ) : (
            <>
              {/* Portal Type Indicator */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Select Portal Type
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    id="portal-type-admin"
                    onClick={() => handleRoleHintSelection('admin')}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      selectedRoleHint === 'admin'
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                    <span className="text-xs font-semibold">T&P Admin</span>
                  </button>

                  <button
                    type="button"
                    id="portal-type-student"
                    onClick={() => handleRoleHintSelection('student')}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      selectedRoleHint === 'student'
                        ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <GraduationCap className="w-5 h-5" />
                    <span className="text-xs font-semibold">Student</span>
                  </button>

                  <button
                    type="button"
                    id="portal-type-recruiter"
                    onClick={() => handleRoleHintSelection('recruiter')}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      selectedRoleHint === 'recruiter'
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    <span className="text-xs font-semibold">Recruiter</span>
                  </button>
                </div>
              </div>

              {/* Error Message Banner */}
              {errorMessage && (
                <div
                  id="login-error-alert"
                  className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs font-semibold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <div>{errorMessage}</div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Institutional / Corporate Email
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      id="login-email-input"
                      value={emailInput}
                      onChange={e => {
                        setEmailInput(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder={
                        selectedRoleHint === 'admin'
                          ? 'admin@placeflow.ac.in'
                          : selectedRoleHint === 'student'
                          ? 'student@placeflow.ac.in'
                          : 'recruiter@company.com'
                      }
                      className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      id="login-password-input"
                      value={passwordInput}
                      onChange={e => {
                        setPasswordInput(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Enter your password"
                      className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Encrypted via Supabase Auth</span>
                  <span>Role resolved from public.profiles</span>
                </div>

                <button
                  type="submit"
                  id="login-submit-button"
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In with Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Create Account Switch Link */}
              <div className="text-center pt-1">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    id="login-switch-to-register-btn"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMessage(null);
                    }}
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </p>
              </div>

              {/* Quick Demo Access for Hackathon Testing */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 mb-2.5 text-slate-500 dark:text-slate-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Hackathon Demo Testing (1-Click Access)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="quick-demo-student"
                    onClick={() => {
                      setCurrentRole('student');
                      setActiveStudentId('std-1');
                      setSelectedCompanyId(null);
                      setCurrentView('student-portal');
                      addToast('Demo Student Access', 'Signed in as Raghav Sharma (std-1)', 'success');
                    }}
                    className="py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    id="quick-demo-recruiter"
                    onClick={() => {
                      setCurrentRole('recruiter');
                      setSelectedCompanyId('comp-1');
                      setActiveStudentId(null);
                      setCurrentView('recruiter-portal');
                      addToast('Demo Recruiter Access', 'Signed in as Google Recruiter', 'success');
                    }}
                    className="py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Recruiter</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

