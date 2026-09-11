import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  supabase,
  fetchApplicationsJoinedFromSupabase,
  createOfferInSupabase,
  fetchOffersFromSupabase
} from '../../lib/supabase';
import { Application, ApplicationStatus, Offer } from '../../types';
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  RefreshCw,
  Database,
  AlertCircle,
  AlertTriangle,
  Building2,
  Sparkles,
  ChevronDown,
  Award,
  FileCheck2,
  Eye,
  X,
  ExternalLink,
  Layers,
  Briefcase,
  GraduationCap,
  Calendar,
  Mail,
  ArrowRight,
  Filter,
  User,
  Check,
  Send
} from 'lucide-react';

export const ApplicationsPage: React.FC = () => {
  const {
    applications: contextApplications,
    drives,
    companies,
    students,
    offers: contextOffers,
    updateApplicationStatus: contextUpdateApplicationStatus,
    addToast
  } = useApp();

  const [applicationsList, setApplicationsList] = useState<Application[]>([]);
  const [existingOffers, setExistingOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [selectedDriveId, setSelectedDriveId] = useState<string>('ALL');

  // Modals
  const [selectedAppForDetail, setSelectedAppForDetail] = useState<Application | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    app: Application;
    newStatus: ApplicationStatus;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [creatingOfferAppId, setCreatingOfferAppId] = useState<string | null>(null);

  // Fetch applications joined with students, placement_drives, companies & existing offers
  const loadApplicationsAndOffers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (supabase) {
        const [appsRes, offersRes] = await Promise.allSettled([
          fetchApplicationsJoinedFromSupabase(),
          fetchOffersFromSupabase()
        ]);

        if (offersRes.status === 'fulfilled' && offersRes.value.data) {
          setExistingOffers(offersRes.value.data);
        } else if (contextOffers) {
          setExistingOffers(contextOffers);
        }

        if (appsRes.status === 'fulfilled') {
          if (appsRes.value.data) {
            setApplicationsList(appsRes.value.data);
          } else if (appsRes.value.error) {
            console.warn('Notice loading applications from Supabase:', appsRes.value.error);
            setApplicationsList(contextApplications || []);
          }
        } else {
          setApplicationsList(contextApplications || []);
        }
      } else {
        setApplicationsList(contextApplications || []);
        setExistingOffers(contextOffers || []);
      }
    } catch (err: any) {
      console.warn('Notice loading applications:', err?.message || err);
      setApplicationsList(contextApplications || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApplicationsAndOffers();

    // Setup Supabase real-time listener if available
    if (supabase) {
      try {
        const channel = supabase
          .channel('applications-realtime-listener')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'applications' },
            () => {
              loadApplicationsAndOffers();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'offers' },
            () => {
              loadApplicationsAndOffers();
            }
          )
          .subscribe();

        return () => {
          try {
            supabase.removeChannel(channel);
          } catch (_) {}
        };
      } catch (_) {}
    }
  }, []);

  // Synchronize with context if applications change locally
  useEffect(() => {
    if (!supabase && contextApplications) {
      setApplicationsList(contextApplications);
    }
  }, [contextApplications]);

  // Derive unique company names for the Company filter
  const availableCompanies = useMemo(() => {
    const set = new Set<string>();
    (applicationsList || []).forEach(a => {
      if (a.companyName) set.add(a.companyName);
    });
    (drives || []).forEach(d => {
      if (d.companyName) set.add(d.companyName);
    });
    (companies || []).forEach(c => {
      const name = c.company_name || c.name;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [applicationsList, drives, companies]);

  // Derive summary metrics
  const counts = useMemo(() => {
    const total = applicationsList.length;
    const applied = applicationsList.filter(a => a.status === 'Applied').length;
    const shortlisted = applicationsList.filter(a => a.status === 'Shortlisted').length;
    const interview = applicationsList.filter(a => a.status === 'Interview').length;
    const selected = applicationsList.filter(a => a.status === 'Selected' || a.status === 'Offered' || a.status === 'Offer Accepted').length;
    const rejected = applicationsList.filter(a => a.status === 'Rejected' || a.status === 'Offer Declined').length;
    const withdrawn = applicationsList.filter(a => a.status === 'Withdrawn').length;

    return { total, applied, shortlisted, interview, selected, rejected, withdrawn };
  }, [applicationsList]);

  // Filter and search logic
  const filteredApplications = useMemo(() => {
    return applicationsList.filter(app => {
      // 1. Status Filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'Selected') {
          if (app.status !== 'Selected' && app.status !== 'Offered' && app.status !== 'Offer Accepted') return false;
        } else if (selectedStatus === 'Rejected') {
          if (app.status !== 'Rejected' && app.status !== 'Offer Declined') return false;
        } else {
          if (app.status !== selectedStatus) return false;
        }
      }

      // 2. Company Filter
      if (selectedCompany !== 'ALL') {
        if ((app.companyName || '').toLowerCase() !== selectedCompany.toLowerCase()) return false;
      }

      // 3. Placement Drive Filter
      if (selectedDriveId !== 'ALL') {
        if (app.driveId !== selectedDriveId) return false;
      }

      // 4. Search Filter (Student name, Enrollment, Company, Role)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const studentNameMatch = (app.studentName || '').toLowerCase().includes(q);
        const enrollmentMatch = (app.studentEnrollment || '').toLowerCase().includes(q);
        const companyMatch = (app.companyName || '').toLowerCase().includes(q);
        const roleMatch = (app.role || '').toLowerCase().includes(q);
        if (!studentNameMatch && !enrollmentMatch && !companyMatch && !roleMatch) {
          return false;
        }
      }

      return true;
    });
  }, [applicationsList, selectedStatus, selectedCompany, selectedDriveId, searchQuery]);

  // Check if student already has an offer for this drive/company
  const hasOfferForDrive = (studentId: string, driveId: string, companyName: string) => {
    return existingOffers.some(
      o => o.studentId === studentId && (o.driveId === driveId || o.companyName?.toLowerCase() === companyName.toLowerCase())
    );
  };

  // Status progression definitions
  const allowedStatuses: ApplicationStatus[] = [
    'Applied',
    'Shortlisted',
    'Interview',
    'Selected',
    'Rejected',
    'Withdrawn'
  ];

  const getNextRecommendedStatus = (current: ApplicationStatus): ApplicationStatus | null => {
    switch (current) {
      case 'Applied':
        return 'Shortlisted';
      case 'Shortlisted':
        return 'Interview';
      case 'Interview':
        return 'Selected';
      default:
        return null;
    }
  };

  // Status badge visual helpers
  const getStatusBadgeStyle = (status: ApplicationStatus | string) => {
    switch (status) {
      case 'Selected':
      case 'Offered':
      case 'Offer Accepted':
        return 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Interview':
        return 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Shortlisted':
        return 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Applied':
        return 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Rejected':
      case 'Offer Declined':
        return 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'Withdrawn':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Trigger status update with confirmation for critical statuses
  const handleRequestStatusChange = (app: Application, targetStatus: ApplicationStatus) => {
    if (app.status === targetStatus) return;

    // Critical statuses requiring explicit confirmation: Selected, Rejected, Withdrawn
    if (targetStatus === 'Selected' || targetStatus === 'Rejected' || targetStatus === 'Withdrawn') {
      setConfirmModal({ app, newStatus: targetStatus });
    } else {
      executeStatusUpdate(app.id, targetStatus, app.studentName);
    }
  };

  // Execute confirmed or direct status update
  const executeStatusUpdate = async (appId: string, newStatus: ApplicationStatus, studentName: string) => {
    setIsUpdatingStatus(true);
    try {
      // 1. Update in local / AppContext state (syncs to Supabase with authoritative column payload)
      await contextUpdateApplicationStatus(appId, newStatus);

      // 2. Update local state view immediately
      setApplicationsList(prev =>
        prev.map(a => (a.id === appId ? { ...a, status: newStatus, updatedAt: new Date().toISOString() } : a))
      );

      // 3. Update details modal if currently open
      if (selectedAppForDetail && selectedAppForDetail.id === appId) {
        setSelectedAppForDetail(prev => prev ? { ...prev, status: newStatus, updatedAt: new Date().toISOString() } : null);
      }

      addToast('Status Updated', `${studentName}'s application marked as ${newStatus}`, 'success');
    } catch (err: any) {
      console.error(`Exception updating application ${appId} status:`, err);
      addToast('Error', `Failed to update status: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsUpdatingStatus(false);
      setConfirmModal(null);
    }
  };

  // Clean offer creation connection when a student is selected
  const handleCreateOffer = async (app: Application) => {
    const drive = drives.find(d => d.id === app.driveId);
    const companyId = app.companyId || drive?.companyId || '';
    const pkg = app.packageLPA || drive?.packageLPA || 0;

    if (hasOfferForDrive(app.studentId, app.driveId, app.companyName)) {
      addToast('Offer Exists', `An offer is already recorded for ${app.studentName} with ${app.companyName}.`, 'warning');
      return;
    }

    setCreatingOfferAppId(app.id);
    try {
      const res = await createOfferInSupabase({
        student_id: app.studentId,
        drive_id: app.driveId,
        company_id: companyId,
        package_lpa: pkg,
        status: 'Offered',
        role: app.role || drive?.role || 'Software Engineer',
        student_name: app.studentName,
        company_name: app.companyName,
        student_enrollment: app.studentEnrollment,
        student_branch: app.studentBranch
      });

      if (res.error) {
        addToast('Offer Notice', res.error, 'warning');
      } else {
        addToast('Offer Recorded', `Official offer generated for ${app.studentName} at ${app.companyName} (₹${pkg} LPA)`, 'success');
        // Refresh offers list
        const refreshed = await fetchOffersFromSupabase();
        if (refreshed.data) {
          setExistingOffers(refreshed.data);
        }
      }
    } catch (err: any) {
      addToast('Error', err?.message || 'Failed to create offer record', 'error');
    } finally {
      setCreatingOfferAppId(null);
    }
  };

  // Export filtered applications to CSV
  const handleExportCSV = () => {
    if (filteredApplications.length === 0) {
      addToast('Export Notice', 'No applications match the current filter to export.', 'info');
      return;
    }

    const headers = ['Application ID', 'Student Name', 'Enrollment No', 'Branch', 'CGPA', 'Company', 'Role', 'Package (LPA)', 'Applied On', 'Status'];
    const rows = filteredApplications.map(a => [
      `"${a.id}"`,
      `"${a.studentName || ''}"`,
      `"${a.studentEnrollment || ''}"`,
      `"${a.studentBranch || ''}"`,
      a.studentCgpa ?? '',
      `"${a.companyName || ''}"`,
      `"${a.role || ''}"`,
      a.packageLPA ?? '',
      `"${a.appliedDate || ''}"`,
      `"${a.status || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PlaceFlow_Applications_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('Report Exported', `Exported ${filteredApplications.length} application records to CSV.`, 'success');
  };

  // Reset all search and filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('ALL');
    setSelectedCompany('ALL');
    setSelectedDriveId('ALL');
  };

  const hasActiveFilters = searchQuery !== '' || selectedStatus !== 'ALL' || selectedCompany !== 'ALL' || selectedDriveId !== 'ALL';

  return (
    <div className="flex flex-col min-w-0 pb-6">
      {/* Solid, opaque dashboard panel with its own stacking context + internal scroll */}
      <section className="relative z-0 flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-h-[calc(100vh-12rem)] sm:max-h-[calc(100vh-9rem)] lg:max-h-[calc(100vh-8rem)]">
        {/* Sticky panel header */}
        <div className="sticky top-0 z-20 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 pt-5 pb-4">
          {/* 1. Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Application Management
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              {applicationsList.length} Total
            </span>
            {supabase && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <Database className="w-3 h-3" /> Supabase Live Joined
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track student applicants, evaluate hiring stages, update progression, and confirm candidate selections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            id="refresh-applications-btn"
            onClick={() => loadApplicationsAndOffers()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Refresh from Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Export CSV Button */}
          <button
            id="export-applications-btn"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>
      {/* End sticky panel header */}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 dark:bg-slate-950 space-y-6">

      {/* Database Error Banner */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Database Connection Error: {errorMessage} (Displaying cached records)</span>
          </div>
          <button
            onClick={() => loadApplicationsAndOffers()}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Summary Cards (Total, Applied, Shortlisted, Interview, Selected, Rejected) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
        {/* Total Applications */}
        <button
          id="summary-card-total"
          onClick={() => setSelectedStatus('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedStatus === 'ALL'
              ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Total</span>
            <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FileCheck2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5">
            {counts.total}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">All applications</div>
        </button>

        {/* Applied */}
        <button
          id="summary-card-applied"
          onClick={() => setSelectedStatus(selectedStatus === 'Applied' ? 'ALL' : 'Applied')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedStatus === 'Applied'
              ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-amber-700 dark:text-amber-400 font-semibold text-[11px]">Applied</span>
            <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/80 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1.5">
            {counts.applied}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">Under review</div>
        </button>

        {/* Shortlisted */}
        <button
          id="summary-card-shortlisted"
          onClick={() => setSelectedStatus(selectedStatus === 'Shortlisted' ? 'ALL' : 'Shortlisted')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedStatus === 'Shortlisted'
              ? 'bg-purple-50/90 dark:bg-purple-950/50 border-purple-300 dark:border-purple-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-purple-700 dark:text-purple-400 font-semibold text-[11px]">Shortlisted</span>
            <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/80 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1.5">
            {counts.shortlisted}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">Screened in</div>
        </button>

        {/* Interview */}
        <button
          id="summary-card-interview"
          onClick={() => setSelectedStatus(selectedStatus === 'Interview' ? 'ALL' : 'Interview')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedStatus === 'Interview'
              ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-blue-700 dark:text-blue-400 font-semibold text-[11px]">Interview</span>
            <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1.5">
            {counts.interview}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">Rounds ongoing</div>
        </button>

        {/* Selected */}
        <button
          id="summary-card-selected"
          onClick={() => setSelectedStatus(selectedStatus === 'Selected' ? 'ALL' : 'Selected')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedStatus === 'Selected'
              ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">Selected</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
            {counts.selected}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">Placed hires</div>
        </button>

        {/* Rejected */}
        <button
          id="summary-card-rejected"
          onClick={() => setSelectedStatus(selectedStatus === 'Rejected' ? 'ALL' : 'Rejected')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedStatus === 'Rejected'
              ? 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-rose-700 dark:text-rose-400 font-semibold text-[11px]">Rejected</span>
            <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5">
            {counts.rejected}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">Disqualified</div>
        </button>
      </div>

      {/* 3. Search and Filters Bar (Status, Company, Placement Drive) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input (Student name, Enrollment, Company, Role) */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="search-applications-input"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search student, enrollment, company, role..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter 1: Status */}
          <div>
            <select
              id="filter-status-select"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Statuses ({counts.total})</option>
              <option value="Applied">Applied ({counts.applied})</option>
              <option value="Shortlisted">Shortlisted ({counts.shortlisted})</option>
              <option value="Interview">Interview ({counts.interview})</option>
              <option value="Selected">Selected ({counts.selected})</option>
              <option value="Rejected">Rejected ({counts.rejected})</option>
              <option value="Withdrawn">Withdrawn ({counts.withdrawn})</option>
            </select>
          </div>

          {/* Filter 2: Company */}
          <div>
            <select
              id="filter-company-select"
              value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Companies</option>
              {availableCompanies.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Placement Drive */}
          <div>
            <select
              id="filter-drive-select"
              value={selectedDriveId}
              onChange={e => setSelectedDriveId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Placement Drives</option>
              {(drives || []).map(d => (
                <option key={d.id} value={d.id}>
                  {d.companyName} — {d.role} (₹{d.packageLPA} LPA)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Pills and Reset */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Active filters:</span>
              {searchQuery && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  Search: "{searchQuery}"
                </span>
              )}
              {selectedStatus !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Status: {selectedStatus}
                </span>
              )}
              {selectedCompany !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Company: {selectedCompany}
                </span>
              )}
              {selectedDriveId !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Drive: {drives.find(d => d.id === selectedDriveId)?.companyName || selectedDriveId}
                </span>
              )}
            </div>

            <button
              id="clear-filters-btn"
              onClick={handleResetFilters}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* 4. Applications Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Loading applications...</h3>
            <p className="text-xs text-slate-400 mt-1">Retrieving joined records from Supabase</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="p-12 text-center">
            <FileCheck2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {applicationsList.length === 0 ? 'No applications submitted yet' : 'No matching applications found'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {applicationsList.length === 0
                ? 'Applications submitted by eligible students through the Student Portal will appear here in real time.'
                : 'None of the applications match your active search and filter criteria. Try adjusting or clearing filters.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[660px]">
              <thead className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-3">Enrollment No</th>
                  <th className="py-3 px-3">Company</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Applied On</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredApplications.map(app => {
                  const nextStatus = getNextRecommendedStatus(app.status);
                  const isCandidateSelected = app.status === 'Selected' || app.status === 'Offered' || app.status === 'Offer Accepted';
                  const hasOffer = hasOfferForDrive(app.studentId, app.driveId, app.companyName);

                  return (
                    <tr
                      key={app.id}
                      id={`application-row-${app.id}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Column 1: Student */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0">
                            {(app.studentName || 'S').charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {app.studentName}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                              <span className="font-medium text-slate-600 dark:text-slate-300">{app.studentBranch}</span>
                              <span>•</span>
                              <span>{app.studentCgpa ? `${app.studentCgpa} CGPA` : '—'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Enrollment Number */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold">
                          {app.studentEnrollment || '—'}
                        </span>
                      </td>

                      {/* Column 3: Company */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs shrink-0">
                            {app.companyName ? app.companyName.charAt(0) : 'C'}
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {app.companyName || 'Company'}
                          </span>
                        </div>
                      </td>

                      {/* Column 4: Role */}
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            {app.role || 'Software Engineer'}
                          </span>
                          {app.packageLPA > 0 && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{app.packageLPA} LPA
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Applied On */}
                      <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {app.appliedDate || (app.appliedAt ? app.appliedAt.split('T')[0] : '—')}
                      </td>

                      {/* Column 6: Status Badge */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadgeStyle(
                            app.status
                          )}`}
                        >
                          {app.status === 'Selected' || app.status === 'Offered' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : app.status === 'Interview' ? (
                            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          ) : app.status === 'Shortlisted' ? (
                            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          ) : app.status === 'Rejected' ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          )}
                          <span>{app.status}</span>
                        </span>
                      </td>

                      {/* Column 7: Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details Button */}
                          <button
                            id={`view-details-btn-${app.id}`}
                            onClick={() => setSelectedAppForDetail(app)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            title="View Full Application Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Progress Button (Applied -> Shortlisted -> Interview -> Selected) */}
                          {nextStatus && (
                            <button
                              id={`quick-advance-btn-${app.id}`}
                              onClick={() => handleRequestStatusChange(app, nextStatus)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                                nextStatus === 'Selected'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
                                  : nextStatus === 'Interview'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100'
                                  : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700 hover:bg-purple-100'
                              }`}
                              title={`Advance to ${nextStatus}`}
                            >
                              <span>{nextStatus}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          {/* If Selected and no offer created yet: 1-click Generate Offer */}
                          {isCandidateSelected && !hasOffer && (
                            <button
                              id={`create-offer-btn-${app.id}`}
                              onClick={() => handleCreateOffer(app)}
                              disabled={creatingOfferAppId === app.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                              title="Generate Official Placement Offer"
                            >
                              {creatingOfferAppId === app.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Award className="w-3 h-3" />
                              )}
                              <span>Create Offer</span>
                            </button>
                          )}

                          {/* Full Status Update Dropdown */}
                          <div className="relative inline-block text-left">
                            <select
                              id={`status-select-${app.id}`}
                              value={app.status}
                              onChange={e => handleRequestStatusChange(app, e.target.value as ApplicationStatus)}
                              className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                              <option disabled value="">
                                Change Status...
                              </option>
                              {allowedStatuses.map(s => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
        {/* End scrollable body */}
      </section>

      {/* 5. Application Details View / Modal (Requirement 6) */}
      {selectedAppForDetail && (
        <div
          id="application-details-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
          onClick={() => setSelectedAppForDetail(null)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                  {(selectedAppForDetail.studentName || 'S').charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {selectedAppForDetail.studentName}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeStyle(
                        selectedAppForDetail.status
                      )}`}
                    >
                      {selectedAppForDetail.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Candidate Application ID: <span className="font-mono text-[11px]">{selectedAppForDetail.id}</span>
                  </p>
                </div>
              </div>

              <button
                id="close-details-modal-btn"
                onClick={() => setSelectedAppForDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 text-xs max-h-[75vh] overflow-y-auto">
              {/* Section 1: Student Profile Information */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  <span>Student Academic Profile</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Enrollment Number</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {selectedAppForDetail.studentEnrollment || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Engineering Branch</span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {selectedAppForDetail.studentBranch}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Academic CGPA</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                      {selectedAppForDetail.studentCgpa ?? '—'} / 10
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Attendance</span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {selectedAppForDetail.studentAttendance}%
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 text-[10px] font-semibold block">Email</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                      {selectedAppForDetail.studentEmail || `${(selectedAppForDetail.studentName || 'student').toLowerCase().replace(/\s+/g, '.')}@college.edu`}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 text-[10px] font-semibold block">Active Backlogs</span>
                    <span className={`font-bold text-xs ${selectedAppForDetail.studentBacklogs === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {selectedAppForDetail.studentBacklogs === 0 ? '0 (Clean Record)' : `${selectedAppForDetail.studentBacklogs} Backlogs`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Company & Placement Drive Details */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>Company & Drive Details</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Company Name</span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {selectedAppForDetail.companyName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Designation Role</span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {selectedAppForDetail.role}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Compensation</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                      ₹{selectedAppForDetail.packageLPA} LPA
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Industry</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                      {selectedAppForDetail.companyIndustry || 'Technology & Software'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Drive Date</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                      {selectedAppForDetail.driveDate || 'Campus Drive'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Drive Status</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                      {selectedAppForDetail.driveStatus || 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Application Metadata & Stage */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Application Lifecycle</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Applied Date</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                      {selectedAppForDetail.appliedDate || selectedAppForDetail.appliedAt?.split('T')[0] || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Last Updated</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                      {selectedAppForDetail.updatedAt ? new Date(selectedAppForDetail.updatedAt).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold block">Eligibility State</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{selectedAppForDetail.eligibilityStatus || 'Eligible'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 4: Status Transition Workflow Bar */}
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Current Stage: <span className="text-blue-600 dark:text-blue-400">{selectedAppForDetail.status}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Update applicant stage according to campus recruitment progression.
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status change select */}
                    <select
                      id="modal-status-select"
                      value={selectedAppForDetail.status}
                      onChange={e => handleRequestStatusChange(selectedAppForDetail, e.target.value as ApplicationStatus)}
                      className="px-3 py-1.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      {allowedStatuses.map(s => (
                        <option key={s} value={s}>
                          Mark as {s}
                        </option>
                      ))}
                    </select>

                    {/* Quick advance button if applicable */}
                    {getNextRecommendedStatus(selectedAppForDetail.status) && (
                      <button
                        id="modal-quick-advance-btn"
                        onClick={() => handleRequestStatusChange(selectedAppForDetail, getNextRecommendedStatus(selectedAppForDetail.status)!)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Advance to {getNextRecommendedStatus(selectedAppForDetail.status)}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 5: Offer Integration (Requirement 12) */}
              {(selectedAppForDetail.status === 'Selected' || selectedAppForDetail.status === 'Offered' || selectedAppForDetail.status === 'Offer Accepted') && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          Placement Offer Integration
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                          {hasOfferForDrive(selectedAppForDetail.studentId, selectedAppForDetail.driveId, selectedAppForDetail.companyName)
                            ? 'Official offer has been generated and recorded in the database.'
                            : 'Student has been marked as Selected. Generate an official offer record.'}
                        </span>
                      </div>
                    </div>

                    {!hasOfferForDrive(selectedAppForDetail.studentId, selectedAppForDetail.driveId, selectedAppForDetail.companyName) && (
                      <button
                        id="modal-generate-offer-btn"
                        onClick={() => handleCreateOffer(selectedAppForDetail)}
                        disabled={creatingOfferAppId === selectedAppForDetail.id}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {creatingOfferAppId === selectedAppForDetail.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Award className="w-3.5 h-3.5" />
                        )}
                        <span>Generate Official Offer</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-end">
              <button
                id="modal-close-btn"
                onClick={() => setSelectedAppForDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Status Change Confirmation Modal (Requirement 8) */}
      {confirmModal && (
        <div
          id="confirm-status-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmModal.newStatus === 'Selected'
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    : confirmModal.newStatus === 'Rejected'
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {confirmModal.newStatus === 'Selected' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : confirmModal.newStatus === 'Rejected' ? (
                  <XCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Confirm Status Change: {confirmModal.newStatus}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Important placement pipeline action
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
              <p>
                Are you sure you want to mark <span className="font-bold text-slate-900 dark:text-white">{confirmModal.app.studentName}</span>'s application for{' '}
                <span className="font-bold text-slate-900 dark:text-white">{confirmModal.app.companyName}</span> ({confirmModal.app.role}) as{' '}
                <span className="font-bold underline">{confirmModal.newStatus}</span>?
              </p>
              {confirmModal.newStatus === 'Selected' && (
                <p className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                  • This will record the candidate as successfully placed and enable placement offer generation.
                </p>
              )}
              {confirmModal.newStatus === 'Rejected' && (
                <p className="text-rose-600 dark:text-rose-400 text-[11px] font-semibold">
                  • This will close this application. The candidate will see their application marked as Rejected.
                </p>
              )}
              {confirmModal.newStatus === 'Withdrawn' && (
                <p className="text-slate-500 text-[11px] font-semibold">
                  • This marks that the candidate has voluntarily withdrawn from this placement process.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                id="cancel-confirm-status-btn"
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="execute-confirm-status-btn"
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => executeStatusUpdate(confirmModal.app.id, confirmModal.newStatus, confirmModal.app.studentName)}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                  confirmModal.newStatus === 'Selected'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : confirmModal.newStatus === 'Rejected'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                {isUpdatingStatus && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Status Update</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
