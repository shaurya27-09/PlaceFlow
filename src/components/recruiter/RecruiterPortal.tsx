import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Sparkles,
  FileCheck2,
  Award
} from 'lucide-react';
import { ApplicationStatus } from '../../types';

export const RecruiterPortal: React.FC = () => {
  const {
    companies,
    drives,
    applications,
    updateApplicationStatus,
    addToast,
    setCurrentView,
    setSelectedDriveForEligibility
  } = useApp();

  const safeCompanies = companies || [];
  const safeDrives = drives || [];
  const safeApplications = applications || [];

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    safeCompanies[0]?.id || ''
  );
  const [selectedDriveId, setSelectedDriveId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentCompany = safeCompanies.find(c => c.id === selectedCompanyId) || safeCompanies[0];
  const companyDrives = safeDrives.filter(d => d.companyId === currentCompany?.id || d.companyName === currentCompany?.name);

  const companyApplications = safeApplications.filter(a => {
    const isCompanyDrive = companyDrives.some(d => d.id === a.driveId) || a.companyName === currentCompany?.name;
    if (!isCompanyDrive) return false;
    if (selectedDriveId !== 'ALL' && a.driveId !== selectedDriveId) return false;
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (a.studentName || '').toLowerCase().includes(q);
      const rollMatch = (a.studentEnrollment || '').toLowerCase().includes(q);
      const branchMatch = (a.studentBranch || '').toLowerCase().includes(q);
      const roleMatch = (a.role || '').toLowerCase().includes(q);
      if (!nameMatch && !rollMatch && !branchMatch && !roleMatch) return false;
    }
    return true;
  });

  const handleStatusChange = (appId: string, newStatus: ApplicationStatus) => {
    updateApplicationStatus(appId, newStatus);
    addToast('Candidate Status Updated', `Application status transitioned to "${newStatus}".`, 'success');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Recruiter Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center font-bold text-xl border border-white/20">
            {currentCompany?.logo ? (
              <img src={currentCompany.logo} alt={currentCompany.name} className="w-9 h-9 object-contain" />
            ) : (
              <Building2 className="w-7 h-7 text-blue-300" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">
                {currentCompany?.name || 'Recruiter Corporate Console'}
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/40 text-blue-200">
                {currentCompany?.tier || 'Corporate Partner'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Recruiter & Talent Acquisition Dashboard • USICT Campus Hiring 2026
            </p>
          </div>
        </div>

        {/* Company Switcher Dropdown */}
        <div className="flex items-center gap-2 text-xs bg-white/10 backdrop-blur-xs px-3 py-2 rounded-xl border border-white/20">
          <span className="text-slate-300 font-medium">Switch Company:</span>
          <select
            value={currentCompany?.id}
            onChange={e => setSelectedCompanyId(e.target.value)}
            className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
          >
            {safeCompanies.map(c => (
              <option key={c.id} value={c.id} className="text-slate-900">
                {c.name} ({c.tier})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Active Campus Drives</span>
          <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {companyDrives.length} Drives
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Total Applicants</span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            {companyApplications.length} Candidates
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Shortlisted / Interview</span>
          <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {companyApplications.filter(a => a.status === 'Shortlisted' || a.status === 'Interview').length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Offered / Selected</span>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {companyApplications.filter(a => a.status === 'Offered' || a.status === 'Offer Accepted' || a.status === 'Selected').length}
          </div>
        </div>
      </div>

      {/* Company's Campus Drives Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-extrabold text-slate-900 dark:text-white text-base">
              Hiring Drives for {currentCompany?.name}
            </h2>
          </div>
          <button
            onClick={() => setCurrentView('drives')}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>All Campus Drives</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companyDrives.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
              <p className="text-xs font-semibold">No active placement drives found for {currentCompany?.name}.</p>
            </div>
          ) : (
            companyDrives.map(drive => (
              <div
                key={drive.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{drive.role}</h3>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-extrabold mt-0.5">
                        ₹{drive.packageLPA} LPA ({drive.tier})
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      {drive.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <div>Min CGPA: <span className="font-semibold text-slate-700 dark:text-slate-300">{drive.minCgpa}</span></div>
                    <div>Eligible Branches: <span className="font-semibold text-slate-700 dark:text-slate-300">{drive.eligibleBranches.join(', ')}</span></div>
                    <div>Drive Date: <span className="font-semibold text-slate-700 dark:text-slate-300">{drive.driveDate}</span></div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {drive.applicationsCount || 0} Registered
                  </span>
                  <button
                    onClick={() => {
                      setSelectedDriveForEligibility(drive);
                      setCurrentView('eligibility-results');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition-colors"
                  >
                    View Roster
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Candidate Pipeline / Application Review */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Candidate Pipeline & Evaluation</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Shortlist, invite for interview, or extend offers to eligible students
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search candidate..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white w-44 sm:w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Pipeline Stages</option>
              <option value="Applied">Applied</option>
              <option value="Shortlisted">Shortlisted</option>
              <option value="Interview">Interview</option>
              <option value="Offered">Offered</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-3">Roll Number</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">CGPA</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Current Status</th>
                <th className="py-3 px-4 text-right">Recruiter Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {companyApplications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No applications match the selected criteria.
                  </td>
                </tr>
              ) : (
                companyApplications.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {app.studentName}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {app.studentEnrollment || '—'}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {app.studentBranch}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                      {(app.studentCgpa ?? 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300">
                      {app.role}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        app.status === 'Offered' || app.status === 'Offer Accepted'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : app.status === 'Shortlisted' || app.status === 'Interview'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : app.status === 'Rejected'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {app.status === 'Applied' && (
                          <button
                            onClick={() => handleStatusChange(app.id, 'Shortlisted')}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                          >
                            Shortlist
                          </button>
                        )}
                        {(app.status === 'Applied' || app.status === 'Shortlisted') && (
                          <button
                            onClick={() => handleStatusChange(app.id, 'Interview')}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                          >
                            Interview
                          </button>
                        )}
                        {app.status === 'Interview' && (
                          <button
                            onClick={() => handleStatusChange(app.id, 'Offered')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                          >
                            Extend Offer
                          </button>
                        )}
                        {app.status !== 'Rejected' && app.status !== 'Offer Accepted' && (
                          <button
                            onClick={() => handleStatusChange(app.id, 'Rejected')}
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-400 hover:text-rose-600 font-semibold text-xs"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
