import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  clearSupabaseCredentials,
  testSupabaseConnection,
  fetchOffersFromSupabase,
  fetchAllFromSupabase,
  supabase
} from '../../lib/supabase';
import {
  Database,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Award,
  Eye,
  EyeOff,
  Trash2,
  Save,
  Check,
  Copy,
  ExternalLink,
  Layers,
  ArrowRight,
  Code2,
  Server
} from 'lucide-react';
import { Offer } from '../../types';

export const SupabaseSettingsPage: React.FC = () => {
  const {
    isSupabaseConfigured,
    supabaseConnected,
    testConnection,
    pullFromSupabase,
    syncAllToSupabase,
    isSyncing,
    addToast
  } = useApp();

  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; hint?: string } | null>(null);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [liveOffers, setLiveOffers] = useState<Offer[]>([]);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'credentials' | 'liveOffers' | 'sqlSchema'>('credentials');
  const [isSaved, setIsSaved] = useState(false);

  // Load existing credentials on mount
  useEffect(() => {
    const creds = getSupabaseCredentials();
    if (creds.url) setUrl(creds.url);
    if (creds.anonKey) setAnonKey(creds.anonKey);

    if (creds.url && creds.anonKey) {
      loadLiveOffers();
    }
  }, []);

  const loadLiveOffers = async () => {
    setIsLoadingOffers(true);
    setOffersError(null);
    try {
      const res = await fetchOffersFromSupabase();
      if (res.error) {
        setOffersError(res.error);
      } else if (res.data) {
        setLiveOffers(res.data);
      }
    } catch (err: any) {
      setOffersError(err?.message || 'Failed to fetch offers from Supabase');
    } finally {
      setIsLoadingOffers(false);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      addToast('Validation Error', 'Please provide a valid Supabase Project URL.', 'error');
      return;
    }
    if (!anonKey.trim()) {
      addToast('Validation Error', 'Please provide your Supabase Anon API key.', 'error');
      return;
    }

    // Securely persist in browser client-side storage
    saveSupabaseCredentials(url.trim(), anonKey.trim());
    setIsSaved(true);
    addToast('Credentials Stored', 'Supabase credentials saved securely in browser session/local storage.', 'success');

    // Run connection test immediately
    setIsTesting(true);
    const result = await testSupabaseConnection();
    setIsTesting(false);
    setTestResult(result);

    if (result.success) {
      addToast('Connected to Supabase', 'Eligibility Engine and Offers table linked live!', 'success');
      loadLiveOffers();
    } else {
      addToast('Connection Check', result.message, 'warning');
    }

    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleClearCredentials = () => {
    const confirmed = window.confirm('Are you sure you want to remove stored Supabase credentials? The engine will revert to local offline cache.');
    if (confirmed) {
      clearSupabaseCredentials();
      setUrl('');
      setAnonKey('');
      setTestResult(null);
      setLiveOffers([]);
      addToast('Credentials Removed', 'Switched to local offline mode.', 'info');
      // Reload page to re-init empty client
      setTimeout(() => window.location.reload(), 600);
    }
  };

  const handleTestDirectly = async () => {
    setIsTesting(true);
    const result = await testSupabaseConnection();
    setIsTesting(false);
    setTestResult(result);
    if (result.success) {
      loadLiveOffers();
    }
  };

  const sqlSchemaSnippet = `-- PlaceFlow TPC PostgreSQL Database Schema for Supabase
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Offers Table for Eligibility Engine & Placement Records
CREATE TABLE IF NOT EXISTS public.offers (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_enrollment TEXT NOT NULL,
    student_branch TEXT NOT NULL,
    company_id TEXT,
    company_name TEXT NOT NULL,
    company_logo TEXT,
    role TEXT NOT NULL,
    package_lpa NUMERIC(5, 2) NOT NULL,
    offer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'Pending',
    policy_check_passed BOOLEAN NOT NULL DEFAULT true,
    policy_violation_reason TEXT,
    tier TEXT NOT NULL DEFAULT 'Core',
    deadline_date DATE NOT NULL,
    bond_years INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) & Grant Access
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to offers" ON public.offers FOR ALL USING (true) WITH CHECK (true);`;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Supabase Database Settings
            </h1>
            {isSupabaseConfigured ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Local Cache Mode
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Securely configure your Supabase Project URL and Anon API key to link your live <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">offers</code> table directly into the Eligibility Engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestDirectly}
            disabled={isTesting || !isSupabaseConfigured}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isTesting ? 'animate-spin' : ''}`} />
            <span>Test Connection</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('credentials')}
          className={`pb-3 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'credentials'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>API Credentials Form</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('liveOffers');
            loadLiveOffers();
          }}
          className={`pb-3 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'liveOffers'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Live Supabase 'offers' ({liveOffers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('sqlSchema')}
          className={`pb-3 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'sqlSchema'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>SQL Table Script</span>
        </button>
      </div>

      {/* TAB 1: Credentials Form */}
      {activeTab === 'credentials' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveCredentials} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Supabase Client Credentials
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Credentials are saved safely in your browser storage and used for live queries.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Client-Side Safe</span>
                </div>
              </div>

              {/* Supabase URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Supabase Project URL <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    id="supabase-project-url-input"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://your-project-id.supabase.co"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Found under Supabase Dashboard &gt; Project Settings &gt; API &gt; Project URL.
                </p>
              </div>

              {/* Supabase Anon Key */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Supabase Anon / Public API Key <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type={showKey ? 'text' : 'password'}
                    id="supabase-anon-key-input"
                    value={anonKey}
                    onChange={e => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    required
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Found under Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API Keys &gt; <code className="font-mono">anon</code> public key.
                </p>
              </div>

              {/* Test Result Message */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-bold text-xs">{testResult.success ? 'Connection Verified' : 'Connection Notice'}</div>
                    <div className="text-[11px] mt-0.5">{testResult.message}</div>
                    {testResult.hint && (
                      <div className="text-[11px] mt-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 font-normal leading-relaxed border border-black/5 dark:border-white/5">
                        <span className="font-semibold">💡 Recommendation: </span>
                        {testResult.hint}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={isTesting}
                  id="save-supabase-creds-btn"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
                >
                  {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>{isSaved ? 'Saved & Connected!' : 'Save & Connect Supabase'}</span>
                </button>

                {isSupabaseConfigured && (
                  <button
                    type="button"
                    onClick={handleClearCredentials}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Stored Keys</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Quick Guide Card */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Server className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs">How Live Queries Work</h4>
              </div>

              <div className="space-y-2.5 text-[11px] text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <p>When configured, the Eligibility Engine executes live SQL queries directly against your <code className="text-emerald-300 font-mono">offers</code> table.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <p>Real-time postgres change listeners immediately reflect any offer insertions, acceptances, or declines across the platform.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                  <p>Keys are stored only in your browser client state, keeping credentials private and isolated.</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
                <span>Free Supabase Tier Supported</span>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  Supabase Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Live Supabase Offers Query View */}
      {activeTab === 'liveOffers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                Live Query Result: <code className="font-mono text-emerald-600 dark:text-emerald-400">SELECT * FROM public.offers</code>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                {liveOffers.length} Rows
              </span>
            </div>

            <button
              onClick={loadLiveOffers}
              disabled={isLoadingOffers}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOffers ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh Table</span>
            </button>
          </div>

          {offersError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Supabase Query Notice</div>
                <div className="text-[11px] mt-0.5">{offersError}</div>
                <p className="mt-2 text-[11px]">Make sure the table <code className="font-mono font-bold">offers</code> exists in your Supabase database by running the SQL script provided in the <strong>SQL Table Script</strong> tab.</p>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                    <th className="py-3 px-4">Offer ID</th>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Company & Role</th>
                    <th className="py-3 px-4">Package (CTC)</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Offer Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {liveOffers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {isLoadingOffers ? (
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                            <span>Querying Supabase 'offers' table...</span>
                          </div>
                        ) : (
                          <span>No offers found in Supabase table. You can add offers from the Offers page or sync initial data.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    liveOffers.map(offer => (
                      <tr key={offer.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {offer.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{offer.studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{offer.studentEnrollment}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{offer.companyName}</div>
                          <div className="text-[10px] text-slate-400">{offer.role}</div>
                        </td>
                        <td className="py-3 px-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                          ₹{offer.packageLPA} LPA
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {offer.tier}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            offer.status === 'Accepted'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : offer.status === 'Declined'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}>
                            {offer.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                          {offer.offerDate}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SQL Table Script */}
      {activeTab === 'sqlSchema' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Run this SQL in your Supabase SQL Editor if you haven't initialized your <code className="font-mono text-emerald-600">offers</code> table yet:
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(sqlSchemaSnippet);
                addToast('SQL Copied', 'SQL Table script copied to clipboard.', 'success');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy SQL</span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200 font-mono text-[11px] p-4 max-h-96 overflow-y-auto leading-relaxed">
            <pre>{sqlSchemaSnippet}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
