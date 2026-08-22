import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase, fetchDrivesFromSupabase } from '../../lib/supabase';
import { PlacementDrive, DriveStatus, CompanyTier, Branch } from '../../types';
import {
  Briefcase,
  Plus,
  Search,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  MapPin,
  Edit3,
  Trash2,
  RefreshCw,
  Database,
  AlertCircle
} from 'lucide-react';
import { CreateDriveModal } from './CreateDriveModal';
import { EditDriveModal } from './EditDriveModal';
import { SupabaseConsoleBar } from '../database/SupabaseConsoleBar';

export const DrivesPage: React.FC = () => {
  const {
    drives: contextDrives,
    deleteDrive,
    setSelectedDriveForEligibility,
    setCurrentView,
    getEligibleStudentsForDrive
  } = useApp();

  // Supabase real-time state
  const [supabaseDrives, setSupabaseDrives] = useState<PlacementDrive[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDriveForEdit, setSelectedDriveForEdit] = useState<PlacementDrive | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Standard asynchronous query from Supabase table 'placement_drives' joined with 'companies'
  const fetchSupabaseDrives = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchDrivesFromSupabase();
      if (res.data && res.data.length > 0) {
        setSupabaseDrives(res.data);
      } else if (contextDrives && contextDrives.length > 0) {
        setSupabaseDrives(contextDrives);
      } else {
        setSupabaseDrives([]);
      }
    } catch (err: any) {
      console.warn('Notice querying Supabase placement_drives (using local cache):', err?.message);
      setSupabaseDrives(contextDrives || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSupabaseDrives();

    // Set up real-time postgres changes listener safely
    if (supabase) {
      try {
        const channel = supabase
          .channel('drives-page-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'placement_drives' },
            () => {
              fetchSupabaseDrives();
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

  const safeDrives = supabaseDrives ?? contextDrives ?? [];

  const filteredDrives = safeDrives.filter(drive => {
    if (statusFilter !== 'ALL' && drive.status !== statusFilter) return false;
    const matches =
      (drive.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (drive.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (drive.tier || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (drive.location || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matches;
  });

  const activeCount = safeDrives.filter(d => d.status === 'Active' || d.status === 'Ongoing').length;
  const upcomingCount = safeDrives.filter(d => d.status === 'Upcoming').length;
  const completedCount = safeDrives.filter(d => d.status === 'Completed').length;

  const handleEditClick = (drive: PlacementDrive) => {
    setSelectedDriveForEdit(drive);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = async (drive: PlacementDrive) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove the placement drive for ${drive.companyName} (${drive.role})?`
    );
    if (confirmed) {
      await deleteDrive(drive.id);
      if (supabase) {
        fetchSupabaseDrives();
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Placement Drives Management
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              {safeDrives.length} Drives
            </span>
            {supabase && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <Database className="w-3 h-3" /> Supabase Live
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Coordinate campus drives, trigger instant eligibility gating calculations, and review candidate rosters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={() => fetchSupabaseDrives()}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh from Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            id="open-create-drive-modal-btn"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Drive</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Error loading placement drives from Supabase: {errorMessage} (showing local cache)</span>
        </div>
      )}

      {/* Floating Black Supabase Console Bar over Placement Drives Area */}
      <SupabaseConsoleBar variant="floating" className="sticky top-16 sm:top-20 z-40 mb-2 drop-shadow-2xl" />

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Status Tab buttons */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700 max-w-full overflow-x-auto no-scrollbar">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap min-h-[36px] ${
              statusFilter === 'ALL'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            All Drives ({safeDrives.length})
          </button>
          <button
            onClick={() => setStatusFilter('Active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap min-h-[36px] ${
              statusFilter === 'Active'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Active & Live ({activeCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('Upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap min-h-[36px] ${
              statusFilter === 'Upcoming'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Upcoming ({upcomingCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('Completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap min-h-[36px] ${
              statusFilter === 'Completed'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed ({completedCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search company, role, location..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Drives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(filteredDrives || []).map(drive => {
          const evalResult = getEligibleStudentsForDrive(drive);
          const eligibleList = evalResult?.eligible || [];
          const liveEligibleCount = eligibleList.length;

          return (
            <div
              key={drive.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-md flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                        {drive.companyName}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        drive.tier === 'Super Dream'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          : drive.tier === 'Dream'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {drive.tier}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                      {drive.role}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      drive.status === 'Active' || drive.status === 'Ongoing'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : drive.status === 'Upcoming'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {drive.status}
                    </span>

                    <button
                      id={`edit-drive-${drive.id}`}
                      title="Edit Drive"
                      onClick={() => handleEditClick(drive)}
                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`delete-drive-${drive.id}`}
                      title="Delete Drive"
                      onClick={() => handleDeleteClick(drive)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Package & Key Specs Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Package CTC</span>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                      ₹{drive.packageLPA} LPA
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Eligible Pool</span>
                    <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                      {liveEligibleCount} Students
                    </div>
                  </div>
                </div>

                {/* Criteria chips */}
                <div className="mt-3 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Academic Threshold:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Min {drive.minCgpa} CGPA • 0 Backlogs</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Branches:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[160px] text-right">
                      {drive.eligibleBranches.join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Drive Schedule:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{drive.driveDate} ({drive.location})</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {drive.applicationsCount || 0} Applied
                </span>

                <div className="flex items-center gap-2">
                  <button
                    id={`inspect-eligibility-${drive.id}`}
                    onClick={() => {
                      setSelectedDriveForEligibility(drive);
                      setCurrentView('eligibility-results');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <span>Check Eligibility</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CreateDriveModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <EditDriveModal
        drive={selectedDriveForEdit}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedDriveForEdit(null);
        }}
      />
    </div>
  );
};

