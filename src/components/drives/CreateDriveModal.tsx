import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PlacementDrive, Branch, CompanyTier, Company } from '../../types';
import { fetchCompaniesFromSupabase } from '../../lib/supabase';
import {
  X,
  Briefcase,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Users,
  Loader2
} from 'lucide-react';

interface CreateDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateDriveModal: React.FC<CreateDriveModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const {
    companies: contextCompanies,
    students,
    addDrive,
    getEligibleStudentsForDrive,
    setSelectedDriveForEligibility,
    setCurrentView
  } = useApp();

  const [companiesList, setCompaniesList] = useState<Company[]>(contextCompanies || []);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [role, setRole] = useState('Software Development Engineer');
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
  const [jobDescription, setJobDescription] = useState('Build scalable distributed systems, cloud microservices, and AI features.');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Live Eligibility Check state
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [ineligibleCount, setIneligibleCount] = useState<number | null>(null);

  // Load companies directly from Supabase companies table
  useEffect(() => {
    async function loadCompanies() {
      try {
        const res = await fetchCompaniesFromSupabase();
        if (res.data && res.data.length > 0) {
          setCompaniesList(res.data);
          if (!selectedCompanyId) {
            setSelectedCompanyId(res.data[0].id);
          }
        } else if (contextCompanies && contextCompanies.length > 0) {
          setCompaniesList(contextCompanies);
          if (!selectedCompanyId) {
            setSelectedCompanyId(contextCompanies[0].id);
          }
        }
      } catch (err: any) {
        console.error('Error loading companies for Create Drive dropdown:', err);
        if (contextCompanies && contextCompanies.length > 0) {
          setCompaniesList(contextCompanies);
          if (!selectedCompanyId) {
            setSelectedCompanyId(contextCompanies[0].id);
          }
        }
      }
    }

    if (isOpen) {
      loadCompanies();
    }
  }, [isOpen, contextCompanies]);

  if (!isOpen) return null;

  const allBranches: Branch[] = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'Civil'];

  const toggleBranch = (branch: Branch) => {
    setEligibleBranches(prev =>
      prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
    );
    setEligibilityChecked(false);
  };

  const selectedCompany = companiesList.find(c => String(c.id) === String(selectedCompanyId)) || companiesList[0];
  const companyDisplayName = (selectedCompany as any)?.company_name || selectedCompany?.name || 'Company';

  const handleRunEligibilityCheck = () => {
    // Construct preview drive object with deterministic criteria
    const previewDrive: PlacementDrive = {
      id: 'preview',
      companyId: selectedCompany?.id || 'comp-preview',
      companyName: companyDisplayName,
      companyLogo: selectedCompany?.logo || '',
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
      status: 'Active',
      rounds: ['Online Assessment', 'Technical Interview', 'HR Interview']
    };

    const { eligible, ineligible } = getEligibleStudentsForDrive(previewDrive);
    setEligibleCount(eligible.length);
    setIneligibleCount(ineligible.length);
    setEligibilityChecked(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedCompanyId && companiesList.length > 0) {
      setSelectedCompanyId(companiesList[0].id);
    }

    if (eligibleBranches.length === 0) {
      setFormError('Please select at least one eligible branch.');
      return;
    }

    setIsSubmitting(true);

    try {
      const drivePayload = {
        companyId: selectedCompanyId || selectedCompany?.id || '',
        company_id: selectedCompanyId || selectedCompany?.id || '',
        companyName: companyDisplayName,
        companyLogo: selectedCompany?.logo || '',
        role,
        jobDescription,
        packageLPA: parseFloat(packageLPA) || 10,
        package_lpa: parseFloat(packageLPA) || 10,
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
        status: 'Active' as const,
        rounds: ['Online Test', 'Technical Round 1', 'Managerial Interview']
      };

      // Register in AppContext (updates local storage and syncs to Supabase if configured)
      const created = await addDrive(drivePayload);

      if (onSuccess) {
        onSuccess();
      }

      onClose();
      // Open results immediately
      setSelectedDriveForEligibility(created);
      setCurrentView('eligibility-results');
    } catch (err: any) {
      console.error('Failed to create placement drive:', err);
      setFormError(err?.message || 'Failed to create drive.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh] sm:max-h-[85vh] my-auto animate-in zoom-in-95 overflow-hidden">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">Create New Placement Drive</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configure drive criteria and save directly to Supabase placement_drives</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
            aria-label="Close modal"
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
                id="create-drive-company"
                value={selectedCompanyId}
                onChange={e => {
                  setSelectedCompanyId(e.target.value);
                  setEligibilityChecked(false);
                }}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {companiesList.length === 0 ? (
                  <option value="">No companies found in database</option>
                ) : (
                  companiesList.map(c => {
                    const cName = (c as any).company_name || c.name;
                    return (
                      <option key={c.id} value={c.id}>
                        {cName} ({c.tier || 'Core'})
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Job Role / Designation *
              </label>
              <input
                type="text"
                id="create-drive-role"
                value={role}
                onChange={e => {
                  setRole(e.target.value);
                  setEligibilityChecked(false);
                }}
                placeholder="e.g. Software Development Engineer"
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
                id="create-drive-package"
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
                id="create-drive-tier"
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
                id="create-drive-batch"
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
                  id="create-drive-min-cgpa"
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
                  id="create-drive-max-backlogs"
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
                  id="create-drive-min-attendance"
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
                      id={`branch-toggle-${branch}`}
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

          {/* Offer Policy Rule & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Institutional Offer Policy Rule *
              </label>
              <select
                id="create-drive-offer-policy"
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
                Drive Date *
              </label>
              <input
                type="date"
                id="create-drive-date"
                value={driveDate}
                onChange={e => setDriveDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Prominent Run Eligibility Check Section */}
          <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-blue-900 dark:text-blue-200 text-xs flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Eligibility Engine Gating Check</span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                Instantly simulate candidate filtering across all {students.length} students.
              </p>
            </div>

            <button
              type="button"
              id="run-eligibility-check-btn"
              onClick={handleRunEligibilityCheck}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all shrink-0 flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Run Eligibility Check</span>
            </button>
          </div>

          {/* Result banner if checked */}
          {eligibilityChecked && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm">
                    {eligibleCount} of {students.length} students are eligible.
                  </span>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    ({ineligibleCount} students auto-gated due to CGPA, Backlogs, Attendance, or Offer Policy rules)
                  </p>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Fixed Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-2 shrink-0 bg-slate-50/75 dark:bg-slate-900/75 backdrop-blur-xs">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              id="publish-placement-drive-btn"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 min-h-[44px] touch-manipulation"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to Supabase...</span>
                </>
              ) : (
                <>
                  <span>Publish Drive & View Roster</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

