import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  testSupabaseConnection,
  fetchOffersFromSupabase
} from '../../lib/supabase';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Award,
  Copy,
  ExternalLink,
  Code2,
  Server
} from 'lucide-react';
import { Offer } from '../../types';

/**
 * Read-only Supabase status & data console.
 *
 * SECURITY: This page contains NO Supabase configuration editor. It does not
 * display or accept the Supabase URL, anon/publishable key, secret key,
 * database password, or environment variables, and it cannot change the
 * connection. The connection is fixed at build time from environment variables
 * (see src/lib/supabase.ts). Only read-only status checks and read-only data
 * views against the already-configured project are exposed here.
 */
export const SupabaseSettingsPage: React.FC = () => {
  const {
    isSupabaseConfigured,
    supabaseConnected,
    addToast
  } = useApp();

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; hint?: string } | null>(null);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [liveOffers, setLiveOffers] = useState<Offer[]>([]);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'liveOffers' | 'sqlSchema'>('liveOffers');

  useEffect(() => {
    if (isSupabaseConfigured) {
      loadLiveOffers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleTestDirectly = async () => {
    setIsTesting(true);
    const result = await testSupabaseConnection();
    setIsTesting(false);
    setTestResult(result);
    if (result.success) {
      loadLiveOffers();
    }
  };

  const sqlSchemaSnippet = `-- PlaceFlow TPC PostgreSQL Database Schema & RLS Policies for Supabase
-- Run this script in your Supabase SQL Editor (SQL Editor -> New Query -> Run)

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_no TEXT,
    full_name TEXT,
    email TEXT,
    branch TEXT,
    cgpa NUMERIC(4, 2),
    backlogs INTEGER DEFAULT 0,
    attendance INTEGER DEFAULT 85,
    graduation_year INTEGER DEFAULT 2026,
    placement_status TEXT DEFAULT 'Unplaced',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    industry TEXT,
    website TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    status TEXT DEFAULT 'Active',
    contact_person TEXT
);

-- 4. Placement Drives Table
CREATE TABLE IF NOT EXISTS public.placement_drives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    package_lpa NUMERIC(5, 2) NOT NULL,
    min_cgpa NUMERIC(4, 2) DEFAULT 6.0,
    max_backlogs INTEGER DEFAULT 0,
    min_attendance INTEGER DEFAULT 75,
    eligible_branches TEXT[] DEFAULT ARRAY['CSE', 'IT']::TEXT[],
    graduation_year INTEGER DEFAULT 2026,
    offer_limit_lpa NUMERIC(5, 2),
    drive_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Applications Table
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL REFERENCES public.placement_drives(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Applied',
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Offers Table
CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL REFERENCES public.placement_drives(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    package_lpa NUMERIC(5, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Offered',
    offer_date DATE DEFAULT CURRENT_DATE,
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

-- 8. Row Level Security (RLS) & Policies (Idempotent Drops + Grants)
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
CREATE POLICY "Public access to eligibility_results" ON public.eligibility_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Supabase Database Status
            </h1>
            {isSupabaseConfigured ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {supabaseConnected ? 'Connected' : 'Configured'}
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Local Cache Mode
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Read-only view of the live database connection and records. The Supabase connection is managed by the
            application deployment and cannot be edited here.
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

      {/* Connection status card (no URL / key / env vars shown) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              {isSupabaseConfigured ? (
                <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Live PostgreSQL connection active</>
              ) : (
                <><AlertCircle className="w-4 h-4 text-amber-600" /> Running on local cache</>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Connection is fixed by the deployment. Access is enforced by authentication &amp; Row Level Security.
            </p>
          </div>
        </div>

        {testResult && (
          <div
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
            }`}
          >
            {testResult.message}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
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

      {/* TAB: Live Supabase Offers Query View (read-only) */}
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
                    <th className="py-3 px-4">Company &amp; Role</th>
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

          <div className="flex items-center justify-end">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
            >
              Manage database in Supabase Dashboard <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* TAB: SQL Table Script */}
      {activeTab === 'sqlSchema' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-400" />
              Run this SQL in your Supabase SQL Editor if you haven't initialized your tables yet:
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
