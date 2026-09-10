import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PlacementDrive, Student } from '../../types';
import {
  evaluateStudentEligibility,
  runEligibilityCheck,
  fetchEligibilityResultsFromSupabase,
  EligibilityResultRecord
} from '../../lib/eligibilityEngine';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Briefcase,
  Users,
  Search,
  Download,
  ArrowLeft,
  Filter,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Play,
  RotateCw,
  Percent,
  Calendar,
  AlertCircle
} from 'lucide-react';

export const EligibilityResultsModal: React.FC = () => {
  const {
    selectedDriveForEligibility,
    setSelectedDriveForEligibility,
    drives,
    students,
    setCurrentView,
    addToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'eligible' | 'ineligible' | 'all'>('eligible');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWhyReason, setActiveWhyReason] = useState<{
    studentName: string;
    enrollmentNumber?: string;
    reasons: string[];
  } | null>(null);

  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [savedDbResults, setSavedDbResults] = useState<Map<string, EligibilityResultRecord>>(new Map());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCheckTimestamp, setLastCheckTimestamp] = useState<string | null>(null);

  // If no drive is currently selected, default to the first active drive
  const currentDrive: PlacementDrive = selectedDriveForEligibility || drives[0];

  // Load existing eligibility results from Supabase whenever currentDrive changes
  useEffect(() => {
    if (!currentDrive) return;

    let isMounted = true;
    const loadSavedResults = async () => {
      try {
        setErrorMessage(null);
        const res = await fetchEligibilityResultsFromSupabase(currentDrive.id);
        if (isMounted) {
          if (res.data && res.data.length > 0) {
            const map = new Map<string, EligibilityResultRecord>();
            res.data.forEach(r => map.set(r.student_id, r));
            setSavedDbResults(map);
            if (res.data[0]?.checked_at) {
              setLastCheckTimestamp(res.data[0].checked_at);
            }
          } else {
            setSavedDbResults(new Map());
          }
        }
      } catch (err: any) {
        console.error('Error loading eligibility results from Supabase:', err);
      }
    };

    loadSavedResults();
    return () => {
      isMounted = false;
    };
  }, [currentDrive?.id]);

  if (!currentDrive) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-500">No drive selected. Return to drives catalog.</p>
        <button
          onClick={() => setCurrentView('drives')}
          className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
        >
          View Drives
        </button>
      </div>
    );
  }

  // Evaluate candidate data against current drive using deterministic engine or saved database records
  const evaluatedList = (students || []).map(student => {
    const studentId = String(student.id);
    const dbRecord = savedDbResults.get(studentId);

    if (dbRecord) {
      return {
        student,
        eligible: dbRecord.eligible,
        reasons: dbRecord.reasons || []
      };
    }

    // Direct deterministic rule evaluation fallback
    const result = evaluateStudentEligibility(student, currentDrive);
    return {
      student,
      eligible: result.eligible,
      reasons: result.reasons
    };
  });

  const totalCount = evaluatedList.length;
  const eligibleItems = evaluatedList.filter(item => item.eligible);
  const ineligibleItems = evaluatedList.filter(item => !item.eligible);
  const eligibleCount = eligibleItems.length;
  const ineligibleCount = ineligibleItems.length;
  const eligibilityPercentage = totalCount > 0 ? Math.round((eligibleCount / totalCount) * 100) : 0;

  // Filter students based on active tab and search query
  const filteredItems = evaluatedList.filter(({ student, eligible }) => {
    if (activeTab === 'eligible' && !eligible) return false;
    if (activeTab === 'ineligible' && eligible) return false;

    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (student?.name || '').toLowerCase().includes(query) ||
      (student?.enrollmentNumber || '').toLowerCase().includes(query) ||
      (student?.branch || '').toLowerCase().includes(query)
    );
  });

  // Handler for Administrator clicking "Run Eligibility Check"
  const handleRunEligibilityCheck = async () => {
    if (!currentDrive) return;

    setIsRunningCheck(true);
    setErrorMessage(null);
    setLoadingMessage(`Checking eligibility for ${students.length} students...`);

    try {
      // 1. Fetch drive & students from Supabase and run deterministic engine, saving to eligibility_results table
      const res = await runEligibilityCheck(currentDrive.id, currentDrive, students);

      if (!res.success && res.error) {
        console.error('Complete Supabase Eligibility Check Error:', res.error);
        setErrorMessage(`Eligibility check error: ${res.error}`);
        addToast('Eligibility Check Failed', res.error, 'error');
      } else {
        // Update local map of saved database results
        const newMap = new Map<string, EligibilityResultRecord>();
        (res.results || []).forEach(r => newMap.set(r.student_id, r));
        setSavedDbResults(newMap);
        setLastCheckTimestamp(new Date().toISOString());

        // Exact requested toast format
        addToast(
          'Eligibility Check Completed',
          `Eligibility check completed. ${res.eligibleCount} of ${res.totalStudents} students are eligible.`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Fatal Supabase eligibility engine error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred while executing the eligibility check.');
      addToast('Error', 'Failed to run eligibility engine. Please inspect console for details.', 'error');
    } finally {
      setIsRunningCheck(false);
      setLoadingMessage('');
    }
  };

  const handleExportRoster = () => {
    const csvRows = [
      ['Student Name', 'Enrollment Number', 'Branch', 'CGPA', 'Backlogs', 'Attendance', 'Graduation Year', 'Eligibility Status', 'Reasons'],
      ...evaluatedList.map(item => [
        `"${item.student.name}"`,
        `"${item.student.enrollmentNumber}"`,
        `"${item.student.branch}"`,
        item.student.cgpa,
        item.student.backlogs,
        `${item.student.attendance}%`,
        item.student.graduationYear || 2026,
        item.eligible ? 'Eligible' : 'Not Eligible',
        `"${(item.reasons || []).join('; ')}"`
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Eligibility_${currentDrive.companyName.replace(/\s+/g, '_')}_${currentDrive.role.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('Eligibility Roster Exported', `Downloaded eligibility manifest for ${currentDrive.companyName} (${eligibleCount} eligible students).`, 'success');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Drive Context Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            id="back-to-drives-btn"
            onClick={() => setCurrentView('drives')}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
            title="Back to Drives"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Placement Eligibility Engine
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {currentDrive.companyName} • {currentDrive.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Deterministic rule evaluation against academic cut-offs and institutional eligibility criteria.
            </p>
          </div>
        </div>

        {/* Action Bar: Drive Selector + Run Eligibility Check Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Drive selector dropdown */}
          <select
            id="eligibility-drive-select"
            value={currentDrive.id}
            onChange={e => {
              const d = drives.find(item => item.id === e.target.value);
              if (d) setSelectedDriveForEligibility(d);
            }}
            className="px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-xs focus:ring-2 focus:ring-blue-500"
          >
            {drives.map(d => (
              <option key={d.id} value={d.id}>
                {d.companyName} — {d.role} (₹{d.packageLPA} LPA)
              </option>
            ))}
          </select>

          {/* Primary "Run Eligibility Check" Button */}
          <button
            id="run-eligibility-check-btn"
            onClick={handleRunEligibilityCheck}
            disabled={isRunningCheck}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            {isRunningCheck ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-white" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Run Eligibility Check</span>
              </>
            )}
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportRoster}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Loading Progress State */}
      {isRunningCheck && (
        <div className="p-4 rounded-2xl bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center gap-3 animate-in fade-in">
          <RotateCw className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
          <div>
            <p className="font-bold text-blue-900 dark:text-blue-200 text-xs">
              {loadingMessage || `Checking eligibility for ${students.length} students...`}
            </p>
            <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
              Evaluating CGPA, backlogs, attendance, eligible branches, and batch parameters in Supabase...
            </p>
          </div>
        </div>
      )}

      {/* Error Alert Display */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-rose-900 dark:text-rose-200">Database Engine Error</span>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={handleRunEligibilityCheck}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0"
          >
            Retry Check
          </button>
        </div>
      )}

      {/* ELIGIBILITY RESULTS STAT METRICS (Required: Total, Eligible, Not Eligible, Percentage) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Students */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Total Students</span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
            {totalCount}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Evaluated for {currentDrive.companyName}
          </span>
        </div>

        {/* Metric 2: Eligible Students (Green Badge) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold">Eligible Students</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {eligibleCount}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block">
            Passed all gating conditions
          </span>
        </div>

        {/* Metric 3: Not Eligible Students (Red Badge) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-rose-700 dark:text-rose-400 text-xs font-bold">Not Eligible Students</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {ineligibleCount}
          </div>
          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5 block">
            Auto-gated with reason logs
          </span>
        </div>

        {/* Metric 4: Eligibility Percentage */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-blue-700 dark:text-blue-400 text-xs font-bold">Eligibility Percentage</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-2">
            {eligibilityPercentage}%
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${eligibilityPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Drive Rule Criteria Specification Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
              Evaluated Rule Criteria: {currentDrive.companyName}
            </span>
          </div>
          {lastCheckTimestamp && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              <Calendar className="w-3 h-3" />
              <span>Last checked: {new Date(lastCheckTimestamp).toLocaleTimeString()}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Package CTC</span>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              ₹{currentDrive.packageLPA} LPA
            </div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">{currentDrive.tier}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Rule 1: Min CGPA</span>
            <div className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">
              ≥ {(currentDrive.minCgpa ?? 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500">CGPA Threshold</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Rule 2 & 3: Backlogs & Attn</span>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              ≤ {currentDrive.maxBacklogs} • ≥ {currentDrive.minAttendance}%
            </div>
            <span className="text-[10px] text-slate-500">Clean Academic Record</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Rule 4: Eligible Branches</span>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate" title={(currentDrive.eligibleBranches || []).join(', ')}>
              {(currentDrive.eligibleBranches || []).join(', ')}
            </div>
            <span className="text-[10px] text-slate-500">Permitted Disciplines</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Rule 5: Graduating Batch</span>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              Class of {currentDrive.graduationYear || 2026}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Strict Cohort Match</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Tabs: Eligible (Green badge) & Not Eligible (Red badge) */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700 max-w-fit">
          <button
            id="tab-eligible"
            onClick={() => setActiveTab('eligible')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'eligible'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Eligible</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
              {eligibleCount}
            </span>
          </button>

          <button
            id="tab-not-eligible"
            onClick={() => setActiveTab('ineligible')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'ineligible'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Not Eligible</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold">
              {ineligibleCount}
            </span>
          </button>

          <button
            id="tab-all-candidates"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            All Candidates ({totalCount})
          </button>
        </div>

        {/* Search Filter */}
        <div className="relative sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, roll, or branch..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Student Name</th>
                <th className="py-3.5 px-3">Enrollment Number</th>
                <th className="py-3.5 px-3">Branch</th>
                <th className="py-3.5 px-3">CGPA</th>
                <th className="py-3.5 px-3">Backlogs</th>
                <th className="py-3.5 px-3">Attendance</th>
                <th className="py-3.5 px-3">Eligibility Status</th>
                <th className="py-3.5 px-4 text-right">Diagnostic Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    No students match the selected tab or search query.
                  </td>
                </tr>
              ) : (
                filteredItems.map(({ student, eligible, reasons }) => {
                  const meetsBranch = (currentDrive.eligibleBranches || []).some(
                    b => b.toLowerCase() === (student.branch || '').toLowerCase()
                  );
                  const meetsCgpa = (student.cgpa ?? 0) >= (currentDrive.minCgpa ?? 0);
                  const meetsBacklogs = (student.backlogs ?? 0) <= (currentDrive.maxBacklogs ?? 0);
                  const meetsAttendance = (student.attendance ?? 0) >= (currentDrive.minAttendance ?? 0);

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Student Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[11px] font-extrabold shrink-0">
                            {student?.name?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <span className="block font-bold">{student?.name || 'Student'}</span>
                            <span className="text-[10px] text-slate-400 font-normal">Class of {student?.graduationYear || 2026}</span>
                          </div>
                        </div>
                      </td>

                      {/* Enrollment Number */}
                      <td className="py-3.5 px-3 font-mono text-slate-700 dark:text-slate-300 font-medium">
                        {student.enrollmentNumber || '—'}
                      </td>

                      {/* Branch */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            meetsBranch
                              ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {student.branch}
                        </span>
                      </td>

                      {/* CGPA */}
                      <td className="py-3.5 px-3 font-mono">
                        <span
                          className={`font-bold ${
                            meetsCgpa
                              ? 'text-slate-900 dark:text-white'
                              : 'text-rose-600 dark:text-rose-400 font-extrabold'
                          }`}
                        >
                          {(student.cgpa ?? 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Backlogs */}
                      <td className="py-3.5 px-3">
                        <span
                          className={
                            meetsBacklogs
                              ? 'text-slate-700 dark:text-slate-300'
                              : 'text-rose-600 dark:text-rose-400 font-bold'
                          }
                        >
                          {student.backlogs}
                        </span>
                      </td>

                      {/* Attendance */}
                      <td className="py-3.5 px-3">
                        <span
                          className={
                            meetsAttendance
                              ? 'text-slate-700 dark:text-slate-300'
                              : 'text-rose-600 dark:text-rose-400 font-bold'
                          }
                        >
                          {student.attendance}%
                        </span>
                      </td>

                      {/* Eligibility Status (Required: Green Badge = Eligible, Red Badge = Not Eligible) */}
                      <td className="py-3.5 px-3">
                        {eligible ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Eligible</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[11px] font-bold border border-rose-200 dark:border-rose-800">
                            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            <span>Not Eligible</span>
                          </span>
                        )}
                      </td>

                      {/* Diagnostic Action: For Ineligible -> "Why?" Button */}
                      <td className="py-3.5 px-4 text-right">
                        {eligible ? (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Meets all criteria</span>
                          </span>
                        ) : (
                          <button
                            id={`why-ineligible-${student.id}`}
                            onClick={() =>
                              setActiveWhyReason({
                                studentName: student.name,
                                enrollmentNumber: student.enrollmentNumber,
                                reasons: reasons && reasons.length > 0 ? reasons : ['Failed drive eligibility criteria']
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            <span>Why?</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* "Why?" Ineligible Diagnostic Modal (Displaying reasons stored in eligibility_results) */}
      {activeWhyReason && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-2xl max-w-md w-full flex flex-col max-h-[85vh] my-auto animate-in zoom-in-95 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-rose-600 dark:text-rose-400 text-xs uppercase tracking-wider">
                      NOT ELIGIBLE
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {activeWhyReason.studentName}
                  </h3>
                  {activeWhyReason.enrollmentNumber && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      {activeWhyReason.enrollmentNumber}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActiveWhyReason(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Reasons List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-3 text-xs">
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                Candidate does not meet the requirements for{' '}
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {currentDrive.companyName} ({currentDrive.role})
                </span>
                :
              </p>

              <div className="space-y-2">
                {activeWhyReason.reasons.map((reason, index) => (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-200 flex items-start gap-2.5 leading-relaxed font-medium"
                  >
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0 bg-slate-50/75 dark:bg-slate-900/75">
              <button
                onClick={() => setActiveWhyReason(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs transition-colors"
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
