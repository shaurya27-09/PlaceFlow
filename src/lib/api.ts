/**
 * PlaceFlow Client API Service
 * 
 * Routes all database and auth operations through the server-side /api/* endpoints.
 * Protects Supabase keys and database credentials from being exposed to the browser.
 */

import { Student, Company, PlacementDrive, Application, Offer, ApplicationStatus, OfferStatus } from '../types';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success?: boolean;
  message?: string;
  code?: string;
}

// ----------------------------------------------------
// Health & Status
// ----------------------------------------------------

export async function checkServerHealth(): Promise<{ status: string; geminiConfigured: boolean; supabaseConfigured: boolean }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return { status: 'error', geminiConfigured: false, supabaseConfigured: false };
  }
}

export async function testServerSupabaseStatus(): Promise<{ success: boolean; connected: boolean; message: string; latencyMs?: number }> {
  try {
    const res = await fetch('/api/supabase/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return { success: false, connected: false, message: err?.message || 'Server connection error' };
  }
}

export async function diagnoseSupabaseConnection(url?: string, anonKey?: string): Promise<any> {
  try {
    const res = await fetch('/api/supabase/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, anonKey })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, reachable: false, message: err?.message || 'Diagnostic request failed' };
  }
}

// ----------------------------------------------------
// 1. Students API
// ----------------------------------------------------

export async function apiFetchStudents(): Promise<ApiResponse<Student[]>> {
  try {
    const res = await fetch('/api/students');
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data || [] };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch students from server' };
  }
}

export async function apiGetStudent(id: string): Promise<ApiResponse<Student>> {
  try {
    const res = await fetch(`/api/students/${encodeURIComponent(id)}`);
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch student' };
  }
}

export async function apiCreateStudent(student: Partial<Student>): Promise<ApiResponse<Student>> {
  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student)
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to create student on server' };
  }
}

export async function apiUpdateStudent(id: string, updates: Partial<Student>): Promise<ApiResponse<any>> {
  try {
    const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true, data: json.data };
  } catch (err: any) {
    return { error: err?.message || 'Failed to update student on server' };
  }
}

export async function apiDeleteStudent(id: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete student on server' };
  }
}

// ----------------------------------------------------
// 2. Companies API
// ----------------------------------------------------

export async function apiFetchCompanies(): Promise<ApiResponse<Company[]>> {
  try {
    const res = await fetch('/api/companies');
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data || [] };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch companies from server' };
  }
}

export async function apiCreateCompany(company: Partial<Company>): Promise<ApiResponse<Company>> {
  try {
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(company)
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to create company on server' };
  }
}

export async function apiUpdateCompany(id: string, updates: Partial<Company>): Promise<ApiResponse<any>> {
  try {
    const res = await fetch(`/api/companies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true, data: json.data };
  } catch (err: any) {
    return { error: err?.message || 'Failed to update company on server' };
  }
}

export async function apiDeleteCompany(id: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/companies/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete company on server' };
  }
}

// ----------------------------------------------------
// 3. Placement Drives API
// ----------------------------------------------------

export async function apiFetchDrives(): Promise<ApiResponse<PlacementDrive[]>> {
  try {
    const res = await fetch('/api/drives');
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data || [] };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch drives from server' };
  }
}

export async function apiCreateDrive(drive: Partial<PlacementDrive>): Promise<ApiResponse<PlacementDrive>> {
  try {
    const res = await fetch('/api/drives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(drive)
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to create drive on server' };
  }
}

export async function apiUpdateDrive(id: string, updates: Partial<PlacementDrive>): Promise<ApiResponse<any>> {
  try {
    const res = await fetch(`/api/drives/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true, data: json.data };
  } catch (err: any) {
    return { error: err?.message || 'Failed to update drive on server' };
  }
}

export async function apiDeleteDrive(id: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/drives/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete drive on server' };
  }
}

// ----------------------------------------------------
// 4. Eligibility API
// ----------------------------------------------------

export async function apiFetchDriveEligibility(driveId: string): Promise<ApiResponse<any[]>> {
  try {
    const res = await fetch(`/api/eligibility/drive/${encodeURIComponent(driveId)}`);
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data || [] };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch eligibility records' };
  }
}

export async function apiFetchStudentEligibility(studentId: string): Promise<ApiResponse<any[]>> {
  try {
    const res = await fetch(`/api/eligibility/student/${encodeURIComponent(studentId)}`);
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data || [] };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch student eligibility' };
  }
}

export async function apiCheckStudentEligibility(studentId: string, driveId: string): Promise<{ status: string; reasons: string[]; checked_at?: string }> {
  try {
    const res = await fetch(`/api/eligibility/check/${encodeURIComponent(studentId)}/${encodeURIComponent(driveId)}`);
    if (!res.ok) return { status: 'not_evaluated', reasons: [] };
    return await res.json();
  } catch (err: any) {
    return { status: 'not_evaluated', reasons: [] };
  }
}

export async function apiSaveEligibilityResults(driveId: string, records: any[]): Promise<ApiResponse<any>> {
  try {
    const res = await fetch('/api/eligibility/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driveId, records })
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true, data: json.data };
  } catch (err: any) {
    return { error: err?.message || 'Failed to save eligibility records' };
  }
}

// ----------------------------------------------------
// 5. Applications API
// ----------------------------------------------------

export async function apiFetchApplications(): Promise<ApiResponse<Application[]>> {
  try {
    const res = await fetch('/api/applications');
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data || [] };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch applications from server' };
  }
}

export async function apiCreateApplication(app: Partial<Application>): Promise<ApiResponse<Application>> {
  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(app)
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to submit application to server' };
  }
}

export async function apiUpdateApplicationStatus(id: string, status: ApplicationStatus | string): Promise<ApiResponse<any>> {
  try {
    const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true, data: json.data };
  } catch (err: any) {
    return { error: err?.message || 'Failed to update application on server' };
  }
}

export async function apiDeleteApplication(id: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete application on server' };
  }
}

// ----------------------------------------------------
// 6. Offers API
// ----------------------------------------------------

export async function apiFetchOffers(): Promise<ApiResponse<Offer[]>> {
  try {
    const res = await fetch('/api/offers');
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data || [] };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch offers from server' };
  }
}

export async function apiCreateOffer(offer: Partial<Offer> & { student_id?: string; drive_id?: string; company_id?: string }): Promise<ApiResponse<Offer>> {
  try {
    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offer)
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to create offer on server' };
  }
}

export async function apiUpdateOfferStatus(id: string, status: OfferStatus | string, payload?: Partial<Offer>): Promise<ApiResponse<any>> {
  try {
    const res = await fetch(`/api/offers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...payload })
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true, data: json.data };
  } catch (err: any) {
    return { error: err?.message || 'Failed to update offer on server' };
  }
}

export async function apiDeleteOffer(id: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/offers/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete offer on server' };
  }
}

// ----------------------------------------------------
// 7. Auth & Profiles API
// ----------------------------------------------------

export async function apiLogin(email: string, password: string): Promise<ApiResponse<{ user: any; session: any; profile: any }>> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json, success: true };
  } catch (err: any) {
    return { error: err?.message || 'Failed to authenticate with server' };
  }
}

export async function apiLogout(): Promise<ApiResponse<boolean>> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
}

export async function apiFetchUserProfile(userId: string): Promise<ApiResponse<any>> {
  try {
    const res = await fetch(`/api/auth/profile/${encodeURIComponent(userId)}`);
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json.data };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch user profile' };
  }
}

export async function apiSaveUserProfile(profile: { id: string; email: string; role?: string; student_id?: string; company_id?: string }): Promise<ApiResponse<any>> {
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true, data: json.data };
  } catch (err: any) {
    return { error: err?.message || 'Failed to save user profile' };
  }
}

// ----------------------------------------------------
// 8. Bulk Sync & Seed API
// ----------------------------------------------------

export async function apiSyncAll(): Promise<ApiResponse<{
  students: Student[];
  companies: Company[];
  drives: PlacementDrive[];
  applications: Application[];
  offers: Offer[];
}>> {
  try {
    const res = await fetch('/api/sync/all');
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { data: json };
  } catch (err: any) {
    return { error: err?.message || 'Failed to sync data from server' };
  }
}

export async function apiSeedInitialData(seedPayload: {
  students?: Student[];
  companies?: Company[];
  drives?: PlacementDrive[];
  applications?: Application[];
  offers?: Offer[];
}): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch('/api/sync/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(seedPayload)
    });
    const json = await res.json();
    if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
    return { success: true, message: json.message };
  } catch (err: any) {
    return { error: err?.message || 'Failed to seed data' };
  }
}
