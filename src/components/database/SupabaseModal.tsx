import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  clearSupabaseCredentials
} from '../../lib/supabase';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  X,
  Layers,
  Code2,
  Terminal,
  ShieldCheck,
  Server,
  Key,
  Globe,
  Save,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const {
    isSupabaseConfigured,
    supabaseConnected,
    isSyncing,
    testConnection,
    syncAllToSupabase,
    pullFromSupabase,
    addToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'credentials' | 'status' | 'sql' | 'guide'>('credentials');
  const [urlInput, setUrlInput] = useState('');
  const [anonKeyInput, setAnonKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; hint?: string } | null>(null);

  useEffect(() => {
    const creds = getSupabaseCredentials();
    if (creds.url) setUrlInput(creds.url);
    if (creds.anonKey) setAnonKeyInput(creds.anonKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !anonKeyInput.trim()) {
      addToast('Validation', 'Please provide both URL and Anon Key', 'warning');
      return;
    }
    saveSupabaseCredentials(urlInput.trim(), anonKeyInput.trim());
    addToast('Credentials Stored', 'Supabase credentials saved securely.', 'success');
    setTesting(true);
    const result = await testConnection();
    setTestResult(result);
    setTesting(false);
    if (result.success) {
      addToast('Connected to Supabase', 'Eligibility Engine linked live.', 'success');
    }
  };

  const handleClearCredentials = () => {
    clearSupabaseCredentials();
    setUrlInput('');
    setAnonKeyInput('');
    setTestResult(null);
    addToast('Credentials Removed', 'Reverted to local storage mode.', 'info');
    setTimeout(() => window.location.reload(), 400);
  };

  const sqlSchemaSnippet = `-- PlaceFlow TPC PostgreSQL Database Schema for Supabase
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enrollment_number TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    branch TEXT NOT NULL CHECK (branch IN ('CSE', 'IT', 'ECE', 'EE', 'ME', 'Civil')),
    cgpa NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    backlogs INTEGER NOT NULL DEFAULT 0,
    attendance INTEGER NOT NULL DEFAULT 100,
    placement_status TEXT NOT NULL DEFAULT 'Unplaced',
    offers JSONB DEFAULT '[]'::jsonb,
    graduation_year INTEGER NOT NULL DEFAULT 2026,
    skills JSONB DEFAULT '[]'::jsonb,
    gender TEXT,
    resume_url TEXT,
    avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    industry TEXT NOT NULL,
    tier TEXT NOT NULL,
    open_drives_count INTEGER DEFAULT 0,
    average_package NUMERIC(5, 2) DEFAULT 0.00,
    min_package NUMERIC(5, 2) DEFAULT 0.00,
    max_package NUMERIC(5, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'Active',
    website TEXT,
    location TEXT,
    contact_person TEXT,
    contact_email TEXT,
    total_hired_history INTEGER DEFAULT 0,
    logo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Placement Drives Table
CREATE TABLE IF NOT EXISTS public.placement_drives (
    id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    company_logo TEXT,
    role TEXT NOT NULL,
    job_description TEXT,
    package_lpa NUMERIC(5, 2) NOT NULL,
    tier TEXT NOT NULL,
    min_cgpa NUMERIC(4, 2) NOT NULL DEFAULT 6.00,
    max_backlogs INTEGER NOT NULL DEFAULT 0,
    eligible_branches JSONB NOT NULL DEFAULT '["CSE", "IT", "ECE"]'::jsonb,
    min_attendance INTEGER NOT NULL DEFAULT 75,
    graduation_year INTEGER NOT NULL DEFAULT 2026,
    offer_policy_rule TEXT NOT NULL DEFAULT 'Dream Upgrade Only (>= 1.5x)',
    drive_date DATE NOT NULL,
    registration_deadline DATE NOT NULL,
    location TEXT DEFAULT 'On-Campus',
    status TEXT NOT NULL DEFAULT 'Active',
    rounds JSONB DEFAULT '["Online Assessment", "Technical Interview", "HR Interview"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Applications Table
CREATE TABLE IF NOT EXISTS public.applications (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_enrollment TEXT NOT NULL,
    student_branch TEXT NOT NULL,
    student_cgpa NUMERIC(4, 2) NOT NULL,
    student_attendance INTEGER NOT NULL,
    drive_id TEXT NOT NULL REFERENCES public.placement_drives(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    company_logo TEXT,
    role TEXT NOT NULL,
    package_lpa NUMERIC(5, 2) NOT NULL,
    applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
    eligibility_status TEXT NOT NULL DEFAULT 'Eligible',
    ineligibility_reasons JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'Applied',
    current_round TEXT,
    interview_slot TEXT,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Offers Table
CREATE TABLE IF NOT EXISTS public.offers (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
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

-- 7. Policy Table
CREATE TABLE IF NOT EXISTS public.offer_policy (
    id TEXT PRIMARY KEY DEFAULT 'default-policy',
    allow_multiple_offers BOOLEAN NOT NULL DEFAULT true,
    max_offers_allowed INTEGER NOT NULL DEFAULT 2,
    dream_threshold_lpa NUMERIC(5, 2) NOT NULL DEFAULT 8.00,
    super_dream_threshold_lpa NUMERIC(5, 2) NOT NULL DEFAULT 14.00,
    min_hike_percentage_for_upgrade NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    freeze_on_acceptance BOOLEAN NOT NULL DEFAULT true,
    mass_recruiter_lock BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Eligibility Results Table
CREATE TABLE IF NOT EXISTS public.eligibility_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    drive_id TEXT NOT NULL REFERENCES public.placement_drives(id) ON DELETE CASCADE,
    eligible BOOLEAN NOT NULL,
    reasons JSONB DEFAULT '[]'::jsonb,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, drive_id)
);

-- 9. Enable Row Level Security (RLS) & Grant Access
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eligibility_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to students" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to companies" ON public.companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to drives" ON public.placement_drives FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to applications" ON public.applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to offers" ON public.offers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to offer_policy" ON public.offer_policy FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to eligibility_results" ON public.eligibility_results FOR ALL USING (true) WITH CHECK (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaSnippet);
    setCopiedSql(true);
    addToast('SQL Copied', 'Supabase SQL schema copied to clipboard!', 'success');
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleTest = async () => {
    setTesting(true);
    const result = await testConnection();
    setTestResult(result);
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] my-auto animate-in zoom-in-95 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  Supabase PostgreSQL Database
                </h3>
                {isSupabaseConfigured ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Configured
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center gap-1 border border-amber-200 dark:border-amber-800/60">
                    Local Storage Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Connect and synchronize PlaceFlow candidate records, drives, and offers with Supabase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-4 sm:px-5 pt-3 border-b border-slate-100 dark:border-slate-800 gap-2 overflow-x-auto shrink-0 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`pb-3 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'credentials'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Credentials Form</span>
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-3 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'status'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Connection & Sync</span>
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`pb-3 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'sql'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>SQL Schema Script</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-3 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Setup Guide</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1 min-h-0">
          {activeTab === 'credentials' && (
            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-slate-800 dark:text-slate-200">Supabase API Keys</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Stored safely in browser</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Project URL:
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Anon / Public Key:
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={anonKeyInput}
                      onChange={e => setAnonKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      required
                      className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2 ${
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
                    <div className="font-bold">{testResult.success ? 'Verified' : 'Notice'}</div>
                    <div className="text-[11px] mt-0.5">{testResult.message}</div>
                    {testResult.hint && (
                      <div className="text-[11px] mt-1.5 p-2 rounded-lg bg-black/5 dark:bg-white/5 font-normal leading-relaxed border border-black/5 dark:border-white/5">
                        💡 {testResult.hint}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="submit"
                  disabled={testing}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{testing ? 'Connecting...' : 'Save & Link Supabase'}</span>
                </button>

                {isSupabaseConfigured && (
                  <button
                    type="button"
                    onClick={handleClearCredentials}
                    className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Keys</span>
                  </button>
                )}
              </div>
            </form>
          )}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Supabase Project Status:</span>
                  <div className="flex items-center gap-1.5">
                    {isSupabaseConfigured ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Credentials Provided
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> Not Linked (Running on Local Cache)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span>Environment Variables:</span>
                  <code className="text-[11px] font-mono bg-slate-200/80 dark:bg-slate-900 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">
                    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
                  </code>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex flex-col items-center justify-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 text-blue-600 ${testing ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>

                <button
                  onClick={async () => {
                    await syncAllToSupabase();
                  }}
                  disabled={isSyncing}
                  className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 flex flex-col items-center justify-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 transition-colors"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  <span>Push Data to Supabase</span>
                </button>

                <button
                  onClick={async () => {
                    await pullFromSupabase();
                  }}
                  disabled={isSyncing}
                  className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex flex-col items-center justify-center gap-1.5 font-bold text-indigo-800 dark:text-indigo-300 transition-colors"
                >
                  <DownloadCloud className="w-4 h-4 text-indigo-600" />
                  <span>Pull from Supabase</span>
                </button>
              </div>

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
                    <div className="font-bold">{testResult.success ? 'Connection Validated' : 'Connection Notice'}</div>
                    <div className="text-[11px] mt-0.5">{testResult.message}</div>
                    {testResult.hint && (
                      <div className="text-[11px] mt-1.5 p-2 rounded-lg bg-black/5 dark:bg-white/5 font-normal leading-relaxed border border-black/5 dark:border-white/5">
                        💡 {testResult.hint}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Information callout */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-blue-900 dark:text-blue-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Offline-First & Cloud-Ready Architecture
                </p>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                  PlaceFlow works seamlessly in local storage mode out-of-the-box. When you add your Supabase URL and Anon Key, all candidates, placement drives, applications, and offer records automatically sync to your cloud PostgreSQL database.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-slate-600 dark:text-slate-400 font-medium">
                  Execute this SQL in your Supabase SQL Editor to initialize all tables, RLS policies, and views:
                </p>
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
                </button>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200 font-mono text-[11px] max-h-72 overflow-y-auto p-4 leading-relaxed">
                <pre>{sqlSchemaSnippet}</pre>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Create a Supabase Project</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Log in to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-3 h-3" /></a> and create a new project.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Run the Database SQL Schema</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Navigate to the <strong>SQL Editor</strong> tab in your Supabase dashboard, paste the SQL schema from the <strong>SQL Schema Script</strong> tab, and click <strong>Run</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Set Environment Variables</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Go to Project Settings &gt; API in Supabase. Copy your Project URL and Anon API key, and configure them in <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">.env</code>:
                    </p>
                    <div className="mt-2 p-2 rounded bg-slate-900 text-emerald-400 font-mono text-[10px]">
                      VITE_SUPABASE_URL=https://xyzcompany.supabase.co<br />
                      VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/75 dark:bg-slate-900/75 backdrop-blur-xs shrink-0">
          <span className="text-[11px] text-slate-400">
            Database Schema: <code className="font-mono">supabase/schema.sql</code>
          </span>
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
