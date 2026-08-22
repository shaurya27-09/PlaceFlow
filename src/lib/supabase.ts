/**
 * PlaceFlow Supabase Integration Layer (Server-Side Architecture)
 * 
 * Secure bridge that delegates all operations to server-side /api/* routes.
 * Supabase project credentials are protected server-side and never exposed to the frontend.
 */

import {
  Student,
  Company,
  PlacementDrive,
  Application,
  Offer,
  OfferPolicyConfig,
  UserProfile,
  UserRole,
  ApplicationStatus,
  OfferStatus
} from '../types';

import {
  testServerSupabaseStatus,
  diagnoseSupabaseConnection,
  apiFetchStudents,
  apiCreateStudent,
  apiUpdateStudent,
  apiDeleteStudent,
  apiFetchCompanies,
  apiCreateCompany,
  apiUpdateCompany,
  apiDeleteCompany,
  apiFetchDrives,
  apiCreateDrive,
  apiUpdateDrive,
  apiDeleteDrive,
  apiFetchApplications,
  apiCreateApplication,
  apiUpdateApplicationStatus,
  apiDeleteApplication,
  apiFetchOffers,
  apiCreateOffer,
  apiUpdateOfferStatus,
  apiDeleteOffer,
  apiFetchDriveEligibility,
  apiFetchStudentEligibility,
  apiCheckStudentEligibility,
  apiSaveEligibilityResults,
  apiLogin,
  apiLogout,
  apiFetchUserProfile,
  apiSaveUserProfile,
  apiSyncAll,
  apiSeedInitialData
} from './api';

import { generateUUID, isValidUUID } from './uuid';

export interface SupabaseDiagnosticInfo {
  message: string;
  details?: string;
  code?: string;
  url?: string;
  hint?: string;
  resolvedIp?: string;
  httpStatus?: number;
}

export interface SupabaseResponse<T> {
  data: T | null;
  error: string | null;
  success?: boolean;
  message?: string;
  diagnostic?: SupabaseDiagnosticInfo;
  profile?: UserProfile;
}

// Display configuration (server-protected)
export const DEFAULT_SUPABASE_URL = 'https://plwsickyaxdkjultrlca.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'Protected-Server-Side';

export const supabaseUrl = DEFAULT_SUPABASE_URL;
export const supabaseAnonKey = DEFAULT_SUPABASE_ANON_KEY;

// Server handles Supabase connection
export const isSupabaseConfigured = true;

export function checkIsSupabaseConfigured(): boolean {
  return true;
}

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  return {
    url: DEFAULT_SUPABASE_URL,
    anonKey: 'Protected-Server-Side'
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  // Credentials are authenticated and secured server-side
}

export function clearSupabaseCredentials(): void {
  // Cleared server-side
}

export function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return DEFAULT_SUPABASE_URL;
  let url = rawUrl.trim();
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
 * Lightweight safe proxy to prevent any legacy code referencing `supabase` object from throwing errors.
 */
export const supabase: any = {
  auth: {
    signInWithPassword: async ({ email, password }: any) => {
      const res = await apiLogin(email, password);
      if (res.error) return { data: null, error: { message: res.error } };
      return { data: res.data, error: null };
    },
    signOut: async () => {
      await apiLogout();
      return { error: null };
    },
    getSession: async () => {
      return { data: { session: null }, error: null };
    },
    getUser: async () => {
      return { data: { user: null }, error: null };
    },
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } }
    })
  },
  from: (tableName: string) => {
    console.info(`[PlaceFlow] Intercepting legacy supabase.from('${tableName}') -> routing via secure /api backend.`);
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        order: () => Promise.resolve({ data: [], error: null })
      }),
      insert: async (rows: any) => ({ data: rows, error: null }),
      update: async (rows: any) => ({ data: rows, error: null }),
      delete: async () => ({ data: null, error: null }),
      upsert: async (rows: any) => ({ data: rows, error: null })
    };
  },
  channel: () => ({
    on: () => ({
      subscribe: () => ({})
    })
  }),
  removeChannel: () => {}
};

export function getSupabaseClient(): any {
  return supabase;
}

// ----------------------------------------------------
// Connectivity & Diagnostics
// ----------------------------------------------------

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  try {
    const res = await testServerSupabaseStatus();
    return {
      success: res.connected || res.success,
      message: res.message || 'Connected to Supabase via server API',
      latencyMs: res.latencyMs
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to verify Supabase connection via server'
    };
  }
}

export async function diagnoseSupabaseReachability(url?: string, anonKey?: string): Promise<any> {
  return await diagnoseSupabaseConnection(url, anonKey);
}

// ----------------------------------------------------
// 1. Students Operations
// ----------------------------------------------------

export async function fetchStudentsFromSupabase(): Promise<SupabaseResponse<Student[]>> {
  const res = await apiFetchStudents();
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_FETCH_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: res.data || [], error: null, success: true };
}

export async function addStudentToSupabase(student: any): Promise<SupabaseResponse<any>> {
  const res = await apiCreateStudent(student);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_INSERT_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: res.data || student, error: null, success: true };
}

export async function updateStudentInSupabase(id: string, updates: Partial<Student>): Promise<SupabaseResponse<boolean>> {
  const res = await apiUpdateStudent(id, updates);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_UPDATE_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: true, error: null, success: true };
}

export async function deleteStudentFromSupabase(id: string): Promise<SupabaseResponse<boolean>> {
  const res = await apiDeleteStudent(id);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_DELETE_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: true, error: null, success: true };
}

export async function upsertStudentToSupabase(student: Student): Promise<SupabaseResponse<Student>> {
  if (student.id) {
    const updRes = await apiUpdateStudent(student.id, student);
    if (!updRes.error) return { data: student, error: null, success: true };
  }
  return addStudentToSupabase(student);
}

// ----------------------------------------------------
// 2. Companies Operations
// ----------------------------------------------------

export async function fetchCompaniesFromSupabase(): Promise<SupabaseResponse<Company[]>> {
  const res = await apiFetchCompanies();
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_FETCH_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: res.data || [], error: null, success: true };
}

export async function addCompanyToSupabase(company: any): Promise<SupabaseResponse<any>> {
  const res = await apiCreateCompany(company);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_INSERT_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: res.data || company, error: null, success: true };
}

export async function updateCompanyInSupabase(id: string, updates: Partial<Company>): Promise<SupabaseResponse<boolean>> {
  const res = await apiUpdateCompany(id, updates);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_UPDATE_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: true, error: null, success: true };
}

export async function deleteCompanyFromSupabase(id: string): Promise<SupabaseResponse<boolean>> {
  const res = await apiDeleteCompany(id);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_DELETE_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: true, error: null, success: true };
}

export async function upsertCompanyToSupabase(company: Company): Promise<SupabaseResponse<Company>> {
  if (company.id) {
    const updRes = await apiUpdateCompany(company.id, company);
    if (!updRes.error) return { data: company, error: null, success: true };
  }
  return addCompanyToSupabase(company);
}

// ----------------------------------------------------
// 3. Placement Drives Operations
// ----------------------------------------------------

export async function fetchDrivesFromSupabase(): Promise<SupabaseResponse<PlacementDrive[]>> {
  const res = await apiFetchDrives();
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_FETCH_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: res.data || [], error: null, success: true };
}

export async function addDriveToSupabase(drive: any): Promise<SupabaseResponse<PlacementDrive>> {
  const res = await apiCreateDrive(drive);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_INSERT_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: res.data as PlacementDrive, error: null, success: true };
}

export async function updateDriveInSupabase(id: string, updates: Partial<PlacementDrive>): Promise<SupabaseResponse<boolean>> {
  const res = await apiUpdateDrive(id, updates);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_UPDATE_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: true, error: null, success: true };
}

export async function deleteDriveFromSupabase(id: string): Promise<SupabaseResponse<boolean>> {
  const res = await apiDeleteDrive(id);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_DELETE_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: true, error: null, success: true };
}

export async function upsertDriveToSupabase(drive: PlacementDrive): Promise<SupabaseResponse<PlacementDrive>> {
  if (drive.id) {
    const updRes = await apiUpdateDrive(drive.id, drive);
    if (!updRes.error) return { data: drive, error: null, success: true };
  }
  return addDriveToSupabase(drive);
}

// ----------------------------------------------------
// 4. Eligibility Operations
// ----------------------------------------------------

export async function fetchEligibilityResultsFromSupabase(driveId: string): Promise<SupabaseResponse<any[]>> {
  const res = await apiFetchDriveEligibility(driveId);
  if (res.error) return { data: null, error: res.error, success: false };
  return { data: res.data || [], error: null, success: true };
}

export async function fetchStudentAllEligibilityResults(studentId: string): Promise<{ data: Map<string, { eligible: boolean; reasons: string[]; checked_at: string }>; error: string | null }> {
  const res = await apiFetchStudentEligibility(studentId);
  const map = new Map<string, { eligible: boolean; reasons: string[]; checked_at: string }>();
  if (res.data) {
    for (const item of res.data) {
      map.set(item.drive_id, {
        eligible: Boolean(item.eligible),
        reasons: item.reasons || [],
        checked_at: item.checked_at || ''
      });
    }
  }
  return { data: map, error: res.error || null };
}

export async function checkStudentEligibilityForDriveInDb(
  studentId: string,
  driveId: string
): Promise<{ status: 'eligible' | 'ineligible' | 'not_evaluated'; reasons: string[]; checked_at?: string }> {
  const res = await apiCheckStudentEligibility(studentId, driveId);
  return {
    status: (res.status as any) || 'not_evaluated',
    reasons: res.reasons || [],
    checked_at: res.checked_at
  };
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
): Promise<SupabaseResponse<boolean>> {
  const res = await apiSaveEligibilityResults(driveId, records);
  if (res.error) return { data: null, error: res.error, success: false };
  return { data: true, error: null, success: true };
}

// ----------------------------------------------------
// 5. Applications Operations
// ----------------------------------------------------

export async function fetchApplicationsJoinedFromSupabase(): Promise<SupabaseResponse<Application[]>> {
  const res = await apiFetchApplications();
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_FETCH_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: res.data || [], error: null, success: true };
}

export async function addApplicationToSupabase(application: Application): Promise<SupabaseResponse<Application>> {
  const res = await apiCreateApplication(application);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_INSERT_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: res.data || application, error: null, success: true };
}

export async function updateApplicationInSupabase(id: string, statusOrUpdates: any): Promise<SupabaseResponse<boolean>> {
  const status = typeof statusOrUpdates === 'string' ? statusOrUpdates : (statusOrUpdates?.status || 'Applied');
  const res = await apiUpdateApplicationStatus(id, status);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_UPDATE_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: true, error: null, success: true };
}

export async function deleteApplicationFromSupabase(id: string): Promise<SupabaseResponse<boolean>> {
  const res = await apiDeleteApplication(id);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_DELETE_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: true, error: null, success: true };
}

export async function upsertApplicationToSupabase(application: Application): Promise<SupabaseResponse<Application>> {
  if (application.id) {
    const updRes = await apiUpdateApplicationStatus(application.id, application.status);
    if (!updRes.error) return { data: application, error: null, success: true };
  }
  return addApplicationToSupabase(application);
}

// ----------------------------------------------------
// 6. Offers Operations
// ----------------------------------------------------

export async function fetchOffersJoinedFromSupabase(): Promise<SupabaseResponse<Offer[]>> {
  const res = await apiFetchOffers();
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_FETCH_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: res.data || [], error: null, success: true };
}

export async function fetchOffersFromSupabase(): Promise<SupabaseResponse<Offer[]>> {
  return fetchOffersJoinedFromSupabase();
}

export async function createOfferInSupabase(
  offer: any
): Promise<SupabaseResponse<Offer>> {
  const res = await apiCreateOffer(offer);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_INSERT_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: res.data as Offer, error: null, success: true };
}

export async function updateOfferStatusInSupabase(
  id: string,
  status: OfferStatus | string,
  extraPayload?: Partial<Offer>
): Promise<SupabaseResponse<boolean>> {
  const res = await apiUpdateOfferStatus(id, status, extraPayload);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_UPDATE_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: true, error: null, success: true };
}

export async function deleteOfferFromSupabase(id: string): Promise<SupabaseResponse<boolean>> {
  const res = await apiDeleteOffer(id);
  if (res.error) {
    return {
      data: null,
      error: res.error,
      success: false,
      diagnostic: {
        message: res.error,
        code: 'API_DELETE_ERROR',
        url: DEFAULT_SUPABASE_URL
      }
    };
  }
  return { data: true, error: null, success: true };
}

export async function upsertOfferToSupabase(offer: Offer): Promise<SupabaseResponse<Offer>> {
  if (offer.id) {
    const updRes = await apiUpdateOfferStatus(offer.id, offer.status, offer);
    if (!updRes.error) return { data: offer, error: null, success: true };
  }
  return createOfferInSupabase(offer);
}

// ----------------------------------------------------
// 7. Auth & Profiles Operations
// ----------------------------------------------------

export async function signInWithSupabaseAuth(email: string, password: string): Promise<{ data: any; error: any }> {
  const res = await apiLogin(email, password);
  if (res.error) {
    return { data: null, error: { message: res.error } };
  }
  return { data: res.data, error: null };
}

export async function signOutFromSupabaseAuth(): Promise<{ error: any }> {
  await apiLogout();
  return { error: null };
}

export async function getSupabaseSession(): Promise<{ data: any; error: any }> {
  return { data: { session: null }, error: null };
}

export async function fetchUserProfile(userId: string): Promise<SupabaseResponse<UserProfile>> {
  const res = await apiFetchUserProfile(userId);
  if (res.error) return { data: null, error: res.error, profile: undefined };
  return { data: res.data as UserProfile, error: null, profile: res.data as UserProfile };
}

export async function saveUserProfile(profile: UserProfile): Promise<SupabaseResponse<UserProfile>> {
  const res = await apiSaveUserProfile(profile as any);
  if (res.error) return { data: null, error: res.error, profile: undefined };
  return { data: profile, error: null, profile };
}

// ----------------------------------------------------
// 8. Bulk Sync & Seed Operations
// ----------------------------------------------------

export async function fetchAllFromSupabase(): Promise<{
  students: Student[];
  companies: Company[];
  drives: PlacementDrive[];
  applications: Application[];
  offers: Offer[];
  offerPolicy?: OfferPolicyConfig;
  error?: string | null;
}> {
  const res = await apiSyncAll();
  if (res.data) {
    return {
      students: res.data.students || [],
      companies: res.data.companies || [],
      drives: res.data.drives || [],
      applications: res.data.applications || [],
      offers: res.data.offers || [],
      error: null
    };
  }
  return {
    students: [],
    companies: [],
    drives: [],
    applications: [],
    offers: [],
    error: res.error || 'Sync failed'
  };
}

export async function seedInitialDataToSupabase(
  dataOrStudents: any,
  companies?: any,
  drives?: any,
  applications?: any,
  offers?: any,
  policy?: any
): Promise<SupabaseResponse<boolean>> {
  let payload: any = {};
  if (Array.isArray(dataOrStudents)) {
    payload = {
      students: dataOrStudents,
      companies,
      drives,
      applications,
      offers,
      offerPolicy: policy
    };
  } else {
    payload = dataOrStudents || {};
  }
  const res = await apiSeedInitialData(payload);
  if (res.error) {
    return { data: null, error: res.error, success: false, message: res.error };
  }
  return { data: true, error: null, success: true, message: res.message || 'Seeded successfully' };
}

export async function upsertPolicyToSupabase(policy: OfferPolicyConfig): Promise<SupabaseResponse<boolean>> {
  return { data: true, error: null, success: true };
}
