import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PlacementDrive, Branch, CompanyTier, DriveStatus, Company } from '../../types';
import { fetchCompaniesFromSupabase } from '../../lib/supabase';
import {
  X,
  Briefcase,
  Zap,
  CheckCircle2,
  Save,
  Building2,
  Layers,
  MapPin,
  Clock,
  Loader2
} from 'lucide-react';

interface EditDriveModalProps {
  drive: PlacementDrive | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditDriveModal: React.FC<EditDriveModalProps> = ({ drive, isOpen, onClose, onSuccess }) => {
  const {
    companies: contextCompanies,
    students,
    updateDrive,
    getEligibleStudentsForDrive
  } = useApp();

  const [companiesList, setCompaniesList] = useState<Company[]>(contextCompanies || []);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [role, setRole] = useState('');
  const [packageLPA, setPackageLPA] = useState<string>('12.0');
  const [tier, setTier] = useState<CompanyTier>('Super Dream');
  const [minCgpa, setMinCgpa] = useState<string>('7.5');
  const [maxBacklogs, setMaxBacklogs] = useState<number>(0);
  const [eligibleBranches, setEligibleBranches] = useState<Branch[]>(['CSE', 'IT']);
  const [minAttendance, setMinAttendance] = useState<number>(75);
  const [graduationYear, setGraduationYear] = useState<number>(2026);
  const [offerPolicyRule, setOfferPolicyRule] = useState<PlacementDrive['offerPolicyRule']>('Dream Upgrade Only (>= 1.5x)');
  const [driveDate, setDriveDate] = useState('2026-09-10');
  const [registrationDeadline, setRegistrationDeadline] = useState('2026-09-05');
  const [location, setLocation] = useState<'On-Campus' | 'Virtual' | 'Hybrid'>('Virtual');
  const [status, setStatus] = useState<DriveStatus>('Active');
  const [jobDescription, setJobDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Live Eligibility Check state
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [ineligibleCount, setIneligibleCount] = useState<number | null>(null);

  // Load companies
  useEffect(() => {
    async function loadCompanies() {
      try {
        const res = await fetchCompaniesFromSupabase();
        if (res.data && res.data.length > 0) {
          setCompaniesList(res.data);
        } else if (contextCompanies && contextCompanies.length > 0) {
          setCompaniesList(contextCompanies);
        }
      } catch (err: any) {
        console.error('Error fetching companies in EditDriveModal:', err);
        if (contextCompanies && contextCompanies.length > 0) {
          setCompaniesList(contextCompanies);
        }
      }
    }

    if (isOpen) {
      loadCompanies();
    }
  }, [isOpen, contextCompanies]);

  useEffect(() => {
    if (drive) {
      // Resolve company id
      const matchedComp = companiesList.find(
        c => String(c.id) === String(drive.companyId) || ((c as any).company_name || c.name) === drive.companyName
      );
      setSelectedCompanyId(matchedComp?.id || drive.companyId || (companiesList[0]?.id || ''));
      setRole(drive.role || '');
      setPackageLPA(drive.packageLPA?.toString() || '10');
      setTier(drive.tier || 'Core');
      setMinCgpa(drive.minCgpa?.toString() || '7.0');
      setMaxBacklogs(drive.maxBacklogs ?? 0);
      setEligibleBranches(drive.eligibleBranches || ['CSE', 'IT']);
      setMinAttendance(drive.minAttendance ?? 75);
      setGraduationYear(drive.graduationYear ?? 2026);
      setOfferPolicyRule(drive.offerPolicyRule || 'Dream Upgrade Only (>= 1.5x)');
      setDriveDate(drive.driveDate || '');
      setRegistrationDeadline(drive.registrationDeadline || drive.driveDate || '');
      setLocation(drive.location || 'On-Campus');
      setStatus(drive.status || 'Active');
      setJobDescription(drive.jobDescription || '');
      setEligibilityChecked(false);
      setFormError(null);
    }
  }, [drive, companiesList]);

  if (!isOpen || !drive) return null;

  const allBranches: Branch[] = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'Civil'];

  const toggleBranch = (branch: Branch) => {
    setEligibleBranches(prev =>
      prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
    );
    setEligibilityChecked(false);
  };

  const selectedCompany = companiesList.find(c => String(c.id) === String(selectedCompanyId)) || companiesList[0];
  const companyDisplayName = (selectedCompany as any)?.company_name || selectedCompany?.name || drive.companyName || 'Company';

  const handleRunEligibilityCheck = () => {
    const previewDrive: PlacementDrive = {
      ...drive,
      companyId: selectedCompanyId || drive.companyId,
      companyName: companyDisplayName,
      role,
      jobDescription,
      packageLPA: parseFloat(packageLPA) || 12,
      tier,
      minCgpa: parseFloat(minCgpa) || 7.5,
      maxBacklogs: Number(maxBacklogs),
      eligibleBranches,
      minAttendance: Number(minAttendance),
      graduationYear: Number(graduationYear),
      offerPolicyRule,
      driveDate,
      registrationDeadline,
      location,
      status
    };

    const { eligible, ineligible } = getEligibleStudentsForDrive(previewDrive);
    setEligibleCount(eligible.length);
    setIneligibleCount(ineligible.length);
    setEligibilityChecked(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (eligibleBranches.length === 0) {
      setFormError('Please select at least one eligible branch.');
      return;
    }

    setIsSubmitting(true);

    try {
      const updatePayload: Partial<PlacementDrive> & Record<string, any> = {
        companyId: selectedCompanyId || drive.companyId,
        company_id: selectedCompanyId || drive.companyId,
        companyName: companyDisplayName,
        company_name: companyDisplayName,
        companyLogo: selectedCompany?.logo || drive.companyLogo,
        role,
        jobDescription,
        packageLPA: parseFloat(packageLPA) || 10,
        package_lpa: parseFloat(packageLPA) || 10,
        offer_limit_lpa: parseFloat(packageLPA) || 10,
        tier,
        minCgpa: parseFloat(minCgpa) || 7.0,
        min_cgpa: parseFloat(minCgpa) || 7.0,
        maxBacklogs: Number(maxBacklogs),
        max_backlogs: Number(maxBacklogs),
        eligibleBranches,
        eligible_branches: eligibleBranches,
        minAttendance: Number(minAttendance),
        min_attendance: Number(minAttendance),
        graduationYear: Number(graduationYear),
        graduation_year: Number(graduationYear),
        offerPolicyRule,
        offer_policy_rule: offerPolicyRule,
        driveDate,
        drive_date: driveDate,
        registrationDeadline,
        location,
        status
      };

      // Update in context (handles local persistence and syncs to Supabase if configured)
      await updateDrive(drive.id, updatePayload);

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to update placement drive:', err);
      setFormError(err?.message || 'Failed to update drive.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full flex flex-col max-h-[82vh] my-auto animate-in zoom-in-95 overflow-hidden">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">Edit Placement Drive</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Update drive parameters and sync criteria with Supabase database</p>
            </div>
          </div>
          <button
            id="close-edit-drive-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
              {formError}
            </div>
          )}

          {/* Company & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recruiting Company *
              </label>
              <select
                id="edit-drive-company"
                value={selectedCompanyId}
                onChange={e => {
                  setSelectedCompanyId(e.target.value);
                  setEligibilityChecked(false);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {companiesList.map(c => {
                  const cName = (c as any).company_name || c.name;
                  return (
                    <option key={c.id} value={c.id}>
                      {cName} ({c.tier || 'Core'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Job Role / Designation *
              </label>
              <input
                type="text"
                id="edit-drive-role"
                value={role}
                onChange={e => {
                  setRole(e.target.value);
                  setEligibilityChecked(false);
                }}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Package & Tier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Package (₹ LPA CTC) *
              </label>
              <input
                type="number"
                id="edit-drive-package"
                step="0.1"
                min="1"
                value={packageLPA}
                onChange={e => {
                  setPackageLPA(e.target.value);
                  const pkg = parseFloat(e.target.value) || 0;
                  if (pkg >= 12) setTier('Super Dream');
                  else if (pkg >= 8) setTier('Dream');
                  else if (pkg >= 5) setTier('Core');
                  else setTier('Mass');
                  setEligibilityChecked(false);
                }}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category Tier
              </label>
              <select
                id="edit-drive-tier"
                value={tier}
                onChange={e => setTier(e.target.value as CompanyTier)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Super Dream">Super Dream (&gt;= ₹12 LPA)</option>
                <option value="Dream">Dream (₹8 - ₹12 LPA)</option>
                <option value="Core">Core (₹5 - ₹8 LPA)</option>
                <option value="Mass">Mass Recruiter (&lt; ₹5 LPA)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Graduation Batch
              </label>
              <input
                type="number"
                id="edit-drive-batch"
                value={graduationYear}
                onChange={e => setGraduationYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Academic Eligibility Thresholds */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Academic Eligibility Gating Thresholds</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Minimum CGPA (0-10) *
                </label>
                <input
                  type="number"
                  id="edit-drive-min-cgpa"
                  step="0.05"
                  min="0"
                  max="10"
                  value={minCgpa}
                  onChange={e => {
                    setMinCgpa(e.target.value);
                    setEligibilityChecked(false);
                  }}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Maximum Active Backlogs *
                </label>
                <input
                  type="number"
                  id="edit-drive-max-backlogs"
                  min="0"
                  max="10"
                  value={maxBacklogs}
                  onChange={e => {
                    setMaxBacklogs(Number(e.target.value));
                    setEligibilityChecked(false);
                  }}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Minimum Attendance % *
                </label>
                <input
                  type="number"
                  id="edit-drive-min-attendance"
                  min="0"
                  max="100"
                  value={minAttendance}
                  onChange={e => {
                    setMinAttendance(Number(e.target.value));
                    setEligibilityChecked(false);
                  }}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Branches check buttons */}
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Eligible Engineering Branches *
              </label>
              <div className="flex flex-wrap gap-2">
                {allBranches.map(branch => {
                  const isSelected = eligibleBranches.includes(branch);
                  return (
                    <button
                      key={branch}
                      type="button"
                      id={`edit-branch-toggle-${branch}`}
                      onClick={() => toggleBranch(branch)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                      }`}
                    >
                      {branch} {isSelected && '✓'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Offer Policy & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Institutional Offer Policy Rule *
              </label>
              <select
                id="edit-drive-offer-policy"
                value={offerPolicyRule}
                onChange={e => {
                  setOfferPolicyRule(e.target.value as any);
                  setEligibilityChecked(false);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Dream Upgrade Only (>= 1.5x)">Dream Upgrade Only (&gt;= 1.5x hike)</option>
                <option value="Must have <= 6 LPA">Must have &lt;= ₹6 LPA existing offer</option>
                <option value="Max 1 Offer">Max 1 Active Offer per Candidate</option>
                <option value="No Restrictions">Open / No Policy Restrictions</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Drive Status *
              </label>
              <select
                id="edit-drive-status"
                value={status}
                onChange={e => setStatus(e.target.value as DriveStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Active">Active / Open</option>
                <option value="Ongoing">Ongoing Rounds</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Drive Date *
              </label>
              <input
                type="date"
                id="edit-drive-date"
                value={driveDate}
                onChange={e => setDriveDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Registration Deadline *
              </label>
              <input
                type="date"
                id="edit-drive-deadline"
                value={registrationDeadline}
                onChange={e => setRegistrationDeadline(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Location Mode
              </label>
              <select
                id="edit-drive-location"
                value={location}
                onChange={e => setLocation(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="On-Campus">On-Campus</option>
                <option value="Virtual">Virtual</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          {/* Job Description */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Job Description / Role Requirements
            </label>
            <textarea
              id="edit-drive-description"
              rows={2}
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Brief description of candidate responsibilities..."
            />
          </div>

          {/* Eligibility Simulation */}
          <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-blue-900 dark:text-blue-200 text-xs flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Eligibility Engine Gating Check</span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                Simulate updated candidate filtering across all {students.length} students.
              </p>
            </div>

            <button
              type="button"
              id="edit-run-eligibility-check-btn"
              onClick={handleRunEligibilityCheck}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all shrink-0 flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Eligibility</span>
            </button>
          </div>

          {eligibilityChecked && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm">
                    {eligibleCount} of {students.length} students would qualify.
                  </span>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    ({ineligibleCount} students auto-gated with updated criteria)
                  </p>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Fixed Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-50/75 dark:bg-slate-900/75 backdrop-blur-xs">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-drive-changes-btn"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold shadow-md shadow-blue-500/25 flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Drive Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

