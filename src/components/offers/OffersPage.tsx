import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  supabase,
  fetchOffersJoinedFromSupabase,
  updateOfferStatusInSupabase,
  SupabaseDiagnosticInfo,
  isSupabaseConfigured
} from '../../lib/supabase';
import {
  Award,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Search,
  Filter,
  Sparkles,
  Zap,
  Info,
  Lock,
  RefreshCw,
  Database,
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
  UserCheck,
  Ban,
  ExternalLink
} from 'lucide-react';
import { Offer, OfferStatus, CompanyTier } from '../../types';
import { checkOfferPolicy, formatLpa } from '../../lib/offerPolicyEngine';

export const OffersPage: React.FC = () => {
  const {
    offers: contextOffers,
    students,
    drives,
    offerPolicy,
    updateOfferStatus: contextUpdateOfferStatus,
    addToast
  } = useApp();

  // Supabase real-time joined offers state
  const [offersList, setOffersList] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<SupabaseDiagnosticInfo | null>(null);
  const [updatingOfferId, setUpdatingOfferId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Policy Simulator states
  const [simMode, setSimMode] = useState<'cap' | 'upgrade' | 'studentDrive'>('cap');
  const [simExistingPackage, setSimExistingPackage] = useState<number>(8.0);
  const [simAllowedMaxPackage, setSimAllowedMaxPackage] = useState<number>(6.0);
  const [simNewPackage, setSimNewPackage] = useState<number>(12.0);
  const [simSelectedStudentId, setSimSelectedStudentId] = useState<string>('std-7');
  const [simSelectedDriveId, setSimSelectedDriveId] = useState<string>('drv-2');

  // Fetch offers joined with students, companies, placement_drives
  const loadOffers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setDiagnosticInfo(null);
    try {
      if (supabase) {
        const res = await fetchOffersJoinedFromSupabase();
        if (res.data) {
          setOffersList(res.data);
          setErrorMessage(null);
          setDiagnosticInfo(null);
        } else if (res.error) {
          console.warn('Supabase offers query warning:', res.error, res.diagnostic);
          setErrorMessage(res.error);
          setDiagnosticInfo(res.diagnostic || null);
          setOffersList(contextOffers || []);
        } else {
          setOffersList(contextOffers || []);
        }
      } else {
        setOffersList(contextOffers || []);
      }
    } catch (err: any) {
      console.warn('Notice loading offers from database:', err?.message || err);
      setErrorMessage(err?.message || 'Failed to load offers');
      setDiagnosticInfo({
        message: err?.message || 'Exception loading offers',
        details: err?.stack || undefined,
        code: err?.code || 'RUNTIME_ERROR'
      });
      setOffersList(contextOffers || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();

    // Set up real-time postgres changes listener
    if (supabase) {
      try {
        const channel = supabase
          .channel('offers-page-realtime-joined')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'offers' },
            () => {
              loadOffers();
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

  const safeStudents = students || [];
  const safeDrives = drives || [];

  // Allowed admin offer statuses according to requirements
  const offerStatuses: OfferStatus[] = ['Offered', 'Accepted', 'Rejected', 'Withdrawn'];

  const handleStatusChange = async (offer: Offer, newStatus: OfferStatus) => {
    if (offer.status === newStatus) return;

    setUpdatingOfferId(offer.id);
    try {
      // 1. Update in local component state
      setOffersList(prev =>
        prev.map(o => (o.id === offer.id ? { ...o, status: newStatus } : o))
      );

      // 2. Update global context
      if (contextUpdateOfferStatus) {
        contextUpdateOfferStatus(offer.id, newStatus);
      }

      // 3. Save to Supabase (and update student's placement_status to 'Placed' if Accepted)
      if (supabase) {
        const res = await updateOfferStatusInSupabase(offer.id, newStatus);
        if (!res.success && res.error) {
          addToast('Supabase Sync Failed', res.error, 'error');
        } else {
          if (newStatus === 'Accepted') {
            addToast(
              'Offer Accepted & Placed',
              `${offer.studentName}'s offer from ${offer.companyName} is Accepted. Student marked as Placed!`,
              'success'
            );
          } else {
            addToast(
              'Offer Status Updated',
              `Offer for ${offer.studentName} updated to ${newStatus}.`,
              'success'
            );
          }
        }
      } else {
        addToast(
          'Offer Status Updated',
          `Offer for ${offer.studentName} updated to ${newStatus}.`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Failed to update offer status:', err);
      addToast('Error', err?.message || 'Failed to update offer status', 'error');
    } finally {
      setUpdatingOfferId(null);
    }
  };

  // Evaluate Simulation
  let simResult = {
    title: 'Application Permitted',
    blocked: false,
    reason: 'Policy checks passed successfully.'
  };

  if (simMode === 'cap') {
    if (simExistingPackage >= simAllowedMaxPackage) {
      simResult = {
        title: 'Application Blocked',
        blocked: true,
        reason: `Existing package ₹${formatLpa(simExistingPackage)} LPA exceeds or equals allowed limit of ₹${formatLpa(simAllowedMaxPackage)} LPA.`
      };
    } else {
      simResult = {
        title: 'Application Allowed',
        blocked: false,
        reason: `Existing package ₹${formatLpa(simExistingPackage)} LPA is within allowed ₹${formatLpa(simAllowedMaxPackage)} LPA.`
      };
    }
  } else if (simMode === 'upgrade') {
    const ratio = simExistingPackage > 0 ? simNewPackage / simExistingPackage : 1;
    if (simExistingPackage > 0 && ratio < 1.5) {
      simResult = {
        title: 'Application Blocked',
        blocked: true,
        reason: `New package (₹${formatLpa(simNewPackage)} LPA) does not meet minimum 1.5x upgrade multiplier over existing ₹${formatLpa(simExistingPackage)} LPA (${ratio.toFixed(2)}x achieved).`
      };
    } else {
      simResult = {
        title: 'Application Allowed',
        blocked: false,
        reason: `Eligible Dream Upgrade with ${(ratio).toFixed(2)}x multiplier.`
      };
    }
  } else {
    const s = safeStudents.find(st => st.id === simSelectedStudentId);
    const d = safeDrives.find(dr => dr.id === simSelectedDriveId);
    if (s && d) {
      const res = checkOfferPolicy(s, d, { allOffers: offersList, policyConfig: offerPolicy });
      simResult = {
        title: res.title,
        blocked: res.blocked,
        reason: res.reason || 'Candidate meets institutional offer policy guidelines.'
      };
    }
  }

  const filteredOffers = offersList.filter(offer => {
    if (statusFilter !== 'ALL' && offer.status !== statusFilter) return false;
    const roll = offer.studentEnrollment || (offer as any).studentRoll || '';
    const matchesSearch =
      (offer.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      roll.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (offer.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (offer.role || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const getStatusBadge = (status: OfferStatus | string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case 'Offered':
      case 'Pending':
        return 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'Rejected':
      case 'Declined':
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      case 'Withdrawn':
      case 'Revoked':
        return 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700';
      case 'Blocked by Policy':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="flex flex-col min-w-0 pb-6">
      {/* Solid, opaque dashboard panel with its own stacking context + internal scroll */}
      <section className="relative z-0 flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-h-[calc(100vh-12rem)] sm:max-h-[calc(100vh-9rem)] lg:max-h-[calc(100vh-8rem)]">
        {/* Sticky panel header */}
        <div className="sticky top-0 z-20 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 pt-5 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Offers & Policy Enforcement
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              {offersList.length} Offers
            </span>
            {supabase && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <Database className="w-3 h-3" /> Supabase Live Joined
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Admin oversight: Manage student offers, update acceptance outcomes, and enforce deterministic offer policy caps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="refresh-offers-btn"
            onClick={loadOffers}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      {/* End sticky panel header */}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 dark:bg-slate-950 space-y-6">

      {/* Error & Diagnostic Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-800 dark:text-rose-200 text-xs space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div>
                <div className="font-bold text-rose-900 dark:text-rose-100 flex items-center gap-2">
                  <span>Supabase Query Diagnosis</span>
                  {diagnosticInfo?.code && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 rounded">
                      Code: {diagnosticInfo.code}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-rose-700 dark:text-rose-300 font-medium">
                  <strong>Message:</strong> {errorMessage}
                </div>
                {diagnosticInfo?.details && (
                  <div className="mt-1 text-slate-600 dark:text-slate-400 text-[11px]">
                    <strong>Details:</strong> {diagnosticInfo.details}
                  </div>
                )}
                {diagnosticInfo?.hint && (
                  <div className="mt-1 text-amber-700 dark:text-amber-300 text-[11px]">
                    <strong>Hint:</strong> {diagnosticInfo.hint}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={loadOffers}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs"
              >
                Retry Query
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3 text-xs">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="search-offers-input"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search offer by student name, enrollment number, company, or role..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="sm:w-64">
          <select
            id="filter-offer-status-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Offered">Offered</option>
            <option value="Accepted">Accepted (Placed)</option>
            <option value="Rejected">Rejected</option>
            <option value="Withdrawn">Withdrawn</option>
          </select>
        </div>
      </div>

      {/* Offers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs font-semibold">Loading offers joined from Supabase...</p>
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Award className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="font-semibold text-sm">No offers match your criteria.</p>
            <p className="text-xs text-slate-400 mt-1">Create offers for selected candidates on the Applications page.</p>
          </div>
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[660px]">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-3">Enrollment Number</th>
                  <th className="py-3 px-3">Company</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Package</th>
                  <th className="py-3 px-3">Offer Date</th>
                  <th className="py-3 px-3">Offer Status</th>
                  <th className="py-3 px-4 text-right">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOffers.map(offer => {
                  const isUpdating = updatingOfferId === offer.id;

                  return (
                    <tr
                      key={offer.id}
                      className={`transition-colors ${
                        offer.status === 'Accepted'
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/20'
                          : offer.status === 'Rejected'
                          ? 'bg-rose-50/20 dark:bg-rose-950/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Student Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <span>{offer.studentName}</span>
                      </td>

                      {/* Enrollment Number */}
                      <td className="py-3.5 px-3 font-mono text-slate-600 dark:text-slate-400 font-semibold">
                        {offer.studentEnrollment || (offer as any).studentRoll || '—'}
                      </td>

                      {/* Company */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          {offer.companyLogo ? (
                            <img
                              src={offer.companyLogo}
                              alt=""
                              className="w-5 h-5 rounded-md object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Building2 className="w-4 h-4 text-slate-400" />
                          )}
                          <span className="font-bold text-slate-900 dark:text-white">{offer.companyName}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300 font-medium">
                        {offer.role}
                      </td>

                      {/* Package */}
                      <td className="py-3.5 px-3 font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                        ₹{offer.packageLPA} LPA
                      </td>

                      {/* Offer Date */}
                      <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400">
                        {offer.offerDate}
                      </td>

                      {/* Offer Status Badge */}
                      <td className="py-3.5 px-3">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${getStatusBadge(offer.status)}`}>
                          {offer.status === 'Accepted' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {offer.status === 'Rejected' && <XCircle className="w-3 h-3 text-rose-600" />}
                          {offer.status === 'Withdrawn' && <Ban className="w-3 h-3 text-slate-500" />}
                          <span>{offer.status}</span>
                        </span>
                      </td>

                      {/* Update Status Dropdown */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {isUpdating && <RefreshCw className="w-3 h-3 animate-spin text-blue-600 mr-1" />}
                          <select
                            id={`offer-status-select-${offer.id}`}
                            value={offer.status}
                            disabled={isUpdating}
                            onChange={e => handleStatusChange(offer, e.target.value as OfferStatus)}
                            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                          >
                            {offerStatuses.map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
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

      {/* Deterministic Offer Policy Simulator Section */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-2">
                Deterministic Offer Policy Simulator
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  Mathematical Rules Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Simulate candidate offer limits, package caps, and Dream upgrade constraints before application submission.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setSimMode('cap')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                simMode === 'cap' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Package Cap
            </button>
            <button
              onClick={() => setSimMode('upgrade')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                simMode === 'upgrade' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dream Upgrade (1.5x)
            </button>
            <button
              onClick={() => setSimMode('studentDrive')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                simMode === 'studentDrive' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Live Student Match
            </button>
          </div>
        </div>

        {/* Simulator Inputs & Dynamic Result */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700/60 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Simulation Parameters</h3>

            {simMode === 'cap' && (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Existing Active Offer:</span>
                    <span className="font-mono font-bold text-blue-400">₹{simExistingPackage} LPA</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    step="0.5"
                    value={simExistingPackage}
                    onChange={e => setSimExistingPackage(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Placement Drive Offer Limit (Cap):</span>
                    <span className="font-mono font-bold text-amber-400">₹{simAllowedMaxPackage} LPA</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    step="0.5"
                    value={simAllowedMaxPackage}
                    onChange={e => setSimAllowedMaxPackage(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            )}

            {simMode === 'upgrade' && (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Existing Offer Package:</span>
                    <span className="font-mono font-bold text-blue-400">₹{simExistingPackage} LPA</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    step="0.5"
                    value={simExistingPackage}
                    onChange={e => setSimExistingPackage(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Prospective New Package:</span>
                    <span className="font-mono font-bold text-emerald-400">₹{simNewPackage} LPA</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="30"
                    step="0.5"
                    value={simNewPackage}
                    onChange={e => setSimNewPackage(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>
            )}

            {simMode === 'studentDrive' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Select Candidate:</label>
                  <select
                    value={simSelectedStudentId}
                    onChange={e => setSimSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white"
                  >
                    {safeStudents.map(st => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.branch} • {st.placementStatus})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target Placement Drive:</label>
                  <select
                    value={simSelectedDriveId}
                    onChange={e => setSimSelectedDriveId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white"
                  >
                    {safeDrives.map(dr => (
                      <option key={dr.id} value={dr.id}>
                        {dr.companyName} — ₹{dr.packageLPA} LPA ({dr.offerPolicyRule})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Result Card */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${
            simResult.blocked
              ? 'bg-rose-950/40 border-rose-700/60 text-rose-200'
              : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
          }`}>
            <div>
              <div className="flex items-center gap-2 mb-2">
                {simResult.blocked ? (
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
                <span className="font-extrabold text-sm text-white">{simResult.title}</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                {simResult.reason}
              </p>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Rule Type: {simMode === 'cap' ? 'Offer Limit LPA' : simMode === 'upgrade' ? 'Dream Upgrade' : 'Full Policy Evaluation'}</span>
              <span className={`font-bold px-2 py-0.5 rounded ${simResult.blocked ? 'bg-rose-900/60 text-rose-300' : 'bg-emerald-900/60 text-emerald-300'}`}>
                {simResult.blocked ? 'BLOCKED' : 'PERMITTED'}
              </span>
            </div>
          </div>
        </div>
      </div>
        </div>
        {/* End scrollable body */}
      </section>
    </div>
  );
};
