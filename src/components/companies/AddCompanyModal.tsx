import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { X, Building2, AlertCircle, Loader2 } from 'lucide-react';
import { CompanyTier } from '../../types';

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddCompanyModal: React.FC<AddCompanyModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { addCompany } = useApp();

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('Technology & Software');
  const [tier, setTier] = useState<CompanyTier>('Dream');
  const [averagePackage, setAveragePackage] = useState<string>('9.5');
  const [minPackage, setMinPackage] = useState<string>('7.0');
  const [maxPackage, setMaxPackage] = useState<string>('12.0');
  const [location, setLocation] = useState('Bengaluru / Gurugram');
  const [website, setWebsite] = useState('https://company.com/careers');
  const [contactPerson, setContactPerson] = useState('Campus Lead');
  const [contactEmail, setContactEmail] = useState('recruitment@company.com');
  const [contactPhone, setContactPhone] = useState('+91 98765 43210');
  const [status, setStatus] = useState<'Active' | 'Upcoming' | 'Past Partner'>('Active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Company name is required.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Clean payload matching exact database column names for Supabase 'companies' table
      // (Omit client-side ID so Supabase auto-generates a valid UUID)
      const companyPayload = {
        company_name: trimmedName,
        industry: industry.trim(),
        tier,
        status,
        average_package: parseFloat(averagePackage) || 0,
        min_package: parseFloat(minPackage) || 0,
        max_package: parseFloat(maxPackage) || 0,
        website: website.trim(),
        location: location.trim(),
        contact_person: contactPerson.trim(),
        contact_name: contactPerson.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        open_drives_count: 0,
        total_hired_history: 0,
        logo: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=128&auto=format&fit=crop&q=80'
      };

      // Add company through context/Supabase
      await addCompany(companyPayload);

      if (onSuccess) {
        onSuccess();
      }

      setName('');
      onClose();
    } catch (err: any) {
      console.warn('Notice adding company:', err?.message || err);
      setErrorMessage(err?.message || 'Failed to add company');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full flex flex-col max-h-[82vh] my-auto animate-in zoom-in-95 overflow-hidden">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">Register Recruiting Company</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Add corporate partner profile to database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  id="add-company-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. NVIDIA / Cisco"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Industry Domain *
                </label>
                <input
                  type="text"
                  id="add-company-industry"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  placeholder="e.g. Semiconductors / FinTech"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Institutional Tier *
                </label>
                <select
                  id="add-company-tier"
                  value={tier}
                  onChange={e => setTier(e.target.value as CompanyTier)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Super Dream">Super Dream (&gt;= ₹12 LPA)</option>
                  <option value="Dream">Dream (₹8 - ₹12 LPA)</option>
                  <option value="Core">Core (₹5 - ₹8 LPA)</option>
                  <option value="Mass">Mass / Bulk Recruiters (&lt; ₹5 LPA)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  id="add-company-status"
                  value={status}
                  onChange={e => setStatus(e.target.value as 'Active' | 'Upcoming' | 'Past Partner')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Active">Active</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Past Partner">Past Partner</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Average CTC (₹ LPA) *
                </label>
                <input
                  type="number"
                  id="add-company-avg-ctc"
                  step="0.1"
                  value={averagePackage}
                  onChange={e => setAveragePackage(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Website
                </label>
                <input
                  type="text"
                  id="add-company-website"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://company.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  HR Point of Contact
                </label>
                <input
                  type="text"
                  id="add-company-contact-name"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                  placeholder="e.g. Priya Nair"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  HR Email Address
                </label>
                <input
                  type="email"
                  id="add-company-contact-email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="campus@company.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  HR Contact Phone
                </label>
                <input
                  type="text"
                  id="add-company-contact-phone"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Locations
              </label>
              <input
                type="text"
                id="add-company-location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Noida / Pune / Hybrid"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
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
              id="submit-add-company-btn"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Company</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
