import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Student } from '../../types';
import {
  X,
  GraduationCap,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Mail,
  Phone,
  Layers,
  Sparkles,
  Edit3,
  Trash2
} from 'lucide-react';

interface StudentDetailDrawerProps {
  student: Student | null;
  onClose: () => void;
  onEdit?: (student: Student) => void;
}

export const StudentDetailDrawer: React.FC<StudentDetailDrawerProps> = ({ student, onClose, onEdit }) => {
  const {
    drives,
    applications,
    evaluateEligibility,
    acceptOffer,
    declineOffer,
    deleteStudent,
    offers,
    activeStudentId,
    setActiveStudentId,
    setCurrentRole,
    setCurrentView
  } = useApp();

  const safeDrives = drives || [];
  const safeApplications = applications || [];
  const safeOffers = offers || [];

  const [selectedDriveId, setSelectedDriveId] = useState<string>(safeDrives[0]?.id || '');

  if (!student) return null;

  const studentApplications = safeApplications.filter(a => a.studentId === student.id);
  const studentOffers = safeOffers.filter(o => o.studentId === student.id);
  const selectedDrive = safeDrives.find(d => d.id === selectedDriveId) || safeDrives[0];

  const eligibilityCheck = selectedDrive ? evaluateEligibility(student, selectedDrive) : null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl overflow-y-auto border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between animate-in slide-in-from-right duration-300">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {student?.name?.charAt(0) || 'S'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{student?.name || 'Student'}</h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    student?.placementStatus === 'Dream Placed'
                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                      : student?.placementStatus === 'Placed'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                    {student?.placementStatus || 'Unplaced'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Roll: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{student?.enrollmentNumber || '—'}</span> • {student?.branch || '—'} Department • Batch {student?.graduationYear || 2026}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {onEdit && (
                <button
                  id="drawer-edit-student-btn"
                  onClick={() => onEdit(student)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold shadow-2xs"
                  title="Edit Student"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
              <button
                id="drawer-delete-student-btn"
                onClick={() => {
                  if (confirm(`Delete student ${student?.name || 'record'} from Supabase?`)) {
                    deleteStudent(student.id);
                    onClose();
                  }
                }}
                className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors flex items-center gap-1 text-xs font-semibold shadow-2xs"
                title="Delete Student"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
              <button
                id="close-student-drawer-btn"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Academic CGPA</span>
              <div className="text-base font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                {(student.cgpa ?? 0).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ 10</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Active Backlogs</span>
              <div className={`text-base font-extrabold mt-0.5 ${student.backlogs === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {student.backlogs === 0 ? '0 (Clean)' : `${student.backlogs} Backlog`}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Attendance Record</span>
              <div className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                {student.attendance}%
              </div>
            </div>
          </div>

          {/* Contact & Skills */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{student.email}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{student.phone}</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                Verified Technical Skills
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(student.skills || []).map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Live Placement Offers & Accept/Decline Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Placement Offers ({(studentOffers || []).length})</span>
              </h3>
            </div>

            {(studentOffers || []).length > 0 ? (
              <div className="space-y-2">
                {(studentOffers || []).map(offer => (
                  <div
                    key={offer.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                      offer.status === 'Accepted'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
                        : offer.status === 'Blocked by Policy'
                        ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{offer.companyName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          offer.status === 'Accepted'
                            ? 'bg-emerald-600 text-white'
                            : offer.status === 'Declined'
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600'
                            : offer.status === 'Blocked by Policy'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}>
                          {offer.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {offer.role} • Package: <span className="font-bold text-slate-800 dark:text-slate-200">₹{offer.packageLPA} LPA</span> ({offer.tier})
                      </p>
                      {offer.policyViolationReason && (
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 font-medium">
                          {offer.policyViolationReason}
                        </p>
                      )}
                    </div>

                    {/* Accept / Decline actions if Pending */}
                    {offer.status === 'Pending' && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          id={`accept-offer-${offer.id}`}
                          onClick={() => acceptOffer(offer.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          id={`decline-offer-${offer.id}`}
                          onClick={() => declineOffer(offer.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-center text-xs text-slate-400">
                No active placement offers yet.
              </div>
            )}
          </div>

          {/* Interactive Drive Eligibility Diagnostic Simulator */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Eligibility Engine Simulator</span>
              </div>
              <span className="text-[10px] text-slate-500">Live Rule Evaluation</span>
            </div>

            <div className="text-xs">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Select Drive to test candidate eligibility:
              </label>
              <select
                id="simulator-drive-select"
                value={selectedDriveId}
                onChange={e => setSelectedDriveId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                {(drives || []).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.companyName} — {d.role} (₹{d.packageLPA} LPA • Min {d.minCgpa} CGPA)
                  </option>
                ))}
              </select>
            </div>

            {eligibilityCheck && selectedDrive && (
              <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                eligibilityCheck.isEligible
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {eligibilityCheck.isEligible ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Eligible for {selectedDrive.companyName} Drive</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Ineligible for {selectedDrive.companyName}</span>
                    </>
                  )}
                </div>

                {!eligibilityCheck.isEligible && (
                  <div className="space-y-1 text-[11px] pl-6">
                    {(eligibilityCheck.reasons || []).map((r, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-rose-700 dark:text-rose-300">
                        <span>•</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
