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
  UserRole,
  DbStudentRow,
  StudentDbInsert,
  DbCompanyRow,
  DbPlacementDriveRow,
  DbEligibilityResultRow,
  DbApplicationRow,
  DbOfferRow,
  DbProfileRow
} from '../types';

// Canonical Supabase Project URL (plwslckyaxdkjultrlca)
export const DEFAULT_SUPABASE_URL = 'https://plwslckyaxdkjultrlca.supabase.co';

// SECURITY: Supabase configuration is read EXCLUSIVELY from build-time
// environment variables. It is never sourced from — or overridable by —
// localStorage, sessionStorage, cookies, URL params, user profiles, or any
// other user-controlled state. The publishable/anon key is safe to ship to the
// browser; database authorization is enforced by Supabase Auth + Row Level
// Security, not by hiding this key.
const viteSupabaseUrl = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_URL || import.meta.env?.SUPABASE_URL)) ||
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL)) || DEFAULT_SUPABASE_URL;
const viteSupabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.SUPABASE_ANON_KEY)) || '';

export const DEFAULT_SUPABASE_ANON_KEY = viteSupabaseAnonKey;

// One-time hardening: strip any Supabase credentials that older builds may have
// persisted in the browser, so a previously user-injected override can never
// take effect again. These keys are intentionally never READ anywhere.
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('placeflow_supabase_url');
    localStorage.removeItem('placeflow_supabase_anon_key');
  }
} catch (_) {}

// Debugging log (Supabase URL only, anon key is NEVER logged)
console.log("Supabase URL:", viteSupabaseUrl || DEFAULT_SUPABASE_URL);

/**
 * Normalizes and cleans Supabase Project URLs
 * Handles trailing slashes, dashboard URLs, missing https://, etc.
 * Also auto-corrects legacy typo ('plwsicky' -> 'plwslcky')
 */
export function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return DEFAULT_SUPABASE_URL;
  let url = rawUrl.trim();
  // Auto-correct typo from original repository
  if (url.includes('plwsickyaxdkjultrlca')) {
    url = url.replace('plwsickyaxdkjultrlca', 'plwslckyaxdkjultrlca');
  }
  const dashMatch = url.match(/(?:supabase\.com\/dashboard\/project|app\.supabase\.com\/project)\/([a-z0-9_-]+)/i);
  if (dashMatch && dashMatch[1]) {
    return `https://${dashMatch[1]}.supabase.co`;
  }
  url = url.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '').replace(/\/auth\/v1\/?$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

/**
 * Returns the Supabase credentials used by the app.
 *
 * SECURITY: values come EXCLUSIVELY from build-time environment variables.
 * Nothing here reads localStorage, sessionStorage, cookies, URL params, or any
 * user-controlled state, so application users cannot enter, edit, save, or
 * override the Supabase URL / anon key. This is the single source of truth.
 */
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const url = normalizeSupabaseUrl((viteSupabaseUrl || DEFAULT_SUPABASE_URL).trim());
  const anonKey = (viteSupabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY || '').trim();

  return {
    url,
    anonKey
  };
}

export function checkIsSupabaseConfigured(): boolean {
  const creds = getSupabaseCredentials();
  return Boolean(
    creds.url &&
    creds.anonKey &&
    creds.url.startsWith('http') &&
    !creds.url.includes('placeholder') &&
    !creds.url.includes('MY_APP_URL') &&
    !creds.url.includes('plwsickyaxdkjultrlca') &&
    !creds.anonKey.includes('placeholder') &&
    !creds.anonKey.includes('8mbX-iQ51g28y13l2q3j9k8h0g9f8e7d6c5b4a3z2y1') &&
    creds.anonKey.length > 15
  );
}

const initialCreds = getSupabaseCredentials();
export const supabaseUrl: string = initialCreds.url;
export const supabaseAnonKey: string = initialCreds.anonKey;
export const isSupabaseConfigured: boolean = checkIsSupabaseConfigured();

/**
 * Helper to ensure any response body returned to @supabase/supabase-js is strictly valid JSON.
 */
async function ensureJsonResponse(resp: Response, targetUrl: string): Promise<Response> {
  const contentType = resp.headers.get('content-type') || '';
  
  try {
    const clone = resp.clone();
    const text = await clone.text().catch(() => '');
    const trimmed = text.trim();
    
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

    try {
      JSON.parse(trimmed);
      return resp;
    } catch {
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
 */
async function resilientSupabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  const method = init?.method || 'GET';

  try {
    const resp = await fetch(input, init);
    return await ensureJsonResponse(resp, urlStr);
  } catch (browserFetchErr: any) {
    console.warn('[Supabase Network Notice]', {
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
      if (prop === 'auth') {
        return {
          signInWithOtp: () => Promise.resolve({ data: null, error: { message: 'Supabase client is not configured with valid URL/Anon Key.' } }),
          verifyOtp: () => Promise.resolve({ data: null, error: { message: 'Supabase client is not configured.' } }),
          signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase client is not configured.' } }),
          signOut: () => Promise.resolve({ error: null }),
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
          getUser: () => Promise.resolve({ data: { user: null }, error: null }),
          updateUser: () => Promise.resolve({ data: null, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
        };
      }
      return undefined;
    }
    const val = (active as any)[prop];
    return typeof val === 'function' ? val.bind(active) : val;
  }
});

/**
 * Retrieves the currently authenticated Supabase user ID.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const client = getSupabaseClient() || supabase;
  if (!client) return null;
  try {
    const { data: { user } } = await client.auth.getUser();
    if (user?.id) return user.id;
    const { data: { session } } = await client.auth.getSession();
    if (session?.user?.id) return session.user.id;

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
          message: 'Connected to Supabase project, but tables are not created yet. Please verify your Supabase database schema.'
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
 * Fetch all data from Supabase matching the authoritative schema and join tables in memory
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
      offersRes
    ] = await Promise.allSettled([
      supabase.from('students').select('*'),
      supabase.from('companies').select('*'),
      supabase.from('placement_drives').select('*'),
      supabase.from('applications').select('*'),
      supabase.from('offers').select('*')
    ]);

    if (studentsRes.status === 'rejected') console.warn('Supabase query notice for students table:', studentsRes.reason);
    else if (studentsRes.value.error) console.warn('Supabase query notice for students table:', studentsRes.value.error);

    if (companiesRes.status === 'rejected') console.warn('Supabase query notice for companies table:', companiesRes.reason);
    else if (companiesRes.value.error) console.warn('Supabase query notice for companies table:', companiesRes.value.error);

    if (drivesRes.status === 'rejected') console.warn('Supabase query notice for placement_drives table:', drivesRes.reason);
    else if (drivesRes.value.error) console.warn('Supabase query notice for placement_drives table:', drivesRes.value.error);

    if (applicationsRes.status === 'rejected') console.warn('Supabase query notice for applications table:', applicationsRes.reason);
    else if (applicationsRes.value.error) console.warn('Supabase query notice for applications table:', applicationsRes.value.error);

    if (offersRes.status === 'rejected') console.warn('Supabase query notice for offers table:', offersRes.reason);
    else if (offersRes.value.error) console.warn('Supabase query notice for offers table:', offersRes.value.error);

    const result: {
      students?: Student[];
      companies?: Company[];
      drives?: PlacementDrive[];
      applications?: Application[];
      offers?: Offer[];
      offerPolicy?: OfferPolicyConfig;
    } = {};

    // 1. Map Companies (Authoritative Schema: id, company_name, industry, website, created_at, contact_name, contact_email, contact_phone, status, contact_person)
    if (companiesRes.status === 'fulfilled' && companiesRes.value.data) {
      result.companies = companiesRes.value.data.map((row: DbCompanyRow | any) => ({
        id: String(row.id),
        name: row.company_name || 'Unnamed Company',
        company_name: row.company_name || 'Unnamed Company',
        industry: row.industry || 'Technology',
        tier: 'Dream',
        openDrivesCount: 0,
        averagePackage: 0,
        minPackage: 0,
        maxPackage: 0,
        status: (row.status || 'Active') as any,
        website: row.website || '',
        location: '',
        contactPerson: row.contact_person || row.contact_name || '',
        contactEmail: row.contact_email || '',
        contactPhone: row.contact_phone || '',
        totalHiredHistory: 0,
        logo: '',
        created_at: row.created_at || undefined
      }));
    }

    const compLookup = new Map<string, Company>((result.companies || []).map(c => [c.id, c]));

    // 2. Map Students (Authoritative Schema: id, enrollment_no, full_name, email, branch, cgpa, backlogs, attendance, graduation_year, placement_status, created_at)
    if (studentsRes.status === 'fulfilled' && studentsRes.value.data) {
      result.students = studentsRes.value.data.map((row: DbStudentRow | any) => ({
        id: String(row.id),
        name: row.full_name || row.name || 'Student',
        enrollmentNumber: row.enrollment_no || row.enrollment_number || '',
        email: row.email || '',
        phone: '',
        branch: (row.branch || 'CSE') as Branch,
        cgpa: parseFloat(String(row.cgpa ?? 0)) || 0,
        backlogs: parseInt(String(row.backlogs ?? 0), 10) || 0,
        attendance: parseInt(String(row.attendance ?? 0), 10) || 0,
        placementStatus: (row.placement_status || 'Unplaced') as any,
        offers: [],
        graduationYear: parseInt(String(row.graduation_year ?? 2026), 10) || 2026,
        skills: [],
        gender: 'Male',
        resumeUrl: '',
        avatar: null
      }));
    }

    const studentLookup = new Map<string, Student>((result.students || []).map(s => [s.id, s]));

    // 3. Map Placement Drives (Authoritative Schema: id, company_id, role, package_lpa, min_cgpa, max_backlogs, min_attendance, eligible_branches, graduation_year, offer_limit_lpa, drive_date, status, created_at)
    if (drivesRes.status === 'fulfilled' && drivesRes.value.data) {
      result.drives = drivesRes.value.data.map((row: DbPlacementDriveRow | any) => {
        const comp = compLookup.get(String(row.company_id));
        const pkg = parseFloat(String(row.package_lpa ?? 0)) || 0;
        const branches = Array.isArray(row.eligible_branches)
          ? row.eligible_branches
          : (row.eligible_branches
              ? (typeof row.eligible_branches === 'string'
                  ? (() => { try { return JSON.parse(row.eligible_branches); } catch { return ['CSE', 'IT']; } })()
                  : row.eligible_branches)
              : ['CSE', 'IT']);

        return {
          id: String(row.id),
          companyId: String(row.company_id || ''),
          companyName: comp?.company_name || comp?.name || 'Company',
          companyLogo: comp?.logo || '',
          role: row.role || 'Software Engineer',
          jobDescription: '',
          packageLPA: pkg,
          tier: (pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core') as CompanyTier,
          minCgpa: parseFloat(String(row.min_cgpa ?? 0)) || 0,
          maxBacklogs: parseInt(String(row.max_backlogs ?? 0), 10) || 0,
          eligibleBranches: branches as Branch[],
          minAttendance: parseInt(String(row.min_attendance ?? 0), 10) || 0,
          graduationYear: parseInt(String(row.graduation_year ?? 2026), 10) || 2026,
          offer_limit_lpa: row.offer_limit_lpa ? parseFloat(String(row.offer_limit_lpa)) : undefined,
          offerPolicyRule: 'Dream Upgrade Only (>= 1.5x)',
          driveDate: row.drive_date || '',
          registrationDeadline: row.drive_date || '',
          location: 'On-Campus',
          status: (row.status || 'Active') as DriveStatus,
          rounds: ['Online Assessment', 'Technical Interview', 'HR Interview']
        };
      });
    }

    const driveLookup = new Map<string, PlacementDrive>((result.drives || []).map(d => [d.id, d]));

    // 4. Map Applications (Authoritative Schema: id, student_id, drive_id, status, applied_at, updated_at) joined in memory
    if (applicationsRes.status === 'fulfilled' && applicationsRes.value.data) {
      result.applications = applicationsRes.value.data.map((row: DbApplicationRow | any) => {
        const s = studentLookup.get(String(row.student_id));
        const d = driveLookup.get(String(row.drive_id));
        const c = d ? compLookup.get(d.companyId) : undefined;
        return {
          id: String(row.id),
          studentId: String(row.student_id || ''),
          studentName: s?.name || 'Student',
          studentEnrollment: s?.enrollmentNumber || '',
          studentBranch: s?.branch || 'CSE',
          studentCgpa: s?.cgpa || 0,
          studentAttendance: s?.attendance || 75,
          driveId: String(row.drive_id || ''),
          companyName: c?.company_name || c?.name || d?.companyName || 'Company',
          companyLogo: c?.logo || d?.companyLogo || '',
          role: d?.role || 'Software Engineer',
          packageLPA: d?.packageLPA || 0,
          appliedDate: row.applied_at ? String(row.applied_at).split('T')[0] : '',
          eligibilityStatus: 'Eligible',
          ineligibilityReasons: [],
          status: (row.status || 'Applied') as ApplicationStatus,
          currentRound: d?.rounds?.[0] || 'Application Review',
          interviewSlot: undefined,
          feedback: undefined
        };
      });
    }

    // 5. Map Offers (Authoritative Schema: id, student_id, drive_id, company_id, package_lpa, status, offer_date, created_at) joined in memory
    if (offersRes.status === 'fulfilled' && offersRes.value.data) {
      result.offers = offersRes.value.data.map((row: DbOfferRow | any) => {
        const s = studentLookup.get(String(row.student_id));
        const d = driveLookup.get(String(row.drive_id));
        const c = compLookup.get(String(row.company_id)) || (d ? compLookup.get(d.companyId) : undefined);
        const pkg = parseFloat(String(row.package_lpa ?? d?.packageLPA ?? 0)) || 0;
        return {
          id: String(row.id),
          studentId: String(row.student_id || ''),
          studentName: s?.name || 'Student',
          studentEnrollment: s?.enrollmentNumber || '',
          studentBranch: s?.branch || 'CSE',
          driveId: String(row.drive_id || ''),
          companyId: String(row.company_id || d?.companyId || ''),
          companyName: c?.company_name || c?.name || d?.companyName || 'Company',
          companyLogo: c?.logo || d?.companyLogo || '',
          role: d?.role || 'Software Engineer',
          packageLPA: pkg,
          offerDate: row.offer_date || (row.created_at ? String(row.created_at).split('T')[0] : ''),
          status: (row.status || 'Offered') as OfferStatus,
          policyCheckPassed: true,
          policyViolationReason: undefined,
          tier: (pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core') as CompanyTier,
          deadlineDate: '',
          bondYears: undefined
        };
      });

      // Update student offers array
      if (result.students && result.offers) {
        result.students.forEach(student => {
          const studentOffers = result.offers!.filter(o => o.studentId === student.id);
          student.offers = studentOffers.map(o => ({
            offerId: o.id,
            companyName: o.companyName,
            role: o.role,
            packageLPA: o.packageLPA,
            status: o.status,
            offerDate: o.offerDate
          }));
        });
      }
    }

    return result;
  } catch (err: any) {
    console.error('Supabase query error occurred during fetchAllFromSupabase:', err);
    return { error: err?.message || 'Error querying Supabase data' };
  }
}

/**
 * Seed initial dataset to Supabase tables using strictly authoritative columns
 */
export async function seedInitialDataToSupabase(
  students: Student[],
  companies: Company[],
  drives: PlacementDrive[],
  applications: Application[],
  offers: Offer[],
  _policy: OfferPolicyConfig
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, message: 'Supabase is not configured in environment.' };
  }

  try {
    // 1. Students: id, enrollment_no, full_name, email, branch, cgpa, backlogs, attendance, graduation_year, placement_status
    const studentRows: DbStudentRow[] = students.map(s => ({
      id: isValidUUID(s.id) ? s.id : generateUUID(),
      enrollment_no: s.enrollmentNumber || null,
      full_name: s.name || null,
      email: s.email || null,
      branch: s.branch || null,
      cgpa: typeof s.cgpa === 'number' ? s.cgpa : null,
      backlogs: typeof s.backlogs === 'number' ? s.backlogs : null,
      attendance: typeof s.attendance === 'number' ? s.attendance : null,
      graduation_year: typeof s.graduationYear === 'number' ? s.graduationYear : 2026,
      placement_status: s.placementStatus || 'Unplaced'
    }));

    // 2. Companies: id, company_name, industry, website, contact_name, contact_email, contact_phone, status, contact_person
    const companyRows: DbCompanyRow[] = companies.map(c => {
      const contact = c.contactPerson || (c as any).contact_person || (c as any).contact_name || null;
      return {
        id: isValidUUID(c.id) ? c.id : generateUUID(),
        company_name: c.company_name || c.name || null,
        industry: c.industry || null,
        website: c.website || null,
        contact_name: contact,
        contact_person: contact,
        contact_email: c.contactEmail || (c as any).contact_email || null,
        contact_phone: c.contactPhone || (c as any).contact_phone || null,
        status: c.status || 'Active'
      };
    });

    // 3. Placement Drives: id, company_id, role, package_lpa, min_cgpa, max_backlogs, min_attendance, eligible_branches, graduation_year, offer_limit_lpa, drive_date, status
    const driveRows: DbPlacementDriveRow[] = drives.map(d => ({
      id: isValidUUID(d.id) ? d.id : generateUUID(),
      company_id: d.companyId,
      role: d.role || 'Software Engineer',
      package_lpa: d.packageLPA || 0,
      min_cgpa: d.minCgpa ?? null,
      max_backlogs: d.maxBacklogs ?? null,
      min_attendance: d.minAttendance ?? null,
      eligible_branches: Array.isArray(d.eligibleBranches) ? d.eligibleBranches : null,
      graduation_year: d.graduationYear ?? null,
      offer_limit_lpa: d.offer_limit_lpa ?? null,
      drive_date: d.driveDate || null,
      status: d.status || 'Active'
    }));

    // 4. Applications: id, student_id, drive_id, status, applied_at, updated_at
    const appRows: DbApplicationRow[] = applications.map(a => ({
      id: isValidUUID(a.id) ? a.id : generateUUID(),
      student_id: a.studentId,
      drive_id: a.driveId,
      status: a.status || 'Applied',
      applied_at: a.appliedDate ? new Date(a.appliedDate).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // 5. Offers: id, student_id, drive_id, company_id, package_lpa, status, offer_date
    const offerRows: DbOfferRow[] = offers.map(o => ({
      id: isValidUUID(o.id) ? o.id : generateUUID(),
      student_id: o.studentId,
      drive_id: o.driveId,
      company_id: o.companyId,
      package_lpa: o.packageLPA || 0,
      status: o.status || 'Offered',
      offer_date: o.offerDate || null
    }));

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

    return {
      success: true,
      message: 'Successfully synchronized placement data to Supabase database!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to push data to Supabase: ${err?.message}`
    };
  }
}

/**
 * Single student upsert
 */
export async function upsertStudentToSupabase(student: Student) {
  if (!isSupabaseConfigured || !supabase) return;
  const payload: DbStudentRow = {
    id: student.id,
    enrollment_no: student.enrollmentNumber || null,
    full_name: student.name || null,
    email: student.email || null,
    branch: student.branch || null,
    cgpa: typeof student.cgpa === 'number' ? student.cgpa : null,
    backlogs: typeof student.backlogs === 'number' ? student.backlogs : null,
    attendance: typeof student.attendance === 'number' ? student.attendance : null,
    graduation_year: typeof student.graduationYear === 'number' ? student.graduationYear : 2026,
    placement_status: student.placementStatus || 'Unplaced'
  };
  try {
    const { error } = await supabase.from('students').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase Error]', {
        table: 'students',
        operation: 'upsert',
        error
      });
    }
  } catch (err) {
    console.error('[Supabase Exception]', {
      table: 'students',
      operation: 'upsert',
      error: err
    });
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
      .order('full_name', { ascending: true });

    if (error) {
      console.error('[Supabase Error]', {
        table: 'students',
        operation: 'select',
        error
      });
      return { error: error.message };
    }

    const students: Student[] = (data || []).map((row: DbStudentRow | any) => ({
      id: String(row.id),
      name: row.full_name || row.name || 'Student',
      enrollmentNumber: row.enrollment_no || row.enrollment_number || '',
      email: row.email || '',
      phone: '',
      branch: (row.branch || 'CSE') as Branch,
      cgpa: parseFloat(String(row.cgpa ?? 0)) || 0,
      backlogs: parseInt(String(row.backlogs ?? 0), 10) || 0,
      attendance: parseInt(String(row.attendance ?? 0), 10) || 0,
      placementStatus: (row.placement_status || 'Unplaced') as any,
      offers: [],
      graduationYear: parseInt(String(row.graduation_year ?? 2026), 10) || 2026,
      skills: [],
      gender: 'Male',
      resumeUrl: '',
      avatar: null
    }));

    return { data: students };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'students',
      operation: 'select',
      error: err
    });
    return { error: err?.message || 'Failed to fetch students from Supabase' };
  }
}

export async function addStudentToSupabase(student: Student | Partial<Student>): Promise<{ data?: DbStudentRow; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }

  // STRICT authoritative columns payload ONLY:
  // enrollment_no, full_name, email, branch, cgpa, backlogs, attendance, graduation_year, placement_status
  // (Do not manually send id, avatar, created_by, or created_at when Supabase/database generates them)
  const payload: StudentDbInsert = {
  enrollment_no: student.enrollmentNumber || (student as any).enrollment_no || null,
  full_name: student.name || (student as any).full_name || 'Student',
  email: student.email || null,
  branch: student.branch || 'CSE',
  cgpa: typeof student.cgpa === 'number' ? student.cgpa : (parseFloat(String(student.cgpa || 0)) || 0),
  backlogs: typeof student.backlogs === 'number' ? student.backlogs : (parseInt(String(student.backlogs || 0), 10) || 0),
  attendance: typeof student.attendance === 'number' ? student.attendance : (parseInt(String(student.attendance || 100), 10) || 100),
  graduation_year: typeof student.graduationYear === 'number' ? student.graduationYear : (parseInt(String((student as any).graduation_year || 2026), 10) || 2026),
  placement_status: student.placementStatus || (student as any).placement_status || 'Unplaced',
  gender: (student as any).gender || null
};

  try {
    const { data, error } = await supabase
      .from('students')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[Supabase Error]', {
        table: 'students',
        operation: 'insert',
        payloadKeys: Object.keys(payload),
        error
      });
      return { error: error.message };
    }
    return { data };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'students',
      operation: 'insert',
      error: err
    });
    return { error: err?.message || 'Failed to insert student into Supabase' };
  }
}

export async function updateStudentInSupabase(id: string, partial: Partial<Student> & Partial<DbStudentRow>): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  // STRICT authoritative columns payload ONLY:
  // enrollment_no, full_name, email, branch, cgpa, backlogs, attendance, graduation_year, placement_status
  const payload: Partial<StudentDbInsert> = {};
  if (partial.name !== undefined || partial.full_name !== undefined) {
    payload.full_name = partial.full_name || partial.name || 'Student';
  }
  if (partial.enrollmentNumber !== undefined || partial.enrollment_no !== undefined) {
    payload.enrollment_no = partial.enrollment_no || partial.enrollmentNumber || null;
  }
  if (partial.email !== undefined) payload.email = partial.email || null;
  if (partial.branch !== undefined) payload.branch = partial.branch || null;
  if (partial.cgpa !== undefined) payload.cgpa = typeof partial.cgpa === 'number' ? partial.cgpa : parseFloat(String(partial.cgpa || 0));
  if (partial.backlogs !== undefined) payload.backlogs = typeof partial.backlogs === 'number' ? partial.backlogs : parseInt(String(partial.backlogs || 0), 10);
  if (partial.attendance !== undefined) payload.attendance = typeof partial.attendance === 'number' ? partial.attendance : parseInt(String(partial.attendance || 0), 10);
  if (partial.graduationYear !== undefined || partial.graduation_year !== undefined) {
    payload.graduation_year = typeof partial.graduationYear === 'number' ? partial.graduationYear : (parseInt(String(partial.graduation_year || 2026), 10) || 2026);
  }
 if (partial.placementStatus !== undefined || partial.placement_status !== undefined) { 
  payload.placement_status = partial.placement_status || partial.placementStatus || 'Unplaced'; 
}

// ADD THIS
if ((partial as any).gender !== undefined) {
  (payload as any).gender = (partial as any).gender || null;
}
 
if (Object.keys(payload).length === 0) { 
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('students')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('[Supabase Error]', {
        table: 'students',
        operation: 'update',
        payloadKeys: Object.keys(payload),
        error
      });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'students',
      operation: 'update',
      error: err
    });
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
      console.error('[Supabase Error]', {
        table: 'students',
        operation: 'delete',
        error
      });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'students',
      operation: 'delete',
      error: err
    });
    return { success: false, error: err?.message || 'Failed to delete student from Supabase' };
  }
}

/**
 * Dedicated Companies Table Operations
 * Authoritative columns: id, company_name, industry, website, created_at, contact_name, contact_email, contact_phone, status, contact_person
 */
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
      const fallback = await supabase.from('companies').select('*');
      if (fallback.error) {
        console.error('[Supabase Error]', {
          table: 'companies',
          operation: 'select',
          error: fallback.error
        });
        return { error: fallback.error.message };
      }
      return {
        data: (fallback.data || []).map((row: DbCompanyRow | any) => ({
          id: String(row.id),
          name: row.company_name || 'Unnamed Company',
          company_name: row.company_name || 'Unnamed Company',
          industry: row.industry || 'Technology',
          tier: 'Dream',
          openDrivesCount: 0,
          averagePackage: 0,
          minPackage: 0,
          maxPackage: 0,
          status: (row.status || 'Active') as any,
          website: row.website || '',
          location: '',
          contactPerson: row.contact_person || row.contact_name || '',
          contactEmail: row.contact_email || '',
          contactPhone: row.contact_phone || '',
          totalHiredHistory: 0,
          logo: '',
          created_at: row.created_at || undefined
        }))
      };
    }

    const companies: Company[] = (data || []).map((row: DbCompanyRow | any) => ({
      id: String(row.id),
      name: row.company_name || 'Unnamed Company',
      company_name: row.company_name || 'Unnamed Company',
      industry: row.industry || 'Technology',
      tier: 'Dream',
      openDrivesCount: 0,
      averagePackage: 0,
      minPackage: 0,
      maxPackage: 0,
      status: (row.status || 'Active') as any,
      website: row.website || '',
      location: '',
      contactPerson: row.contact_person || row.contact_name || '',
      contactEmail: row.contact_email || '',
      contactPhone: row.contact_phone || '',
      totalHiredHistory: 0,
      logo: '',
      created_at: row.created_at || undefined
    }));

    return { data: companies };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'companies',
      operation: 'select',
      error: err
    });
    return { error: err?.message || 'Failed to fetch companies from Supabase' };
  }
}

export async function addCompanyToSupabase(company: Partial<Company> & Partial<DbCompanyRow>): Promise<{ data?: any; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  const compName = company.company_name || company.name || 'Unnamed Company';
  const contact = company.contactPerson || (company as any).contact_person || (company as any).contact_name || null;

  // STRICT authoritative columns payload ONLY:
  // company_name, industry, website, contact_name, contact_email, contact_phone, status, contact_person
  // (Do not manually send id or created_at when Supabase/database generates them)
  const payload = {
    company_name: compName,
    industry: company.industry || 'Technology',
    website: company.website || null,
    contact_name: contact,
    contact_email: company.contactEmail || (company as any).contact_email || null,
    contact_phone: company.contactPhone || (company as any).contact_phone || null,
    status: company.status || 'Active',
    contact_person: contact
  };

  try {
    const { data, error } = await supabase.from('companies').insert([payload]).select();
    
    if (error) {
      console.error('[Supabase Error]', {
        table: 'companies',
        operation: 'insert',
        payloadKeys: Object.keys(payload),
        error
      });
      return { error: error.message };
    }
    return { data: data?.[0] };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'companies',
      operation: 'insert',
      error: err
    });
    return { error: err?.message || 'Failed to insert company into Supabase' };
  }
}

export async function updateCompanyInSupabase(id: string, partial: Partial<Company> & Partial<DbCompanyRow>): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  
  const compName = partial.company_name || partial.name;
  // STRICT authoritative columns payload ONLY:
  const payload: Record<string, any> = {};
  if (compName !== undefined) payload.company_name = compName;
  if (partial.industry !== undefined) payload.industry = partial.industry;
  if (partial.website !== undefined) payload.website = partial.website || null;
  if (partial.contactPerson !== undefined || (partial as any).contact_person !== undefined || (partial as any).contact_name !== undefined) {
    const contact = (partial as any).contact_person || partial.contactPerson || (partial as any).contact_name || null;
    payload.contact_name = contact;
    payload.contact_person = contact;
  }
  if (partial.contactEmail !== undefined || (partial as any).contact_email !== undefined) {
    payload.contact_email = (partial as any).contact_email || partial.contactEmail || null;
  }
  if (partial.contactPhone !== undefined || (partial as any).contact_phone !== undefined) {
    payload.contact_phone = (partial as any).contact_phone || partial.contactPhone || null;
  }
  if (partial.status !== undefined) payload.status = partial.status;

  if (Object.keys(payload).length === 0) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('[Supabase Error]', {
        table: 'companies',
        operation: 'update',
        error
      });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'companies',
      operation: 'update',
      error: err
    });
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
      console.error('[Supabase Error]', {
        table: 'companies',
        operation: 'delete',
        error
      });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'companies',
      operation: 'delete',
      error: err
    });
    return { success: false, error: err?.message || 'Failed to delete company from Supabase' };
  }
}

export async function upsertCompanyToSupabase(company: Company): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: true };
  const compName = company.company_name || company.name || 'Company';
  const contact = company.contactPerson || (company as any).contact_person || (company as any).contact_name || null;

  // STRICT authoritative columns payload ONLY:
  const payload = {
    id: (company.id && isValidUUID(company.id)) ? company.id : generateUUID(),
    company_name: compName,
    industry: company.industry || 'Technology',
    website: company.website || null,
    contact_name: contact,
    contact_person: contact,
    contact_email: company.contactEmail || (company as any).contact_email || null,
    contact_phone: company.contactPhone || (company as any).contact_phone || null,
    status: company.status || 'Active'
  };

  try {
    const { error } = await supabase.from('companies').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase Error]', {
        table: 'companies',
        operation: 'upsert',
        error
      });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'companies',
      operation: 'upsert',
      error: err
    });
    return { success: false, error: err?.message || 'Failed to upsert company in Supabase' };
  }
}

/**
 * Dedicated Placement Drives Operations
 * Authoritative columns: id, company_id, role, package_lpa, min_cgpa, max_backlogs, min_attendance, eligible_branches, graduation_year, offer_limit_lpa, drive_date, status, created_at
 */
export async function fetchDrivesFromSupabase(): Promise<{ data?: PlacementDrive[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    const [drivesRes, compRes] = await Promise.all([
      supabase.from('placement_drives').select('*').order('drive_date', { ascending: false }),
      supabase.from('companies').select('*')
    ]);

    if (drivesRes.error) {
      console.error('[Supabase Error]', {
        table: 'placement_drives',
        operation: 'select',
        error: drivesRes.error
      });
      return { error: drivesRes.error.message };
    }

    const companiesMap = new Map<string, any>((compRes.data || []).map((c: any) => [String(c.id), c]));

    const drives: PlacementDrive[] = (drivesRes.data || []).map((row: DbPlacementDriveRow | any) => {
      const joinedComp = companiesMap.get(String(row.company_id));
      const resolvedCompanyName = joinedComp?.company_name || joinedComp?.name || 'Company';
      const resolvedCompanyLogo = joinedComp?.logo || '';
      const pkg = parseFloat(String(row.package_lpa ?? 0)) || 0;
      const branches = Array.isArray(row.eligible_branches)
        ? row.eligible_branches
        : (row.eligible_branches
            ? (typeof row.eligible_branches === 'string'
                ? (() => { try { return JSON.parse(row.eligible_branches); } catch { return ['CSE', 'IT']; } })()
                : row.eligible_branches)
            : ['CSE', 'IT']);

      return {
        id: String(row.id),
        companyId: String(row.company_id || ''),
        companyName: resolvedCompanyName,
        companyLogo: resolvedCompanyLogo,
        role: row.role || 'Software Engineer',
        jobDescription: '',
        packageLPA: pkg,
        tier: (pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core') as CompanyTier,
        minCgpa: parseFloat(String(row.min_cgpa ?? 0)) || 0,
        maxBacklogs: parseInt(String(row.max_backlogs ?? 0), 10) || 0,
        eligibleBranches: branches as Branch[],
        minAttendance: parseInt(String(row.min_attendance ?? 0), 10) || 0,
        graduationYear: parseInt(String(row.graduation_year ?? 2026), 10) || 2026,
        offer_limit_lpa: row.offer_limit_lpa ? parseFloat(String(row.offer_limit_lpa)) : undefined,
        offerPolicyRule: 'Dream Upgrade Only (>= 1.5x)',
        driveDate: row.drive_date || '',
        registrationDeadline: row.drive_date || '',
        location: 'On-Campus',
        status: (row.status as DriveStatus) || 'Active',
        rounds: ['Online Assessment', 'Technical Interview', 'HR Interview']
      };
    });

    return { data: drives };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'placement_drives',
      operation: 'select',
      error: err
    });
    return { error: err?.message || 'Failed to fetch drives from Supabase' };
  }
}

export async function addDriveToSupabase(drive: Partial<PlacementDrive> & Partial<DbPlacementDriveRow>): Promise<{ data?: PlacementDrive; error?: string }> {
  const driveId = (drive.id && isValidUUID(drive.id)) ? drive.id : generateUUID();
  const rawCompanyId = drive.companyId || drive.company_id;
  const companyId = (rawCompanyId && isValidUUID(rawCompanyId)) ? rawCompanyId : generateUUID();
  const pkg = drive.packageLPA ?? drive.package_lpa ?? 0;
  const branches = drive.eligibleBranches || drive.eligible_branches || ['CSE', 'IT'];
  const dDate = drive.driveDate || drive.drive_date || new Date().toISOString().split('T')[0];
  const dStatus = drive.status || 'Active';

  const defaultDriveObj: PlacementDrive = {
    id: driveId,
    companyId: String(companyId),
    companyName: drive.companyName || 'Company',
    companyLogo: drive.companyLogo || '',
    role: drive.role || 'Software Engineer',
    jobDescription: drive.jobDescription || '',
    packageLPA: pkg,
    tier: drive.tier || (pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core'),
    minCgpa: drive.minCgpa ?? drive.min_cgpa ?? 6.0,
    maxBacklogs: drive.maxBacklogs ?? drive.max_backlogs ?? 0,
    eligibleBranches: Array.isArray(branches) ? branches as Branch[] : ['CSE', 'IT'],
    minAttendance: drive.minAttendance ?? drive.min_attendance ?? 75,
    graduationYear: drive.graduationYear ?? drive.graduation_year ?? 2026,
    offer_limit_lpa: drive.offer_limit_lpa ?? undefined,
    offerPolicyRule: drive.offerPolicyRule || 'Dream Upgrade Only (>= 1.5x)',
    driveDate: dDate,
    registrationDeadline: drive.registrationDeadline || dDate,
    location: drive.location || 'On-Campus',
    status: dStatus as DriveStatus,
    rounds: drive.rounds || ['Online Assessment', 'Technical Interview', 'HR Interview']
  };

  if (!isSupabaseConfigured || !supabase) {
    return { data: defaultDriveObj };
  }

  const row: DbPlacementDriveRow = {
    id: driveId,
    company_id: companyId,
    role: drive.role || 'Software Engineer',
    package_lpa: pkg,
    min_cgpa: drive.minCgpa ?? drive.min_cgpa ?? 6.0,
    max_backlogs: drive.maxBacklogs ?? drive.max_backlogs ?? 0,
    min_attendance: drive.minAttendance ?? drive.min_attendance ?? 75,
    eligible_branches: Array.isArray(branches) ? branches : ['CSE', 'IT'],
    graduation_year: drive.graduationYear ?? drive.graduation_year ?? 2026,
    offer_limit_lpa: drive.offer_limit_lpa ?? null,
    drive_date: dDate,
    status: dStatus
  };

  try {
    const { data, error } = await supabase.from('placement_drives').insert([row]).select();

    if (error) {
      console.error('[Supabase Error]', {
        table: 'placement_drives',
        operation: 'insert',
        payloadKeys: Object.keys(row),
        error
      });
      return { data: defaultDriveObj, error: error.message };
    }

    const savedDrive = data?.[0] ? { ...defaultDriveObj, id: data[0].id } : defaultDriveObj;
    return { data: savedDrive };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'placement_drives',
      operation: 'insert',
      error: err
    });
    return { data: defaultDriveObj, error: err?.message || 'Failed to insert placement drive into Supabase' };
  }
}

export async function updateDriveInSupabase(id: string, partial: Partial<PlacementDrive> & Partial<DbPlacementDriveRow>): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  const payload: Partial<DbPlacementDriveRow> = {};
  if (partial.companyId !== undefined || partial.company_id !== undefined) {
    payload.company_id = partial.companyId || partial.company_id;
  }
  if (partial.role !== undefined) payload.role = partial.role;
  if (partial.packageLPA !== undefined || partial.package_lpa !== undefined) {
    payload.package_lpa = partial.packageLPA ?? partial.package_lpa;
  }
  if (partial.minCgpa !== undefined || partial.min_cgpa !== undefined) {
    payload.min_cgpa = partial.minCgpa ?? partial.min_cgpa;
  }
  if (partial.maxBacklogs !== undefined || partial.max_backlogs !== undefined) {
    payload.max_backlogs = partial.maxBacklogs ?? partial.max_backlogs;
  }
  if (partial.eligibleBranches !== undefined || partial.eligible_branches !== undefined) {
    payload.eligible_branches = (partial.eligibleBranches ?? partial.eligible_branches) as string[];
  }
  if (partial.minAttendance !== undefined || partial.min_attendance !== undefined) {
    payload.min_attendance = partial.minAttendance ?? partial.min_attendance;
  }
  if (partial.graduationYear !== undefined || partial.graduation_year !== undefined) {
    payload.graduation_year = partial.graduationYear ?? partial.graduation_year;
  }
  if (partial.offer_limit_lpa !== undefined) {
    payload.offer_limit_lpa = partial.offer_limit_lpa;
  }
  if (partial.driveDate !== undefined || partial.drive_date !== undefined) {
    payload.drive_date = partial.driveDate ?? partial.drive_date;
  }
  if (partial.status !== undefined) payload.status = partial.status;

  if (Object.keys(payload).length === 0) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('placement_drives')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('[Supabase Error]', {
        table: 'placement_drives',
        operation: 'update',
        error
      });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'placement_drives',
      operation: 'update',
      error: err
    });
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
      console.error('[Supabase Error]', {
        table: 'placement_drives',
        operation: 'delete',
        error
      });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Exception]', {
      table: 'placement_drives',
      operation: 'delete',
      error: err
    });
    return { success: false, error: err?.message || 'Failed to delete drive from Supabase' };
  }
}

export async function upsertDriveToSupabase(drive: PlacementDrive) {
  if (!isSupabaseConfigured || !supabase) return;
  const payload: DbPlacementDriveRow = {
    id: drive.id,
    company_id: drive.companyId,
    role: drive.role,
    package_lpa: drive.packageLPA,
    min_cgpa: drive.minCgpa,
    max_backlogs: drive.maxBacklogs,
    eligible_branches: drive.eligibleBranches,
    min_attendance: drive.minAttendance,
    graduation_year: drive.graduationYear,
    offer_limit_lpa: drive.offer_limit_lpa ?? null,
    drive_date: drive.driveDate,
    status: drive.status
  };
  try {
    const { error } = await supabase.from('placement_drives').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase Error]', {
        table: 'placement_drives',
        operation: 'upsert',
        error
      });
    }
  } catch (err) {
    console.error('[Supabase Exception]', {
      table: 'placement_drives',
      operation: 'upsert',
      error: err
    });
  }
}

/**
 * Dedicated Applications Operations
 * Authoritative columns: id, student_id, drive_id, status, applied_at, updated_at
 */
export async function fetchApplicationsFromSupabase(): Promise<{ data?: Application[]; error?: string }> {
  return fetchApplicationsJoinedFromSupabase();
}

export async function checkApplicationExistsInSupabase(studentId: string, driveId: string): Promise<{ exists: boolean; status?: ApplicationStatus; id?: string; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { exists: false };
  }
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('id, status, applied_at')
      .eq('student_id', studentId)
      .eq('drive_id', driveId)
      .maybeSingle();

    if (error) {
      console.warn('Check application exists query error:', error.message);
      return { exists: false, error: error.message };
    }
    if (data) {
      return { exists: true, status: data.status as ApplicationStatus, id: data.id };
    }
    return { exists: false };
  } catch (err: any) {
    console.error('Exception checking application existence in Supabase:', err);
    return { exists: false, error: err?.message };
  }
}

export async function fetchApplicationsJoinedFromSupabase(): Promise<{ data?: Application[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    // 1. Try authoritative PostgREST joined query using foreign keys
    const { data: joinedData, error: joinError } = await supabase
      .from('applications')
      .select(`
        id,
        student_id,
        drive_id,
        status,
        applied_at,
        updated_at,
        students (
          id,
          full_name,
          enrollment_no,
          email,
          branch,
          cgpa,
          attendance,
          backlogs
        ),
        placement_drives (
          id,
          role,
          package_lpa,
          min_cgpa,
          max_backlogs,
          min_attendance,
          drive_date,
          status,
          company_id,
          companies (
            id,
            company_name,
            industry,
            website
          )
        )
      `)
      .order('applied_at', { ascending: false });

    if (!joinError && Array.isArray(joinedData)) {
      const mapped: Application[] = joinedData.map((row: any) => {
        const student = row.students;
        const drive = row.placement_drives;
        const company = drive?.companies;

        const studentName = student?.full_name || 'Student';
        const studentEnrollment = student?.enrollment_no || '';
        const studentBranch = (student?.branch || 'CSE') as Branch;
        const studentCgpa = parseFloat(String(student?.cgpa ?? 0)) || 0;
        const studentAttendance = parseInt(String(student?.attendance ?? 75), 10) || 75;
        const studentBacklogs = parseInt(String(student?.backlogs ?? 0), 10) || 0;
        const studentEmail = student?.email || '';

        const companyName = company?.company_name || 'Company';
        const companyLogo = '';
        const companyIndustry = company?.industry || 'Technology';
        const companyWebsite = company?.website || '';

        const role = drive?.role || 'Software Engineer';
        const packageLPA = parseFloat(String(drive?.package_lpa ?? 0)) || 0;
        const driveDate = drive?.drive_date || '';
        const driveStatus = drive?.status || 'Active';

        const appliedAt = row.applied_at || new Date().toISOString();
        const appliedDate = appliedAt.split('T')[0];

        return {
          id: String(row.id),
          studentId: String(row.student_id),
          studentName,
          studentEnrollment,
          studentBranch,
          studentCgpa,
          studentAttendance,
          studentBacklogs,
          studentEmail,
          driveId: String(row.drive_id),
          companyId: company?.id ? String(company.id) : undefined,
          companyName,
          companyLogo,
          companyIndustry,
          companyWebsite,
          role,
          packageLPA,
          driveDate,
          driveStatus,
          appliedDate,
          appliedAt,
          updatedAt: row.updated_at || appliedAt,
          eligibilityStatus: 'Eligible',
          ineligibilityReasons: [],
          status: (row.status as ApplicationStatus) || 'Applied',
          currentRound: 'Application Review'
        };
      });

      return { data: mapped };
    }

    // 2. Fallback: Separate table fetches if nested relationship schema is not resolved
    console.warn('Notice: falling back to separate queries for joined applications:', joinError?.message);
    const [appRes, studentRes, driveRes, compRes] = await Promise.all([
      supabase.from('applications').select('*').order('applied_at', { ascending: false }),
      supabase.from('students').select('*'),
      supabase.from('placement_drives').select('*'),
      supabase.from('companies').select('*')
    ]);

    if (appRes.error) {
      console.error('[Supabase Error]', {
        table: 'applications',
        operation: 'select',
        error: appRes.error
      });
      return { error: appRes.error.message };
    }

    const studentMap = new Map<string, any>((studentRes.data || []).map((s: any) => [String(s.id), s]));
    const driveMap = new Map<string, any>((driveRes.data || []).map((d: any) => [String(d.id), d]));
    const companyMap = new Map<string, any>((compRes.data || []).map((c: any) => [String(c.id), c]));

    const joined: Application[] = (appRes.data || []).map((row: DbApplicationRow | any) => {
      const studentId = String(row.student_id || '');
      const driveId = String(row.drive_id || '');

      const s = studentMap.get(studentId);
      const d = driveMap.get(driveId);
      const c = d ? companyMap.get(String(d.company_id)) : undefined;

      const studentName = s?.full_name || 'Student';
      const studentEnrollment = s?.enrollment_no || '';
      const studentBranch = (s?.branch || 'CSE') as Branch;
      const studentCgpa = parseFloat(String(s?.cgpa ?? 0)) || 0;
      const studentAttendance = parseInt(String(s?.attendance ?? 75), 10) || 75;
      const studentBacklogs = parseInt(String(s?.backlogs ?? 0), 10) || 0;
      const studentEmail = s?.email || '';

      const companyName = c?.company_name || d?.company_name || 'Company';
      const companyLogo = c?.logo || '';
      const companyIndustry = c?.industry || 'Technology';
      const companyWebsite = c?.website || '';

      const role = d?.role || 'Software Engineer';
      const packageLPA = parseFloat(String(d?.package_lpa ?? 0)) || 0;
      const driveDate = d?.drive_date || '';
      const driveStatus = d?.status || 'Active';

      const appliedAt = row.applied_at || new Date().toISOString();
      const appliedDate = appliedAt.split('T')[0];

      return {
        id: String(row.id),
        studentId,
        studentName,
        studentEnrollment,
        studentBranch,
        studentCgpa,
        studentAttendance,
        studentBacklogs,
        studentEmail,
        driveId,
        companyId: c?.id ? String(c.id) : undefined,
        companyName,
        companyLogo,
        companyIndustry,
        companyWebsite,
        role,
        packageLPA,
        driveDate,
        driveStatus,
        appliedDate,
        appliedAt,
        updatedAt: row.updated_at || appliedAt,
        eligibilityStatus: 'Eligible',
        ineligibilityReasons: [],
        status: (row.status as ApplicationStatus) || 'Applied',
        currentRound: 'Application Review'
      };
    });

    return { data: joined };
  } catch (err: any) {
    console.error('Exception in fetchApplicationsJoinedFromSupabase:', err);
    return { error: err?.message || 'Failed to fetch joined applications' };
  }
}

export async function addApplicationToSupabase(application: Application): Promise<{ data?: Application; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    const appId = (application.id && isValidUUID(application.id)) ? application.id : generateUUID();
    const row: DbApplicationRow = {
      id: appId,
      student_id: application.studentId,
      drive_id: application.driveId,
      status: application.status || 'Applied',
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('applications').insert([row]).select();

    if (error) {
      console.error('Supabase insert application error:', error);
      // Catch duplicate key constraint (student_id, drive_id)
      if (
        error.code === '23505' ||
        error.message?.toLowerCase().includes('duplicate key') ||
        error.message?.toLowerCase().includes('unique constraint') ||
        error.message?.toLowerCase().includes('applications_student_id_drive_id')
      ) {
        return { error: 'You have already submitted an application for this placement drive. A duplicate application cannot be created.' };
      }
      return { error: error.message };
    }
    const savedApp: Application = { ...application, id: data?.[0]?.id || appId };
    return { data: savedApp };
  } catch (err: any) {
    console.error('Exception adding application to Supabase:', err);
    return { error: err?.message || 'Failed to insert application into Supabase' };
  }
}

export async function updateApplicationInSupabase(id: string, partial: Partial<Application> & Partial<DbApplicationRow>): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const payload: Partial<DbApplicationRow> = {
      updated_at: new Date().toISOString()
    };
    if (partial.status !== undefined) payload.status = partial.status;

    const { error } = await supabase
      .from('applications')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error(`Supabase update error for application ${id}:`, error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error(`Exception updating application ${id} in Supabase:`, err);
    return { success: false, error: err?.message || 'Failed to update application in Supabase' };
  }
}

export async function updateApplicationStatusInSupabase(id: string, newStatus: ApplicationStatus): Promise<{ success: boolean; error?: string }> {
  return updateApplicationInSupabase(id, { status: newStatus });
}

export async function deleteApplicationFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const { error } = await supabase.from('applications').delete().eq('id', id);
    if (error) {
      console.error(`Supabase delete application error for ${id}:`, error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error(`Exception deleting application ${id} in Supabase:`, err);
    return { success: false, error: err?.message || 'Failed to delete application from Supabase' };
  }
}

export async function upsertApplicationToSupabase(application: Application) {
  if (!isSupabaseConfigured || !supabase) return;
  const payload: DbApplicationRow = {
    id: application.id,
    student_id: application.studentId,
    drive_id: application.driveId,
    status: application.status,
    applied_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  try {
    const { error } = await supabase.from('applications').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase Error]', {
        table: 'applications',
        operation: 'upsert',
        error
      });
    }
  } catch (err) {
    console.error('[Supabase Exception]', {
      table: 'applications',
      operation: 'upsert',
      error: err
    });
  }
}

/**
 * Dedicated Offers Table Operations
 * Authoritative columns: id, student_id, drive_id, company_id, package_lpa, status, offer_date, created_at
 */
export interface SupabaseDiagnosticInfo {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
  url?: string;
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
    return { error: 'Supabase is not configured', diagnostic: diag };
  }

  console.log("Fetching offers from Supabase");

  try {
    const [offersRes, studentRes, compRes, driveRes] = await Promise.all([
      client.from('offers').select('*'),
      client.from('students').select('*'),
      client.from('companies').select('*'),
      client.from('placement_drives').select('*')
    ]);

    if (offersRes.error) {
      console.error("Offers Supabase error:", offersRes.error);
      const diag: SupabaseDiagnosticInfo = {
        message: offersRes.error.message,
        details: offersRes.error.details,
        hint: offersRes.error.hint,
        code: offersRes.error.code,
        url: activeUrl
      };
      return { error: offersRes.error.message, diagnostic: diag };
    }

    const studentsMap = new Map<string, any>((studentRes.data || []).map((s: any) => [String(s.id), s]));
    const companiesMap = new Map<string, any>((compRes.data || []).map((c: any) => [String(c.id), c]));
    const drivesMap = new Map<string, any>((driveRes.data || []).map((d: any) => [String(d.id), d]));

    const offers: Offer[] = (offersRes.data || []).map((row: DbOfferRow | any) => {
      const studentId = String(row.student_id || '');
      const driveId = String(row.drive_id || '');
      const companyId = String(row.company_id || '');

      const s = studentsMap.get(studentId);
      const d = drivesMap.get(driveId);
      const c = companiesMap.get(companyId) || (d ? companiesMap.get(String(d.company_id)) : undefined);

      const studentName = s?.full_name || 'Student';
      const studentEnrollment = s?.enrollment_no || '';
      const studentBranch = (s?.branch || 'CSE') as Branch;

      const companyName = c?.company_name || c?.name || d?.companyName || 'Company';
      const companyLogo = c?.logo || '';
      const role = d?.role || 'Software Engineer';
      const packageLPA = parseFloat(String(row.package_lpa ?? d?.package_lpa ?? 0)) || 0;
      const offerDate = row.offer_date || (row.created_at ? String(row.created_at).split('T')[0] : new Date().toISOString().split('T')[0]);
      const status = (row.status || 'Offered') as OfferStatus;

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
        updateStatus: 'synced',
        policyCheckPassed: true,
        policyViolationReason: undefined,
        tier: (packageLPA >= 14 ? 'Super Dream' : packageLPA >= 8 ? 'Dream' : 'Core') as CompanyTier,
        deadlineDate: '',
        bondYears: undefined
      };
    });

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
  drive_id: string;
  company_id: string;
  package_lpa: number;
  status?: OfferStatus;
  role?: string;
  student_name?: string;
  student_enrollment?: string;
  student_branch?: string;
  company_name?: string;
  company_logo?: string;
}): Promise<{ data?: Offer; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }
  try {
    const studentId = params.student_id;
    const driveId = params.drive_id;
    const companyId = params.company_id;
    const pkg = Number(params.package_lpa) || 0;
    const status: OfferStatus = params.status || 'Offered';
    const offerDate = new Date().toISOString().split('T')[0];
    const offerId = (params.id && isValidUUID(params.id)) ? params.id : generateUUID();

    // Prevent duplicate offers for the same student and drive
    if (driveId && studentId && isValidUUID(studentId) && isValidUUID(driveId)) {
      const { data: existing } = await supabase
        .from('offers')
        .select('id, status')
        .eq('student_id', studentId)
        .eq('drive_id', driveId)
        .maybeSingle();

      if (existing) {
        return { error: 'An offer already exists for this student and placement drive.' };
      }
    }

    const payload: DbOfferRow = {
      id: offerId,
      student_id: studentId,
      drive_id: driveId,
      company_id: companyId,
      package_lpa: pkg,
      status: status,
      offer_date: offerDate
    };

    const { data, error: insertErr } = await supabase.from('offers').insert([payload]).select();

    if (insertErr) {
      console.error("Offers Supabase insert error:", insertErr);
      return { error: insertErr.message };
    }

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
      tier: pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core'
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
    const { data: offerData } = await supabase
      .from('offers')
      .select('id, student_id, status')
      .eq('id', offerId)
      .maybeSingle();

    const studentId = offerData?.student_id;

    const { error: updateErr } = await supabase
      .from('offers')
      .update({
        status: newStatus
      })
      .eq('id', offerId);

    if (updateErr) {
      console.error("Offers Supabase error:", updateErr);
      return { success: false, error: updateErr.message };
    }

    if (studentId) {
      if (newStatus === 'Accepted') {
        await updateStudentPlacementStatusInDb(studentId, 'Placed');
      } else if (newStatus === 'Rejected' || newStatus === 'Withdrawn' || newStatus === 'Declined') {
        const { data: remainingOffers } = await supabase
          .from('offers')
          .select('id, status')
          .eq('student_id', studentId)
          .neq('id', offerId)
          .eq('status', 'Accepted');

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

export async function updateOfferInSupabase(id: string, partial: Partial<Offer> & Partial<DbOfferRow>): Promise<{ success: boolean; error?: string }> {
  if (partial.status) {
    return updateOfferStatusInSupabase(id, partial.status as OfferStatus);
  }
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }
  try {
    const payload: Partial<DbOfferRow> = {};
    if (partial.packageLPA !== undefined || partial.package_lpa !== undefined) {
      payload.package_lpa = partial.packageLPA ?? partial.package_lpa;
    }
    if (partial.offerDate !== undefined || partial.offer_date !== undefined) {
      payload.offer_date = partial.offerDate ?? partial.offer_date;
    }

    if (Object.keys(payload).length === 0) {
      return { success: true };
    }

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

export async function upsertOfferToSupabase(offer: Offer) {
  if (!isSupabaseConfigured || !supabase) return;
  const payload: DbOfferRow = {
    id: offer.id,
    student_id: offer.studentId,
    drive_id: offer.driveId,
    company_id: offer.companyId,
    package_lpa: offer.packageLPA,
    status: offer.status,
    offer_date: offer.offerDate || null
  };
  try {
    const { error } = await supabase.from('offers').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase Error]', {
        table: 'offers',
        operation: 'upsert',
        error
      });
    }
  } catch (err) {
    console.error('[Supabase Exception]', {
      table: 'offers',
      operation: 'upsert',
      error: err
    });
  }
}

export async function upsertPolicyToSupabase(_policy: OfferPolicyConfig) {
  // Authoritative schema does not contain an offer_policy table. Offer policy is handled locally/in app configuration.
}

/**
 * Real-time table subscription helper
 */
export function subscribeToRealtimeTable(
  tableName: 'students' | 'companies' | 'placement_drives' | 'applications' | 'offers' | 'profiles' | 'eligibility_results',
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
 * Authoritative columns: id, student_id, drive_id, eligible, reasons, checked_at
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
      console.warn(`Notice checking eligibility for student ${studentId} on drive ${driveId}:`, error.message);
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
      checked_at: data.checked_at || undefined
    };
  } catch (err: any) {
    console.warn(`Notice checking eligibility for student ${studentId} on drive ${driveId}:`, err?.message || err);
    return { status: 'not_evaluated', reasons: [], error: err?.message };
  }
}

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
      console.warn(`Notice fetching eligibility results for student ${studentId}:`, error.message);
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

export async function fetchEligibilityResultsFromSupabase(
  driveId: string
): Promise<{ data?: DbEligibilityResultRow[]; error?: string }> {
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

    const mapped: DbEligibilityResultRow[] = (data || []).map((row: any) => ({
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

    const payload: DbEligibilityResultRow[] = records.map(r => {
      const existingId = idMap.get(r.student_id);
      return {
        id: (existingId && isValidUUID(existingId)) ? existingId : generateUUID(),
        student_id: r.student_id,
        drive_id: r.drive_id,
        eligible: r.eligible,
        reasons: r.reasons,
        checked_at: r.checked_at || new Date().toISOString()
      };
    });

    const upsertResult = await supabase
      .from('eligibility_results')
      .upsert(payload, { onConflict: 'id' });

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
 * Authoritative columns: id, email, role, student_id, company_id, created_at
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

    let linkedStudentId: string | null = data.student_id ? String(data.student_id) : null;

    // If role is student and student_id is not yet set in profiles, try linking by email in students table
    if (!linkedStudentId && ((data.role || '').toLowerCase() === 'student' || data.email)) {
      try {
        const { data: stdMatch } = await client
          .from('students')
          .select('id')
          .ilike('email', (data.email || '').trim())
          .maybeSingle();
        if (stdMatch?.id) {
          linkedStudentId = String(stdMatch.id);
          await client.from('profiles').update({ student_id: linkedStudentId }).eq('id', userId);
        }
      } catch (err) {
        console.warn('Auto-link student by email notice:', err);
      }
    }

    const profile: UserProfile = {
      id: data.id,
      email: data.email || '',
      role: (data.role || 'student').toLowerCase() as UserRole,
      student_id: linkedStudentId,
      company_id: (data.company_id ? String(data.company_id) : null),
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

/**
 * Send an email OTP for registration using Supabase Authentication.
 * Strictly enforces that public users can only register as 'student' or 'recruiter' (NEVER 'admin').
 */
export async function sendRegistrationOtp(
  email: string,
  role: 'student' | 'recruiter',
  metadata: { name: string; enrollmentNumber?: string; companyName?: string }
): Promise<{ success: boolean; error?: string; isRateLimit?: boolean }> {
  // Enforce security policy: admin role cannot be self-registered via public signup
  if (role !== 'student' && role !== 'recruiter') {
    return { success: false, error: 'Registration is restricted to Student and Recruiter accounts.' };
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const client = getSupabaseClient() || supabase;
  if (!isSupabaseConfigured || !client) {
    return {
      success: false,
      error: 'Supabase client is not configured. Please ensure your project URL and Anon Key are set.'
    };
  }

  try {
    const { error } = await client.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        data: {
          role,
          name: metadata.name?.trim() || '',
          full_name: metadata.name?.trim() || '',
          enrollment_number: metadata.enrollmentNumber?.trim() || undefined,
          company_name: metadata.companyName?.trim() || undefined
        }
      }
    });

    if (error) {
      console.warn('[Supabase Auth Send OTP Notice]', error.message);
      const isRateLimit =
        error.message.toLowerCase().includes('rate limit') ||
        (error as any)?.status === 429;

      let userFriendlyMsg = error.message;
      if (isRateLimit) {
        userFriendlyMsg =
          'Email rate limit reached. Supabase free tier limits how frequently emails can be dispatched. If a 6-digit code was already sent to your email, you can enter it directly; otherwise please wait 60 seconds before requesting another code.';
      } else if (error.message.toLowerCase().includes('signups not allowed')) {
        userFriendlyMsg = 'New registrations are currently disabled in your Supabase Auth project configuration.';
      } else if (error.message.toLowerCase().includes('invalid email')) {
        userFriendlyMsg = 'Invalid email address syntax.';
      }
      return { success: false, error: userFriendlyMsg, isRateLimit };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Supabase Auth Send OTP Exception]', err?.message || err);
    return { success: false, error: err?.message || 'Failed to send verification OTP code. Please try again.' };
  }
}

/**
 * Verify the 6-digit email OTP for registration and provision/link the student or recruiter profile
 * in Supabase Auth and the existing database schema without creating duplicate records.
 */
export async function verifyRegistrationOtp(params: {
  email: string;
  token: string;
  role: 'student' | 'recruiter';
  studentName?: string;
  enrollmentNumber?: string;
  recruiterName?: string;
  companyName?: string;
}): Promise<{
  success: boolean;
  user?: any;
  profile?: UserProfile;
  linkedStudent?: Student | null;
  linkedCompany?: Company | null;
  error?: string;
}> {
  const { email, token, role, studentName, enrollmentNumber, recruiterName, companyName } = params;

  // Strict role security: forbid admin assignment
  if (role !== 'student' && role !== 'recruiter') {
    return { success: false, error: 'Registration is strictly allowed for Student or Recruiter.' };
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanToken = (token || '').trim();

  if (!cleanToken || cleanToken.length < 6) {
    return { success: false, error: 'Please enter the complete 6-digit OTP code.' };
  }

  const client = getSupabaseClient() || supabase;
  if (!isSupabaseConfigured || !client) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    // 1. Verify OTP with Supabase Auth
    let verifyRes = await client.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email'
    });

    // Fallback if the Supabase project configuration expects 'signup'
    if (verifyRes.error && verifyRes.error.message.toLowerCase().includes('type')) {
      const retryRes = await client.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'signup' as any
      });
      if (!retryRes.error) {
        verifyRes = retryRes;
      }
    }

    if (verifyRes.error || !verifyRes.data?.user) {
      console.warn('[Supabase Auth Verify Notice]', verifyRes.error?.message);
      const errMsg = verifyRes.error?.message || 'OTP Verification failed.';
      const isExpiredOrInvalid =
        errMsg.toLowerCase().includes('expired') ||
        errMsg.toLowerCase().includes('invalid') ||
        errMsg.toLowerCase().includes('token');
      return {
        success: false,
        error: isExpiredOrInvalid
          ? 'The OTP code you entered is invalid or has expired. Please check your email or click Resend OTP.'
          : errMsg
      };
    }

    const authUser = verifyRes.data.user;

    // 2. Link/create database records based on role using EXISTING schema
    if (role === 'student') {
      let linkedStudentId: string | null = null;
      let linkedStudent: Student | null = null;
      const cleanEnrollment = (enrollmentNumber || '').trim();
      const cleanName = (studentName || '').trim() || 'Student';

      // Check if student already exists in public.students by email or enrollment
      try {
        const { data: existingRows } = await client
          .from('students')
          .select('*');

        const match = (existingRows || []).find((r: any) => {
          const rowEmail = (r.email || '').trim().toLowerCase();
          const rowEnroll = (r.enrollment_no || r.enrollment_number || '').trim().toLowerCase();
          return rowEmail === cleanEmail || (cleanEnrollment && rowEnroll === cleanEnrollment.toLowerCase());
        });

        if (match) {
          linkedStudentId = String(match.id);
          // Keep existing data, fill in name or enrollment if empty
          if (!match.full_name && cleanName) {
            await client.from('students').update({ full_name: cleanName }).eq('id', match.id);
          }
          if (!match.email && cleanEmail) {
            await client.from('students').update({ email: cleanEmail }).eq('id', match.id);
          }
          linkedStudent = {
            id: String(match.id),
            name: match.full_name || match.name || cleanName,
            enrollmentNumber: match.enrollment_no || match.enrollment_number || cleanEnrollment || '',
            email: match.email || cleanEmail,
            phone: match.phone || '',
            branch: match.branch || 'CSE',
            cgpa: parseFloat(String(match.cgpa ?? 0)) || 0,
            backlogs: parseInt(String(match.backlogs ?? 0), 10) || 0,
            attendance: parseInt(String(match.attendance ?? 75), 10) || 75,
            placementStatus: match.placement_status || 'Unplaced',
            offers: Array.isArray(match.offers) ? match.offers : [],
            graduationYear: parseInt(String(match.graduation_year ?? 2026), 10) || 2026,
            skills: Array.isArray(match.skills) ? match.skills : []
          };
        }
      } catch (err) {
        console.warn('Notice checking existing students:', err);
      }

      // If no student record exists yet, create one using EXISTING student schema
      if (!linkedStudentId) {
        const newId = generateUUID();
        const studentPayload: StudentDbInsert = {
          enrollment_no: cleanEnrollment || null,
          full_name: cleanName,
          email: cleanEmail,
          branch: 'CSE',
          cgpa: 0,
          backlogs: 0,
          attendance: 75,
          graduation_year: 2026,
          placement_status: 'Unplaced'
        };

        try {
          const { data: inserted, error: insErr } = await client
            .from('students')
            .insert({ id: newId, ...studentPayload })
            .select()
            .maybeSingle();

          if (!insErr && inserted) {
            linkedStudentId = String(inserted.id);
          } else {
            // If primary key is auto-generated by database, insert without explicit id
            const retryIns = await client.from('students').insert(studentPayload).select().maybeSingle();
            linkedStudentId = retryIns.data?.id ? String(retryIns.data.id) : newId;
          }
        } catch (_) {
          linkedStudentId = newId;
        }

        linkedStudent = {
          id: linkedStudentId,
          name: cleanName,
          enrollmentNumber: cleanEnrollment,
          email: cleanEmail,
          phone: '',
          branch: 'CSE',
          cgpa: 0,
          backlogs: 0,
          attendance: 75,
          placementStatus: 'Unplaced',
          offers: [],
          graduationYear: 2026,
          skills: []
        };
      }

      // 3. Upsert to public.profiles table
      const profile: UserProfile = {
        id: authUser.id,
        email: cleanEmail,
        role: 'student',
        student_id: linkedStudentId,
        company_id: null,
        created_at: new Date().toISOString()
      };

      try {
        await client.from('profiles').upsert({
          id: authUser.id,
          email: cleanEmail,
          role: 'student',
          student_id: linkedStudentId,
          company_id: null
        });
      } catch (e) {
        console.warn('Notice updating public.profiles:', e);
      }

      // 4. Update user metadata in Supabase Auth
      try {
        await client.auth.updateUser({
          data: {
            role: 'student',
            student_id: linkedStudentId,
            name: cleanName,
            full_name: cleanName,
            enrollment_number: cleanEnrollment
          }
        });
      } catch (_) {}

      return {
        success: true,
        user: authUser,
        profile,
        linkedStudent
      };
    } else {
      // Role is recruiter
      let linkedCompanyId: string | null = null;
      let linkedCompany: Company | null = null;
      const targetCompName = (companyName || '').trim() || 'Partner Organization';
      const cleanRecruiterName = (recruiterName || '').trim() || 'Recruiter';

      // Check if company exists in public.companies
      try {
        const { data: existingCompanies } = await client
          .from('companies')
          .select('*');

        const match = (existingCompanies || []).find((c: any) => {
          const cName = (c.company_name || c.name || '').trim().toLowerCase();
          return cName === targetCompName.toLowerCase();
        });

        if (match) {
          linkedCompanyId = String(match.id);
          // Update contact info if missing
          if (!match.contact_name && cleanRecruiterName) {
            await client.from('companies').update({ contact_name: cleanRecruiterName, contact_person: cleanRecruiterName }).eq('id', match.id);
          }
          if (!match.contact_email && cleanEmail) {
            await client.from('companies').update({ contact_email: cleanEmail }).eq('id', match.id);
          }
          linkedCompany = {
            id: String(match.id),
            name: match.company_name || match.name || targetCompName,
            industry: match.industry || 'Technology',
            tier: match.tier || 'Core',
            openDrivesCount: match.open_drives_count ?? 0,
            averagePackage: match.average_package ?? 0,
            minPackage: match.min_package ?? 0,
            maxPackage: match.max_package ?? 0,
            status: match.status || 'Active',
            website: match.website || '',
            location: match.location || 'Bangalore, India',
            totalHiredHistory: match.total_hired_history ?? 0,
            logo: match.logo || 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=100&auto=format&fit=crop&q=60',
            contactPerson: cleanRecruiterName || match.contact_person || match.contact_name || '',
            contactEmail: cleanEmail || match.contact_email || ''
          };
        }
      } catch (err) {
        console.warn('Notice checking existing companies:', err);
      }

      // If company doesn't exist, insert using EXISTING company schema
      if (!linkedCompanyId) {
        const newCompId = generateUUID();
        const compPayload = {
          id: newCompId,
          company_name: targetCompName,
          industry: 'Technology',
          tier: 'Core',
          status: 'Active',
          contact_name: cleanRecruiterName,
          contact_person: cleanRecruiterName,
          contact_email: cleanEmail,
          website: null
        };

        try {
          const { data: insComp, error: compErr } = await client
            .from('companies')
            .insert(compPayload)
            .select()
            .maybeSingle();

          if (!compErr && insComp) {
            linkedCompanyId = String(insComp.id);
          } else {
            linkedCompanyId = newCompId;
          }
        } catch (_) {
          linkedCompanyId = newCompId;
        }

        linkedCompany = {
          id: linkedCompanyId,
          name: targetCompName,
          industry: 'Technology',
          tier: 'Core',
          openDrivesCount: 0,
          averagePackage: 0,
          minPackage: 0,
          maxPackage: 0,
          status: 'Active',
          website: '',
          location: 'Bangalore, India',
          totalHiredHistory: 0,
          logo: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=100&auto=format&fit=crop&q=60',
          contactPerson: cleanRecruiterName,
          contactEmail: cleanEmail
        };
      }

      // Upsert to public.profiles
      const profile: UserProfile = {
        id: authUser.id,
        email: cleanEmail,
        role: 'recruiter',
        student_id: null,
        company_id: linkedCompanyId,
        created_at: new Date().toISOString()
      };

      try {
        await client.from('profiles').upsert({
          id: authUser.id,
          email: cleanEmail,
          role: 'recruiter',
          student_id: null,
          company_id: linkedCompanyId
        });
      } catch (e) {
        console.warn('Notice writing recruiter profile to public.profiles:', e);
      }

      // Update user metadata in Supabase Auth
      try {
        await client.auth.updateUser({
          data: {
            role: 'recruiter',
            company_id: linkedCompanyId,
            company_name: targetCompName,
            name: cleanRecruiterName,
            full_name: cleanRecruiterName
          }
        });
      } catch (_) {}

      return {
        success: true,
        user: authUser,
        profile,
        linkedCompany
      };
    }
  } catch (err: any) {
    console.warn('[Supabase Auth Verify Exception]', err?.message || err);
    return { success: false, error: err?.message || 'Verification failed. Please try again.' };
  }
}
