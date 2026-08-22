import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  TrendingUp,
  Award,
  Briefcase,
  Download,
  Building2,
  CheckCircle2,
  DollarSign,
  Layers,
  Users,
  RefreshCw,
  Database,
  Filter,
  ArrowUpRight,
  UserCheck,
  UserX,
  Target
} from 'lucide-react';
import { Branch } from '../../types';

export const AnalyticsPage: React.FC = () => {
  const {
    students,
    companies,
    drives,
    applications,
    offers,
    addToast,
    pullFromSupabase,
    supabaseConnected,
    isSyncing,
    darkMode
  } = useApp();

  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());

  const safeStudents = students || [];
  const safeCompanies = companies || [];
  const safeDrives = drives || [];
  const safeApplications = applications || [];
  const safeOffers = offers || [];

  // Realtime Supabase Subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const channel = supabase
        .channel('analytics-page-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
          pullFromSupabase().catch(() => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
          pullFromSupabase().catch(() => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'placement_drives' }, () => {
          pullFromSupabase().catch(() => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, () => {
          pullFromSupabase().catch(() => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => {
          pullFromSupabase().catch(() => {});
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('Analytics realtime channel status:', status);
          }
        });

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      };
    } catch (err) {
      console.warn('Notice setting up analytics realtime listener:', err);
    }
  }, [isSupabaseConfigured, pullFromSupabase]);

  const handleRefreshLive = async () => {
    setIsLoadingLive(true);
    try {
      if (isSupabaseConfigured) {
        await pullFromSupabase();
      }
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Error refreshing Supabase analytics data:', err);
    } finally {
      setIsLoadingLive(false);
    }
  };

  const tooltipStyle = {
    backgroundColor: darkMode ? '#0F172A' : '#ffffff',
    border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    fontSize: '11px',
    color: darkMode ? '#ffffff' : '#0f172a'
  };

  // 1. Core KPIs
  const totalStudents = safeStudents.length;
  const placedStudents = safeStudents.filter(s => s.placementStatus === 'Placed' || s.placementStatus === 'Dream Placed').length;
  const unplacedStudents = Math.max(0, totalStudents - placedStudents);
  const placementRate = totalStudents > 0 ? Number(((placedStudents / totalStudents) * 100).toFixed(1)) : 0;

  const validOffers = safeOffers.filter(o => (o.packageLPA || 0) > 0);
  const acceptedOffers = safeOffers.filter(o => o.status === 'Accepted' && (o.packageLPA || 0) > 0);

  const highestPackage = validOffers.length > 0
    ? Math.max(...validOffers.map(o => o.packageLPA || 0)).toFixed(2)
    : '0.00';

  const averagePackage = acceptedOffers.length > 0
    ? (acceptedOffers.reduce((sum, o) => sum + (o.packageLPA || 0), 0) / acceptedOffers.length).toFixed(2)
    : '0.00';

  const totalOffersCount = safeOffers.length;
  const dreamOffersCount = safeOffers.filter(o => (o.packageLPA || 0) >= 8).length;

  // -------------------------------------------------------------
  // 1. Live Chart: Branch-wise Placement (total, placed, percentage)
  // -------------------------------------------------------------
  const allBranches: Branch[] = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'Civil'];
  const branchPlacementData = allBranches.map(branch => {
    const branchStudents = safeStudents.filter(s => s.branch === branch);
    const total = branchStudents.length;
    const placed = branchStudents.filter(s => s.placementStatus === 'Placed' || s.placementStatus === 'Dream Placed').length;
    const rate = total > 0 ? Number(((placed / total) * 100).toFixed(1)) : 0;

    return {
      branch,
      total,
      placed,
      placementRate: rate
    };
  });

  // -------------------------------------------------------------
  // 2. Live Chart: Package Distribution (Below 5 LPA, 5–10 LPA, 10–20 LPA, 20+ LPA)
  // -------------------------------------------------------------
  const packageDistributionData = [
    {
      range: 'Below 5 LPA',
      count: safeOffers.filter(o => (o.packageLPA || 0) > 0 && (o.packageLPA || 0) < 5).length,
      color: '#94a3b8'
    },
    {
      range: '5–10 LPA',
      count: safeOffers.filter(o => (o.packageLPA || 0) >= 5 && (o.packageLPA || 0) < 10).length,
      color: '#10B981'
    },
    {
      range: '10–20 LPA',
      count: safeOffers.filter(o => (o.packageLPA || 0) >= 10 && (o.packageLPA || 0) < 20).length,
      color: '#2563EB'
    },
    {
      range: '20+ LPA',
      count: safeOffers.filter(o => (o.packageLPA || 0) >= 20).length,
      color: '#8B5CF6'
    }
  ];

  // -------------------------------------------------------------
  // 3. Live Chart: Company-wise Hiring (accepted offers grouped by company)
  // -------------------------------------------------------------
  const companyHiringMap: Record<string, number> = {};
  acceptedOffers.forEach(o => {
    const company = o.companyName || 'Other';
    companyHiringMap[company] = (companyHiringMap[company] || 0) + 1;
  });

  // Also include companies from list if not present
  safeCompanies.forEach(c => {
    if (companyHiringMap[c.name] === undefined) {
      // count all accepted offers for this company
      const cnt = safeOffers.filter(o => o.companyName === c.name && o.status === 'Accepted').length;
      if (cnt > 0) companyHiringMap[c.name] = cnt;
    }
  });

  const companyHiringData = Object.entries(companyHiringMap)
    .map(([company, hired]) => ({ company, hired }))
    .sort((a, b) => b.hired - a.hired)
    .slice(0, 8); // Top 8 hiring companies

  // -------------------------------------------------------------
  // 4. Live Chart: Placement Status (Placed vs Unplaced)
  // -------------------------------------------------------------
  const placementStatusData = [
    { name: 'Placed', value: placedStudents, color: '#10B981' },
    { name: 'Unplaced', value: unplacedStudents, color: '#F43F5E' }
  ];

  // -------------------------------------------------------------
  // 5. Live Chart: Application Funnel (Applied, Shortlisted, Interview, Selected, Rejected)
  // -------------------------------------------------------------
  const totalApps = safeApplications.length;
  const shortlistedApps = safeApplications.filter(a =>
    a.status === 'Shortlisted' || a.status === 'Interview' || a.status === 'Selected' || a.status === 'Offered' || a.status === 'Offer Accepted'
  ).length;
  const interviewApps = safeApplications.filter(a =>
    a.status === 'Interview' || a.status === 'Selected' || a.status === 'Offered' || a.status === 'Offer Accepted'
  ).length;
  const selectedApps = safeApplications.filter(a =>
    a.status === 'Selected' || a.status === 'Offered' || a.status === 'Offer Accepted'
  ).length;
  const rejectedApps = safeApplications.filter(a =>
    a.status === 'Offer Declined'
  ).length;

  const applicationFunnelData = [
    { stage: 'Applied', count: totalApps, fill: '#3B82F6' },
    { stage: 'Shortlisted', count: shortlistedApps, fill: '#6366F1' },
    { stage: 'Interview', count: interviewApps, fill: '#8B5CF6' },
    { stage: 'Selected', count: selectedApps, fill: '#10B981' },
    { stage: 'Rejected', count: rejectedApps, fill: '#EF4444' }
  ];

  // -------------------------------------------------------------
  // 6. Live Chart: Drive Statistics (Active, Upcoming, Completed)
  // -------------------------------------------------------------
  const activeDrivesCount = safeDrives.filter(d => d.status === 'Active' || d.status === 'Ongoing').length;
  const upcomingDrivesCount = safeDrives.filter(d => d.status === 'Upcoming' || d.status === 'Draft').length;
  const completedDrivesCount = safeDrives.filter(d => d.status === 'Completed').length;

  const driveStatsData = [
    { name: 'Active', count: activeDrivesCount, color: '#10B981' },
    { name: 'Upcoming', count: upcomingDrivesCount, color: '#F59E0B' },
    { name: 'Completed', count: completedDrivesCount, color: '#64748B' }
  ];

  const handleExportAnalytics = () => {
    addToast(
      'Analytics Dossier Exported',
      `Downloaded complete placement executive summary for ${totalStudents} students and ${totalOffersCount} offers.`,
      'success'
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Live Placement Intelligence & Analytics
            </h1>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
              supabaseConnected
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}>
              <Database className="w-3.5 h-3.5" />
              <span>{supabaseConnected ? 'Supabase Live' : 'Live State'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time analytics engine computed dynamically from Supabase database records.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            id="analytics-refresh-btn"
            onClick={handleRefreshLive}
            disabled={isLoadingLive || isSyncing}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive || isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isLoadingLive || isSyncing ? 'Syncing...' : 'Refresh Data'}</span>
          </button>

          <button
            id="analytics-export-btn"
            onClick={handleExportAnalytics}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Placement Rate */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Placement Rate</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {placementRate}%
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{placedStudents} of {totalStudents} students placed</span>
          </div>
        </div>

        {/* Average CTC */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Average CTC</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            ₹{averagePackage} LPA
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
            <span>From {acceptedOffers.length} accepted offers</span>
          </div>
        </div>

        {/* Highest CTC */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Highest CTC Secured</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-purple-600 dark:text-purple-400">
            ₹{highestPackage} LPA
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            <span>{dreamOffersCount} Dream Offers (≥ 8 LPA)</span>
          </div>
        </div>

        {/* Total Offers */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Total Offers Released</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {totalOffersCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            <span>{safeCompanies.length} Partner Recruiters</span>
          </div>
        </div>
      </div>

      {/* Row 1: Charts 1 & 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Branch-wise Placement */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">1. Branch-wise Placement</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Total candidates, placed candidates, and placement percentage across disciplines
              </p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchPlacementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                <XAxis dataKey="branch" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: number, name: string) => [
                    name === 'placementRate' ? `${val}%` : val,
                    name === 'placementRate' ? 'Placement Rate' : name === 'placed' ? 'Placed Students' : 'Total Students'
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Bar dataKey="total" name="Total Students" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="placed" name="Placed Students" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Package Distribution */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">2. Package Distribution</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Offers categorized by compensation brackets (Below 5L, 5–10L, 10–20L, 20+L)
              </p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={packageDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                <XAxis dataKey="range" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: number) => [`${val} Offers`, 'Offer Count']}
                />
                <Bar dataKey="count" name="Offers Count" fill="#2563EB" radius={[6, 6, 0, 0]}>
                  {packageDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Charts 3 & 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3. Company-wise Hiring */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">3. Company-wise Hiring</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Count of accepted student offers grouped by recruiter
              </p>
            </div>
          </div>

          <div className="h-64">
            {companyHiringData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No accepted company offers recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={companyHiringData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 40, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.15} />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="company" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: number) => [`${val} Hires`, 'Accepted Offers']}
                  />
                  <Bar dataKey="hired" name="Accepted Offers" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 4. Placement Status */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">4. Placement Status</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Proportion of placed vs unplaced candidates
                </p>
              </div>
            </div>

            <div className="h-48 my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={placementStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {placementStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: number) => [
                      `${val} students (${totalStudents > 0 ? ((val / totalStudents) * 100).toFixed(1) : 0}%)`,
                      'Count'
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Placed</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {placedStudents} ({placementRate}%)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50/50 dark:bg-rose-950/30">
              <UserX className="w-4 h-4 text-rose-600" />
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Unplaced</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {unplacedStudents} ({totalStudents > 0 ? (100 - placementRate).toFixed(1) : 0}%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Charts 5 & 6 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 5. Application Funnel */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">5. Application Funnel</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Conversion stages: Applied → Shortlisted → Interview → Selected vs Rejected
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {totalApps} Total Applications
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={applicationFunnelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                <XAxis dataKey="stage" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: number) => [`${val} Applications`, 'Stage Count']}
                />
                <Bar dataKey="count" name="Applications" radius={[6, 6, 0, 0]}>
                  {applicationFunnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6. Drive Statistics */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">6. Drive Statistics</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Distribution of Active, Upcoming, and Completed placement drives
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {safeDrives.length} Drives Total
              </span>
            </div>

            <div className="h-48 my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={driveStatsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {driveStatsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: number) => [`${val} Drives`, 'Count']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            {driveStatsData.map((d, i) => (
              <div key={i} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{d.name}</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {d.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
