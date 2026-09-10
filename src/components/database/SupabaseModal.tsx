import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ShieldCheck,
  Users,
  Building2,
  Briefcase,
  Award
} from 'lucide-react';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Database status modal.
 *
 * This is intentionally a read-only status surface. It never renders or accepts
 * Supabase credentials, project URLs, environment variables, or any other
 * internal configuration. Connection details are provided to the browser client
 * exclusively through build-time environment variables.
 */
export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const {
    isSupabaseConfigured,
    supabaseConnected,
    isSyncing,
    pullFromSupabase,
    students,
    companies,
    drives,
    offers,
    addToast
  } = useApp();

  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const connected = isSupabaseConfigured && supabaseConnected;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await pullFromSupabase();
      addToast('Data Refreshed', 'Latest records loaded from the database.', 'success');
    } catch (err: any) {
      addToast('Refresh Notice', 'Could not refresh records right now.', 'warning');
    } finally {
      setIsRefreshing(false);
    }
  };

  const tableStats = [
    { label: 'Students', value: students.length, icon: Users, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Companies', value: companies.length, icon: Building2, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Drives', value: drives.length, icon: Briefcase, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Offers', value: offers.length, icon: Award, color: 'text-amber-600 dark:text-amber-400' }
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full flex flex-col my-auto animate-in zoom-in-95 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 ${connected ? 'bg-emerald-600' : 'bg-slate-500'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  Database Status
                </h3>
                {connected ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center gap-1 border border-amber-200 dark:border-amber-800/60">
                    Local Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live sync status for PlaceFlow records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Connection summary */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
              connected
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {connected ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="text-xs leading-relaxed">
              {connected ? (
                <>
                  <span className="font-bold">Supabase Connected.</span> PlaceFlow is synchronized with the secure PostgreSQL backend.
                </>
              ) : (
                <>
                  <span className="font-bold">Running in local mode.</span> The app is fully usable and will sync automatically once the database connection is available.
                </>
              )}
            </div>
          </div>

          {/* Record counts */}
          <div className="grid grid-cols-2 gap-2.5">
            {tableStats.map(stat => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                    <span>{stat.label}</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {stat.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Database credentials are managed securely through environment configuration and are never exposed in the app.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/75 dark:bg-slate-900/75 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isSyncing || !connected}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing || isSyncing ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
