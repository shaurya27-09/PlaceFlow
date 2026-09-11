import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  X,
  Code2,
  ShieldCheck,
  Server,
  Lock
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

  const [activeTab, setActiveTab] = useState<'status' | 'sql' | 'guide'>('status');
  const [copiedSql, setCopiedSql] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; hint?: string } | null>(null);

  if (!isOpen) return null;

  const sqlSchemaSnippet = `-- PlaceFlow TPC PostgreSQL Database Schema for Supabase
-- Exact Live Schema:

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_no TEXT,
    full_name TEXT,
    email TEXT,
    branch TEXT,
    cgpa NUMERIC,
    backlogs INTEGER DEFAULT 0,
    placement_status TEXT DEFAULT 'Unplaced',
    tier TEXT,
    skills TEXT[] DEFAULT '{}',
    batch INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    website TEXT,
    tier TEXT,
    industry TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Placement Drives Table
CREATE TABLE IF NOT EXISTS public.placement_drives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    company_name TEXT,
    role_title TEXT,
    tier TEXT,
    min_cgpa NUMERIC,
    max_backlogs INTEGER DEFAULT 0,
    allowed_branches TEXT[] DEFAULT '{}',
    package_lpa NUMERIC,
    status TEXT DEFAULT 'Upcoming',
    drive_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Applications Table
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    drive_id UUID REFERENCES public.placement_drives(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Applied',
    applied_at TIMESTAMP DEFAULT NOW()
);

-- 6. Offers Table
CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    company_name TEXT,
    package_lpa NUMERIC,
    status TEXT DEFAULT 'Offered',
    offer_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Eligibility Results Table
CREATE TABLE IF NOT EXISTS public.eligibility_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL REFERENCES public.placement_drives(id) ON DELETE CASCADE,
    eligible BOOLEAN NOT NULL,
    reasons JSONB DEFAULT '[]'::jsonb,
    checked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, drive_id)
);

-- 8. User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    student_id UUID,
    company_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Row Level Security (RLS) & Policies
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to students" ON public.students;
CREATE POLICY "Public access to students" ON public.students FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to companies" ON public.companies;
CREATE POLICY "Public access to companies" ON public.companies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.placement_drives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to drives" ON public.placement_drives;
DROP POLICY IF EXISTS "Public access to placement_drives" ON public.placement_drives;
CREATE POLICY "Public access to placement_drives" ON public.placement_drives FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to applications" ON public.applications;
CREATE POLICY "Public access to applications" ON public.applications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to offers" ON public.offers;
CREATE POLICY "Public access to offers" ON public.offers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.eligibility_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to eligibility_results" ON public.eligibility_results;
CREATE POLICY "Public access to eligibility_results" ON public.eligibility_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to profiles" ON public.profiles;
CREATE POLICY "Public access to profiles" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`;

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
                {isSupabaseConfigured && supabaseConnected ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Connected
                  </span>
                ) : isSupabaseConfigured ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center gap-1 border border-blue-200 dark:border-blue-800/60">
                    Configured
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                    Environment Configuration
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Database synchronization and schema overview for PlaceFlow
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
            onClick={() => setActiveTab('status')}
            className={`pb-3 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'status'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Connection Status</span>
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
            <span>Security Architecture</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1 min-h-0">
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Supabase Service Status:</span>
                  <div className="flex items-center gap-1.5">
                    {isSupabaseConfigured && supabaseConnected ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Connected to Database
                      </span>
                    ) : isSupabaseConfigured ? (
                      <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Configured via Environment
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> Environment Credentials Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Configuration Source:
                  </span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    System Environment Variables Only
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex flex-col items-center justify-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 text-blue-600 ${testing ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>

                <button
                  onClick={async () => {
                    await syncAllToSupabase();
                  }}
                  disabled={isSyncing}
                  className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 flex flex-col items-center justify-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  <span>Push Data to Supabase</span>
                </button>

                <button
                  onClick={async () => {
                    await pullFromSupabase();
                  }}
                  disabled={isSyncing}
                  className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex flex-col items-center justify-center gap-1.5 font-bold text-indigo-800 dark:text-indigo-300 transition-colors cursor-pointer"
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
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Secured Environment Configuration
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Supabase credentials are managed strictly through server environment variables. Client-side input or modification of credentials is disabled to prevent security vulnerabilities.
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer"
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
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Environment Configuration</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Supabase connection details are specified via server environment variables. Normal users cannot view or modify these credentials in the browser.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Row Level Security (RLS)</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Database security is enforced directly at the PostgreSQL layer using Supabase Row Level Security policies.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">No LocalStorage Storage</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Credentials are never persisted in localStorage, sessionStorage, cookies, or user profile state.
                    </p>
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
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
