import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Users,
  Briefcase,
  Award,
  TrendingUp,
  Building2,
  FileCheck,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronRight,
  Bot,
  Calendar,
  RefreshCw,
  Database,
  ArrowUpRight,
  Percent
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { Branch } from '../../types';

interface AdminDashboardProps {
  onOpenCreateDrive: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenCreateDrive }) => {
  const {
    students,
    companies,
    drives,
    applications,
    offers,
    setCurrentView,
    setSelectedDriveForEligibility,
    evaluateEligibility,
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
  const safeOffers = offers || [];
  const safeApplications = applications || [];

  // Live Supabase Realtime Subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const channel = supabase
        .channel('admin-dashboard-realtime')
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
            console.warn('Realtime channel status:', status);
          }
        });

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      };
    } catch (err) {
      console.warn('Notice setting up Supabase realtime channel:', err);
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
      console.error('Supabase fetch error on manual refresh:', err);
    } finally {
      setIsLoadingLive(false);
    }
  };

  // 1. Total Students: Count rows from students
  const totalStudents = safeStudents.length;

  // 2. Total Companies: Count rows from companies
  const totalCompanies = safeCompanies.length;

  // 3. Active Drives: Count placement_drives where status is Active or Upcoming
  const activeDrivesCount = safeDrives.filter(d => d.status === 'Active' || d.status === 'Upcoming' || d.status === 'Ongoing').length;
  const activeOnlyDrives = safeDrives.filter(d => d.status === 'Active' || d.status === 'Ongoing');
  const upcomingOnlyDrives = safeDrives.filter(d => d.status === 'Upcoming');

  // 4. Students Placed: Count students where placement_status = 'Placed'
  const studentsPlaced = safeStudents.filter(s => s.placementStatus === 'Placed' || s.placementStatus === 'Dream Placed').length;

  // 5. Placement Rate: students placed / total students * 100 (rounded to one decimal place)
  const placementRate = totalStudents > 0 ? ((studentsPlaced / totalStudents) * 100).toFixed(1) : '0.0';

  // 6. Highest Package: Calculate MAX(package_lpa) from accepted/offered valid offers
  const validOffers = safeOffers.filter(o => (o.packageLPA || 0) > 0);
  const highestPackageNum = validOffers.length > 0 ? Math.max(...validOffers.map(o => o.packageLPA || 0)) : 0;
  const highestPackage = highestPackageNum > 0 ? highestPackageNum.toFixed(2) : '0.00';
  const highestOfferRecord = validOffers.find(o => o.packageLPA === highestPackageNum);

  // 7. Average Package: Calculate AVG(package_lpa) from accepted offers
  const acceptedOffers = safeOffers.filter(o => o.status === 'Accepted' && (o.packageLPA || 0) > 0);
  const averagePackageNum = acceptedOffers.length > 0
    ? acceptedOffers.reduce((sum, o) => sum + (o.packageLPA || 0), 0) / acceptedOffers.length
    : 0;
  const averagePackage = averagePackageNum > 0 ? averagePackageNum.toFixed(2) : '0.00';

  // Median Package: Calculate MEDIAN(package_lpa) from accepted offers
  const acceptedSalaryList = (acceptedOffers.length > 0 ? acceptedOffers : validOffers)
    .map(o => Number(o.packageLPA))
    .sort((a, b) => a - b);
  let medianPackageNum = 0;
  if (acceptedSalaryList.length > 0) {
    const mid = Math.floor(acceptedSalaryList.length / 2);
    medianPackageNum = acceptedSalaryList.length % 2 !== 0 ? acceptedSalaryList[mid] : (acceptedSalaryList[mid - 1] + acceptedSalaryList[mid]) / 2;
  }
  const medianPackage = medianPackageNum > 0 ? medianPackageNum.toFixed(2) : '0.00';

  // 8. Total Offers: Count offers
  const totalOffers = safeOffers.length;

  // Chart 1: Monthly Placement Trajectory computed from live offers / students data
  const monthOrder = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const monthCounts: Record<string, { totalPlaced: number; totalPkg: number; count: number }> = {};
  monthOrder.forEach(m => {
    monthCounts[m] = { totalPlaced: 0, totalPkg: 0, count: 0 };
  });

  safeOffers.forEach(offer => {
    if (!offer.offerDate) return;
    try {
      const d = new Date(offer.offerDate);
      if (!isNaN(d.getTime())) {
        const monthShort = d.toLocaleString('default', { month: 'short' });
        if (monthCounts[monthShort]) {
          monthCounts[monthShort].totalPlaced += (offer.status === 'Accepted' || offer.status === 'Offered' ? 1 : 0);
          monthCounts[monthShort].totalPkg += (offer.packageLPA || 0);
          monthCounts[monthShort].count += 1;
        }
      }
    } catch {}
  });

  // Calculate cumulative trajectory
  let runningPlaced = 0;
  const placementTrendData = monthOrder.slice(0, 7).map(month => {
    runningPlaced += monthCounts[month]?.totalPlaced || 0;
    const avg = (monthCounts[month]?.count || 0) > 0
      ? Number(((monthCounts[month]?.totalPkg || 0) / (monthCounts[month]?.count || 1)).toFixed(1))
      : 0;
    return {
      month,
      totalPlaced: runningPlaced,
      avgPackage: avg
    };
  });

  // Chart 2: Branch-wise Placed vs Total computed dynamically from live students
  const standardBranches: Branch[] = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'Civil'];
  const branchPlacementData = standardBranches.map(branchName => {
    const bStudents = safeStudents.filter(s => s.branch === branchName);
    const total = bStudents.length;
    const placed = bStudents.filter(s => s.placementStatus === 'Placed' || s.placementStatus === 'Dream Placed').length;
    const rate = total > 0 ? Number(((placed / total) * 100).toFixed(1)) : 0;
    return {
      branch: branchName,
      total,
      placed,
      rate
    };
  });

  // Recent drives from Supabase
  const recentDrives = safeDrives.slice(0, 6);

  // Dynamic AI Insight metrics
  const topBranch = [...branchPlacementData].sort((a, b) => b.rate - a.rate)[0] || { branch: 'CSE', rate: 0 };
  const superDreamCount = safeOffers.filter(o => (o.packageLPA || 0) >= 14).length;
  const dreamRatio = totalOffers > 0 ? ((superDreamCount / totalOffers) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Sync Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                Live Placement Control Center
              </h2>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                supabaseConnected
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              }`}>
                <Database className="w-3 h-3" />
                <span>{supabaseConnected ? 'Supabase Live Sync' : 'Live Data Engine'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live statistics calculated dynamically from Supabase database tables.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden md:inline">
            Updated: {lastRefreshed}
          </span>
          <button
            id="admin-dashboard-refresh-btn"
            onClick={handleRefreshLive}
            disabled={isLoadingLive || isSyncing}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive || isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isLoadingLive || isSyncing ? 'Syncing...' : 'Refresh Live'}</span>
          </button>
        </div>
      </div>

      {/* DASHBOARD CARDS: 8 dynamic live cards organized into responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Students */}
        <div
          id="dashboard-card-total-students"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-600 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Total Students
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
              {totalStudents}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Registered across 6 branches</span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Enrolled in Batch 2026</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">Live Count</span>
          </div>
        </div>

        {/* Card 2: Total Companies */}
        <div
          id="dashboard-card-total-companies"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-cyan-400 dark:hover:border-cyan-600 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Total Companies
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
              {totalCompanies}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                {safeCompanies.filter(c => c.status === 'Active').length} Active
              </span>
              <span className="text-slate-400">corporate recruiters</span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Super Dream / Dream / Core</span>
            <span className="font-semibold text-cyan-600 dark:text-cyan-400">Partners</span>
          </div>
        </div>

        {/* Card 3: Active Drives */}
        <div
          id="dashboard-card-active-drives"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-amber-400 dark:hover:border-amber-600 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Active Drives
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
              {activeDrivesCount}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                {activeOnlyDrives.length} Ongoing
              </span>
              <span className="text-slate-400">· {upcomingOnlyDrives.length} Upcoming</span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
            <span>{safeDrives.length} Total Registered</span>
            <button
              onClick={() => setCurrentView('drives')}
              className="font-semibold text-amber-600 dark:text-amber-400 hover:underline"
            >
              Manage →
            </button>
          </div>
        </div>

        {/* Card 4: Total Offers */}
        <div
          id="dashboard-card-total-offers"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-violet-400 dark:hover:border-violet-600 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Total Offers
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
              {totalOffers}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-violet-600 dark:text-violet-400 font-bold">
                {acceptedOffers.length} Accepted
              </span>
              <span className="text-slate-400">by candidates</span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
            <span>{safeOffers.filter(o => o.status === 'Offered' || o.status === 'Pending').length} Pending Acceptance</span>
            <button
              onClick={() => setCurrentView('offers')}
              className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              View Offers →
            </button>
          </div>
        </div>

        {/* Card 5: Students Placed */}
        <div
          id="dashboard-card-students-placed"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-600 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Students Placed
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
              {studentsPlaced}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {totalStudents - studentsPlaced} remaining
              </span>
              <span className="text-slate-400">in current drive pool</span>
            </div>
          </div>
          <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, Number(placementRate)))}%` }}
            />
          </div>
        </div>

        {/* Card 6: Placement Rate */}
        <div
          id="dashboard-card-placement-rate"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-600 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Placement Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
              {placementRate}%
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {studentsPlaced}/{totalStudents}
              </span>
              <span className="text-slate-400">candidates secured</span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Target: 90.0%</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Live Rate</span>
          </div>
        </div>

        {/* Card 7: Average Package */}
        <div
          id="dashboard-card-avg-package"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-600 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Average Package
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
              ₹{averagePackage} <span className="text-base font-semibold text-slate-500">LPA</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                {acceptedOffers.length} Accepted Offers
              </span>
              <span className="text-slate-400">calculated</span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Median Package: ₹{medianPackage} LPA</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">AVG CTC</span>
          </div>
        </div>

        {/* Card 8: Highest Package */}
        <div
          id="dashboard-card-highest-package"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-purple-400 dark:hover:border-purple-600 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Highest Package
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tighter">
              ₹{highestPackage} <span className="text-base font-semibold text-slate-500">LPA</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                {highestPackageNum >= 14 ? 'Super Dream' : highestPackageNum >= 8 ? 'Dream' : 'Core'} Tier
              </span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {highestOfferRecord ? `${highestOfferRecord.studentName} (${highestOfferRecord.companyName})` : 'Awaiting offers'}
          </div>
        </div>
      </div>

      {/* Row 2: Charts & PlaceFlow AI Insights Box */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Main Chart Bento: Season Trajectory (col-span-8) */}
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Placement Season Progression & Branch Performance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cumulative students placed and department breakdown from Supabase live records
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('analytics')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                <span>Full Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Area Chart: Progression */}
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Monthly Placement Trajectory
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={placementTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="placedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.2)" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                        borderRadius: '12px',
                        border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                      itemStyle={{ color: darkMode ? '#cbd5e1' : '#334155' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalPlaced"
                      name="Students Placed"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#placedGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart: Branch Breakdown */}
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Branch-wise Placed vs Total
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchPlacementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.2)" />
                    <XAxis dataKey="branch" stroke="#9ca3af" fontSize={11} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                        borderRadius: '12px',
                        border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                        color: darkMode ? '#ffffff' : '#0f172a'
                      }}
                      itemStyle={{ color: darkMode ? '#cbd5e1' : '#334155' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                    <Bar dataKey="total" name="Total Students" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="placed" name="Placed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* PlaceFlow AI Insights Bento Card (col-span-4) */}
        <div className="xl:col-span-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl pointer-events-none"></div>

          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse"></span>
                <h3 className="font-bold text-sm text-white tracking-wide">PlaceFlow AI Insights</h3>
              </div>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                Live Analysis
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="bg-slate-800/80 p-3.5 rounded-xl border-l-4 border-blue-500 text-xs text-slate-300">
                <p className="italic font-medium text-slate-200">
                  "{topBranch.branch} leads with {topBranch.rate}% placement rate across {safeStudents.filter(s => s.branch === topBranch.branch).length} candidates."
                </p>
                <span className="block mt-1 text-[10px] text-slate-400 font-sans">
                  Super Dream ratio: {dreamRatio}% of released offers
                </span>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-xl border-l-4 border-amber-500 text-xs text-slate-300">
                <p className="italic font-medium text-slate-200">
                  "Policy Engine: Automated upgrade rules requiring 1.5× hike active for subsequent tier applications."
                </p>
                <span className="block mt-1 text-[10px] text-slate-400 font-sans">
                  Active Drives in Flight: {activeDrivesCount}
                </span>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-xl border-l-4 border-emerald-500 text-xs text-slate-300">
                <p className="italic font-medium text-slate-200">
                  "Overall institutional placement rate is currently at {placementRate}% with ₹{averagePackage} LPA Average CTC."
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800">
            <button
              onClick={() => setCurrentView('ai')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm shadow-blue-500/30 transition-all group"
            >
              <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Query Assistant with Natural Language</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bento Grid Row 3: Upcoming Placement Drives (col-span-12) */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Placement Drives & Eligibility Gating Roster
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click any drive to trigger automated eligibility determination and student verification
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenCreateDrive}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>New Drive</span>
              </button>
              <button
                onClick={() => setCurrentView('drives')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                View All ({safeDrives.length})
              </button>
            </div>
          </div>

        {recentDrives.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No placement drives found. Click "New Drive" to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {recentDrives.map(drive => {
              // Dynamically evaluate eligible students count
              const liveEligibleCount = safeStudents.filter(s => evaluateEligibility(s, drive).isEligible).length;

              return (
                <div
                  key={drive.id}
                  onClick={() => {
                    setSelectedDriveForEligibility(drive);
                    setCurrentView('eligibility-results');
                  }}
                  className="group p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shadow-xs">
                        {drive.companyName?.charAt(0) || 'D'}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {drive.companyName || 'Company'}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{drive.role}</p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      drive.tier === 'Super Dream'
                        ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                        : drive.tier === 'Dream'
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {drive.tier}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-semibold">CTC</span>
                      <span className="font-extrabold text-slate-900 dark:text-white">₹{drive.packageLPA} LPA</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-semibold">Min CGPA</span>
                      <span className="font-extrabold text-slate-900 dark:text-white">{drive.minCgpa}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-semibold">Eligible</span>
                      <span className="font-extrabold text-blue-600 dark:text-blue-400">{liveEligibleCount}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {drive.driveDate}
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Check Roster <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </div>
  );
};
