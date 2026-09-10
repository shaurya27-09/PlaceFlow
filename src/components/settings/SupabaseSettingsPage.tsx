import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Users,
  Building2,
  Briefcase,
  Award,
  FileCheck2,
  Server
} from 'lucide-react';

/**
 * Database status page.
 *
 * Read-only by design. It surfaces the live connection state and record counts
 * only. Supabase credentials, project URLs, environment variables, and SQL
 * schema are intentionally never rendered here — connection details reach the
 * browser client exclusively through build-time environment variables.
 */
export const SupabaseSettingsPage: React.FC = () => {
  const {
    isSupabaseConfigured,
    supabaseConnected,
    pullFromSupabase,
    isSyncing,
    students,
    companies,
    drives,
    applications,
    offers,
    addToast
  } = useApp();

  const [isRefreshing, setIsRefreshing] = useState(false);

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
    { label: 'Students', value: (students || []).length, icon: Users, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Companies', value: (companies || []).length, icon: Building2, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Placement Drives', value: (drives || []).length, icon: Briefcase, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Applications', value: (applications || []).length, icon: FileCheck2, color: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Offers', value: (offers || []).length, icon: Award, color: 'text-amber-600 dark:text-amber-400' }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Database Status
            </h1>
            {connected ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Local Mode
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Live synchronization status for PlaceFlow's Supabase PostgreSQL backend.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isSyncing || !connected}
          className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing || isSyncing ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Connection summary */}
      <div
        className={`p-4 rounded-2xl border flex items-start gap-3 ${
          connected
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
        }`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${connected ? 'bg-emerald-600' : 'bg-slate-500'}`}>
          {connected ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
        </div>
        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {connected ? (
            <>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">Supabase Connected.</span> All candidate,
              company, drive, application, and offer records are synchronized with the secure PostgreSQL backend in real time.
            </>
          ) : (
            <>
              <span className="font-bold">Running in local mode.</span> The platform is fully usable offline and will
              synchronize automatically once the database connection becomes available.
            </>
          )}
        </div>
      </div>

      {/* Record counts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tableStats.map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                <span>{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Security posture card */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm">Secure by Configuration</h4>
        </div>
        <div className="space-y-2.5 text-[11px] text-slate-300">
          <div className="flex items-start gap-2">
            <Server className="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5" />
            <p>
              Connection details are supplied to the browser only through environment variables at build time. No secret keys,
              service-role keys, or database passwords are present in the client.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Database className="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5" />
            <p>
              The Eligibility Engine and Offer Policy run their queries against the live PostgreSQL database whenever the
              connection is active, and fall back to the local cache otherwise.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
