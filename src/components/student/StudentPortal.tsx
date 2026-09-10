import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  fetchStudentAllEligibilityResults,
  fetchApplicationsJoinedFromSupabase,
  supabase
} from '../../lib/supabase';
import { evaluateStudentEligibility, EligibilityResultRecord } from '../../lib/eligibilityEngine';
import { Application, ApplicationStatus, PlacementDrive } from '../../types';
import {
  GraduationCap,
  Briefcase,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  Building2,
  Layers,
  Sparkles,
  ArrowRight,
  User,
  ShieldAlert,
  ShieldCheck,
  Lock,
  HelpCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  FileCheck2,
  RefreshCw
} from 'lucide-react';

export const StudentPortal: React.FC = () => {
  const {
    students,
    activeStudentId,
    setActiveStudentId,
    drives,
    applications,
    offers,
    applyToDrive,
    acceptOffer,
    declineOffer,
    evaluateEligibility,
    checkOfferPolicy,
    setCurrentView,
    addToast,
    userProfile,
    currentRole,
    isAuthenticated
  } = useApp();

  const safeStudents = students || [];
  const safeDrives = drives || [];
  const safeApplications = applications || [];
  const safeOffers = offers || [];

  // Determine current student: if authenticated student, use linked student record
  const profileStudent = (userProfile?.role === 'student')
    ? (safeStudents.find(s => (userProfile.student_id && s.id === userProfile.student_id) || (userProfile.email && s.email?.toLowerCase() === userProfile.email.toLowerCase())) || null)
    : null;

  const currentStudent = profileStudent || safeStudents.find(s => s.id === activeStudentId) || safeStudents[0];

  // Active view tab: 'drives' (Available Drives) or 'my-applications' (My Applications)
  const [activeTab, setActiveTab] = useState<'drives' | 'my-applications'>('drives');

  // Supabase eligibility results cache for this student: driveId -> { eligible, reasons, checked_at }
  const [studentEligibilityMap, setStudentEligibilityMap] = useState<Map<string, { eligible: boolean; reasons: string[]; checked_at: string }>>(new Map());
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(false);
  const [isApplyingDriveId, setIsApplyingDriveId] = useState<string | null>(null);

  // Modal for "Why Not Eligible?"
  const [whyNotEligibleModal, setWhyNotEligibleModal] = useState<{
    drive: PlacementDrive;
    reasons: string[];
  } | null>(null);

  // Load student eligibility results from Supabase
  const loadStudentEligibility = async () => {
    if (!currentStudent) return;
    setIsLoadingEligibility(true);
    try {
      if (supabase) {
        const res = await fetchStudentAllEligibilityResults(currentStudent.id);
        if (res.data) {
          setStudentEligibilityMap(res.data);
        }
      }
    } catch (err) {
      console.error('Error loading student eligibility results:', err);
    } finally {
      setIsLoadingEligibility(false);
    }
  };

  useEffect(() => {
    loadStudentEligibility();
  }, [currentStudent?.id]);

  if (!currentStudent) {
    return (
      <div className="p-12 text-center text-slate-500">
        <p className="font-semibold">No student records found.</p>
      </div>
    );
  }

  const studentApplications = safeApplications.filter(a => a.studentId === currentStudent.id);
  const studentOffers = safeOffers.filter(o => o.studentId === currentStudent.id);
  const acceptedOffer = studentOffers.find(o => o.status === 'Accepted');

  // Handle Apply button click
  const handleApply = async (driveId: string) => {
    if (currentRole !== 'student') {
      addToast('Unauthorized', 'Only student accounts can apply for placement drives.', 'error');
      return;
    }

    if (!currentStudent?.id) {
      addToast('Profile Incomplete', 'Could not locate student ID for your profile.', 'error');
      return;
    }

    if (isApplyingDriveId) return;

    setIsApplyingDriveId(driveId);
    try {
      const res = await applyToDrive(currentStudent.id, driveId);
      if (res.success) {
        await loadStudentEligibility();
      }
    } catch (err: any) {
      console.error('Error applying to drive:', err);
      addToast('Application Failed', err?.message || 'Failed to submit application.', 'error');
    } finally {
      setIsApplyingDriveId(null);
    }
  };

  // Helper to determine eligibility state for a drive using existing project engines
  const getDriveEligibilityState = (drive: PlacementDrive): {
    isEligible: boolean;
    reasons: string[];
  } => {
    // 1. Check if Supabase eligibility results table has a cached pre-evaluated record
    const dbRecord = studentEligibilityMap.get(drive.id);
    if (dbRecord) {
      if (dbRecord.eligible) {
        return { isEligible: true, reasons: [] };
      } else {
        const reasons = Array.isArray(dbRecord.reasons) ? dbRecord.reasons : [];
        return { isEligible: false, reasons: reasons.length > 0 ? reasons : ['Eligibility criteria not satisfied.'] };
      }
    }

    // 2. Deterministic local rule engine (source of truth when no cached DB record exists)
    const localEval = evaluateEligibility(currentStudent, drive);
    return {
      isEligible: localEval.isEligible,
      reasons: localEval.reasons
    };
  };

  const getApplicationStatusBadge = (status: ApplicationStatus | string) => {
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
      case 'Withdrawn':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Student Switcher Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center font-bold text-lg">
            {(currentStudent?.name || 'S')?.charAt(0) || 'S'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{currentStudent?.name || 'Student'}</h1>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20">
                {currentStudent?.placementStatus || 'Unplaced'}
              </span>
            </div>
            <p className="text-xs text-blue-100 mt-0.5">
              Roll: {currentStudent?.enrollmentNumber || '—'} • {currentStudent?.branch || '—'} • Batch {currentStudent?.graduationYear || 2026}
            </p>
          </div>
        </div>

        {/* Quick Switch student dropdown (only available in demo / unauthenticated mode) */}
        {(!isAuthenticated || userProfile?.role !== 'student') && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-blue-100 text-[11px] font-semibold">Demo Student:</span>
            <select
              id="student-switcher-select"
              value={currentStudent.id}
              onChange={e => setActiveStudentId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold focus:outline-none cursor-pointer"
            >
              {(students || []).map(s => {
                const sOffers = (offers || []).filter(o => o.studentId === s.id && o.status === 'Accepted');
                const offerText = sOffers.length > 0 ? ` [₹${sOffers[0].packageLPA} LPA Offer]` : '';
                return (
                  <option key={s.id} value={s.id} className="text-slate-900">
                    {s.name} ({s.branch}, {s.cgpa} CGPA{offerText})
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Academic Highlights & Policy Standing */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Academic CGPA</span>
          <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
            {(currentStudent.cgpa ?? 0).toFixed(2)} <span className="text-xs text-slate-400 font-normal">/ 10</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Active Backlogs</span>
          <div className={`text-xl font-extrabold mt-0.5 ${currentStudent.backlogs === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {currentStudent.backlogs === 0 ? '0 (Clean)' : `${currentStudent.backlogs} Backlog`}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Attendance</span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            {currentStudent.attendance}%
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Offer Standing</span>
          <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">
            {acceptedOffer ? (
              <span className="text-emerald-600 font-extrabold">₹{acceptedOffer.packageLPA} LPA ({acceptedOffer.companyName})</span>
            ) : (
              <span className="text-slate-500">Unplaced (Open for all)</span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs: Available Drives vs My Applications */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          id="tab-available-drives"
          onClick={() => setActiveTab('drives')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'drives'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Available Drives ({safeDrives.length})</span>
        </button>

        <button
          id="tab-my-applications"
          onClick={() => setActiveTab('my-applications')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'my-applications'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>My Applications ({studentApplications.length})</span>
        </button>
      </div>

      {/* TAB 1: Available Drives */}
      {activeTab === 'drives' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-slate-900 dark:text-white text-base">
                Placement Drives & Opportunities
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Eligibility status is determined deterministically by the rule engine.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {safeDrives.map(drive => {
              const eligibilityState = getDriveEligibilityState(drive);
              const offerPolicyResult = checkOfferPolicy(currentStudent, drive);
              const isEligible = eligibilityState.isEligible && !offerPolicyResult.blocked;
              const ineligibilityReasons = !eligibilityState.isEligible
                ? eligibilityState.reasons
                : (offerPolicyResult.blocked ? [offerPolicyResult.reason] : []);

              const hasApplied = studentApplications.some(a => a.driveId === drive.id) ||
                safeApplications.some(a => a.studentId === currentStudent.id && a.driveId === drive.id);

              return (
                <div
                  key={drive.id}
                  id={`drive-card-${drive.id}`}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Company & Role & Package */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        {drive.companyLogo ? (
                          <img
                            src={drive.companyLogo}
                            alt=""
                            className="w-8 h-8 rounded-lg object-contain bg-slate-50 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                            {drive.companyName?.charAt(0) || 'D'}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white">{drive.companyName || 'Company'}</h3>
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{drive.role}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          ₹{drive.packageLPA} LPA
                        </span>
                      </div>
                    </div>

                    {/* Drive Details (Drive Date, Min CGPA, Branches) */}
                    <div className="mt-3.5 space-y-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span>Drive Date:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{drive.driveDate}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Min CGPA:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{drive.minCgpa}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Eligible Branches:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                          {(drive.eligibleBranches || []).join(', ')}
                        </span>
                      </div>
                    </div>

                    {/* Eligibility Status Badge */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Eligibility Status</span>
                      </div>

                      {isEligible ? (
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Eligible to Apply</span>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5" title={ineligibilityReasons.join(', ')}>
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span className="truncate">{offerPolicyResult.blocked ? 'Blocked by Offer Policy' : 'Not Eligible'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    {/* If not eligible, show Why Not Eligible button */}
                    {!isEligible ? (
                      <button
                        type="button"
                        id={`why-not-eligible-btn-${drive.id}`}
                        onClick={() => {
                          setWhyNotEligibleModal({
                            drive,
                            reasons: ineligibilityReasons.length > 0 ? ineligibilityReasons : ['Eligibility criteria not satisfied.']
                          });
                        }}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Why Not Eligible?</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">{drive.location || 'On-Campus'}</span>
                    )}

                    {/* Action Button: Applied / Not Eligible / Apply Now */}
                    {hasApplied ? (
                      /* B) If the student has already applied: Show disabled "Applied" */
                      <button
                        type="button"
                        id={`applied-btn-${drive.id}`}
                        disabled={true}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold flex items-center gap-1.5 cursor-not-allowed opacity-90 transition-all"
                        title="You have already applied for this placement drive"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Applied</span>
                      </button>
                    ) : !isEligible ? (
                      /* C) If the student is NOT eligible: Show disabled "Not Eligible" */
                      <button
                        type="button"
                        id={`not-eligible-btn-${drive.id}`}
                        disabled={true}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs cursor-not-allowed border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all"
                        title={ineligibilityReasons.join(', ') || 'You do not satisfy eligibility criteria for this placement drive.'}
                      >
                        <XCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>Not Eligible</span>
                      </button>
                    ) : (
                      /* A) If the student is ELIGIBLE and has NOT applied: Show active "Apply Now" */
                      <button
                        type="button"
                        id={`apply-btn-${drive.id}`}
                        disabled={isApplyingDriveId === drive.id}
                        onClick={() => handleApply(drive.id)}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                      >
                        {isApplyingDriveId === drive.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Applying...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Apply Now</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: My Applications */}
      {activeTab === 'my-applications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-slate-900 dark:text-white text-base">
                My Placement Applications
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Track status and stage progression for drives you have applied to.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {studentApplications.length} Submissions
            </span>
          </div>

          {studentApplications.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <FileCheck2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">No applications yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Explore the Available Drives tab to check your eligibility and submit applications.
              </p>
              <button
                onClick={() => setActiveTab('drives')}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
              >
                Browse Available Drives
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="w-full max-w-full overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Package</th>
                      <th className="py-3 px-3">Applied Date</th>
                      <th className="py-3 px-4 text-right">Application Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {studentApplications.map(app => (
                      <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        {/* Company */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {app.companyLogo ? (
                              <img
                                src={app.companyLogo}
                                alt=""
                                className="w-6 h-6 rounded-md object-contain"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Building2 className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="font-bold text-slate-900 dark:text-white">{app.companyName}</span>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                          {app.role}
                        </td>

                        {/* Package */}
                        <td className="py-3.5 px-3 font-extrabold text-blue-600 dark:text-blue-400">
                          ₹{app.packageLPA} LPA
                        </td>

                        {/* Applied Date */}
                        <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400">
                          {app.appliedDate}
                        </td>

                        {/* Application Status Badge */}
                        <td className="py-3.5 px-4 text-right">
                          <span className={`inline-flex items-center text-[11px] font-bold px-3 py-1 rounded-full ${getApplicationStatusBadge(app.status)}`}>
                            {app.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* "Why Not Eligible?" Details Modal */}
      {whyNotEligibleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Eligibility Evaluation Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {whyNotEligibleModal.drive.companyName} • {whyNotEligibleModal.drive.role}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-300">
                Deterministic Engine Reasons:
              </div>
              <ul className="space-y-1.5">
                {(whyNotEligibleModal.reasons || []).map((reason, idx) => (
                  <li key={idx} className="text-rose-700 dark:text-rose-300 font-medium flex items-start gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Student vs Drive Criteria comparison */}
            <div className="text-[11px] grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
              <div className="p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-800">
                <span className="font-bold block text-slate-700 dark:text-slate-200">Your Stats</span>
                <div>CGPA: <span className="font-bold">{currentStudent.cgpa}</span></div>
                <div>Branch: <span className="font-bold">{currentStudent.branch}</span></div>
                <div>Backlogs: <span className="font-bold">{currentStudent.backlogs}</span></div>
                <div>Attendance: <span className="font-bold">{currentStudent.attendance}%</span></div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-800">
                <span className="font-bold block text-slate-700 dark:text-slate-200">Drive Criteria</span>
                <div>Min CGPA: <span className="font-bold">{whyNotEligibleModal.drive.minCgpa}</span></div>
                <div>Branches: <span className="font-bold">{(whyNotEligibleModal.drive.eligibleBranches || []).join(', ')}</span></div>
                <div>Max Backlogs: <span className="font-bold">{whyNotEligibleModal.drive.maxBacklogs}</span></div>
                <div>Min Attend: <span className="font-bold">{whyNotEligibleModal.drive.minAttendance || 75}%</span></div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                id="close-why-not-eligible-btn"
                onClick={() => setWhyNotEligibleModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
