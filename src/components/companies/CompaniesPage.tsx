import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Building2,
  Search,
  Plus,
  ExternalLink,
  MapPin,
  Mail,
  Phone,
  Briefcase,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Edit3,
  Trash2,
  RefreshCw,
  Database,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Company, CompanyTier } from '../../types';
import { AddCompanyModal } from './AddCompanyModal';
import { EditCompanyModal } from './EditCompanyModal';

export const CompaniesPage: React.FC = () => {
  const {
    companies: contextCompanies,
    drives,
    setCurrentView,
    setSelectedDriveForEligibility,
    deleteCompany,
    addToast
  } = useApp();

  const [companies, setCompanies] = useState<Company[]>(contextCompanies || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState<boolean>(!supabase);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);

  // Sync with context companies if updated
  useEffect(() => {
    if (contextCompanies && contextCompanies.length > 0 && (!companies || companies.length === 0)) {
      setCompanies(contextCompanies);
    }
  }, [contextCompanies]);

  // Fetch companies directly from Supabase 'companies' table with fallback
  const fetchSupabaseCompanies = async (showLoadingState = true) => {
    if (!supabase) {
      setIsOfflineFallback(true);
      if (contextCompanies && contextCompanies.length > 0) {
        setCompanies(contextCompanies);
      }
      return;
    }

    if (showLoadingState) {
      setIsLoading(true);
    }

    try {
      // Query the companies table
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback to unordered select if created_at does not exist
        const fallback = await supabase.from('companies').select('*');
        if (fallback.error) {
          console.warn('Notice querying Supabase companies table (using local cache):', fallback.error.message);
          setIsOfflineFallback(true);
          setCompanies(contextCompanies || []);
          return;
        }

        if (fallback.data && fallback.data.length > 0) {
          const mapped: Company[] = fallback.data.map((row: any) => ({
            id: String(row.id),
            name: row.company_name || row.name || 'Unnamed Company',
            company_name: row.company_name || row.name || 'Unnamed Company',
            industry: row.industry || 'Technology',
            tier: (row.tier as CompanyTier) || 'Dream',
            openDrivesCount: parseInt(row.open_drives_count || row.openDrivesCount, 10) || 0,
            averagePackage: parseFloat(row.average_package || row.averagePackage) || 0,
            minPackage: parseFloat(row.min_package || row.minPackage) || 0,
            maxPackage: parseFloat(row.max_package || row.maxPackage) || 0,
            status: row.status || 'Active',
            website: row.website || '',
            location: row.location || '',
            contactPerson: row.contact_name || row.contact_person || row.contactPerson || '',
            contactEmail: row.contact_email || row.contactEmail || '',
            contactPhone: row.contact_phone || row.contactPhone || row.phone || '',
            totalHiredHistory: parseInt(row.total_hired_history || row.totalHiredHistory, 10) || 0,
            logo: row.logo || '',
            created_at: row.created_at
          }));
          setCompanies(mapped);
          setIsOfflineFallback(false);
          return;
        }
      }

      if (data && data.length > 0) {
        const mapped: Company[] = data.map((row: any) => ({
          id: String(row.id),
          name: row.company_name || row.name || 'Unnamed Company',
          company_name: row.company_name || row.name || 'Unnamed Company',
          industry: row.industry || 'Technology',
          tier: (row.tier as CompanyTier) || 'Dream',
          openDrivesCount: parseInt(row.open_drives_count || row.openDrivesCount, 10) || 0,
          averagePackage: parseFloat(row.average_package || row.averagePackage) || 0,
          minPackage: parseFloat(row.min_package || row.minPackage) || 0,
          maxPackage: parseFloat(row.max_package || row.maxPackage) || 0,
          status: row.status || 'Active',
          website: row.website || '',
          location: row.location || '',
          contactPerson: row.contact_name || row.contact_person || row.contactPerson || '',
          contactEmail: row.contact_email || row.contactEmail || '',
          contactPhone: row.contact_phone || row.contactPhone || row.phone || '',
          totalHiredHistory: parseInt(row.total_hired_history || row.totalHiredHistory, 10) || 0,
          logo: row.logo || '',
          created_at: row.created_at
        }));
        setCompanies(mapped);
        setIsOfflineFallback(false);
      } else {
        // Table is empty or not yet seeded - use local cache
        setCompanies(contextCompanies || []);
        setIsOfflineFallback(false);
      }
    } catch (err: any) {
      console.warn('Supabase fetch notice (operating with local state):', err?.message || err);
      setIsOfflineFallback(true);
      setCompanies(contextCompanies || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSupabaseCompanies();

    // Set up real-time postgres changes listener safely
    if (supabase) {
      try {
        const channel = supabase
          .channel('companies-page-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'companies' },
            () => {
              fetchSupabaseCompanies(false);
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

  // Delete company handler
  const handleDeleteCompany = async (comp: Company) => {
    if (!confirm(`Are you sure you want to delete company "${comp.name}"?`)) {
      return;
    }

    // Always delete from local state and AppContext first
    deleteCompany(comp.id);
    setCompanies(prev => prev.filter(c => c.id !== comp.id));
    addToast('Company Removed', `"${comp.name}" was removed from the directory.`, 'info');

    // Attempt remote Supabase deletion if connected
    if (supabase) {
      try {
        await supabase.from('companies').delete().eq('id', comp.id);
      } catch (err) {
        console.warn('Notice: Remote Supabase company deletion deferred:', err);
      }
    }
  };

  const safeDrives = drives || [];

  const filteredCompanies = companies.filter(company => {
    const matchesSearch =
      (company.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (company.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (company.industry || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (company.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (company.contactPerson || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (company.contactEmail || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedTier !== 'ALL' && company.tier !== selectedTier) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Corporate & Recruiting Partners
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              {companies.length} Partners
            </span>
            {supabase && !isOfflineFallback ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <Database className="w-3 h-3" /> Supabase Live
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                <Database className="w-3 h-3" /> Local Storage
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage corporate recruiting partner records with tier classifications and liaison details.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={() => fetchSupabaseCompanies()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
            title="Refresh Partners"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* View toggle */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            id="open-add-company-btn"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Company</span>
          </button>
        </div>
      </div>

      {/* Search & Tier Filter */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            id="company-search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search company name, industry, contact, email..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="sm:w-60">
          <select
            id="company-tier-filter"
            value={selectedTier}
            onChange={e => setSelectedTier(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Tiers</option>
            <option value="Super Dream">Super Dream (&gt;= ₹12 LPA)</option>
            <option value="Dream">Dream (₹8 - ₹12 LPA)</option>
            <option value="Core">Core (₹5 - ₹8 LPA)</option>
            <option value="Mass">Mass Recruiter (&lt; ₹5 LPA)</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && companies.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Fetching Companies from Supabase...</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Connecting to live Supabase companies table</p>
        </div>
      ) : companies.length === 0 ? (
        /* Empty State */
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">No Companies in Supabase Database</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
            No company records were returned from the companies table. Click below to add your first recruiting partner.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Company</span>
          </button>
        </div>
      ) : filteredCompanies.length === 0 ? (
        /* No Search Results */
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            No companies found matching "{searchQuery}"
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCompanies.map(comp => {
            const companyDrives = (safeDrives || []).filter(d => d.companyId === comp.id || (d.companyName || '').toLowerCase().includes((comp.name || '').toLowerCase()));
            const activeCompanyDrives = companyDrives.filter(d => d.status === 'Active' || d.status === 'Ongoing');

            return (
              <div
                key={comp.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-extrabold text-base text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700">
                        {(comp.name || comp.company_name || 'C')?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">
                          {comp.name || comp.company_name || 'Company'}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{comp.industry}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        comp.status === 'Active'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : comp.status === 'Upcoming'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {comp.status || 'Active'}
                      </span>
                      <button
                        id={`edit-company-${comp.id}`}
                        onClick={() => setCompanyToEdit(comp)}
                        className="p-1 rounded-lg bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-950 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Edit Company"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`delete-company-${comp.id}`}
                        onClick={() => handleDeleteCompany(comp)}
                        className="p-1 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="Delete Company"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Average CTC</span>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {comp.averagePackage ? `₹${comp.averagePackage} LPA` : '₹8.0 LPA'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Tier</span>
                      <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                        {comp.tier || 'Dream'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {comp.contactPerson && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {comp.contactPerson} {comp.contactEmail ? `(${comp.contactEmail})` : ''}
                        </span>
                      </div>
                    )}
                    {comp.contactPhone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{comp.contactPhone}</span>
                      </div>
                    )}
                    {comp.website && (
                      <div className="flex items-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a
                          href={comp.website.startsWith('http') ? comp.website : `https://${comp.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {comp.website}
                        </a>
                      </div>
                    )}
                    {comp.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{comp.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {activeCompanyDrives.length} Active Drive{activeCompanyDrives.length === 1 ? '' : 's'}
                  </span>

                  {activeCompanyDrives.length > 0 ? (
                    <button
                      onClick={() => {
                        setSelectedDriveForEligibility(activeCompanyDrives[0]);
                        setCurrentView('eligibility-results');
                      }}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Inspect Eligibility →
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">No live drive</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table Mode */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-3">Industry</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Contact Phone</th>
                  <th className="py-3 px-3">Website</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCompanies.map(comp => (
                  <tr key={comp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {comp.name || comp.company_name}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300">
                      {comp.industry}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300">
                      <div>{comp.contactPerson || '-'}</div>
                      <div className="text-[11px] text-slate-400">{comp.contactEmail}</div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300">
                      {comp.contactPhone || '-'}
                    </td>
                    <td className="py-3.5 px-3 text-slate-500">
                      {comp.website ? (
                        <a
                          href={comp.website.startsWith('http') ? comp.website : `https://${comp.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {comp.website}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[10px] font-semibold ${
                        comp.status === 'Active'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : comp.status === 'Upcoming'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-500'
                      }`}>
                        {comp.status || 'Active'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          id={`edit-company-table-${comp.id}`}
                          onClick={() => setCompanyToEdit(comp)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Edit Company"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-company-table-${comp.id}`}
                          onClick={() => handleDeleteCompany(comp)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                          title="Delete Company"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddCompanyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => fetchSupabaseCompanies()}
      />

      <EditCompanyModal
        isOpen={Boolean(companyToEdit)}
        company={companyToEdit}
        onClose={() => setCompanyToEdit(null)}
        onSuccess={() => fetchSupabaseCompanies()}
      />
    </div>
  );
};
