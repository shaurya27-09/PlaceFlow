import React, { useState, useEffect } from 'react';
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
  UserCheck,
  ChevronDown,
  Award
} from 'lucide-react';

export const ApplicationsPage: React.FC = () => {
  const {
    applications: contextApplications,
    drives,
    offers: contextOffers,
    updateApplicationStatus: contextUpdateApplicationStatus,
    addToast
  } = useApp();

  const [applicationsList, setApplicationsList] = useState<Application[]>([]);
  const [existingOffers, setExistingOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriveId, setSelectedDriveId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Offer creation loading state
  const [creatingOfferAppId, setCreatingOfferAppId] = useState<string | null>(null);

  // Confirmation modal state for critical status changes (Selected or Rejected)
  const [confirmModal, setConfirmModal] = useState<{
    app: Application;
    newStatus: ApplicationStatus;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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
          .channel('applications-offers-live')
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

  // Sync with context if applications change locally
  useEffect(() => {
    if (!supabase && contextApplications) {
      setApplicationsList(contextApplications);
    }
  }, [contextApplications]);

  const hasOfferForDrive = (studentId: string, driveId: string) => {
    return existingOffers.some(
      o => o.studentId === studentId && (o.driveId === driveId || (o.companyName === applicationsList.find(a => a.studentId === studentId && a.driveId === driveId)?.companyName))
    );
  };

  const handleCreateOffer = async (app: Application) => {
    const drive = drives.find(d => d.id === app.driveId);
    const companyId = drive?.companyId || '';
    const pkg = app.packageLPA || drive?.packageLPA || 0;

    // Check duplicate locally first
    if (hasOfferForDrive(app.studentId, app.driveId)) {
      addToast('Offer Exists', `An offer already exists for ${app.studentName} and this placement drive.`, 'warning');
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
        student_enrollment: app.studentEnrollment,
        student_branch: app.studentBranch,
        company_name: app.companyName,
        company_logo: app.companyLogo
      });

      if (res.error) {
        addToast('Offer Creation Failed', res.error, 'error');
      } else if (res.data) {
        setExistingOffers(prev => [res.data!, ...prev]);
        addToast(
          'Offer Created Successfully',
          `Created ₹${pkg} LPA offer from ${app.companyName} for ${app.studentName}.`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Failed to create offer:', err);
      addToast('Error', err?.message || 'Failed to create offer', 'error');
    } finally {
      setCreatingOfferAppId(null);
    }
  };

  const handleStatusSelect = (app: Application, targetStatus: string) => {
    const newStatus = targetStatus as ApplicationStatus;
    if (newStatus === app.status) return;

    // Requirement: Add confirmation before changing a student to Selected or Rejected
    if (newStatus === 'Selected' || newStatus === 'Rejected' || newStatus === 'Offered') {
      setConfirmModal({
        app,
        newStatus
      });
    } else {
      executeStatusUpdate(app.id, newStatus, app.studentName);
    }
  };

  const executeStatusUpdate = async (appId: string, newStatus: ApplicationStatus, studentName: string) => {
    setIsUpdatingStatus(true);
    try {
      // 1. Update in local / AppContext state (syncs to Supabase automatically if configured)
      await contextUpdateApplicationStatus(appId, newStatus);

      // 2. Update local state view immediately
      setApplicationsList(prev =>
        prev.map(a => (a.id === appId ? { ...a, status: newStatus } : a))
      );

      addToast('Status Updated', `${studentName}'s application updated to ${newStatus}`, 'success');
    } catch (err: any) {
      console.error(`Exception updating application ${appId} status:`, err);
      addToast('Error', `Failed to update status: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsUpdatingStatus(false);
      setConfirmModal(null);
    }
  };

  const safeDrives = drives || [];

  const filteredApplications = applicationsList.filter(app => {
    if (selectedDriveId !== 'ALL' && app.driveId !== selectedDriveId) return false;
    if (selectedStatus !== 'ALL' && app.status !== selectedStatus) return false;

    const roll = app.studentEnrollment || (app as any).studentRoll || '';
    const matchesSearch =
      (app.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      roll.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.role || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Admin allowed statuses according to requirements: Applied, Shortlisted, Interview, Selected, Rejected
  const statuses: ApplicationStatus[] = ['Applied', 'Shortlisted', 'Interview', 'Selected', 'Rejected'];

  const getStatusBadge = (status: ApplicationStatus | string) => {
    switch (status) {
      case 'Selected':
      case 'Offered':
      case 'Offer Accepted':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case 'Interview':
        return 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'Shortlisted':
        return 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
      case 'Applied':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
      case 'Rejected':
      case 'Offer Declined':
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const handleExport = () => {
    addToast('Applications Exported', `Generated application tracker report with ${filteredApplications.length} records.`, 'success');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Applications Management
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              {applicationsList.length} Total
            </span>
            {supabase && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <Database className="w-3 h-3" /> Supabase Live Joined
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Admin oversight: Manage student applications, evaluate stages, update progression, and create offers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            id="refresh-applications-btn"
            onClick={() => loadApplicationsAndOffers()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh from Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            id="export-applications-btn"
            onClick={handleExport}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Tracker</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Database Error: {errorMessage} (showing local cache)</span>
          </div>
          <button
            onClick={() => loadApplicationsAndOffers()}
            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters Row */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="search-applications-input"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search student, enrollment, company..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Drive Filter */}
        <div>
          <select
            id="filter-drive-select"
            value={selectedDriveId}
            onChange={e => setSelectedDriveId(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Placement Drives</option>
            {(safeDrives || []).map(d => (
              <option key={d.id} value={d.id}>{d.companyName} — {d.role}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            id="filter-status-select"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            {statuses.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs font-semibold">Loading applications joined from Supabase...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="font-semibold text-sm">No applications match your criteria.</p>
            <p className="text-xs text-slate-400 mt-1">Eligible students can submit applications from the Student Portal.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-3">Enrollment Number</th>
                  <th className="py-3 px-3">Company</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Package</th>
                  <th className="py-3 px-3">Applied Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Offer Action</th>
                  <th className="py-3 px-4 text-right">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredApplications.map(app => {
                  const offerExists = hasOfferForDrive(app.studentId, app.driveId);
                  const isSelected = app.status === 'Selected';
                  const isProcessingOffer = creatingOfferAppId === app.id;

                  return (
                    <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Student Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <span>{app.studentName}</span>
                      </td>

                      {/* Enrollment Number */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
                          {app.studentEnrollment || (app as any).studentRoll || 'N/A'}
                        </span>
                      </td>

                      {/* Company */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          {app.companyLogo ? (
                            <img
                              src={app.companyLogo}
                              alt=""
                              className="w-5 h-5 rounded-md object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Building2 className="w-4 h-4 text-slate-400" />
                          )}
                          <span className="font-bold text-slate-900 dark:text-white">{app.companyName}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-3">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{app.role}</span>
                      </td>

                      {/* Package */}
                      <td className="py-3.5 px-3">
                        <span className="font-extrabold text-blue-600 dark:text-blue-400">
                          ₹{app.packageLPA} LPA
                        </span>
                      </td>

                      {/* Applied Date */}
                      <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400">
                        {app.appliedDate}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-3">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${getStatusBadge(app.status)}`}>
                          {app.status}
                        </span>
                      </td>

                      {/* Offer Action */}
                      <td className="py-3.5 px-3">
                        {offerExists ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Offer Created
                          </span>
                        ) : isSelected ? (
                          <button
                            id={`create-offer-btn-${app.id}`}
                            onClick={() => handleCreateOffer(app)}
                            disabled={isProcessingOffer}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            {isProcessingOffer ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Award className="w-3 h-3" />
                            )}
                            <span>Create Offer</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                            Select candidate first
                          </span>
                        )}
                      </td>

                      {/* Admin Status Update Dropdown */}
                      <td className="py-3.5 px-4 text-right">
                        <select
                          id={`status-select-${app.id}`}
                          value={app.status}
                          onChange={e => handleStatusSelect(app, e.target.value)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                        >
                          {statuses.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Selected / Rejected changes */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmModal.newStatus === 'Selected'
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
              }`}>
                {confirmModal.newStatus === 'Selected' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Confirm Status Change
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update candidate outcome in Supabase
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <p className="text-slate-700 dark:text-slate-300">
                Are you sure you want to mark <span className="font-bold text-slate-900 dark:text-white">{confirmModal.app.studentName}</span> as{' '}
                <span className={`font-extrabold px-1.5 py-0.5 rounded ${
                  confirmModal.newStatus === 'Selected'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                }`}>
                  {confirmModal.newStatus}
                </span>{' '}
                for <span className="font-bold text-slate-900 dark:text-white">{confirmModal.app.companyName}</span> ({confirmModal.app.role})?
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                This action will update the application record in Supabase.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="cancel-status-change-btn"
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                id="confirm-status-change-btn"
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => executeStatusUpdate(confirmModal.app.id, confirmModal.newStatus, confirmModal.app.studentName)}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs flex items-center gap-1.5 ${
                  confirmModal.newStatus === 'Selected'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isUpdatingStatus ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : confirmModal.newStatus === 'Selected' ? (
                  <UserCheck className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>Confirm {confirmModal.newStatus}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
