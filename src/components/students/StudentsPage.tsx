import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Student, Branch, PlacementStatus } from '../../types';
import { supabase } from '../../lib/supabase';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Award,
  ChevronRight,
  Sparkles,
  Download,
  Edit3,
  Trash2,
  RefreshCw,
  Database,
  AlertCircle
} from 'lucide-react';
import { AddStudentModal } from './AddStudentModal';
import { EditStudentModal } from './EditStudentModal';
import { StudentDetailDrawer } from './StudentDetailDrawer';

export const StudentsPage: React.FC = () => {
  const {
    students: contextStudents,
    selectedStudentForDetail,
    setSelectedStudentForDetail,
    acceptOffer,
    declineOffer,
    deleteStudent,
    addToast
  } = useApp();

  // Local state for fetched students from Supabase
  const [supabaseStudents, setSupabaseStudents] = useState<Student[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active students to display (fetched Supabase data or context fallback)
  const students = supabaseStudents ?? contextStudents ?? [];

  // Fetch real data from Supabase students table
  const fetchSupabaseStudents = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("students")
          .select("*");

        if (error) {
          console.warn("Supabase students query notice (using local cache):", error.message);
          setSupabaseStudents(contextStudents);
        } else if (data && data.length > 0) {
          const mapped: Student[] = data.map((row: any) => ({
            id: String(row.id),
            name: row.name || 'Unnamed Student',
            enrollmentNumber: row.enrollment_number || row.enrollmentNumber || '',
            email: row.email || '',
            phone: row.phone || '',
            branch: (row.branch as Branch) || 'CSE',
            cgpa: parseFloat(row.cgpa) || 0,
            backlogs: parseInt(row.backlogs, 10) || 0,
            attendance: parseInt(row.attendance, 10) || 75,
            placementStatus: (row.placement_status || row.placementStatus || 'Unplaced') as PlacementStatus,
            offers: Array.isArray(row.offers) ? row.offers : (row.offers ? (typeof row.offers === 'string' ? JSON.parse(row.offers) : row.offers) : []),
            graduationYear: parseInt(row.graduation_year || row.graduationYear, 10) || 2026,
            skills: Array.isArray(row.skills) ? row.skills : (row.skills ? (typeof row.skills === 'string' ? JSON.parse(row.skills) : []) : []),
            gender: row.gender,
            resumeUrl: row.resume_url || row.resumeUrl,
            avatar: row.avatar
          }));
          setSupabaseStudents(mapped);
        } else {
          setSupabaseStudents(contextStudents);
        }
      } else {
        // If Supabase credentials are not configured yet, fallback to context
        setSupabaseStudents(contextStudents);
      }
    } catch (err: any) {
      console.warn("Notice querying Supabase students (using local cache):", err?.message);
      setSupabaseStudents(contextStudents);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSupabaseStudents();

    // Set up real-time postgres changes listener safely
    if (supabase) {
      try {
        const channel = supabase
          .channel('students-page-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'students' },
            () => {
              fetchSupabaseStudents();
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedCgpaFilter, setSelectedCgpaFilter] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBacklogFilter, setSelectedBacklogFilter] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<keyof Student>('cgpa');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof Student) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filtered and sorted students
  const filteredStudents = useMemo(() => {
    return (students || []).filter(student => {
      // Search
      const matchesSearch =
        (student.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.enrollmentNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.skills || []).some(s => (s || '').toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Branch filter
      if (selectedBranch !== 'ALL' && student.branch !== selectedBranch) return false;

      // CGPA filter
      const studentCgpa = student.cgpa ?? 0;
      if (selectedCgpaFilter === '9_PLUS' && studentCgpa < 9.0) return false;
      if (selectedCgpaFilter === '8_PLUS' && studentCgpa < 8.0) return false;
      if (selectedCgpaFilter === '7_PLUS' && studentCgpa < 7.0) return false;
      if (selectedCgpaFilter === 'BELOW_7' && studentCgpa >= 7.0) return false;

      // Placement status filter
      if (selectedStatus !== 'ALL' && student.placementStatus !== selectedStatus) return false;

      // Backlog filter
      const backlogs = student.backlogs ?? 0;
      if (selectedBacklogFilter === 'ZERO' && backlogs !== 0) return false;
      if (selectedBacklogFilter === 'HAS_BACKLOG' && backlogs === 0) return false;

      return true;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, searchQuery, selectedBranch, selectedCgpaFilter, selectedStatus, selectedBacklogFilter, sortField, sortOrder]);

  const handleExportRoster = () => {
    addToast('Roster Exported', `Generated CSV export for ${filteredStudents.length} students.`, 'success');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Student Directory & Eligibility Pool
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              {students.length} Registered
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor academic metrics, backlogs, attendance, and manage student offer acceptances.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="refresh-students-supabase-btn"
            onClick={fetchSupabaseStudents}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Fetch live records from Supabase students table"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-emerald-500'}`} />
            <span>{isLoading ? 'Fetching...' : 'Fetch Supabase'}</span>
          </button>

          <button
            id="export-students-csv-btn"
            onClick={handleExportRoster}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Roster</span>
          </button>

          <button
            id="open-add-student-modal-btn"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>Supabase query notification: {errorMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            id="student-search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by student name, enrollment number, branch, or skills (e.g., Python, C++, React)..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          {/* Branch Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Branch / Discipline
            </label>
            <select
              id="filter-student-branch"
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Branches</option>
              <option value="CSE">CSE</option>
              <option value="IT">IT</option>
              <option value="ECE">ECE</option>
              <option value="EE">EE</option>
              <option value="ME">ME</option>
              <option value="Civil">Civil</option>
            </select>
          </div>

          {/* CGPA Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              CGPA Range
            </label>
            <select
              id="filter-student-cgpa"
              value={selectedCgpaFilter}
              onChange={e => setSelectedCgpaFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All CGPA</option>
              <option value="9_PLUS">&gt;= 9.0 (Outstanding)</option>
              <option value="8_PLUS">&gt;= 8.0 (First Class Distinction)</option>
              <option value="7_PLUS">&gt;= 7.0 (First Class)</option>
              <option value="BELOW_7">&lt; 7.0</option>
            </select>
          </div>

          {/* Placement Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Placement Status
            </label>
            <select
              id="filter-student-status"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="Unplaced">Unplaced</option>
              <option value="Placed">Placed (Core/Mass)</option>
              <option value="Dream Placed">Dream Placed</option>
              <option value="Higher Studies">Higher Studies</option>
              <option value="Opted Out">Opted Out</option>
            </select>
          </div>

          {/* Backlog Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Backlog Filter
            </label>
            <select
              id="filter-student-backlogs"
              value={selectedBacklogFilter}
              onChange={e => setSelectedBacklogFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Records</option>
              <option value="ZERO">0 Active Backlogs (Clean)</option>
              <option value="HAS_BACKLOG">Has Active Backlogs (1+)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Student Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-white"
                  >
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3">Enrollment Number</th>
                <th className="py-3 px-3">
                  <button
                    onClick={() => handleSort('branch')}
                    className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-white"
                  >
                    <span>Branch</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3">
                  <button
                    onClick={() => handleSort('cgpa')}
                    className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-white text-blue-600 dark:text-blue-400"
                  >
                    <span>CGPA</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3">
                  <button
                    onClick={() => handleSort('backlogs')}
                    className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-white"
                  >
                    <span>Backlogs</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3">
                  <button
                    onClick={() => handleSort('attendance')}
                    className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-white"
                  >
                    <span>Attendance</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3">Placement Status</th>
                <th className="py-3 px-3">Offers & Package</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {(filteredStudents || []).length > 0 ? (
                (filteredStudents || []).map(student => {
                  const acceptedOffer = (student.offers || []).find(o => o.status === 'Accepted');
                  const pendingOffer = (student.offers || []).find(o => o.status === 'Pending');

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedStudentForDetail(student)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {student?.name?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {student?.name || 'Unknown Student'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {student?.email || '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {student?.enrollmentNumber || '—'}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {student?.branch || '—'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                        <span className={(student.cgpa ?? 0) >= 8.5 ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>
                          {(student.cgpa ?? 0).toFixed(2)}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`font-semibold ${student.backlogs === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {student.backlogs === 0 ? '0' : `${student.backlogs} Act.`}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`font-semibold ${student.attendance >= 75 ? 'text-slate-700 dark:text-slate-300' : 'text-amber-600 dark:text-amber-400 font-bold'}`}>
                          {student.attendance}%
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          student.placementStatus === 'Dream Placed'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                            : student.placementStatus === 'Placed'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : student.placementStatus === 'Higher Studies'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {student.placementStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        {acceptedOffer ? (
                          <div className="text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{acceptedOffer.companyName}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">₹{acceptedOffer.packageLPA} LPA</span>
                          </div>
                        ) : pendingOffer ? (
                          <div className="text-xs" onClick={e => e.stopPropagation()}>
                            <span className="font-bold text-amber-600 dark:text-amber-400">{pendingOffer.companyName} (₹{pendingOffer.packageLPA}L)</span>
                            <div className="flex items-center gap-1 mt-1">
                              <button
                                id={`quick-accept-${pendingOffer.offerId}`}
                                onClick={() => acceptOffer(pendingOffer.offerId)}
                                className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold"
                              >
                                Accept
                              </button>
                              <button
                                id={`quick-decline-${pendingOffer.offerId}`}
                                onClick={() => declineOffer(pendingOffer.offerId)}
                                className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px]"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No active offers</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`edit-student-${student.id}`}
                            onClick={() => setStudentToEdit(student)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Edit Student"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-student-${student.id}`}
                            onClick={() => {
                              if (confirm(`Delete student ${student.name} (${student.enrollmentNumber}) from Supabase?`)) {
                                deleteStudent(student.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Delete Student"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`view-student-${student.id}`}
                            onClick={() => setSelectedStudentForDetail(student)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                          >
                            Profile
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No students match the selected filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredStudents.length} of {students.length} students</span>
          <span>Click any row to open full academic & eligibility diagnostics</span>
        </div>
      </div>

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={Boolean(studentToEdit)}
        student={studentToEdit}
        onClose={() => setStudentToEdit(null)}
      />

      {/* Detail Drawer */}
      <StudentDetailDrawer
        student={selectedStudentForDetail}
        onClose={() => setSelectedStudentForDetail(null)}
        onEdit={(student) => setStudentToEdit(student)}
      />
    </div>
  );
};
