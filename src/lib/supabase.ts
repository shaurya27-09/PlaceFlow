import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateUUID, isValidUUID } from './uuid';
import {
  Student,
  Branch,
  Company,
  CompanyTier,
  PlacementDrive,
  DriveStatus,
  Application,
  ApplicationStatus,
  Offer,
  OfferStatus,
  OfferPolicyConfig,
  UserProfile,
  UserRole
} from '../types';

// Default project URL as specified
export const DEFAULT_SUPABASE_URL = 'https://plwsickyaxdkjultrlca.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsd3NpY2t5YXhka2p1bHRybGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyMzg2NjYsImV4cCI6MjA1NjgxNDY2Nn0.8mbX-iQ51g28y13l2q3j9k8h0g9f8e7d6c5b4a3z2y1';

// Read configuration from environment variables and browser storage
const viteSupabaseUrl = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_URL || import.meta.env?.SUPABASE_URL)) ||
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL)) || '';
const viteSupabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY)) || '';

// Required debugging log (Supabase URL only, anon key is NEVER logged)
console.log("Supabase URL:", (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || viteSupabaseUrl || DEFAULT_SUPABASE_URL);

/**
 * Normalizes and cleans Supabase Project URLs
 * Handles trailing slashes, dashboard URLs, missing https://, etc.
 */
export function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return DEFAULT_SUPABASE_URL;
  let url = rawUrl.trim();
  // Extract project ref if full dashboard URL was pasted: https://supabase.com/dashboard/project/plwsickyaxdkjultrlca
  const dashMatch = url.match(/(?:supabase\.com\/dashboard\/project|app\.supabase\.com\/project)\/([a-z0-9_-]+)/i);
  if (dashMatch && dashMatch[1]) {
    return `https://${dashMatch[1]}.supabase.co`;
  }
  // Strip trailing slashes and rest/auth paths
  url = url.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '').replace(/\/auth\/v1\/?$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  let storedUrl = '';
  let storedAnonKey = '';
  try {
    if (typeof localStorage !== 'undefined') {
      storedUrl = (localStorage.getItem('placeflow_supabase_url') || '').trim();
      storedAnonKey = (localStorage.getItem('placeflow_supabase_anon_key') || '').trim();
    }
  } catch (_) {}

  // User configured credentials take precedence, fallback to default Supabase project credentials
  const rawUrl = (storedUrl || viteSupabaseUrl || DEFAULT_SUPABASE_URL).trim();
  const url = normalizeSupabaseUrl(rawUrl);
  const anonKey = (storedAnonKey || viteSupabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY).trim();

  return {
    url,
    anonKey
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  try {
    const cleanUrl = normalizeSupabaseUrl(url);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('placeflow_supabase_url', cleanUrl);
      localStorage.setItem('placeflow_supabase_anon_key', anonKey.trim());
    }
    // Clear cached client so next getSupabaseClient() instantiates with new credentials
    cachedClient = null;
  } catch (_) {}
}

export function clearSupabaseCredentials(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('placeflow_supabase_url');
      localStorage.removeItem('placeflow_supabase_anon_key');
    }
    cachedClient = null;
  } catch (_) {}
}

const initialCreds = getSupabaseCredentials();
export const supabaseUrl: string = initialCreds.url;
export const supabaseAnonKey: string = initialCreds.anonKey;

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('MY_APP_URL') &&
  !supabaseAnonKey.includes('placeholder') &&
  supabaseAnonKey.length > 10
);

export function checkIsSupabaseConfigured(): boolean {
  const creds = getSupabaseCredentials();
  return Boolean(
    creds.url &&
    creds.anonKey &&
    creds.url.startsWith('http') &&
    !creds.url.includes('placeholder') &&
    !creds.url.includes('MY_APP_URL') &&
    !creds.anonKey.includes('placeholder') &&
    creds.anonKey.length > 10
  );
}

/**
 * Helper to ensure any response body returned to @supabase/supabase-js is strictly valid JSON.
 * Completely eliminates "Unexpected token '<', "<!doctype "... is not valid JSON" errors.
 */
async function ensureJsonResponse(resp: Response, targetUrl: string): Promise<Response> {
  const contentType = resp.headers.get('content-type') || '';
  
  try {
    const clone = resp.clone();
    const text = await clone.text().catch(() => '');
    const trimmed = text.trim();
    
    // Check if the response body looks like HTML or XML
    const isHtmlOrXml = 
      trimmed.startsWith('<!') || 
      trimmed.startsWith('<html') || 
      trimmed.startsWith('<HTML') ||
      trimmed.startsWith('<?xml') ||
      (trimmed.startsWith('<') && trimmed.endsWith('>')) ||
      contentType.includes('text/html') ||
      contentType.includes('text/xml');

    if (isHtmlOrXml) {
      console.error(`[Supabase HTML Response] Server returned HTML instead of JSON for request URL: "${targetUrl}". Status: ${resp.status}. Snippet:`, trimmed.slice(0, 200));

      const isPausedOrError = 
        trimmed.toLowerCase().includes('paused') || 
        trimmed.toLowerCase().includes('bad gateway') || 
        trimmed.toLowerCase().includes('error') || 
        trimmed.toLowerCase().includes('not found') || 
        !resp.ok;
      
      const cleanMessage = isPausedOrError
        ? `Supabase host returned HTML (HTTP ${resp.status}). The project is likely PAUSED in your Supabase dashboard or the URL is invalid.`
        : `Supabase endpoint returned an HTML page (HTTP ${resp.status}). Verify your Supabase URL (https://<project-ref>.supabase.co).`;

      return new Response(
        JSON.stringify({
          error: 'invalid_json_response',
          error_description: cleanMessage,
          message: cleanMessage,
          hint: 'Verify the Supabase Project URL in Settings (https://<project-id>.supabase.co) and unpause the project in your Supabase dashboard.',
          code: 'UPSTREAM_HTML_RECEIVED',
          status: resp.status,
          requestedUrl: targetUrl
        }),
        {
          status: resp.ok && isHtmlOrXml ? 502 : resp.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // If it's an empty body on an error response
    if (!trimmed && !resp.ok) {
      return new Response(
        JSON.stringify({
          error: 'empty_response',
          error_description: `Supabase server returned empty HTTP ${resp.status} response.`,
          message: `Supabase server error (HTTP ${resp.status}).`,
          code: 'EMPTY_RESPONSE'
        }),
        {
          status: resp.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify it is parseable JSON before returning original response
    try {
      JSON.parse(trimmed);
      return resp;
    } catch {
      // If it's not valid JSON, wrap text in clean JSON
      return new Response(
        JSON.stringify({
          error: 'non_json_response',
          error_description: `Supabase returned non-JSON data: ${trimmed.slice(0, 150)}`,
          message: trimmed.slice(0, 150) || `HTTP ${resp.status} response from Supabase.`,
          code: 'INVALID_JSON',
          status: resp.status
        }),
        {
          status: resp.status || 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch {
    return resp;
  }
}

/**
 * Custom fetch handler for Supabase requests.
 * Directly communicates with Supabase and guarantees a clean JSON response
 * even when the upstream host returns HTML (e.g., paused project status or gateway errors).
 * Avoids any fallback POST calls to static hosting routes (preventing HTTP 405 Method Not Allowed).
 */
async function resilientSupabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  const method = init?.method || 'GET';

  try {
    // 1. Direct browser fetch to Supabase endpoint
    const resp = await fetch(input, init);
    return await ensureJsonResponse(resp, urlStr);
  } catch (browserFetchErr: any) {
    console.error('[Supabase Network Error]', {
      url: urlStr,
      method,
      operation: 'Direct Supabase Fetch',
      error: browserFetchErr?.message || browserFetchErr
    });

    const cleanMsg = browserFetchErr?.message?.includes('Failed to fetch')
      ? `Unable to reach ${urlStr}. Please verify network connectivity and ensure the project is active in your Supabase Dashboard.`
      : (browserFetchErr?.message || 'Network fetch failure');

    return new Response(
      JSON.stringify({
        error: 'fetch_failed',
        error_description: cleanMsg,
        message: cleanMsg,
        code: 'FETCH_ERROR',
        details: browserFetchErr?.message || ''
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

let cachedClient: { client: SupabaseClient; url: string; key: string } | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const currentCreds = getSupabaseCredentials();
  if (
    currentCreds.url &&
    currentCreds.anonKey &&
    currentCreds.url.startsWith('http') &&
    !currentCreds.url.includes('placeholder') &&
    currentCreds.anonKey.length > 10
  ) {
    if (
      cachedClient &&
      cachedClient.url === currentCreds.url &&
      cachedClient.key === currentCreds.anonKey
    ) {
      return cachedClient.client;
    }
    const newClient = createClient(currentCreds.url, currentCreds.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      },
      global: {
        fetch: resilientSupabaseFetch
      }
    });
    cachedClient = { client: newClient, url: currentCreds.url, key: currentCreds.anonKey };
    return newClient;
  }
  return null;
}

/**
 * Dynamic Supabase Client Proxy
 * Always resolves to the current active client instance
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const active = getSupabaseClient();
    if (!active) {
      if (prop === 'from') {
        return () => ({
          select: () => Promise.resolve({ data: null, error: { message: 'Supabase client is not configured with valid URL/Anon Key.' } }),
          insert: () => Promise.resolve({ data: null, error: { message: 'Supabase client is not configured.' } }),
          update: () => Promise.resolve({ data: null, error: { message: 'Supabase client is not configured.' } }),
          upsert: () => Promise.resolve({ data: null, error: { message: 'Supabase client is not configured.' } }),
          delete: () => Promise.resolve({ data: null, error: { message: 'Supabase client is not configured.' } }),
        });
      }
      return undefined;
    }
    const val = (active as any)[prop];
    return typeof val === 'function' ? val.bind(active) : val;
  }
});

/**
 * Retrieves the currently authenticated Supabase user ID.
 * Returns null if no user is signed in or client is not configured.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const client = getSupabaseClient() || supabase;
  if (!client) return null;
  try {
    const { data: { user } } = await client.auth.getUser();
    if (user?.id) return user.id;
    const { data: { session } } = await client.auth.getSession();
    if (session?.user?.id) return session.user.id;

    // Fallback: check localStorage for cached Supabase Auth user session
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && ((key.startsWith('sb-') && key.endsWith('-auth-token')) || key === 'supabase.auth.token' || key === 'tpc_user_session')) {
            const raw = window.localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              const uid = parsed?.user?.id || parsed?.currentSession?.user?.id || parsed?.id;
              if (uid) return uid;
            }
          }
        }
      } catch (_) {}
    }

    return null;
  } catch (err) {
    return null;
  }
}

export interface SupabaseSyncStatus {
  isConfigured: boolean;
  isConnected: boolean;
  url: string;
  lastSynced?: string;
  error?: string;
}

/**
 * Checks connectivity and reachability to the Supabase database
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  details?: string;
  hint?: string;
}> {
  const creds = getSupabaseCredentials();
  if (!creds.url || !creds.anonKey || creds.anonKey.length < 10) {
    return {
      success: false,
      message: 'Supabase URL or Anon Key is missing or invalid in configuration.'
    };
  }

  // Client-side query probe on public schema
  try {
    const client = getSupabaseClient();
    if (!client) {
      return {
        success: false,
        message: 'Could not initialize Supabase client with the provided credentials.'
      };
    }

    const { error } = await client.from('students').select('id').limit(1);
    if (error) {
      if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('Cannot resolve host') ||
        error.message?.includes('DNS_LOOKUP_FAILED')
      ) {
        return {
          success: false,
          message: `Unable to reach Supabase project at ${creds.url}. Host DNS lookup failed or project is paused.`,
          hint: 'Check your Supabase dashboard (https://supabase.com/dashboard) to unpause or restore your project.'
        };
      }
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: false,
          message: 'Connected to Supabase project, but tables are not created yet. Please execute the provided SQL schema script in your Supabase SQL Editor.'
        };
      }
      return {
        success: false,
        message: `Supabase Notice: ${error.message}`
      };
    }
    return {
      success: true,
      message: 'Successfully connected to Supabase PostgreSQL database!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to reach Supabase server.'
    };
  }
}

/**
 * Fetch all data from Supabase
 */
export async function fetchAllFromSupabase(): Promise<{
  students?: Student[];
  companies?: Company[];
  drives?: PlacementDrive[];
  applications?: Application[];
  offers?: Offer[];
  offerPolicy?: OfferPolicyConfig;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }

  try {
    const [
      studentsRes,
      companiesRes,
      drivesRes,
      applicationsRes,
      offersRes,
      policyRes
    ] = await Promise.allSettled([
      supabase.from('students').select('*'),
      supabase.from('companies').select('*'),
      supabase.from('placement_drives').select('*'),
      supabase.from('applications').select('*'),
      supabase.from('offers').select('*'),
      supabase.from('offer_policy').select('*').limit(1)
    ]);

    // Log any errors to console as requested
    if (studentsRes.status === 'rejected') console.error('Supabase query error for students table:', studentsRes.reason);
    else if (studentsRes.value.error) console.error('Supabase query error for students table:', studentsRes.value.error);

    if (companiesRes.status === 'rejected') console.error('Supabase query error for companies table:', companiesRes.reason);
    else if (companiesRes.value.error) console.error('Supabase query error for companies table:', companiesRes.value.error);

    if (drivesRes.status === 'rejected') console.error('Supabase query error for placement_drives table:', drivesRes.reason);
    else if (drivesRes.value.error) console.error('Supabase query error for placement_drives table:', drivesRes.value.error);

    if (applicationsRes.status === 'rejected') console.error('Supabase query error for applications table:', applicationsRes.reason);
    else if (applicationsRes.value.error) console.error('Supabase query error for applications table:', applicationsRes.value.error);

    if (offersRes.status === 'rejected') console.error('Supabase query error for offers table:', offersRes.reason);
    else if (offersRes.value.error) console.error('Supabase query error for offers table:', offersRes.value.error);

    const result: {
      students?: Student[];
      companies?: Company[];
      drives?: PlacementDrive[];
      applications?: Application[];
      offers?: Offer[];
      offerPolicy?: OfferPolicyConfig;
    } = {};

    if (studentsRes.status === 'fulfilled' && studentsRes.value.data) {
      const safeParseArr = (val: any): any[] => {
        if (Array.isArray(val)) return val;
        if (!val) return [];
        if (typeof val === 'string') {
          try {
            const p = JSON.parse(val);
            if (Array.isArray(p)) return p;
          } catch {
            return val.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }
        return [];
      };

      result.students = studentsRes.value.data.map((row: any) => ({
        id: String(row.id),
        name: row.name || row.full_name || 'Student',
        enrollmentNumber: row.enrollment_number || row.enrollmentNumber || row.roll_no || '',
        email: row.email || '',
        phone: row.phone || '',
        branch: (row.branch || 'CSE') as Branch,
        cgpa: parseFloat(row.cgpa) || 0,
        backlogs: parseInt(row.backlogs, 10) || 0,
        attendance: parseInt(row.attendance, 10) || 0,
        placementStatus: row.placement_status || row.placementStatus || 'Unplaced',
        offers: safeParseArr(row.offers),
        graduationYear: parseInt(row.graduation_year || row.graduationYear, 10) || 2026,
        skills: safeParseArr(row.skills),
        gender: row.gender || 'Male',
        resumeUrl: row.resume_url || row.resumeUrl || '',
        avatar: row.avatar || null
      }));
    }

    if (companiesRes.status === 'fulfilled' && companiesRes.value.data) {
      result.companies = companiesRes.value.data.map((row: any) => ({
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
    }

    if (drivesRes.status === 'fulfilled' && drivesRes.value.data) {
      const compLookup: Record<string, any> = {};
      if (result.companies) {
        result.companies.forEach(c => { compLookup[c.id] = c; });
      }

      result.drives = drivesRes.value.data.map((row: any) => {
        const joinedComp = compLookup[String(row.company_id || row.companyId)];
        return {
          id: String(row.id),
          companyId: String(row.company_id || row.companyId || ''),
          companyName: joinedComp?.company_name || joinedComp?.name || row.company_name || row.companyName || 'Company',
          companyLogo: joinedComp?.logo || row.company_logo || row.companyLogo || '',
          role: row.role || '',
          jobDescription: row.job_description || row.jobDescription || '',
          packageLPA: parseFloat(row.package_lpa ?? row.packageLPA ?? row.offer_limit_lpa) || 0,
          tier: row.tier || (joinedComp?.tier as CompanyTier) || 'Core',
          minCgpa: parseFloat(row.min_cgpa ?? row.minCgpa) || 0,
          maxBacklogs: parseInt(row.max_backlogs ?? row.maxBacklogs, 10) || 0,
          eligibleBranches: Array.isArray(row.eligible_branches) ? row.eligible_branches : (row.eligible_branches ? (typeof row.eligible_branches === 'string' ? JSON.parse(row.eligible_branches) : row.eligible_branches) : ['CSE', 'IT']),
          minAttendance: parseInt(row.min_attendance ?? row.minAttendance, 10) || 0,
          graduationYear: parseInt(row.graduation_year ?? row.graduationYear, 10) || 2026,
          offerPolicyRule: row.offer_policy_rule || row.offerPolicyRule || 'Dream Upgrade Only (>= 1.5x)',
          driveDate: row.drive_date || row.driveDate || '',
          registrationDeadline: row.registration_deadline || row.registrationDeadline || row.drive_date || '',
          location: row.location || 'On-Campus',
          status: row.status || 'Active',
          rounds: Array.isArray(row.rounds) ? row.rounds : (row.rounds ? (typeof row.rounds === 'string' ? JSON.parse(row.rounds) : row.rounds) : ['Online Assessment', 'Technical Interview', 'HR Interview'])
        };
      });
    }

    if (applicationsRes.status === 'fulfilled' && applicationsRes.value.data) {
      result.applications = applicationsRes.value.data.map((row: any) => ({
        id: row.id,
        studentId: row.student_id || row.studentId,
        studentName: row.student_name || row.studentName,
        studentEnrollment: row.student_enrollment || row.studentEnrollment,
        studentBranch: row.student_branch || row.studentBranch,
        studentCgpa: parseFloat(row.student_cgpa || row.studentCgpa) || 0,
        studentAttendance: parseInt(row.student_attendance || row.studentAttendance, 10) || 0,
        driveId: row.drive_id || row.driveId,
        companyName: row.company_name || row.companyName,
        companyLogo: row.company_logo || row.companyLogo || '',
        role: row.role,
        packageLPA: parseFloat(row.package_lpa || row.packageLPA) || 0,
        appliedDate: row.applied_date || row.appliedDate || '',
        eligibilityStatus: row.eligibility_status || row.eligibilityStatus || 'Eligible',
        ineligibilityReasons: Array.isArray(row.ineligibility_reasons) ? row.ineligibility_reasons : (row.ineligibility_reasons ? JSON.parse(row.ineligibility_reasons) : []),
        status: row.status || 'Applied',
        currentRound: row.current_round || row.currentRound,
        interviewSlot: row.interview_slot || row.interviewSlot,
        feedback: row.feedback
      }));
    }

    if (offersRes.status === 'fulfilled' && offersRes.value.data) {
      result.offers = offersRes.value.data.map((row: any) => ({
        id: row.id,
        studentId: row.student_id || row.studentId,
        studentName: row.student_name || row.studentName,
        studentEnrollment: row.student_enrollment || row.studentEnrollment,
        studentBranch: row.student_branch || row.studentBranch,
        companyId: row.company_id || row.companyId,
        companyName: row.company_name || row.companyName,
        companyLogo: row.company_logo || row.companyLogo || '',
        role: row.role,
        packageLPA: parseFloat(row.package_lpa || row.packageLPA) || 0,
        offerDate: row.offer_date || row.offerDate || '',
        status: row.status || 'Pending',
        policyCheckPassed: Boolean(row.policy_check_passed ?? row.policyCheckPassed),
        policyViolationReason: row.policy_violation_reason || row.policyViolationReason,
        tier: row.tier || 'Core',
        deadlineDate: row.deadline_date || row.deadlineDate || '',
        bondYears: row.bond_years ?? row.bondYears
      }));
    }

    if (policyRes.status === 'fulfilled' && policyRes.value.data && policyRes.value.data[0]) {
      const p = policyRes.value.data[0];
      result.offerPolicy = {
        allowMultipleOffers: Boolean(p.allow_multiple_offers ?? p.allowMultipleOffers),
        maxOffersAllowed: parseInt(p.max_offers_allowed || p.maxOffersAllowed, 10) || 2,
        dreamThresholdLPA: parseFloat(p.dream_threshold_lpa || p.dreamThresholdLPA) || 8,
        superDreamThresholdLPA: parseFloat(p.super_dream_threshold_lpa || p.superDreamThresholdLPA) || 14,
        minHikePercentageForUpgrade: parseFloat(p.min_hike_percentage_for_upgrade || p.minHikePercentageForUpgrade) || 50,
        freezeOnAcceptance: Boolean(p.freeze_on_acceptance ?? p.freezeOnAcceptance),
        massRecruiterLock: Boolean(p.mass_recruiter_lock ?? p.massRecruiterLock)
      };
    }

    return result;
  } catch (err: any) {
    console.error('Supabase query error occurred during fetchAllFromSupabase:', err);
    return { error: err?.message || 'Error querying Supabase data' };
  }
}

/**
 * Seed or push whole initial dataset to Supabase tables
 */
export async function seedInitialDataToSupabase(
  students: Student[],
  companies: Company[],
  drives: PlacementDrive[],
  applications: Application[],
  offers: Offer[],
  policy: OfferPolicyConfig
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, message: 'Supabase is not configured in environment.' };
  }

  try {
    // 1. Students
    const studentRows = students.map(s => ({
      id: s.id,
      name: s.name,
      enrollment_number: s.enrollmentNumber,
      email: s.email,
      phone: s.phone,
      branch: s.branch,
      cgpa: s.cgpa,
      backlogs: s.backlogs,
      attendance: s.attendance,
      placement_status: s.placementStatus,
      offers: s.offers,
      graduation_year: s.graduationYear,
      skills: s.skills,
      gender: s.gender,
      resume_url: s.resumeUrl,
      avatar: s.avatar
    }));

    // 2. Companies
    const companyRows = companies.map(c => ({
      id: c.id,
      company_name: c.company_name || c.name,
      industry: c.industry,
      tier: c.tier,
      open_drives_count: c.openDrivesCount,
      average_package: c.averagePackage,
      min_package: c.minPackage,
      max_package: c.maxPackage,
      status: c.status,
      website: c.website,
      location: c.location,
      contact_person: c.contactPerson,
      contact_name: c.contactPerson,
      contact_email: c.contactEmail,
      contact_phone: c.contactPhone || '',
      total_hired_history: c.totalHiredHistory,
      logo: c.logo
    }));

    // 3. Drives
    const driveRows = drives.map(d => ({
      id: d.id,
      company_id: d.companyId,
      company_name: d.companyName,
      company_logo: d.companyLogo,
      role: d.role,
      job_description: d.jobDescription,
      package_lpa: d.packageLPA,
      tier: d.tier,
      min_cgpa: d.minCgpa,
      max_backlogs: d.maxBacklogs,
      eligible_branches: d.eligibleBranches,
      min_attendance: d.minAttendance,
      graduation_year: d.graduationYear,
      offer_policy_rule: d.offerPolicyRule,
      drive_date: d.driveDate,
      registration_deadline: d.registrationDeadline,
      location: d.location,
      status: d.status,
      rounds: d.rounds
    }));

    // 4. Applications
    const appRows = applications.map(a => ({
      id: a.id,
      student_id: a.studentId,
      student_name: a.studentName,
      student_enrollment: a.studentEnrollment,
      student_branch: a.studentBranch,
      student_cgpa: a.studentCgpa,
      student_attendance: a.studentAttendance,
      drive_id: a.driveId,
      company_name: a.companyName,
      company_logo: a.companyLogo,
      role: a.role,
      package_lpa: a.packageLPA,
      applied_date: a.appliedDate,
      eligibility_status: a.eligibilityStatus,
      ineligibility_reasons: a.ineligibilityReasons,
      status: a.status,
      current_round: a.currentRound,
      interview_slot: a.interviewSlot,
      feedback: a.feedback
    }));

    // 5. Offers
    const offerRows = offers.map(o => ({
      id: o.id,
      student_id: o.studentId,
      student_name: o.studentName,
      student_enrollment: o.studentEnrollment,
      student_branch: o.studentBranch,
      company_id: o.companyId,
      company_name: o.companyName,
      company_logo: o.companyLogo,
      role: o.role,
      package_lpa: o.packageLPA,
      offer_date: o.offerDate,
      status: o.status,
      policy_check_passed: o.policyCheckPassed,
      policy_violation_reason: o.policyViolationReason,
      tier: o.tier,
      deadline_date: o.deadlineDate,
      bond_years: o.bondYears
    }));

    // 6. Policy
    const policyRow = {
      id: 'default-policy',
      allow_multiple_offers: policy.allowMultipleOffers,
      max_offers_allowed: policy.maxOffersAllowed,
      dream_threshold_lpa: policy.dreamThresholdLPA,
      super_dream_threshold_lpa: policy.superDreamThresholdLPA,
      min_hike_percentage_for_upgrade: policy.minHikePercentageForUpgrade,
      freeze_on_acceptance: policy.freezeOnAcceptance,
      mass_recruiter_lock: policy.massRecruiterLock
    };

    // Upsert into each table
    if (studentRows.length > 0) {
      await supabase.from('students').upsert(studentRows, { onConflict: 'id' });
    }
    if (companyRows.length > 0) {
      await supabase.from('companies').upsert(companyRows, { onConflict: 'id' });
    }
    if (driveRows.length > 0) {
      await supabase.from('placement_drives').upsert(driveRows, { onConflict: 'id' });
    }
    if (appRows.length > 0) {
      await supabase.from('applications').upsert(appRows, { onConflict: 'id' });
    }
    if (offerRows.length > 0) {
      await supabase.from('offers').upsert(offerRows, { onConflict: 'id' });
    }
    await supabase.from('offer_policy').upsert([policyRow], { onConflict: 'id' });

    return {
      success: true,
      message: 'Successfully seeded institutional placement data to Supabase database!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to push data to Supabase: ${err?.message}`
    };
  }
}

/**
 * Single entity upsert helpers
 */
export async function upsertStudentToSupabase(student: Student) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('students').upsert({
      id: student.id,
      name: student.name,
      enrollment_number: student.enrollmentNumber,
      email: student.email,
      phone: student.phone,
      branch: student.branch,
      cgpa: student.cgpa,
      backlogs: student.backlogs,
      attendance: student.attendance,
      placement_status: student.placementStatus,
      offers: student.offers,
      graduation_year: student.graduationYear,
      skills: student.skills,
      gender: student.gender,
      resume_url: student.resumeUrl,
      avatar: student.avatar
    }, { onConflict: 'id' });
  } catch (err) {
    console.error('Failed to sync student to Supabase:', err);
  }
}

/**
 * Dedicated Student Table Operations
 */

export async function fetchStudentsFromSupabase(): Promise<{ data?: Student[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return { error: error.message };
    }

    const safeParseArray = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (!val) return [];
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          return val.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      return [];
    };

    const students: Student[] = (data || []).map((row: any) => ({
      id: String(row.id),
      name: row.name || row.full_name || 'Student',
      enrollmentNumber: row.enrollment_number || row.enrollmentNumber || row.roll_no || '',
      email: row.email || '',
      phone: row.phone || '',
      branch: (row.branch || 'CSE') as Branch,
      cgpa: parseFloat(row.cgpa) || 0,
      backlogs: parseInt(row.backlogs, 10) || 0,
      attendance: parseInt(row.attendance, 10) || 0,
      placementStatus: row.placement_status || row.placementStatus || 'Unplaced',
      offers: safeParseArray(row.offers),
      graduationYear: parseInt(row.graduation_year || row.graduationYear, 10) || 2026,
      skills: safeParseArray(row.skills),
      gender: row.gender || 'Male',
      resumeUrl: row.resume_url || row.resumeUrl || '',
      avatar: row.avatar || null
    }));

    return { data: students };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch students from Supabase' };
  }
}

export async function addStudentToSupabase(student: Student & { user_id?: string; created_by?: string }): Promise<{ data?: Student; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: student };
  }
  try {
    const authUserId = student.user_id || await getAuthenticatedUserId();
    const studentId = isValidUUID(student.id) ? student.id : generateUUID();
    const row: Record<string, any> = {
      name: student.name || 'Student',
      enrollment_number: student.enrollmentNumber || '',
      email: student.email || '',
      phone: student.phone || null,
      branch: student.branch || 'CSE',
      cgpa: student.cgpa ?? 0,
      backlogs: student.backlogs ?? 0,
      attendance: student.attendance ?? 100,
      placement_status: student.placementStatus || 'Unplaced',
      offers: student.offers || [],
      graduation_year: student.graduationYear || 2026,
      skills: student.skills || [],
      gender: student.gender || 'Male',
      resume_url: student.resumeUrl || null,
      avatar: student.avatar || null
    };

    if (isValidUUID(student.id)) {
      row.id = student.id;
    } else {
      row.id = studentId;
    }

    // Attach authenticated user.id for Supabase RLS policies
    if (authUserId) {
      row.user_id = authUserId;
      row.created_by = authUserId;
    }

    let { data, error } = await supabase.from('students').upsert([row], { onConflict: 'id' }).select();
    
    // Only strip user_id / created_by if database specifically reports the column does not exist (code 42703)
    if (error && (error.code === '42703' || (error.message?.includes('column') && error.message?.includes('does not exist')))) {
      const fallbackRow = { ...row };
      delete fallbackRow.user_id;
      delete fallbackRow.created_by;
      const retryRes = await supabase.from('students').upsert([fallbackRow], { onConflict: 'id' }).select();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.warn('Notice: Sync student to Supabase deferred:', error.message);
      return { data: student, error: error.message };
    }
    const savedStudent = data?.[0] ? { ...student, id: data[0].id } : { ...student, id: row.id };
    return { data: savedStudent };
  } catch (err: any) {
    console.warn('Notice: Sync student to Supabase exception:', err?.message || err);
    return { data: student, error: err?.message || 'Failed to insert student into Supabase' };
  }
}

export async function updateStudentInSupabase(id: string, partial: Partial<Student>): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const payload: Record<string, any> = {};
    if (partial.name !== undefined) payload.name = partial.name;
    if (partial.enrollmentNumber !== undefined) payload.enrollment_number = partial.enrollmentNumber;
    if (partial.email !== undefined) payload.email = partial.email;
    if (partial.phone !== undefined) payload.phone = partial.phone;
    if (partial.branch !== undefined) payload.branch = partial.branch;
    if (partial.cgpa !== undefined) payload.cgpa = partial.cgpa;
    if (partial.backlogs !== undefined) payload.backlogs = partial.backlogs;
    if (partial.attendance !== undefined) payload.attendance = partial.attendance;
    if (partial.placementStatus !== undefined) payload.placement_status = partial.placementStatus;
    if (partial.offers !== undefined) payload.offers = partial.offers;
    if (partial.graduationYear !== undefined) payload.graduation_year = partial.graduationYear;
    if (partial.skills !== undefined) payload.skills = partial.skills;
    if (partial.gender !== undefined) payload.gender = partial.gender;
    if (partial.resumeUrl !== undefined) payload.resume_url = partial.resumeUrl;
    if (partial.avatar !== undefined) payload.avatar = partial.avatar;

    const { error } = await supabase
      .from('students')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.warn('Notice: Update student in Supabase deferred:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Notice: Update student in Supabase exception:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to update student in Supabase' };
  }
}

export async function deleteStudentFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Notice: Delete student from Supabase deferred:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Notice: Delete student from Supabase exception:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to delete student from Supabase' };
  }
}

export async function fetchCompaniesFromSupabase(): Promise<{ data?: Company[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback ordering if created_at does not exist
      const fallback = await supabase.from('companies').select('*');
      if (fallback.error) {
        return { error: fallback.error.message };
      }
      return {
        data: (fallback.data || []).map((row: any) => ({
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
        }))
      };
    }

    const companies: Company[] = (data || []).map((row: any) => ({
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

    return { data: companies };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch companies from Supabase' };
  }
}

export async function addCompanyToSupabase(company: Partial<Company> & { name?: string; company_name?: string; user_id?: string; created_by?: string; [key: string]: any }): Promise<{ data?: any; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    const authUserId = company.user_id || await getAuthenticatedUserId();
    const compName = company.company_name || company.name || 'Unnamed Company';
    
    // Clean payload matching exact database column names for Supabase 'companies' table:
    // Uses company_name instead of name, and omits client-side string ID to allow Supabase auto-generated UUID
    const row: Record<string, any> = {
      company_name: compName,
      industry: company.industry || 'Technology',
      tier: company.tier || 'Dream',
      status: company.status || 'Active',
      average_package: parseFloat(company.average_package ?? company.averagePackage) || 0,
      min_package: parseFloat(company.min_package ?? company.minPackage) || 0,
      max_package: parseFloat(company.max_package ?? company.maxPackage) || 0,
      website: company.website || '',
      location: company.location || '',
      contact_person: company.contactPerson || company.contact_person || company.contact_name || '',
      contact_name: company.contactPerson || company.contact_person || company.contact_name || '',
      contact_email: company.contactEmail || company.contact_email || '',
      contact_phone: company.contactPhone || company.contact_phone || '',
      open_drives_count: parseInt(company.open_drives_count ?? company.openDrivesCount, 10) || 0,
      total_hired_history: parseInt(company.total_hired_history ?? company.totalHiredHistory, 10) || 0,
      logo: company.logo || ''
    };

    if (authUserId) {
      row.user_id = authUserId;
      row.created_by = authUserId;
    }

    // 1. Primary insert with exact columns
    let { data, error } = await supabase.from('companies').insert([row]).select();
    
    if (error) {
      console.warn('Initial insert on companies notice:', error.message);

      // Handle schema column variance if user_id or specific contact column is absent
      const altRow: Record<string, any> = {
        company_name: compName,
        industry: company.industry || 'Technology',
        tier: company.tier || 'Dream',
        status: company.status || 'Active',
        website: company.website || '',
        location: company.location || '',
        contact_person: company.contactPerson || company.contact_person || '',
        contact_email: company.contactEmail || company.contact_email || '',
        contact_phone: company.contactPhone || company.contact_phone || ''
      };

      if (authUserId) {
        altRow.user_id = authUserId;
      }

      let altRes = await supabase.from('companies').insert([altRow]).select();
      if (altRes.error) {
        // Minimal fallback payload without user_id if table does not have user_id
        const minRow: Record<string, any> = {
          company_name: compName,
          industry: company.industry || 'Technology',
          tier: company.tier || 'Dream',
          status: company.status || 'Active',
          website: company.website || '',
          location: company.location || ''
        };
        const minRes = await supabase.from('companies').insert([minRow]).select();
        if (minRes.error) {
          return { error: minRes.error.message };
        }
        return { data: minRes.data?.[0] || { ...company, company_name: compName } };
      }
      return { data: altRes.data?.[0] || { ...company, company_name: compName } };
    }
    return { data: data?.[0] || { ...company, company_name: compName } };
  } catch (err: any) {
    return { error: err?.message || 'Failed to insert company into Supabase' };
  }
}

export async function updateCompanyInSupabase(id: string, partial: Partial<Company> & { company_name?: string; contact_name?: string; contact_phone?: string; [key: string]: any }): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const compName = partial.company_name || partial.name;
    const payload: Record<string, any> = {};
    if (compName !== undefined) {
      payload.company_name = compName;
    }
    if (partial.industry !== undefined) payload.industry = partial.industry;
    if (partial.tier !== undefined) payload.tier = partial.tier;
    if (partial.status !== undefined) payload.status = partial.status;
    if (partial.averagePackage !== undefined || partial.average_package !== undefined) {
      payload.average_package = parseFloat(partial.average_package ?? partial.averagePackage) || 0;
    }
    if (partial.minPackage !== undefined || partial.min_package !== undefined) {
      payload.min_package = parseFloat(partial.min_package ?? partial.minPackage) || 0;
    }
    if (partial.maxPackage !== undefined || partial.max_package !== undefined) {
      payload.max_package = parseFloat(partial.max_package ?? partial.maxPackage) || 0;
    }
    if (partial.website !== undefined) payload.website = partial.website;
    if (partial.location !== undefined) payload.location = partial.location;
    if (partial.contactPerson !== undefined || partial.contact_person !== undefined || partial.contact_name !== undefined) {
      payload.contact_person = partial.contact_person || partial.contactPerson || partial.contact_name;
      payload.contact_name = partial.contact_name || partial.contact_person || partial.contactPerson;
    }
    if (partial.contactEmail !== undefined || partial.contact_email !== undefined) {
      payload.contact_email = partial.contact_email || partial.contactEmail;
    }
    if (partial.contactPhone !== undefined || partial.contact_phone !== undefined) {
      payload.contact_phone = partial.contact_phone || partial.contactPhone;
    }

    const { error } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.warn('Notice: Remote update company deferred:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Notice: Exception updating company in Supabase:', err);
    return { success: false, error: err?.message || 'Failed to update company in Supabase' };
  }
}

export async function deleteCompanyFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Notice: Delete company from Supabase deferred:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Notice: Delete company from Supabase exception:', err);
    return { success: false, error: err?.message || 'Failed to delete company from Supabase' };
  }
}

export async function fetchDrivesFromSupabase(): Promise<{ data?: PlacementDrive[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    // 1. First attempt to fetch with joined companies table
    let drivesData: any[] | null = null;

    try {
      const { data, error } = await supabase
        .from('placement_drives')
        .select(`
          *,
          companies (
            id,
            name,
            company_name,
            logo,
            tier,
            industry
          )
        `)
        .order('drive_date', { ascending: false });

      if (!error && data) {
        drivesData = data;
      } else if (error) {
        console.warn('Notice querying placement_drives with join (falling back to lookup):', error.message);
      }
    } catch (e: any) {
      console.warn('Relational join exception on placement_drives:', e?.message);
    }

    // 2. Fallback to flat query if join failed or was unavailable
    if (!drivesData) {
      const { data, error } = await supabase
        .from('placement_drives')
        .select('*')
        .order('drive_date', { ascending: false });

      if (error) {
        console.error('Supabase error fetching placement_drives:', error);
        return { error: error.message };
      }
      drivesData = data || [];
    }

    // Also fetch companies map to ensure company_name is accurately resolved in all cases
    const companiesMap: Record<string, any> = {};
    try {
      const { data: compData } = await supabase.from('companies').select('*');
      if (compData && Array.isArray(compData)) {
        compData.forEach((c: any) => {
          if (c.id) {
            companiesMap[String(c.id)] = c;
          }
        });
      }
    } catch (_) {}

    const drives: PlacementDrive[] = (drivesData || []).map((row: any) => {
      const joinedComp = row.companies || companiesMap[String(row.company_id || row.companyId)] || null;
      const resolvedCompanyName =
        joinedComp?.company_name ||
        joinedComp?.name ||
        row.company_name ||
        row.companyName ||
        (row.company_id ? `Company (${String(row.company_id).slice(0, 8)})` : 'Company');

      const resolvedCompanyLogo =
        joinedComp?.logo ||
        row.company_logo ||
        row.companyLogo ||
        '';

      const resolvedTier =
        (row.tier as CompanyTier) ||
        (joinedComp?.tier as CompanyTier) ||
        'Core';

      return {
        id: String(row.id),
        companyId: String(row.company_id || row.companyId || ''),
        companyName: resolvedCompanyName,
        companyLogo: resolvedCompanyLogo,
        role: row.role || '',
        jobDescription: row.job_description || row.jobDescription || '',
        packageLPA: parseFloat(row.package_lpa ?? row.packageLPA ?? row.offer_limit_lpa) || 0,
        tier: resolvedTier,
        minCgpa: parseFloat(row.min_cgpa ?? row.minCgpa) || 0,
        maxBacklogs: parseInt(row.max_backlogs ?? row.maxBacklogs, 10) || 0,
        eligibleBranches: Array.isArray(row.eligible_branches)
          ? row.eligible_branches
          : (row.eligible_branches
              ? (typeof row.eligible_branches === 'string'
                  ? (() => { try { return JSON.parse(row.eligible_branches); } catch { return ['CSE', 'IT']; } })()
                  : row.eligible_branches)
              : ['CSE', 'IT']),
        minAttendance: parseInt(row.min_attendance ?? row.minAttendance, 10) || 0,
        graduationYear: parseInt(row.graduation_year ?? row.graduationYear, 10) || 2026,
        offerPolicyRule: row.offer_policy_rule || row.offerPolicyRule || 'Dream Upgrade Only (>= 1.5x)',
        driveDate: row.drive_date || row.driveDate || '',
        registrationDeadline: row.registration_deadline || row.registrationDeadline || row.drive_date || '',
        location: row.location || 'On-Campus',
        status: (row.status as DriveStatus) || 'Active',
        rounds: Array.isArray(row.rounds)
          ? row.rounds
          : (row.rounds
              ? (typeof row.rounds === 'string'
                  ? (() => { try { return JSON.parse(row.rounds); } catch { return ['Online Assessment', 'Technical Interview', 'HR Interview']; } })()
                  : row.rounds)
              : ['Online Assessment', 'Technical Interview', 'HR Interview'])
      };
    });

    return { data: drives };
  } catch (err: any) {
    console.error('Exception fetching placement_drives from Supabase:', err);
    return { error: err?.message || 'Failed to fetch drives from Supabase' };
  }
}

export async function addDriveToSupabase(drive: Partial<PlacementDrive> & {
  company_id?: string;
  package_lpa?: number;
  min_cgpa?: number;
  max_backlogs?: number;
  min_attendance?: number;
  eligible_branches?: any;
  graduation_year?: number;
  offer_limit_lpa?: number;
  drive_date?: string;
  status?: DriveStatus;
  user_id?: string;
  created_by?: string;
}): Promise<{ data?: PlacementDrive; error?: string }> {
  const driveId = (drive.id && isValidUUID(drive.id)) ? drive.id : generateUUID();
  const rawCompanyId = drive.companyId || drive.company_id || null;
  const companyId = (rawCompanyId && isValidUUID(rawCompanyId)) ? rawCompanyId : null;
  const pkg = drive.packageLPA ?? drive.package_lpa ?? 0;
  const branches = drive.eligibleBranches || drive.eligible_branches || ['CSE', 'IT'];
  const dDate = drive.driveDate || drive.drive_date || new Date().toISOString().split('T')[0];
  const dStatus = drive.status || 'Active';

  const defaultDriveObj: PlacementDrive = {
    id: driveId,
    companyId: String(rawCompanyId || ''),
    companyName: drive.companyName || 'Company',
    companyLogo: drive.companyLogo || '',
    role: drive.role || '',
    jobDescription: drive.jobDescription || '',
    packageLPA: pkg,
    tier: drive.tier || (pkg >= 12 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core'),
    minCgpa: drive.minCgpa ?? drive.min_cgpa ?? 6.0,
    maxBacklogs: drive.maxBacklogs ?? drive.max_backlogs ?? 0,
    eligibleBranches: branches,
    minAttendance: drive.minAttendance ?? drive.min_attendance ?? 75,
    graduationYear: drive.graduationYear ?? drive.graduation_year ?? 2026,
    offerPolicyRule: drive.offerPolicyRule || 'Dream Upgrade Only (>= 1.5x)',
    driveDate: dDate,
    registrationDeadline: drive.registrationDeadline || dDate,
    location: drive.location || 'On-Campus',
    status: dStatus,
    rounds: drive.rounds || ['Online Assessment', 'Technical Interview', 'HR Interview']
  };

  if (!isSupabaseConfigured || !supabase) {
    return { data: defaultDriveObj };
  }
  try {
    const authUserId = drive.user_id || await getAuthenticatedUserId();
    // 1. Primary insertion payload with full columns including offer_limit_lpa
    const primaryRow: Record<string, any> = {
      id: driveId,
      company_id: companyId,
      company_name: drive.companyName || 'Company',
      company_logo: drive.companyLogo || null,
      role: drive.role,
      job_description: drive.jobDescription || null,
      package_lpa: pkg,
      tier: drive.tier || (pkg >= 12 ? 'Super Dream' : pkg >= 8 ? 'Dream' : pkg >= 5 ? 'Core' : 'Mass'),
      min_cgpa: drive.minCgpa ?? drive.min_cgpa ?? 6.0,
      max_backlogs: drive.maxBacklogs ?? drive.max_backlogs ?? 0,
      eligible_branches: branches,
      min_attendance: drive.minAttendance ?? drive.min_attendance ?? 75,
      graduation_year: drive.graduationYear ?? drive.graduation_year ?? 2026,
      offer_limit_lpa: drive.offer_limit_lpa ?? pkg,
      offer_policy_rule: drive.offerPolicyRule || 'Dream Upgrade Only (>= 1.5x)',
      drive_date: dDate,
      registration_deadline: drive.registrationDeadline || dDate,
      location: drive.location || 'On-Campus',
      status: dStatus,
      rounds: drive.rounds || ['Online Assessment', 'Technical Interview', 'HR Interview']
    };

    if (authUserId) {
      primaryRow.user_id = authUserId;
      primaryRow.created_by = authUserId;
    }

    let { data, error } = await supabase.from('placement_drives').insert([primaryRow]).select();

    if (error) {
      console.warn('Initial insert on placement_drives notice:', error.message);
      // Fallback row KEEPING user_id so RLS policy WITH CHECK (auth.uid() = user_id) passes!
      const fallbackRow: Record<string, any> = {
        id: driveId,
        company_id: companyId,
        role: drive.role,
        package_lpa: pkg,
        min_cgpa: drive.minCgpa ?? drive.min_cgpa ?? 6.0,
        max_backlogs: drive.maxBacklogs ?? drive.max_backlogs ?? 0,
        min_attendance: drive.minAttendance ?? drive.min_attendance ?? 75,
        eligible_branches: branches,
        graduation_year: drive.graduationYear ?? drive.graduation_year ?? 2026,
        offer_limit_lpa: drive.offer_limit_lpa ?? pkg,
        drive_date: dDate,
        status: dStatus
      };

      if (authUserId) {
        fallbackRow.user_id = authUserId;
        fallbackRow.created_by = authUserId;
      }

      let fallbackRes = await supabase.from('placement_drives').insert([fallbackRow]).select();
      if (fallbackRes.error && (fallbackRes.error.code === '42703' || (fallbackRes.error.message?.includes('column') && fallbackRes.error.message?.includes('does not exist')))) {
        const noAuthRow = { ...fallbackRow };
        delete noAuthRow.user_id;
        delete noAuthRow.created_by;
        fallbackRes = await supabase.from('placement_drives').insert([noAuthRow]).select();
      }

      if (fallbackRes.error) {
        console.warn('Notice: Remote insert placement drive deferred:', fallbackRes.error.message);
        return { data: defaultDriveObj, error: fallbackRes.error.message };
      }
      data = fallbackRes.data;
    }

    const savedDrive = data?.[0] ? { ...defaultDriveObj, id: data[0].id } : defaultDriveObj;
    return { data: savedDrive };
  } catch (err: any) {
    console.warn('Notice: Remote insert placement drive exception:', err?.message || err);
    return { data: defaultDriveObj, error: err?.message || 'Failed to insert placement drive into Supabase' };
  }
}

export async function updateDriveInSupabase(id: string, partial: Partial<PlacementDrive> & {
  company_id?: string;
  package_lpa?: number;
  min_cgpa?: number;
  max_backlogs?: number;
  min_attendance?: number;
  eligible_branches?: any;
  graduation_year?: number;
  offer_limit_lpa?: number;
  drive_date?: string;
  status?: DriveStatus;
}): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const payload: Record<string, any> = {};
    if (partial.companyId !== undefined || partial.company_id !== undefined) {
      payload.company_id = partial.companyId || partial.company_id;
    }
    if (partial.companyName !== undefined) payload.company_name = partial.companyName;
    if (partial.companyLogo !== undefined) payload.company_logo = partial.companyLogo;
    if (partial.role !== undefined) payload.role = partial.role;
    if (partial.jobDescription !== undefined) payload.job_description = partial.jobDescription;
    if (partial.packageLPA !== undefined || partial.package_lpa !== undefined) {
      const p = partial.packageLPA ?? partial.package_lpa;
      payload.package_lpa = p;
      payload.offer_limit_lpa = p;
    }
    if (partial.tier !== undefined) payload.tier = partial.tier;
    if (partial.minCgpa !== undefined || partial.min_cgpa !== undefined) {
      payload.min_cgpa = partial.minCgpa ?? partial.min_cgpa;
    }
    if (partial.maxBacklogs !== undefined || partial.max_backlogs !== undefined) {
      payload.max_backlogs = partial.maxBacklogs ?? partial.max_backlogs;
    }
    if (partial.eligibleBranches !== undefined || partial.eligible_branches !== undefined) {
      payload.eligible_branches = partial.eligibleBranches ?? partial.eligible_branches;
    }
    if (partial.minAttendance !== undefined || partial.min_attendance !== undefined) {
      payload.min_attendance = partial.minAttendance ?? partial.min_attendance;
    }
    if (partial.graduationYear !== undefined || partial.graduation_year !== undefined) {
      payload.graduation_year = partial.graduationYear ?? partial.graduation_year;
    }
    if (partial.offerPolicyRule !== undefined) payload.offer_policy_rule = partial.offerPolicyRule;
    if (partial.driveDate !== undefined || partial.drive_date !== undefined) {
      payload.drive_date = partial.driveDate ?? partial.drive_date;
    }
    if (partial.registrationDeadline !== undefined) payload.registration_deadline = partial.registrationDeadline;
    if (partial.location !== undefined) payload.location = partial.location;
    if (partial.status !== undefined) payload.status = partial.status;
    if (partial.rounds !== undefined) payload.rounds = partial.rounds;

    const { error } = await supabase
      .from('placement_drives')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.warn('Update placement_drives notice:', error.message);
      // Fallback with minimal columns if some columns don't exist
      const minimalPayload: Record<string, any> = {};
      if (payload.company_id !== undefined) minimalPayload.company_id = payload.company_id;
      if (payload.role !== undefined) minimalPayload.role = payload.role;
      if (payload.package_lpa !== undefined) {
        minimalPayload.package_lpa = payload.package_lpa;
        minimalPayload.offer_limit_lpa = payload.package_lpa;
      }
      if (payload.min_cgpa !== undefined) minimalPayload.min_cgpa = payload.min_cgpa;
      if (payload.max_backlogs !== undefined) minimalPayload.max_backlogs = payload.max_backlogs;
      if (payload.min_attendance !== undefined) minimalPayload.min_attendance = payload.min_attendance;
      if (payload.eligible_branches !== undefined) minimalPayload.eligible_branches = payload.eligible_branches;
      if (payload.graduation_year !== undefined) minimalPayload.graduation_year = payload.graduation_year;
      if (payload.drive_date !== undefined) minimalPayload.drive_date = payload.drive_date;
      if (payload.status !== undefined) minimalPayload.status = payload.status;

      const fallbackRes = await supabase
        .from('placement_drives')
        .update(minimalPayload)
        .eq('id', id);

      if (fallbackRes.error) {
        console.warn('Notice: Remote update placement drive deferred:', fallbackRes.error.message);
        return { success: false, error: fallbackRes.error.message };
      }
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Notice: Update placement drive in Supabase exception:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to update drive in Supabase' };
  }
}

export async function deleteDriveFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const { error } = await supabase
      .from('placement_drives')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Notice: Delete placement drive in Supabase deferred:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Notice: Delete placement drive in Supabase exception:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to delete drive from Supabase' };
  }
}

export async function upsertCompanyToSupabase(company: Company) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const authUserId = company.user_id || await getAuthenticatedUserId();
    const compName = company.company_name || company.name || 'Company';
    const payload: Record<string, any> = {
      company_name: compName,
      industry: company.industry,
      tier: company.tier,
      open_drives_count: company.openDrivesCount,
      average_package: company.averagePackage,
      min_package: company.minPackage,
      max_package: company.maxPackage,
      status: company.status,
      website: company.website,
      location: company.location,
      contact_person: company.contactPerson,
      contact_name: company.contactPerson,
      contact_email: company.contactEmail,
      contact_phone: company.contactPhone,
      total_hired_history: company.totalHiredHistory,
      logo: company.logo
    };
    if (company.id && isValidUUID(company.id)) {
      payload.id = company.id;
    }
    if (authUserId) {
      payload.user_id = authUserId;
      payload.created_by = authUserId;
    }
    await supabase.from('companies').upsert(payload, { onConflict: 'id' });
  } catch (err) {
    console.error('Failed to sync company to Supabase:', err);
  }
}

export async function upsertDriveToSupabase(drive: PlacementDrive) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const authUserId = drive.user_id || await getAuthenticatedUserId();
    const payload: Record<string, any> = {
      id: drive.id,
      company_id: drive.companyId,
      company_name: drive.companyName,
      company_logo: drive.companyLogo,
      role: drive.role,
      job_description: drive.jobDescription,
      package_lpa: drive.packageLPA,
      tier: drive.tier,
      min_cgpa: drive.minCgpa,
      max_backlogs: drive.maxBacklogs,
      eligible_branches: drive.eligibleBranches,
      min_attendance: drive.minAttendance,
      graduation_year: drive.graduationYear,
      offer_policy_rule: drive.offerPolicyRule,
      drive_date: drive.driveDate,
      registration_deadline: drive.registrationDeadline,
      location: drive.location,
      status: drive.status,
      rounds: drive.rounds
    };
    if (authUserId) {
      payload.user_id = authUserId;
      payload.created_by = authUserId;
    }
    await supabase.from('placement_drives').upsert(payload, { onConflict: 'id' });
  } catch (err) {
    console.error('Failed to sync drive to Supabase:', err);
  }
}

export async function upsertApplicationToSupabase(application: Application) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const authUserId = application.user_id || await getAuthenticatedUserId();
    const payload: Record<string, any> = {
      id: application.id,
      student_id: application.studentId,
      student_name: application.studentName,
      student_enrollment: application.studentEnrollment,
      student_branch: application.studentBranch,
      student_cgpa: application.studentCgpa,
      student_attendance: application.studentAttendance,
      drive_id: application.driveId,
      company_name: application.companyName,
      company_logo: application.companyLogo,
      role: application.role,
      package_lpa: application.packageLPA,
      applied_date: application.appliedDate,
      eligibility_status: application.eligibilityStatus,
      ineligibility_reasons: application.ineligibilityReasons,
      status: application.status,
      current_round: application.currentRound,
      interview_slot: application.interviewSlot,
      feedback: application.feedback
    };
    if (authUserId) {
      payload.user_id = authUserId;
      payload.created_by = authUserId;
    }
    await supabase.from('applications').upsert(payload, { onConflict: 'id' });
  } catch (err) {
    console.error('Failed to sync application to Supabase:', err);
  }
}

export async function upsertOfferToSupabase(offer: Offer) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const authUserId = offer.user_id || await getAuthenticatedUserId();
    const payload: Record<string, any> = {
      id: offer.id,
      student_id: offer.studentId,
      student_name: offer.studentName,
      student_enrollment: offer.studentEnrollment,
      student_branch: offer.studentBranch,
      company_id: offer.companyId,
      company_name: offer.companyName,
      company_logo: offer.companyLogo,
      role: offer.role,
      package_lpa: offer.packageLPA,
      offer_date: offer.offerDate,
      status: offer.status,
      policy_check_passed: offer.policyCheckPassed,
      policy_violation_reason: offer.policyViolationReason,
      tier: offer.tier,
      deadline_date: offer.deadlineDate,
      bond_years: offer.bondYears
    };
    if (authUserId) {
      payload.user_id = authUserId;
      payload.created_by = authUserId;
    }
    await supabase.from('offers').upsert(payload, { onConflict: 'id' });
  } catch (err) {
    console.error('Failed to sync offer to Supabase:', err);
  }
}

export async function upsertPolicyToSupabase(policy: OfferPolicyConfig) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('offer_policy').upsert({
      id: 'default-policy',
      allow_multiple_offers: policy.allowMultipleOffers,
      max_offers_allowed: policy.maxOffersAllowed,
      dream_threshold_lpa: policy.dreamThresholdLPA,
      super_dream_threshold_lpa: policy.superDreamThresholdLPA,
      min_hike_percentage_for_upgrade: policy.minHikePercentageForUpgrade,
      freeze_on_acceptance: policy.freezeOnAcceptance,
      mass_recruiter_lock: policy.massRecruiterLock
    }, { onConflict: 'id' });
  } catch (err) {
    console.error('Failed to sync policy to Supabase:', err);
  }
}

/**
 * Dedicated Application Table Operations
 */
export async function fetchApplicationsFromSupabase(): Promise<{ data?: Application[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('applied_at', { ascending: false });

    if (error) {
      console.warn('Notice querying Supabase applications table (using local cache):', error.message);
      return { error: error.message };
    }

    const applications: Application[] = (data || []).map((row: any) => ({
      id: String(row.id),
      studentId: row.student_id || row.studentId || '',
      studentName: row.student_name || row.studentName || 'Student',
      studentEnrollment: row.student_enrollment || row.studentEnrollment || '',
      studentBranch: row.student_branch || row.studentBranch || 'CSE',
      studentCgpa: parseFloat(row.student_cgpa || row.studentCgpa) || 0,
      studentAttendance: parseInt(row.student_attendance || row.studentAttendance, 10) || 75,
      driveId: row.drive_id || row.driveId || '',
      companyName: row.company_name || row.companyName || 'Company',
      companyLogo: row.company_logo || row.companyLogo || '',
      role: row.role || 'Software Engineer',
      packageLPA: parseFloat(row.package_lpa || row.packageLPA) || 0,
      appliedDate: (row.applied_at ? row.applied_at.split('T')[0] : (row.applied_date || row.appliedDate || new Date().toISOString().split('T')[0])),
      eligibilityStatus: row.eligibility_status || row.eligibilityStatus || 'Eligible',
      ineligibilityReasons: Array.isArray(row.ineligibility_reasons)
        ? row.ineligibility_reasons
        : (row.ineligibility_reasons ? (typeof row.ineligibility_reasons === 'string' ? JSON.parse(row.ineligibility_reasons) : row.ineligibility_reasons) : []),
      status: (row.status as ApplicationStatus) || 'Applied',
      currentRound: row.current_round || row.currentRound,
      interviewSlot: row.interview_slot || row.interviewSlot,
      feedback: row.feedback
    }));

    return { data: applications };
  } catch (err: any) {
    console.warn('Notice in fetchApplicationsFromSupabase (using local cache):', err?.message || err);
    return { error: err?.message || 'Failed to fetch applications from Supabase' };
  }
}

/**
 * Fetch applications joined with students, placement_drives, and companies
 */
export async function fetchApplicationsJoinedFromSupabase(): Promise<{ data?: Application[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    // 1. Fetch applications safely (with fallback if applied_at column ordering fails)
    let appRows: any[] = [];
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*');
      if (error) {
        console.warn('Notice querying Supabase applications:', error.message);
        return { error: error.message };
      }
      appRows = data || [];
    } catch (err: any) {
      console.warn('Notice querying Supabase applications:', err?.message || err);
      return { error: err?.message || 'Failed to query applications table' };
    }

    if (appRows.length === 0) {
      return { data: [] };
    }

    // 2. Fetch joined students, placement_drives, and companies using Promise.allSettled
    const [studentsSettled, drivesSettled, companiesSettled] = await Promise.allSettled([
      supabase.from('students').select('*'),
      supabase.from('placement_drives').select('*'),
      supabase.from('companies').select('*')
    ]);

    const studentsData = studentsSettled.status === 'fulfilled' ? (studentsSettled.value.data || []) : [];
    const drivesData = drivesSettled.status === 'fulfilled' ? (drivesSettled.value.data || []) : [];
    const companiesData = companiesSettled.status === 'fulfilled' ? (companiesSettled.value.data || []) : [];

    const studentMap = new Map(studentsData.map((s: any) => [String(s.id), s]));
    const driveMap = new Map(drivesData.map((d: any) => [String(d.id), d]));
    const companyMap = new Map(companiesData.map((c: any) => [String(c.id), c]));

    const joined: Application[] = appRows.map((row: any) => {
      const studentId = String(row.student_id || row.studentId || '');
      const driveId = String(row.drive_id || row.driveId || '');

      const s = studentMap.get(studentId);
      const d = driveMap.get(driveId);
      const c = d ? companyMap.get(String(d.company_id || d.companyId)) : undefined;

      const studentName = s?.full_name || s?.name || row.student_name || row.studentName || 'Student';
      const studentEnrollment = s?.enrollment_number || s?.enrollmentNumber || row.student_enrollment || row.studentEnrollment || '';
      const studentBranch = (s?.branch || row.student_branch || row.studentBranch || 'CSE') as Branch;
      const studentCgpa = typeof s?.cgpa === 'number' ? s.cgpa : (parseFloat(row.student_cgpa || row.studentCgpa) || 0);
      const studentAttendance = typeof s?.attendance === 'number' ? s.attendance : (parseInt(row.student_attendance || row.studentAttendance, 10) || 75);

      const companyName = c?.name || c?.company_name || d?.company_name || d?.companyName || row.company_name || row.companyName || 'Company';
      const companyLogo = c?.logo || d?.company_logo || d?.companyLogo || row.company_logo || row.companyLogo || '';
      const role = d?.role || row.role || 'Software Engineer';
      const packageLPA = typeof d?.package_lpa === 'number' ? d.package_lpa : (parseFloat(row.package_lpa || row.packageLPA) || 0);

      const appliedDate = row.applied_at
        ? row.applied_at.split('T')[0]
        : (row.applied_date || row.appliedDate || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]));

      return {
        id: String(row.id),
        studentId,
        studentName,
        studentEnrollment,
        studentBranch,
        studentCgpa,
        studentAttendance,
        driveId,
        companyName,
        companyLogo,
        role,
        packageLPA,
        appliedDate,
        eligibilityStatus: row.eligibility_status || row.eligibilityStatus || 'Eligible',
        ineligibilityReasons: Array.isArray(row.ineligibility_reasons)
          ? row.ineligibility_reasons
          : (row.ineligibility_reasons ? (typeof row.ineligibility_reasons === 'string' ? JSON.parse(row.ineligibility_reasons) : row.ineligibility_reasons) : []),
        status: (row.status as ApplicationStatus) || 'Applied',
        currentRound: row.current_round || row.currentRound,
        interviewSlot: row.interview_slot || row.interviewSlot,
        feedback: row.feedback
      };
    });

    // Sort by appliedDate descending
    joined.sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());

    return { data: joined };
  } catch (err: any) {
    console.warn('Notice in fetchApplicationsJoinedFromSupabase (using cache):', err?.message || err);
    return { error: err?.message || 'Failed to fetch joined applications' };
  }
}

export async function addApplicationToSupabase(application: Application & { user_id?: string; created_by?: string }): Promise<{ data?: Application; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    const authUserId = application.user_id || await getAuthenticatedUserId();
    const appId = (application.id && isValidUUID(application.id)) ? application.id : generateUUID();
    const row: Record<string, any> = {
      id: appId,
      student_id: application.studentId,
      student_name: application.studentName || 'Student',
      student_enrollment: application.studentEnrollment || '',
      student_branch: application.studentBranch || 'CSE',
      student_cgpa: application.studentCgpa ?? 0,
      student_attendance: application.studentAttendance ?? 100,
      drive_id: application.driveId,
      company_name: application.companyName || 'Company',
      company_logo: application.companyLogo || null,
      role: application.role || 'Software Engineer',
      package_lpa: application.packageLPA ?? 0,
      applied_at: new Date().toISOString(),
      applied_date: application.appliedDate || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
      eligibility_status: application.eligibilityStatus || 'Eligible',
      ineligibility_reasons: application.ineligibilityReasons || [],
      status: application.status || 'Applied',
      current_round: application.currentRound || null,
      interview_slot: application.interviewSlot || null,
      feedback: application.feedback || null
    };

    if (authUserId) {
      row.user_id = authUserId;
      row.created_by = authUserId;
    }

    let { data, error } = await supabase.from('applications').upsert([row], { onConflict: 'id' }).select();
    
    // Only strip user_id / created_by if database specifically reports the column does not exist (code 42703)
    if (error && (error.code === '42703' || (error.message?.includes('column') && error.message?.includes('does not exist')))) {
      const fallbackRow = { ...row };
      delete fallbackRow.user_id;
      delete fallbackRow.created_by;
      const retryRes = await supabase.from('applications').upsert([fallbackRow], { onConflict: 'id' }).select();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error('Supabase insert application error:', error);
      return { error: error.message };
    }
    const savedApp = data?.[0] ? { ...application, id: data[0].id } : { ...application, id: appId };
    return { data: savedApp };
  } catch (err: any) {
    console.error('Exception adding application to Supabase:', err);
    return { error: err?.message || 'Failed to insert application into Supabase' };
  }
}

export async function updateApplicationInSupabase(id: string, partial: Partial<Application>): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (partial.status !== undefined) payload.status = partial.status;
    if (partial.currentRound !== undefined) payload.current_round = partial.currentRound;
    if (partial.interviewSlot !== undefined) payload.interview_slot = partial.interviewSlot;
    if (partial.feedback !== undefined) payload.feedback = partial.feedback;
    if (partial.eligibilityStatus !== undefined) payload.eligibility_status = partial.eligibilityStatus;

    const { error } = await supabase
      .from('applications')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.warn(`Notice: Supabase update application deferred for ${id}:`, error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn(`Notice: Exception updating application ${id} in Supabase:`, err);
    return { success: false, error: err?.message || 'Failed to update application in Supabase' };
  }
}

export async function deleteApplicationFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const { error } = await supabase.from('applications').delete().eq('id', id);
    if (error) {
      console.warn(`Notice: Supabase delete application deferred for ${id}:`, error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn(`Notice: Exception deleting application ${id} in Supabase:`, err);
    return { success: false, error: err?.message || 'Failed to delete application from Supabase' };
  }
}

/**
 * Check student eligibility status for a drive directly against eligibility_results in Supabase
 */
export async function checkStudentEligibilityForDriveInDb(
  studentId: string,
  driveId: string
): Promise<{
  status: 'eligible' | 'ineligible' | 'not_evaluated';
  reasons: string[];
  checked_at?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { status: 'not_evaluated', reasons: ['Supabase is not connected'] };
  }

  try {
    const { data, error } = await supabase
      .from('eligibility_results')
      .select('*')
      .eq('student_id', studentId)
      .eq('drive_id', driveId)
      .maybeSingle();

    if (error) {
      console.warn(`Notice checking eligibility for student ${studentId} on drive ${driveId} (using local cache):`, error.message);
      return { status: 'not_evaluated', reasons: [], error: error.message };
    }

    if (!data) {
      return { status: 'not_evaluated', reasons: [] };
    }

    const reasons = Array.isArray(data.reasons)
      ? data.reasons
      : (data.reasons ? (typeof data.reasons === 'string' ? JSON.parse(data.reasons) : [data.reasons]) : []);

    return {
      status: data.eligible ? 'eligible' : 'ineligible',
      reasons,
      checked_at: data.checked_at
    };
  } catch (err: any) {
    console.warn(`Notice checking eligibility for student ${studentId} on drive ${driveId}:`, err?.message || err);
    return { status: 'not_evaluated', reasons: [], error: err?.message };
  }
}

/**
 * Fetch all eligibility records for a student across all drives from Supabase
 */
export async function fetchStudentAllEligibilityResults(
  studentId: string
): Promise<{ data: Map<string, { eligible: boolean; reasons: string[]; checked_at: string }>; error?: string }> {
  const result = new Map<string, { eligible: boolean; reasons: string[]; checked_at: string }>();

  if (!isSupabaseConfigured || !supabase) {
    return { data: result };
  }

  try {
    const { data, error } = await supabase
      .from('eligibility_results')
      .select('*')
      .eq('student_id', studentId);

    if (error) {
      console.warn(`Notice fetching eligibility results for student ${studentId} (using local cache):`, error.message);
      return { data: result, error: error.message };
    }

    (data || []).forEach((row: any) => {
      const driveId = String(row.drive_id);
      const reasons = Array.isArray(row.reasons)
        ? row.reasons
        : (row.reasons ? (typeof row.reasons === 'string' ? JSON.parse(row.reasons) : [row.reasons]) : []);

      result.set(driveId, {
        eligible: Boolean(row.eligible),
        reasons,
        checked_at: row.checked_at || ''
      });
    });

    return { data: result };
  } catch (err: any) {
    console.warn(`Notice fetching eligibility results for student ${studentId}:`, err?.message || err);
    return { data: result, error: err?.message };
  }
}

/**
 * Dedicated Offer Table Operations
 */
export interface SupabaseDiagnosticInfo {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
  url: string;
}

export async function fetchOffersFromSupabase(): Promise<{ data?: Offer[]; error?: string; diagnostic?: SupabaseDiagnosticInfo }> {
  return fetchOffersJoinedFromSupabase();
}

export async function fetchOffersJoinedFromSupabase(): Promise<{
  data?: Offer[];
  error?: string;
  diagnostic?: SupabaseDiagnosticInfo;
}> {
  const creds = getSupabaseCredentials();
  const activeUrl = creds.url || 'Not configured';
  const client = getSupabaseClient() || supabase;

  if (!isSupabaseConfigured || !client) {
    const diag: SupabaseDiagnosticInfo = {
      message: 'Supabase is not configured or credentials are missing',
      url: activeUrl
    };
    console.warn('[Supabase Diagnosis] Configuration check notice:', diag);
    return { error: 'Supabase is not configured', diagnostic: diag };
  }

  // Required log for every offers query
  console.log("Fetching offers from Supabase");

  // Main query: Fetch offers directly from public.offers via Supabase client
  try {
    let offerRows: any[] = [];
    const { data, error } = await client.from('offers').select('*');
    
    if (error) {
      console.error("Offers Supabase error:", error);
      const diag: SupabaseDiagnosticInfo = {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        url: activeUrl
      };
      return { error: error.message, diagnostic: diag };
    }
    
    offerRows = data || [];

    if (offerRows.length === 0) {
      return { data: [] };
    }

    // Fetch associated tables if present to enrich data
    const [studentsSettled, companiesSettled, drivesSettled] = await Promise.allSettled([
      client.from('students').select('*'),
      client.from('companies').select('*'),
      client.from('placement_drives').select('*')
    ]);

    const studentsData = studentsSettled.status === 'fulfilled' ? (studentsSettled.value.data || []) : [];
    const companiesData = companiesSettled.status === 'fulfilled' ? (companiesSettled.value.data || []) : [];
    const drivesData = drivesSettled.status === 'fulfilled' ? (drivesSettled.value.data || []) : [];

    const studentsMap = new Map(studentsData.map((s: any) => [String(s.id), s]));
    const companiesMap = new Map(companiesData.map((c: any) => [String(c.id), c]));
    const drivesMap = new Map(drivesData.map((d: any) => [String(d.id), d]));

    const offers: Offer[] = offerRows.map((row: any) => {
      const studentId = String(row.student_id || row.studentId || '');
      const driveId = String(row.drive_id || row.driveId || '');
      const companyId = String(row.company_id || row.companyId || '');

      const s = studentsMap.get(studentId);
      const d = drivesMap.get(driveId);
      const c = companiesMap.get(companyId) || (d ? companiesMap.get(String(d.company_id || d.companyId)) : undefined);

      // Support both active schema fields (student_name, enrollment_number, company, role, package_lpa, offer_date, offer_status, update_status) and joins
      const studentName = row.student_name || row.studentName || s?.name || 'Student';
      const studentEnrollment = row.enrollment_number || row.enrollmentNumber || row.student_enrollment || row.studentEnrollment || s?.enrollment_number || '';
      const studentBranch = (row.student_branch || row.studentBranch || s?.branch || 'CSE') as Branch;

      const companyName = row.company || row.company_name || row.companyName || c?.name || d?.company_name || 'Company';
      const companyLogo = row.company_logo || row.companyLogo || c?.logo || d?.company_logo || '';
      const role = row.role || d?.role || 'Software Engineer';
      const packageLPA = parseFloat(row.package_lpa ?? row.packageLPA ?? d?.package_lpa ?? 0) || 0;
      const offerDate = row.offer_date || row.offered_date || row.offerDate || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
      const status = (row.offer_status || row.status || 'Offered') as OfferStatus;

      return {
        id: String(row.id),
        studentId,
        studentName,
        studentEnrollment,
        studentBranch,
        driveId,
        companyId,
        companyName,
        companyLogo,
        role,
        packageLPA,
        offerDate,
        status,
        updateStatus: row.update_status || 'synced',
        policyCheckPassed: Boolean(row.policy_check_passed ?? row.policyCheckPassed ?? true),
        policyViolationReason: row.policy_violation_reason || row.policyViolationReason,
        tier: (row.tier as CompanyTier) || d?.tier || (packageLPA >= 12 ? 'Super Dream' : packageLPA >= 8 ? 'Dream' : 'Core'),
        deadlineDate: row.deadline_date || row.acceptance_deadline || row.deadlineDate || '',
        bondYears: row.bond_years ?? row.bondYears
      };
    });

    // Sort by offerDate descending
    offers.sort((a, b) => new Date(b.offerDate).getTime() - new Date(a.offerDate).getTime());

    return { data: offers };
  } catch (err: any) {
    console.error("Offers Supabase error:", err);
    const diag: SupabaseDiagnosticInfo = {
      message: err?.message || 'Failed to fetch offers from Supabase',
      details: err?.details || err?.stack,
      hint: err?.hint,
      code: err?.code,
      url: activeUrl
    };
    return { error: diag.message, diagnostic: diag };
  }
}

export async function createOfferInSupabase(params: {
  id?: string;
  student_id: string;
  drive_id?: string;
  company_id?: string;
  package_lpa: number;
  status?: OfferStatus;
  role?: string;
  student_name?: string;
  student_enrollment?: string;
  student_branch?: string;
  company_name?: string;
  company_logo?: string;
  user_id?: string;
  created_by?: string;
}): Promise<{ data?: Offer; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    const authUserId = params.user_id || await getAuthenticatedUserId();
    const studentId = params.student_id;
    const driveId = params.drive_id || '';
    const companyId = params.company_id || '';
    const pkg = Number(params.package_lpa) || 0;
    const status: OfferStatus = params.status || 'Offered';
    const offerDate = new Date().toISOString().split('T')[0];
    const offerId = (params.id && isValidUUID(params.id)) ? params.id : generateUUID();

    // 1. Prevent duplicate offers for the same student and drive
    if (driveId && studentId && isValidUUID(studentId) && isValidUUID(driveId)) {
      const { data: existing, error: checkErr } = await supabase
        .from('offers')
        .select('id, status, offer_status')
        .eq('student_id', studentId)
        .eq('drive_id', driveId)
        .maybeSingle();

      if (checkErr) {
        console.warn('Notice checking existing offer duplicate:', checkErr.message);
      }

      if (existing) {
        return { error: 'An offer already exists for this student and placement drive.' };
      }
    }

    // 2. Primary insert targeting the offers schema
    const payload: Record<string, any> = {
      id: offerId,
      student_name: params.student_name || 'Student',
      enrollment_number: params.student_enrollment || '',
      company: params.company_name || 'Company',
      role: params.role || 'Software Engineer',
      package_lpa: pkg,
      offer_date: offerDate,
      offer_status: status,
      update_status: 'created',
      status: status,
      student_id: isValidUUID(studentId) ? studentId : null,
      drive_id: isValidUUID(driveId) ? driveId : null,
      company_id: isValidUUID(companyId) ? companyId : null,
      company_name: params.company_name || null,
      company_logo: params.company_logo || null,
      student_enrollment: params.student_enrollment || null,
      student_branch: params.student_branch || null,
      created_at: new Date().toISOString()
    };

    if (authUserId) {
      payload.user_id = authUserId;
      payload.created_by = authUserId;
    }

    let { data, error: insertErr } = await supabase.from('offers').insert([payload]).select();

    if (insertErr) {
      console.warn('Notice on full offers insert, trying standard schema fallback:', insertErr.message);
      const standardPayload: Record<string, any> = {
        id: offerId,
        student_name: params.student_name || 'Student',
        enrollment_number: params.student_enrollment || '',
        company: params.company_name || 'Company',
        role: params.role || 'Software Engineer',
        package_lpa: pkg,
        offer_date: offerDate,
        offer_status: status,
        update_status: 'created'
      };
      if (authUserId) {
        standardPayload.user_id = authUserId;
        standardPayload.created_by = authUserId;
      }
      let fallbackRes = await supabase.from('offers').insert([standardPayload]).select();
      if (fallbackRes.error && (fallbackRes.error.code === '42703' || (fallbackRes.error.message?.includes('column') && fallbackRes.error.message?.includes('does not exist')))) {
        const noAuthPayload = { ...standardPayload };
        delete noAuthPayload.user_id;
        delete noAuthPayload.created_by;
        fallbackRes = await supabase.from('offers').insert([noAuthPayload]).select();
      }

      if (fallbackRes.error) {
        console.error("Offers Supabase error:", fallbackRes.error);
        return { error: fallbackRes.error.message };
      }
      data = fallbackRes.data;
    }

    // 3. If status is Accepted, update student placement_status to 'Placed'
    if (status === 'Accepted' && studentId) {
      await updateStudentPlacementStatusInDb(studentId, 'Placed');
    }

    const savedOfferId = data?.[0]?.id || offerId;
    const createdOffer: Offer = {
      id: savedOfferId,
      studentId,
      studentName: params.student_name || 'Student',
      studentEnrollment: params.student_enrollment || '',
      studentBranch: (params.student_branch || 'CSE') as Branch,
      driveId,
      companyId,
      companyName: params.company_name || 'Company',
      companyLogo: params.company_logo || '',
      role: params.role || 'Software Engineer',
      packageLPA: pkg,
      offerDate,
      status,
      policyCheckPassed: true,
      tier: pkg >= 12 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core'
    };

    return { data: createdOffer };
  } catch (err: any) {
    console.error("Offers Supabase error:", err);
    return { error: err?.message || 'Failed to create offer in Supabase' };
  }
}

export async function addOfferToSupabase(offer: Offer): Promise<{ data?: Offer; error?: string }> {
  return createOfferInSupabase({
    id: offer.id,
    student_id: offer.studentId,
    drive_id: offer.driveId,
    company_id: offer.companyId,
    package_lpa: offer.packageLPA,
    status: offer.status,
    role: offer.role,
    student_name: offer.studentName,
    student_enrollment: offer.studentEnrollment,
    student_branch: offer.studentBranch,
    company_name: offer.companyName,
    company_logo: offer.companyLogo
  });
}

export async function updateOfferStatusInSupabase(
  offerId: string,
  newStatus: OfferStatus
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    // 1. Fetch current offer to get student_id
    const { data: offerData, error: fetchErr } = await supabase
      .from('offers')
      .select('id, student_id, status, offer_status')
      .eq('id', offerId)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Notice fetching offer before status update:', fetchErr.message);
    }

    const studentId = offerData?.student_id;

    // 2. Update offer status directly using Supabase client
    const { error: updateErr } = await supabase
      .from('offers')
      .update({
        offer_status: newStatus,
        status: newStatus,
        update_status: 'updated'
      })
      .eq('id', offerId);

    if (updateErr) {
      console.error("Offers Supabase error:", updateErr);
      return { success: false, error: updateErr.message };
    }

    // 3. Update student placement status
    if (studentId) {
      if (newStatus === 'Accepted') {
        await updateStudentPlacementStatusInDb(studentId, 'Placed');
      } else if (newStatus === 'Rejected' || newStatus === 'Withdrawn' || newStatus === 'Declined') {
        // Check if student has any OTHER accepted offer
        const { data: remainingOffers } = await supabase
          .from('offers')
          .select('id, status, offer_status')
          .eq('student_id', studentId)
          .neq('id', offerId)
          .or('status.eq.Accepted,offer_status.eq.Accepted');

        if (!remainingOffers || remainingOffers.length === 0) {
          await updateStudentPlacementStatusInDb(studentId, 'Unplaced');
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Offers Supabase error:", err);
    return { success: false, error: err?.message || 'Failed to update offer status in Supabase' };
  }
}

async function updateStudentPlacementStatusInDb(studentId: string, placementStatus: 'Placed' | 'Unplaced' | 'Dream Placed'): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase
      .from('students')
      .update({ placement_status: placementStatus })
      .eq('id', studentId);
  } catch (err) {
    console.warn(`Notice updating student ${studentId} placement_status to ${placementStatus}:`, err);
  }
}

export async function updateOfferInSupabase(id: string, partial: Partial<Offer>): Promise<{ success: boolean; error?: string }> {
  if (partial.status) {
    return updateOfferStatusInSupabase(id, partial.status);
  }
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const payload: Record<string, any> = {
      update_status: 'updated'
    };
    if (partial.status !== undefined) {
      payload.status = partial.status;
      payload.offer_status = partial.status;
    }
    if (partial.role !== undefined) payload.role = partial.role;
    if (partial.packageLPA !== undefined) payload.package_lpa = partial.packageLPA;
    if (partial.companyName !== undefined) payload.company = partial.companyName;
    if (partial.studentName !== undefined) payload.student_name = partial.studentName;
    if (partial.studentEnrollment !== undefined) payload.enrollment_number = partial.studentEnrollment;
    if (partial.policyCheckPassed !== undefined) payload.policy_check_passed = partial.policyCheckPassed;
    if (partial.policyViolationReason !== undefined) payload.policy_violation_reason = partial.policyViolationReason;

    const { error } = await supabase
      .from('offers')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error("Offers Supabase error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("Offers Supabase error:", err);
    return { success: false, error: err?.message || 'Failed to update offer in Supabase' };
  }
}

export async function deleteOfferFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }
  try {
    const { error } = await supabase.from('offers').delete().eq('id', id);
    if (error) {
      console.error("Offers Supabase error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("Offers Supabase error:", err);
    return { success: false, error: err?.message || 'Failed to delete offer from Supabase' };
  }
}

/**
 * Real-time table subscription helper
 */
export function subscribeToRealtimeTable(
  tableName: 'students' | 'companies' | 'placement_drives' | 'applications' | 'offers' | 'offer_policy' | 'eligibility_results',
  callback: (payload: any) => void
) {
  if (!isSupabaseConfigured || !supabase) return () => {};

  const channel = supabase
    .channel(`realtime_${tableName}_${Math.random().toString(36).substring(2, 9)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch (_) {}
  };
}

/**
 * Dedicated Eligibility Results Table Operations
 */
export interface EligibilityResultRow {
  id?: string;
  student_id: string;
  drive_id: string;
  eligible: boolean;
  reasons: string[];
  checked_at: string;
}

export async function fetchEligibilityResultsFromSupabase(
  driveId: string
): Promise<{ data?: EligibilityResultRow[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('eligibility_results')
      .select('*')
      .eq('drive_id', driveId);

    if (error) {
      return { error: error.message };
    }

    const mapped: EligibilityResultRow[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: String(row.student_id),
      drive_id: String(row.drive_id),
      eligible: Boolean(row.eligible),
      reasons: Array.isArray(row.reasons)
        ? row.reasons
        : (row.reasons ? (typeof row.reasons === 'string' ? JSON.parse(row.reasons) : [row.reasons]) : []),
      checked_at: row.checked_at || ''
    }));

    return { data: mapped };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch eligibility results' };
  }
}

export async function saveEligibilityResultsToSupabase(
  driveId: string,
  records: Array<{
    student_id: string;
    drive_id: string;
    eligible: boolean;
    reasons: string[];
    checked_at: string;
  }>
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const { data: existingRows, error: fetchErr } = await supabase
      .from('eligibility_results')
      .select('id, student_id')
      .eq('drive_id', driveId);

    if (fetchErr) {
      console.warn('Notice checking existing eligibility_results:', fetchErr.message);
    }

    const idMap = new Map((existingRows || []).map((r: any) => [String(r.student_id), String(r.id)]));

    const payload = records.map(r => {
      const existingId = idMap.get(r.student_id);
      return {
        ...(existingId ? { id: existingId } : {}),
        student_id: r.student_id,
        drive_id: r.drive_id,
        eligible: r.eligible,
        reasons: r.reasons,
        checked_at: r.checked_at || new Date().toISOString()
      };
    });

    let upsertResult = await supabase
      .from('eligibility_results')
      .upsert(payload, { onConflict: 'student_id,drive_id' });

    if (upsertResult.error) {
      console.warn('Notice on conflict student_id,drive_id, attempting ID-based upsert:', upsertResult.error.message);
      const fallbackPayload = records.map(r => {
        const existingId = idMap.get(r.student_id) || `elg-${r.student_id}-${r.drive_id}`;
        return {
          id: existingId,
          student_id: r.student_id,
          drive_id: r.drive_id,
          eligible: r.eligible,
          reasons: r.reasons,
          checked_at: r.checked_at || new Date().toISOString()
        };
      });

      upsertResult = await supabase
        .from('eligibility_results')
        .upsert(fallbackPayload, { onConflict: 'id' });
    }

    if (upsertResult.error) {
      console.error('Supabase eligibility_results upsert error:', upsertResult.error);
      return { success: false, error: upsertResult.error.message };
    }

    return { success: true, data: upsertResult.data || payload };
  } catch (err: any) {
    console.error('Exception saving eligibility results to Supabase:', err);
    return { success: false, error: err?.message || 'Failed to save eligibility results to database' };
  }
}

/**
 * Fetch authoritative user profile from public.profiles table by auth user UUID
 */
export async function fetchUserProfile(userId: string): Promise<{ profile: UserProfile | null; error: string | null }> {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return { profile: null, error: 'Supabase client is not configured.' };
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, email, role, student_id, company_id, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error querying public.profiles table:', error);
      return { profile: null, error: error.message };
    }

    if (!data) {
      return { profile: null, error: 'Profile record not found in public.profiles' };
    }

    const profile: UserProfile = {
      id: data.id,
      email: data.email || '',
      role: (data.role || 'student').toLowerCase() as UserRole,
      student_id: data.student_id ? String(data.student_id) : null,
      company_id: data.company_id ? String(data.company_id) : null,
      created_at: data.created_at
    };

    return { profile, error: null };
  } catch (err: any) {
    console.error('Exception querying public.profiles:', err);
    return { profile: null, error: err?.message || 'Failed to load profile.' };
  }
}

/**
 * Sign in using Supabase Auth with Email and Password
 */
export async function signInWithSupabaseAuth(
  email: string,
  password: string
): Promise<{ user: any | null; session: any | null; error: string | null }> {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return { user: null, session: null, error: 'Supabase client is not configured.' };
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err: any) {
    return { user: null, session: null, error: err?.message || 'Authentication failed.' };
  }
}

/**
 * Sign out from Supabase Auth session
 */
export async function signOutFromSupabaseAuth(): Promise<{ error: string | null }> {
  try {
    const client = getSupabaseClient();
    if (!client) return { error: null };
    const { error } = await client.auth.signOut();
    return { error: error ? error.message : null };
  } catch (err: any) {
    return { error: err?.message || 'Failed to sign out.' };
  }
}

/**
 * Get active Supabase Auth session on app startup
 */
export async function getSupabaseSession(): Promise<{ session: any | null; user: any | null; error: string | null }> {
  try {
    const client = getSupabaseClient();
    if (!client) return { session: null, user: null, error: null };
    const { data, error } = await client.auth.getSession();
    if (error) {
      return { session: null, user: null, error: error.message };
    }
    return { session: data.session, user: data.session?.user || null, error: null };
  } catch (err: any) {
    return { session: null, user: null, error: err?.message || null };
  }
}



