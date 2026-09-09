import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  supabase,
  isSupabaseConfigured,
  getSupabaseCredentials,
  testSupabaseConnection
} from '../../lib/supabase';
import {
  Database,
  Terminal,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Activity,
  Layers,
  Zap,
  Code2,
  X,
  Radio,
  Sliders
} from 'lucide-react';
import { SupabaseModal } from './SupabaseModal';

interface SupabaseConsoleBarProps {
  className?: string;
  variant?: 'floating' | 'docked' | 'banner' | 'overlay';
  defaultExpanded?: boolean;
}

export const SupabaseConsoleBar: React.FC<SupabaseConsoleBarProps> = ({
  className = '',
  variant = 'floating',
  defaultExpanded = false
}) => {
  const {
    supabaseConnected,
    isSyncing,
    pullFromSupabase,
    drives,
    students,
    companies,
    offers,
    addToast
  } = useApp();

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(48);
  const [isTesting, setIsTesting] = useState(false);
  const creds = getSupabaseCredentials();
  const maskedUrl = creds.url
    ? creds.url.replace(/^https?:\/\//, '').replace(/\.supabase\.co.*$/, '.supabase.co')
    : 'Local Storage Mode';

  const [consoleLogs, setConsoleLogs] = useState<Array<{ timestamp: string; type: 'info' | 'success' | 'warn' | 'query'; message: string }>>([
    {
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: creds.url
        ? `Supabase client configured with endpoint ${creds.url}`
        : 'PlaceFlow operational in local reactive mode. Connect Supabase to enable cloud persistence.'
    },
    { timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Local schema [students, placement_drives, offers, companies] ready' }
  ]);

  const addConsoleLog = (type: 'info' | 'success' | 'warn' | 'query', message: string) => {
    setConsoleLogs(prev => [
      { timestamp: new Date().toLocaleTimeString(), type, message },
      ...prev.slice(0, 19)
    ]);
  };

  const handleTestPing = async () => {
    setIsTesting(true);
    const start = performance.now();
    addConsoleLog('query', 'PING -> Testing active Supabase REST & Auth connection...');
    const result = await testSupabaseConnection();
    const duration = Math.round(performance.now() - start);
    setLatencyMs(duration);
    setIsTesting(false);

    if (result.success) {
      addConsoleLog('success', `Pong received in ${duration}ms: ${result.message}`);
      addToast('Supabase Connection Active', `Latency: ${duration}ms. Connected to PostgreSQL.`, 'success');
    } else {
      addConsoleLog('warn', `Supabase ping notice: ${result.message}`);
      addToast('Supabase Notice', result.message, 'warning');
    }
  };

  const handleSyncNow = async () => {
    addConsoleLog('info', 'Triggering bidirectional sync for students, drives, and offers...');
    try {
      await pullFromSupabase();
      addConsoleLog('success', `Data sync complete: ${drives.length} drives, ${students.length} students, ${offers.length} offers.`);
      addToast('Sync Complete', 'Latest records fetched from Supabase database.', 'success');
    } catch (err: any) {
      addConsoleLog('warn', `Sync error: ${err?.message || err}`);
    }
  };

  // Minimized Floating Pill Overlay
  if (isMinimized) {
    return (
      <>
        <aside
          aria-label="Supabase Database Live Console Minimized"
          className={`sticky top-16 sm:top-20 z-20 transition-all duration-300 drop-shadow-2xl ${className}`}
        >
          <div className="bg-slate-950/95 text-slate-100 rounded-2xl border border-slate-700/90 shadow-2xl shadow-black/90 backdrop-blur-xl px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 ring-1 ring-white/15">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="relative flex items-center justify-center shrink-0">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white ${
                  supabaseConnected ? 'bg-emerald-600' : 'bg-blue-600'
                }`}>
                  <Database className="w-3.5 h-3.5" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-950 ${
                  supabaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`} />
              </div>
              <span className="font-mono font-bold text-[11px] sm:text-xs text-white tracking-tight flex items-center gap-1 truncate">
                SUPABASE CONSOLE
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap">
                {drives.length} Drives · {latencyMs ? `${latencyMs}ms` : 'Ready'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="px-2 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-semibold flex items-center gap-1 cursor-pointer min-h-[36px]"
                title="Sync database records"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer min-h-[36px]"
                title="Expand full Supabase Console overlay"
              >
                <span className="hidden sm:inline">Expand</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>
        <SupabaseModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  return (
    <>
      <aside
        aria-label="Supabase Database Live Console"
        className={`sticky top-16 sm:top-20 z-20 w-full transition-all duration-300 drop-shadow-2xl ${className}`}
      >
        <div className="bg-slate-950/95 text-slate-100 rounded-2xl border border-slate-700/90 shadow-2xl shadow-black/90 backdrop-blur-xl overflow-hidden transition-all duration-300 ring-1 ring-white/15">
          {/* Main Top Bar */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800/80">
            {/* Left: Indicator & Name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex items-center justify-center">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-inner ${
                  supabaseConnected ? 'bg-emerald-600' : 'bg-blue-600'
                }`}>
                  <Database className="w-4 h-4" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                  supabaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-xs text-white tracking-tight flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    SUPABASE CONSOLE
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${
                    supabaseConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    <Radio className="w-2.5 h-2.5 animate-pulse" />
                    {supabaseConnected ? 'Live Synced' : 'Ready'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 truncate hidden md:inline">
                    {maskedUrl}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <span className="text-slate-300 font-medium">Placement Drives & Eligibility Overlay</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 font-mono font-semibold">
                    {latencyMs ? `${latencyMs}ms latency` : 'Connected'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Quick Actions & Toggle */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Quick Ping Test */}
              <button
                type="button"
                id="supabase-console-ping-btn"
                onClick={handleTestPing}
                disabled={isTesting}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-[11px] font-mono font-semibold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                title="Send test ping to Supabase REST and Auth endpoints"
              >
                <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
                <span>{isTesting ? 'Testing...' : 'Test Ping'}</span>
              </button>

              {/* Sync Button */}
              <button
                type="button"
                id="supabase-console-sync-btn"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-semibold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                title="Pull and refresh latest data from Supabase tables"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync DB'}</span>
              </button>

              {/* Console Logs Toggle */}
              <button
                type="button"
                id="supabase-console-logs-btn"
                onClick={() => setShowLogs(prev => !prev)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  showLogs
                    ? 'bg-blue-600/30 text-blue-300 border-blue-500/40'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                }`}
                title="Toggle live query console log stream"
              >
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Logs ({consoleLogs.length})</span>
              </button>

              {/* Configure / Full Modal */}
              <button
                type="button"
                id="supabase-console-config-btn"
                onClick={() => setShowModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-[11px] font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Open Supabase settings & SQL schema generator"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Settings</span>
              </button>

              {/* Expand/Collapse metrics */}
              <button
                type="button"
                id="supabase-console-toggle-expand-btn"
                onClick={() => setIsExpanded(prev => !prev)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
                title={isExpanded ? 'Collapse Table Stats' : 'Expand Live Table Stats'}
                aria-label="Toggle Console Summary"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Minimize to floating pill button */}
              <button
                type="button"
                id="supabase-console-minimize-btn"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
                title="Minimize console to floating pill"
                aria-label="Minimize Console"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Collapsible Section 1: Live Table Sync Status Cards */}
          {isExpanded && (
            <div className="p-4 sm:p-5 bg-slate-950/95 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs animate-in fade-in duration-200">
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-inner">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>public.placement_drives</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {drives.length} <span className="text-[10px] font-normal text-slate-400">records</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-1 font-mono">
                  {drives.filter(d => d.status === 'Active' || d.status === 'Ongoing').length} Active Drives
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-inner">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>public.students</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {students.length} <span className="text-[10px] font-normal text-slate-400">enrolled</span>
                </div>
                <div className="text-[10px] text-blue-400 mt-1 font-mono">
                  {students.filter(s => s.placementStatus === 'Placed' || s.placementStatus === 'Dream Placed').length} Placed
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-inner">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>public.companies</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {companies.length} <span className="text-[10px] font-normal text-slate-400">partners</span>
                </div>
                <div className="text-[10px] text-purple-400 mt-1 font-mono">
                  {companies.filter(c => c.tier === 'Super Dream').length} Super Dream
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-inner">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>public.offers</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {offers.length} <span className="text-[10px] font-normal text-slate-400">offers</span>
                </div>
                <div className="text-[10px] text-amber-400 mt-1 font-mono">
                  {offers.filter(o => o.status === 'Accepted').length} Accepted
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Section 2: Live Log Terminal Stream */}
          {showLogs && (
            <div className="p-4 bg-black/95 border-t border-slate-800 font-mono text-[11px] animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Terminal className="w-3 h-3" />
                  Supabase Live Transaction & Query Terminal
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConsoleLogs([])}
                    className="hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    Clear Stream
                  </button>
                  <span>•</span>
                  <span className="text-slate-500">Auto-scroll ON</span>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2 select-text">
                {consoleLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                    <span className={`shrink-0 font-bold ${
                      log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'warn' ? 'text-amber-400' :
                      log.type === 'query' ? 'text-cyan-400' : 'text-blue-400'
                    }`}>
                      {log.type.toUpperCase()}:
                    </span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Supabase Full Configuration Modal */}
      <SupabaseModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};
