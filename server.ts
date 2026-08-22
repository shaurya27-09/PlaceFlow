import express from 'express';
import path from 'path';
import dns from 'dns';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return geminiClient;
}

// Server-side Supabase configuration
const DEFAULT_SUPABASE_URL = 'https://plwsickyaxdkjultrlca.supabase.co';
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

let supabaseServerClient: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabaseServerClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  } catch (e) {
    console.error('[SERVER] Failed to initialize Supabase client:', e);
  }
}

// Helper to check if string is valid UUID
function isValidUUID(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function ensureUUID(id?: string | null): string {
  return (id && isValidUUID(id)) ? id : crypto.randomUUID();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // ==========================================
  // SYSTEM HEALTH & STATUS ENDPOINTS
  // ==========================================

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      supabaseConfigured: Boolean(supabaseServerClient)
    });
  });

  app.get('/api/supabase/status', async (req, res) => {
    if (!supabaseServerClient) {
      return res.json({
        success: false,
        connected: false,
        message: 'Supabase credentials are not configured on server (SUPABASE_URL / SUPABASE_ANON_KEY missing).'
      });
    }

    const start = performance.now();
    try {
      const { data, error } = await supabaseServerClient
        .from('placement_drives')
        .select('id')
        .limit(1);

      const latencyMs = Math.round(performance.now() - start);

      if (error) {
        return res.json({
          success: false,
          connected: false,
          latencyMs,
          message: error.message,
          code: error.code
        });
      }

      return res.json({
        success: true,
        connected: true,
        latencyMs,
        message: `Connected to Supabase PostgreSQL database (${latencyMs}ms latency).`
      });
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      return res.json({
        success: false,
        connected: false,
        latencyMs,
        message: err?.message || 'Failed to connect to Supabase'
      });
    }
  });

  // Supabase Network & DNS Reachability Diagnostic API
  app.post('/api/supabase/diagnose', async (req, res) => {
    try {
      const rawUrl = (req.body?.url || supabaseUrl || '').trim();
      const rawKey = (req.body?.anonKey || supabaseKey || '').trim();

      if (!rawUrl || !rawKey) {
        return res.json({
          success: false,
          reachable: false,
          errorType: 'MISSING_CREDENTIALS',
          message: 'Supabase URL or Anon Key is missing in request.'
        });
      }

      // Normalize URL
      let cleanUrl = rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }

      let parsed: URL;
      try {
        parsed = new URL(cleanUrl);
      } catch (e: any) {
        return res.json({
          success: false,
          reachable: false,
          errorType: 'INVALID_URL_FORMAT',
          message: `Invalid URL format: ${rawUrl}`
        });
      }

      const hostname = parsed.hostname;

      // 1. DNS Resolution Check
      let resolvedIp = '';
      try {
        const lookupResult = await dns.promises.lookup(hostname);
        resolvedIp = lookupResult.address;
      } catch (dnsErr: any) {
        const isNotFound = dnsErr?.code === 'ENOTFOUND' || dnsErr?.code === 'EAI_AGAIN';
        return res.json({
          success: false,
          reachable: false,
          dnsResolved: false,
          hostname,
          errorType: isNotFound ? 'DNS_NOT_FOUND' : 'DNS_ERROR',
          message: `Could not resolve host '${hostname}'.`,
          details: dnsErr?.message || 'DNS lookup failed',
          hint: hostname.includes('supabase.co')
            ? 'This Supabase project is either PAUSED due to inactivity, deleted, or the project reference is mistyped. Please visit https://supabase.com/dashboard, find your project, and click "Restore project" if paused, or copy the exact Project URL from Project Settings > API.'
            : 'Please verify the hostname and network configuration.'
        });
      }

      // 2. HTTP Ping to Supabase REST endpoint
      const restEndpoint = `${cleanUrl}/rest/v1/`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const resp = await fetch(restEndpoint, {
          method: 'GET',
          headers: {
            apikey: rawKey,
            Authorization: `Bearer ${rawKey}`,
            'User-Agent': 'PlaceFlow-Diagnostic/1.0'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (resp.status === 401 || resp.status === 403) {
          return res.json({
            success: false,
            reachable: true,
            dnsResolved: true,
            resolvedIp,
            httpStatus: resp.status,
            errorType: 'AUTH_FAILED',
            message: `Supabase host responded, but API key was rejected (HTTP ${resp.status} Unauthorized).`,
            hint: 'Please verify that your Supabase anon/public key is copied accurately from Project Settings > API.'
          });
        }

        return res.json({
          success: true,
          reachable: true,
          dnsResolved: true,
          resolvedIp,
          httpStatus: resp.status,
          message: `Successfully connected to Supabase endpoint (${hostname}).`
        });
      } catch (httpErr: any) {
        return res.json({
          success: false,
          reachable: false,
          dnsResolved: true,
          resolvedIp,
          errorType: 'HTTP_CONNECTION_FAILED',
          message: `DNS resolved to ${resolvedIp}, but HTTP connection failed: ${httpErr?.message || 'Network error'}`,
          details: httpErr?.message
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Internal error diagnosing Supabase reachability'
      });
    }
  });

  // Resilient Server-Side Proxy Endpoint
  app.post('/api/supabase/proxy', async (req, res) => {
    try {
      const { targetUrl: rawTargetUrl, method = 'GET', headers = {}, body } = req.body;
      if (!rawTargetUrl) {
        return res.status(400).json({ error: 'targetUrl is required' });
      }

      let targetUrl = String(rawTargetUrl).trim();
      if (targetUrl.startsWith('/') && !targetUrl.startsWith('//')) {
        targetUrl = `${supabaseUrl.replace(/\/+$/, '')}${targetUrl}`;
      }

      const forwardHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        const lower = k.toLowerCase();
        if (['apikey', 'authorization', 'content-type', 'prefer', 'range', 'accept'].includes(lower)) {
          forwardHeaders[k] = String(v);
        }
      }
      if (!forwardHeaders['apikey'] && supabaseKey) {
        forwardHeaders['apikey'] = supabaseKey;
      }
      if (!forwardHeaders['authorization'] && supabaseKey) {
        forwardHeaders['authorization'] = `Bearer ${supabaseKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const upstreamResp = await fetch(targetUrl, {
          method,
          headers: forwardHeaders,
          body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const contentType = upstreamResp.headers.get('content-type') || '';
        res.status(upstreamResp.status);

        if (contentType.includes('application/json')) {
          const json = await upstreamResp.json();
          return res.json(json);
        } else {
          const text = await upstreamResp.text();
          return res.status(upstreamResp.status).json({
            error: {
              message: `Upstream response (HTTP ${upstreamResp.status}): ${text.slice(0, 200)}`,
              code: 'UPSTREAM_HTML_RESPONSE',
              status: upstreamResp.status
            }
          });
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        const isDnsErr = fetchErr?.cause?.code === 'ENOTFOUND' || fetchErr?.message?.includes('ENOTFOUND');
        return res.status(502).json({
          error: {
            message: isDnsErr
              ? `Cannot resolve host for ${targetUrl}. The Supabase project is likely PAUSED, deleted, or mistyped.`
              : (fetchErr?.message || 'Upstream network fetch failure'),
            code: isDnsErr ? 'DNS_LOOKUP_FAILED' : 'FETCH_ERROR',
            details: fetchErr?.message
          }
        });
      }
    } catch (err: any) {
      return res.status(500).json({ error: { message: err?.message || 'Internal proxy error' } });
    }
  });

  // ==========================================
  // 1. STUDENTS API ENDPOINTS
  // ==========================================

  // GET /api/students - List all students
  app.get('/api/students', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { data, error } = await supabaseServerClient
        .from('students')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('[SERVER] Students select error:', error);
        return res.status(400).json({ error: error.message });
      }

      const students = (data || []).map((row: any) => ({
        id: String(row.id),
        name: row.full_name || 'Student',
        enrollmentNumber: row.enrollment_no || '',
        email: row.email || '',
        phone: row.phone || '',
        branch: row.branch || 'CSE',
        cgpa: parseFloat(String(row.cgpa ?? 0)) || 0,
        backlogs: parseInt(String(row.backlogs ?? 0), 10) || 0,
        attendance: parseInt(String(row.attendance ?? 75), 10) || 75,
        placementStatus: row.placement_status || 'Unplaced',
        graduationYear: parseInt(String(row.graduation_year ?? 2026), 10) || 2026,
        skills: Array.isArray(row.skills) ? row.skills : ['React', 'TypeScript', 'Data Structures'],
        gender: row.gender || 'Not Specified',
        offers: []
      }));

      return res.json({ data: students });
    } catch (err: any) {
      console.error('[SERVER] Students query exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to fetch students' });
    }
  });

  // GET /api/students/:id - Get single student
  app.get('/api/students/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const { data, error } = await supabaseServerClient
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return res.status(400).json({ error: error.message });
      }
      if (!data) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const student = {
        id: String(data.id),
        name: data.full_name || 'Student',
        enrollmentNumber: data.enrollment_no || '',
        email: data.email || '',
        phone: data.phone || '',
        branch: data.branch || 'CSE',
        cgpa: parseFloat(String(data.cgpa ?? 0)) || 0,
        backlogs: parseInt(String(data.backlogs ?? 0), 10) || 0,
        attendance: parseInt(String(data.attendance ?? 75), 10) || 75,
        placementStatus: data.placement_status || 'Unplaced',
        graduationYear: parseInt(String(data.graduation_year ?? 2026), 10) || 2026,
        skills: Array.isArray(data.skills) ? data.skills : [],
        offers: []
      };

      return res.json({ data: student });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch student' });
    }
  });

  // POST /api/students - Add new student
  app.post('/api/students', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const s = req.body || {};
      const studentId = ensureUUID(s.id);
      const studentName = s.full_name || s.name || 'New Student';
      const enrollmentNo = s.enrollment_no || s.enrollmentNumber || `ENR-${Math.floor(100000 + Math.random() * 900000)}`;

      const row = {
        id: studentId,
        full_name: studentName,
        enrollment_no: enrollmentNo,
        email: s.email || `${enrollmentNo.toLowerCase()}@university.edu`,
        branch: s.branch || 'CSE',
        cgpa: typeof s.cgpa === 'number' ? s.cgpa : (parseFloat(s.cgpa) || 7.5),
        backlogs: typeof s.backlogs === 'number' ? s.backlogs : (parseInt(s.backlogs, 10) || 0),
        attendance: typeof s.attendance === 'number' ? s.attendance : (parseInt(s.attendance, 10) || 80),
        placement_status: s.placement_status || s.placementStatus || 'Unplaced',
        graduation_year: typeof s.graduation_year === 'number' ? s.graduation_year : (parseInt(s.graduationYear, 10) || 2026)
      };

      const { data, error } = await supabaseServerClient
        .from('students')
        .insert([row])
        .select();

      if (error) {
        console.error('[SERVER] Student insert error:', error);
        return res.status(400).json({ error: error.message });
      }

      const inserted = data?.[0] || row;
      const resultStudent = {
        id: String(inserted.id),
        name: inserted.full_name,
        enrollmentNumber: inserted.enrollment_no,
        email: inserted.email,
        branch: inserted.branch,
        cgpa: parseFloat(String(inserted.cgpa ?? 0)),
        backlogs: parseInt(String(inserted.backlogs ?? 0), 10),
        attendance: parseInt(String(inserted.attendance ?? 75), 10),
        placementStatus: inserted.placement_status,
        graduationYear: parseInt(String(inserted.graduation_year ?? 2026), 10),
        skills: s.skills || ['React', 'Node.js', 'PostgreSQL'],
        offers: []
      };

      return res.status(201).json({ data: resultStudent });
    } catch (err: any) {
      console.error('[SERVER] Student insert exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create student' });
    }
  });

  // PATCH /api/students/:id - Update student
  app.patch('/api/students/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const partial = req.body || {};

      const payload: Record<string, any> = {};
      if (partial.name !== undefined || partial.full_name !== undefined) {
        payload.full_name = partial.name || partial.full_name;
      }
      if (partial.enrollmentNumber !== undefined || partial.enrollment_no !== undefined) {
        payload.enrollment_no = partial.enrollmentNumber || partial.enrollment_no;
      }
      if (partial.email !== undefined) payload.email = partial.email;
      if (partial.branch !== undefined) payload.branch = partial.branch;
      if (partial.cgpa !== undefined) payload.cgpa = parseFloat(String(partial.cgpa)) || 0;
      if (partial.backlogs !== undefined) payload.backlogs = parseInt(String(partial.backlogs), 10) || 0;
      if (partial.attendance !== undefined) payload.attendance = parseInt(String(partial.attendance), 10) || 0;
      if (partial.placementStatus !== undefined || partial.placement_status !== undefined) {
        payload.placement_status = partial.placementStatus || partial.placement_status;
      }
      if (partial.graduationYear !== undefined || partial.graduation_year !== undefined) {
        payload.graduation_year = parseInt(String(partial.graduationYear || partial.graduation_year), 10) || 2026;
      }

      if (Object.keys(payload).length === 0) {
        return res.json({ success: true, message: 'No fields to update' });
      }

      const { data, error } = await supabaseServerClient
        .from('students')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) {
        console.error('[SERVER] Student update error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true, data: data?.[0] });
    } catch (err: any) {
      console.error('[SERVER] Student update exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to update student' });
    }
  });

  // DELETE /api/students/:id - Delete student
  app.delete('/api/students/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const { error } = await supabaseServerClient
        .from('students')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SERVER] Student delete error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[SERVER] Student delete exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete student' });
    }
  });

  // ==========================================
  // 2. COMPANIES API ENDPOINTS
  // ==========================================

  // GET /api/companies - List all companies
  app.get('/api/companies', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { data, error } = await supabaseServerClient
        .from('companies')
        .select('*')
        .order('company_name', { ascending: true });

      if (error) {
        console.error('[SERVER] Companies select error:', error);
        return res.status(400).json({ error: error.message });
      }

      const companies = (data || []).map((row: any) => {
        const compName = row.company_name || row.name || 'Company';
        return {
          id: String(row.id),
          name: compName,
          company_name: compName,
          industry: row.industry || 'Technology',
          tier: (row.industry === 'Investment Banking' || row.industry === 'Fintech' ? 'Super Dream' : 'Dream'),
          openDrivesCount: 0,
          averagePackage: 10.0,
          minPackage: 6.0,
          maxPackage: 18.0,
          status: row.status || 'Active',
          website: row.website || '',
          location: row.location || 'Gurugram, India',
          contactPerson: row.contact_person || row.contact_name || '',
          contactEmail: row.contact_email || '',
          contactPhone: row.contact_phone || '',
          totalHiredHistory: 12,
          logo: row.logo || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=128&auto=format&fit=crop&q=80',
          created_at: row.created_at
        };
      });

      return res.json({ data: companies });
    } catch (err: any) {
      console.error('[SERVER] Companies query exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to fetch companies' });
    }
  });

  // GET /api/companies/:id - Get single company
  app.get('/api/companies/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const { data, error } = await supabaseServerClient
        .from('companies')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) return res.status(400).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Company not found' });

      const compName = data.company_name || data.name || 'Company';
      const company = {
        id: String(data.id),
        name: compName,
        company_name: compName,
        industry: data.industry || 'Technology',
        status: data.status || 'Active',
        website: data.website || '',
        contactPerson: data.contact_person || data.contact_name || '',
        contactEmail: data.contact_email || '',
        contactPhone: data.contact_phone || ''
      };

      return res.json({ data: company });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch company' });
    }
  });

  // POST /api/companies - Add new company
  app.post('/api/companies', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const c = req.body || {};
      const companyId = ensureUUID(c.id);
      const compName = c.company_name || c.name || 'New Company';
      const contact = c.contactPerson || c.contact_person || c.contact_name || 'HR Team';

      const row = {
        id: companyId,
        company_name: compName,
        industry: c.industry || 'Technology',
        website: c.website || null,
        contact_name: contact,
        contact_person: contact,
        contact_email: c.contactEmail || c.contact_email || null,
        contact_phone: c.contactPhone || c.contact_phone || null,
        status: c.status || 'Active'
      };

      const { data, error } = await supabaseServerClient
        .from('companies')
        .insert([row])
        .select();

      if (error) {
        console.error('[SERVER] Company insert error:', error);
        return res.status(400).json({ error: error.message });
      }

      const inserted = data?.[0] || row;
      const resultCompany = {
        id: String(inserted.id),
        name: inserted.company_name,
        company_name: inserted.company_name,
        industry: inserted.industry,
        tier: c.tier || 'Dream',
        openDrivesCount: 0,
        averagePackage: 10.0,
        minPackage: 6.0,
        maxPackage: 16.0,
        status: inserted.status,
        website: inserted.website || '',
        location: c.location || 'India',
        contactPerson: inserted.contact_person || inserted.contact_name || '',
        contactEmail: inserted.contact_email || '',
        contactPhone: inserted.contact_phone || '',
        totalHiredHistory: 0,
        logo: c.logo || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=128&auto=format&fit=crop&q=80',
        created_at: inserted.created_at
      };

      return res.status(201).json({ data: resultCompany });
    } catch (err: any) {
      console.error('[SERVER] Company insert exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create company' });
    }
  });

  // PATCH /api/companies/:id - Update company
  app.patch('/api/companies/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const partial = req.body || {};

      const payload: Record<string, any> = {};
      if (partial.name !== undefined || partial.company_name !== undefined) {
        payload.company_name = partial.company_name || partial.name;
      }
      if (partial.industry !== undefined) payload.industry = partial.industry;
      if (partial.website !== undefined) payload.website = partial.website;
      if (partial.contactPerson !== undefined || partial.contact_person !== undefined || partial.contact_name !== undefined) {
        const c = partial.contactPerson || partial.contact_person || partial.contact_name;
        payload.contact_person = c;
        payload.contact_name = c;
      }
      if (partial.contactEmail !== undefined || partial.contact_email !== undefined) {
        payload.contact_email = partial.contactEmail || partial.contact_email;
      }
      if (partial.contactPhone !== undefined || partial.contact_phone !== undefined) {
        payload.contact_phone = partial.contactPhone || partial.contact_phone;
      }
      if (partial.status !== undefined) payload.status = partial.status;

      if (Object.keys(payload).length === 0) {
        return res.json({ success: true, message: 'No fields to update' });
      }

      const { data, error } = await supabaseServerClient
        .from('companies')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) {
        console.error('[SERVER] Company update error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true, data: data?.[0] });
    } catch (err: any) {
      console.error('[SERVER] Company update exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to update company' });
    }
  });

  // DELETE /api/companies/:id - Delete company
  app.delete('/api/companies/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const { error } = await supabaseServerClient
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SERVER] Company delete error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[SERVER] Company delete exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete company' });
    }
  });

  // ==========================================
  // 3. PLACEMENT DRIVES API ENDPOINTS
  // ==========================================

  // GET /api/drives - List all drives with joined company details
  app.get('/api/drives', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const [drivesRes, compRes] = await Promise.all([
        supabaseServerClient.from('placement_drives').select('*').order('drive_date', { ascending: false }),
        supabaseServerClient.from('companies').select('*')
      ]);

      if (drivesRes.error) {
        console.error('[SERVER] Drives select error:', drivesRes.error);
        return res.status(400).json({ error: drivesRes.error.message });
      }

      const companiesMap = new Map<string, any>((compRes.data || []).map((c: any) => [String(c.id), c]));

      const drives = (drivesRes.data || []).map((row: any) => {
        const joinedComp = companiesMap.get(String(row.company_id));
        const compName = joinedComp?.company_name || joinedComp?.name || 'Company';
        const compLogo = joinedComp?.logo || '';
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
          companyName: compName,
          companyLogo: compLogo,
          role: row.role || 'Software Engineer',
          jobDescription: row.job_description || '',
          packageLPA: pkg,
          tier: (pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core'),
          minCgpa: parseFloat(String(row.min_cgpa ?? 0)) || 0,
          maxBacklogs: parseInt(String(row.max_backlogs ?? 0), 10) || 0,
          eligibleBranches: branches,
          minAttendance: parseInt(String(row.min_attendance ?? 75), 10) || 75,
          graduationYear: parseInt(String(row.graduation_year ?? 2026), 10) || 2026,
          offer_limit_lpa: row.offer_limit_lpa ? parseFloat(String(row.offer_limit_lpa)) : undefined,
          offerPolicyRule: 'Dream Upgrade Only (>= 1.5x)',
          driveDate: row.drive_date || new Date().toISOString().split('T')[0],
          registrationDeadline: row.drive_date || new Date().toISOString().split('T')[0],
          location: row.location || 'On-Campus',
          status: row.status || 'Active',
          rounds: ['Online Assessment', 'Technical Interview', 'HR Interview']
        };
      });

      return res.json({ data: drives });
    } catch (err: any) {
      console.error('[SERVER] Drives query exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to fetch placement drives' });
    }
  });

  // GET /api/drives/:id - Get single drive
  app.get('/api/drives/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const { data, error } = await supabaseServerClient
        .from('placement_drives')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) return res.status(400).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Drive not found' });

      let compName = 'Company';
      let compLogo = '';
      if (data.company_id) {
        const { data: comp } = await supabaseServerClient
          .from('companies')
          .select('company_name, logo')
          .eq('id', data.company_id)
          .maybeSingle();
        if (comp) {
          compName = comp.company_name || 'Company';
          compLogo = comp.logo || '';
        }
      }

      const pkg = parseFloat(String(data.package_lpa ?? 0)) || 0;
      const drive = {
        id: String(data.id),
        companyId: String(data.company_id || ''),
        companyName: compName,
        companyLogo: compLogo,
        role: data.role || 'Software Engineer',
        packageLPA: pkg,
        tier: (pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core'),
        minCgpa: parseFloat(String(data.min_cgpa ?? 0)) || 0,
        maxBacklogs: parseInt(String(data.max_backlogs ?? 0), 10) || 0,
        eligibleBranches: Array.isArray(data.eligible_branches) ? data.eligible_branches : ['CSE', 'IT'],
        minAttendance: parseInt(String(data.min_attendance ?? 75), 10) || 75,
        graduationYear: parseInt(String(data.graduation_year ?? 2026), 10) || 2026,
        offer_limit_lpa: data.offer_limit_lpa ? parseFloat(String(data.offer_limit_lpa)) : undefined,
        driveDate: data.drive_date || '',
        status: data.status || 'Active'
      };

      return res.json({ data: drive });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch drive' });
    }
  });

  // POST /api/drives - Add new drive
  app.post('/api/drives', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const d = req.body || {};
      const driveId = ensureUUID(d.id);
      const companyId = ensureUUID(d.companyId || d.company_id);
      const pkg = parseFloat(String(d.packageLPA ?? d.package_lpa ?? 0)) || 0;
      const branches = d.eligibleBranches || d.eligible_branches || ['CSE', 'IT'];
      const driveDate = d.driveDate || d.drive_date || new Date().toISOString().split('T')[0];
      const driveStatus = d.status || 'Active';

      const row = {
        id: driveId,
        company_id: companyId,
        role: d.role || 'Software Engineer',
        package_lpa: pkg,
        min_cgpa: parseFloat(String(d.minCgpa ?? d.min_cgpa ?? 6.0)) || 6.0,
        max_backlogs: parseInt(String(d.maxBacklogs ?? d.max_backlogs ?? 0), 10) || 0,
        min_attendance: parseInt(String(d.minAttendance ?? d.min_attendance ?? 75), 10) || 75,
        eligible_branches: Array.isArray(branches) ? branches : ['CSE', 'IT'],
        graduation_year: parseInt(String(d.graduationYear ?? d.graduation_year ?? 2026), 10) || 2026,
        offer_limit_lpa: d.offer_limit_lpa ? parseFloat(String(d.offer_limit_lpa)) : null,
        drive_date: driveDate,
        status: driveStatus
      };

      const { data, error } = await supabaseServerClient
        .from('placement_drives')
        .insert([row])
        .select();

      if (error) {
        console.error('[SERVER] Drive insert error:', error);
        return res.status(400).json({ error: error.message });
      }

      const inserted = data?.[0] || row;
      const resultDrive = {
        id: String(inserted.id),
        companyId: String(inserted.company_id),
        companyName: d.companyName || 'Company',
        companyLogo: d.companyLogo || '',
        role: inserted.role,
        jobDescription: d.jobDescription || '',
        packageLPA: pkg,
        tier: (pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core'),
        minCgpa: parseFloat(String(inserted.min_cgpa)),
        maxBacklogs: parseInt(String(inserted.max_backlogs), 10),
        eligibleBranches: Array.isArray(inserted.eligible_branches) ? inserted.eligible_branches : ['CSE', 'IT'],
        minAttendance: parseInt(String(inserted.min_attendance), 10),
        graduationYear: parseInt(String(inserted.graduation_year), 10),
        offer_limit_lpa: inserted.offer_limit_lpa ? parseFloat(String(inserted.offer_limit_lpa)) : undefined,
        offerPolicyRule: 'Dream Upgrade Only (>= 1.5x)',
        driveDate: inserted.drive_date,
        registrationDeadline: inserted.drive_date,
        location: d.location || 'On-Campus',
        status: inserted.status,
        rounds: ['Online Assessment', 'Technical Interview', 'HR Interview']
      };

      return res.status(201).json({ data: resultDrive });
    } catch (err: any) {
      console.error('[SERVER] Drive insert exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create drive' });
    }
  });

  // PATCH /api/drives/:id - Update drive
  app.patch('/api/drives/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const partial = req.body || {};

      const payload: Record<string, any> = {};
      if (partial.companyId !== undefined || partial.company_id !== undefined) {
        payload.company_id = partial.companyId || partial.company_id;
      }
      if (partial.role !== undefined) payload.role = partial.role;
      if (partial.packageLPA !== undefined || partial.package_lpa !== undefined) {
        payload.package_lpa = parseFloat(String(partial.packageLPA ?? partial.package_lpa)) || 0;
      }
      if (partial.minCgpa !== undefined || partial.min_cgpa !== undefined) {
        payload.min_cgpa = parseFloat(String(partial.minCgpa ?? partial.min_cgpa)) || 0;
      }
      if (partial.maxBacklogs !== undefined || partial.max_backlogs !== undefined) {
        payload.max_backlogs = parseInt(String(partial.maxBacklogs ?? partial.max_backlogs), 10) || 0;
      }
      if (partial.minAttendance !== undefined || partial.min_attendance !== undefined) {
        payload.min_attendance = parseInt(String(partial.minAttendance ?? partial.min_attendance), 10) || 75;
      }
      if (partial.eligibleBranches !== undefined || partial.eligible_branches !== undefined) {
        payload.eligible_branches = partial.eligibleBranches || partial.eligible_branches;
      }
      if (partial.graduationYear !== undefined || partial.graduation_year !== undefined) {
        payload.graduation_year = parseInt(String(partial.graduationYear ?? partial.graduation_year), 10) || 2026;
      }
      if (partial.offer_limit_lpa !== undefined) {
        payload.offer_limit_lpa = partial.offer_limit_lpa ? parseFloat(String(partial.offer_limit_lpa)) : null;
      }
      if (partial.driveDate !== undefined || partial.drive_date !== undefined) {
        payload.drive_date = partial.driveDate || partial.drive_date;
      }
      if (partial.status !== undefined) payload.status = partial.status;

      if (Object.keys(payload).length === 0) {
        return res.json({ success: true, message: 'No fields to update' });
      }

      const { data, error } = await supabaseServerClient
        .from('placement_drives')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) {
        console.error('[SERVER] Drive update error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true, data: data?.[0] });
    } catch (err: any) {
      console.error('[SERVER] Drive update exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to update drive' });
    }
  });

  // DELETE /api/drives/:id - Delete drive
  app.delete('/api/drives/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const { error } = await supabaseServerClient
        .from('placement_drives')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SERVER] Drive delete error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[SERVER] Drive delete exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete drive' });
    }
  });

  // ==========================================
  // 4. ELIGIBILITY API ENDPOINTS
  // ==========================================

  // GET /api/eligibility/drive/:driveId - Fetch all eligibility records for a drive
  app.get('/api/eligibility/drive/:driveId', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { driveId } = req.params;
      const { data, error } = await supabaseServerClient
        .from('eligibility_results')
        .select('*')
        .eq('drive_id', driveId);

      if (error) return res.status(400).json({ error: error.message });

      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        student_id: String(row.student_id),
        drive_id: String(row.drive_id),
        eligible: Boolean(row.eligible),
        reasons: Array.isArray(row.reasons)
          ? row.reasons
          : (row.reasons ? (typeof row.reasons === 'string' ? JSON.parse(row.reasons) : [row.reasons]) : []),
        checked_at: row.checked_at || ''
      }));

      return res.json({ data: mapped });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch eligibility results' });
    }
  });

  // GET /api/eligibility/student/:studentId - Fetch all eligibility records for a student
  app.get('/api/eligibility/student/:studentId', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { studentId } = req.params;
      const { data, error } = await supabaseServerClient
        .from('eligibility_results')
        .select('*')
        .eq('student_id', studentId);

      if (error) return res.status(400).json({ error: error.message });

      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        student_id: String(row.student_id),
        drive_id: String(row.drive_id),
        eligible: Boolean(row.eligible),
        reasons: Array.isArray(row.reasons)
          ? row.reasons
          : (row.reasons ? (typeof row.reasons === 'string' ? JSON.parse(row.reasons) : [row.reasons]) : []),
        checked_at: row.checked_at || ''
      }));

      return res.json({ data: mapped });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch student eligibility' });
    }
  });

  // GET /api/eligibility/check/:studentId/:driveId - Check student eligibility in DB
  app.get('/api/eligibility/check/:studentId/:driveId', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { studentId, driveId } = req.params;
      const { data, error } = await supabaseServerClient
        .from('eligibility_results')
        .select('*')
        .eq('student_id', studentId)
        .eq('drive_id', driveId)
        .maybeSingle();

      if (error) return res.status(400).json({ error: error.message });
      if (!data) return res.json({ status: 'not_evaluated', reasons: [] });

      const reasons = Array.isArray(data.reasons)
        ? data.reasons
        : (data.reasons ? (typeof data.reasons === 'string' ? JSON.parse(data.reasons) : [data.reasons]) : []);

      return res.json({
        status: data.eligible ? 'eligible' : 'ineligible',
        reasons,
        checked_at: data.checked_at || undefined
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to check eligibility' });
    }
  });

  // POST /api/eligibility/save - Save/Upsert batch eligibility records
  app.post('/api/eligibility/save', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { driveId, records = [] } = req.body;
      if (!driveId || !Array.isArray(records)) {
        return res.status(400).json({ error: 'driveId and records array are required' });
      }

      // Check existing rows for the drive
      const { data: existingRows } = await supabaseServerClient
        .from('eligibility_results')
        .select('id, student_id')
        .eq('drive_id', driveId);

      const idMap = new Map((existingRows || []).map((r: any) => [String(r.student_id), String(r.id)]));

      const payload = records.map((r: any) => {
        const existingId = idMap.get(String(r.student_id));
        return {
          id: ensureUUID(existingId),
          student_id: r.student_id,
          drive_id: r.drive_id || driveId,
          eligible: Boolean(r.eligible),
          reasons: r.reasons || [],
          checked_at: r.checked_at || new Date().toISOString()
        };
      });

      const { data, error } = await supabaseServerClient
        .from('eligibility_results')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('[SERVER] Eligibility upsert error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true, data: data || payload });
    } catch (err: any) {
      console.error('[SERVER] Eligibility save exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to save eligibility records' });
    }
  });

  // ==========================================
  // 5. APPLICATIONS API ENDPOINTS
  // ==========================================

  // GET /api/applications - List all applications joined with student and drive details
  app.get('/api/applications', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const [appRes, studentRes, driveRes, compRes] = await Promise.all([
        supabaseServerClient.from('applications').select('*'),
        supabaseServerClient.from('students').select('*'),
        supabaseServerClient.from('placement_drives').select('*'),
        supabaseServerClient.from('companies').select('*')
      ]);

      if (appRes.error) {
        console.error('[SERVER] Applications select error:', appRes.error);
        return res.status(400).json({ error: appRes.error.message });
      }

      const studentMap = new Map<string, any>((studentRes.data || []).map((s: any) => [String(s.id), s]));
      const driveMap = new Map<string, any>((driveRes.data || []).map((d: any) => [String(d.id), d]));
      const companyMap = new Map<string, any>((compRes.data || []).map((c: any) => [String(c.id), c]));

      const applications = (appRes.data || []).map((row: any) => {
        const studentId = String(row.student_id || '');
        const driveId = String(row.drive_id || '');

        const s = studentMap.get(studentId);
        const d = driveMap.get(driveId);
        const c = d ? companyMap.get(String(d.company_id)) : undefined;

        const studentName = s?.full_name || 'Student';
        const studentEnrollment = s?.enrollment_no || '';
        const studentBranch = s?.branch || 'CSE';
        const studentCgpa = parseFloat(String(s?.cgpa ?? 0)) || 0;
        const studentAttendance = parseInt(String(s?.attendance ?? 75), 10) || 75;

        const companyName = c?.company_name || d?.company_name || 'Company';
        const companyLogo = c?.logo || '';
        const role = d?.role || 'Software Engineer';
        const packageLPA = parseFloat(String(d?.package_lpa ?? 0)) || 0;

        const appliedDate = row.applied_at
          ? String(row.applied_at).split('T')[0]
          : new Date().toISOString().split('T')[0];

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
          eligibilityStatus: 'Eligible',
          ineligibilityReasons: [],
          status: row.status || 'Applied',
          currentRound: d?.rounds?.[0] || 'Application Review'
        };
      });

      applications.sort((a: any, b: any) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());

      return res.json({ data: applications });
    } catch (err: any) {
      console.error('[SERVER] Applications query exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to fetch applications' });
    }
  });

  // POST /api/applications - Submit application
  app.post('/api/applications', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const a = req.body || {};
      const appId = ensureUUID(a.id);
      const studentId = a.studentId || a.student_id;
      const driveId = a.driveId || a.drive_id;

      if (!studentId || !driveId) {
        return res.status(400).json({ error: 'studentId and driveId are required' });
      }

      const row = {
        id: appId,
        student_id: studentId,
        drive_id: driveId,
        status: a.status || 'Applied',
        applied_at: a.applied_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseServerClient
        .from('applications')
        .insert([row])
        .select();

      if (error) {
        console.error('[SERVER] Application insert error:', error);
        return res.status(400).json({ error: error.message });
      }

      const inserted = data?.[0] || row;
      const resultApp = {
        ...a,
        id: String(inserted.id),
        studentId: String(inserted.student_id),
        driveId: String(inserted.drive_id),
        status: inserted.status,
        appliedDate: inserted.applied_at ? String(inserted.applied_at).split('T')[0] : new Date().toISOString().split('T')[0]
      };

      return res.status(201).json({ data: resultApp });
    } catch (err: any) {
      console.error('[SERVER] Application insert exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to submit application' });
    }
  });

  // PATCH /api/applications/:id - Update application status
  app.patch('/api/applications/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'status is required' });
      }

      const payload = {
        status,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseServerClient
        .from('applications')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) {
        console.error('[SERVER] Application update error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true, data: data?.[0] });
    } catch (err: any) {
      console.error('[SERVER] Application update exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to update application' });
    }
  });

  // DELETE /api/applications/:id - Delete application
  app.delete('/api/applications/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const { error } = await supabaseServerClient
        .from('applications')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SERVER] Application delete error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[SERVER] Application delete exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete application' });
    }
  });

  // ==========================================
  // 6. OFFERS API ENDPOINTS
  // ==========================================

  // GET /api/offers - List all offers joined with student, drive, company details
  app.get('/api/offers', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const [offersRes, studentRes, compRes, driveRes] = await Promise.all([
        supabaseServerClient.from('offers').select('*'),
        supabaseServerClient.from('students').select('*'),
        supabaseServerClient.from('companies').select('*'),
        supabaseServerClient.from('placement_drives').select('*')
      ]);

      if (offersRes.error) {
        console.error('[SERVER] Offers select error:', offersRes.error);
        return res.status(400).json({ error: offersRes.error.message });
      }

      const studentsMap = new Map<string, any>((studentRes.data || []).map((s: any) => [String(s.id), s]));
      const companiesMap = new Map<string, any>((compRes.data || []).map((c: any) => [String(c.id), c]));
      const drivesMap = new Map<string, any>((driveRes.data || []).map((d: any) => [String(d.id), d]));

      const offers = (offersRes.data || []).map((row: any) => {
        const studentId = String(row.student_id || '');
        const driveId = String(row.drive_id || '');
        const companyId = String(row.company_id || '');

        const s = studentsMap.get(studentId);
        const d = drivesMap.get(driveId);
        const c = companiesMap.get(companyId) || (d ? companiesMap.get(String(d.company_id)) : undefined);

        const studentName = s?.full_name || 'Student';
        const studentEnrollment = s?.enrollment_no || '';
        const studentBranch = s?.branch || 'CSE';

        const companyName = c?.company_name || c?.name || d?.companyName || 'Company';
        const companyLogo = c?.logo || '';
        const role = d?.role || 'Software Engineer';
        const packageLPA = parseFloat(String(row.package_lpa ?? d?.package_lpa ?? 0)) || 0;
        const offerDate = row.offer_date || (row.created_at ? String(row.created_at).split('T')[0] : new Date().toISOString().split('T')[0]);
        const status = row.status || 'Offered';

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
          tier: (packageLPA >= 14 ? 'Super Dream' : packageLPA >= 8 ? 'Dream' : 'Core')
        };
      });

      offers.sort((a: any, b: any) => new Date(b.offerDate).getTime() - new Date(a.offerDate).getTime());

      return res.json({ data: offers });
    } catch (err: any) {
      console.error('[SERVER] Offers query exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to fetch offers' });
    }
  });

  // POST /api/offers - Create new offer
  app.post('/api/offers', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const o = req.body || {};
      const studentId = o.student_id || o.studentId;
      const driveId = o.drive_id || o.driveId;
      const companyId = o.company_id || o.companyId;
      const pkg = parseFloat(String(o.package_lpa ?? o.packageLPA ?? 0)) || 0;
      const status = o.status || 'Offered';
      const offerDate = o.offer_date || o.offerDate || new Date().toISOString().split('T')[0];
      const offerId = ensureUUID(o.id);

      if (!studentId || !driveId || !companyId) {
        return res.status(400).json({ error: 'student_id, drive_id, and company_id are required' });
      }

      // Prevent duplicates
      const { data: existing } = await supabaseServerClient
        .from('offers')
        .select('id, status')
        .eq('student_id', studentId)
        .eq('drive_id', driveId)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'An offer already exists for this student and placement drive.' });
      }

      const row = {
        id: offerId,
        student_id: studentId,
        drive_id: driveId,
        company_id: companyId,
        package_lpa: pkg,
        status: status,
        offer_date: offerDate
      };

      const { data, error } = await supabaseServerClient
        .from('offers')
        .insert([row])
        .select();

      if (error) {
        console.error('[SERVER] Offer insert error:', error);
        return res.status(400).json({ error: error.message });
      }

      // Update student placement status if accepted
      if (status === 'Accepted' && studentId) {
        await supabaseServerClient
          .from('students')
          .update({ placement_status: 'Placed' })
          .eq('id', studentId);
      }

      const inserted = data?.[0] || row;
      const createdOffer = {
        id: String(inserted.id),
        studentId,
        studentName: o.student_name || o.studentName || 'Student',
        studentEnrollment: o.student_enrollment || o.studentEnrollment || '',
        studentBranch: o.student_branch || o.studentBranch || 'CSE',
        driveId,
        companyId,
        companyName: o.company_name || o.companyName || 'Company',
        companyLogo: o.company_logo || o.companyLogo || '',
        role: o.role || 'Software Engineer',
        packageLPA: pkg,
        offerDate,
        status,
        policyCheckPassed: true,
        tier: pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core'
      };

      return res.status(201).json({ data: createdOffer });
    } catch (err: any) {
      console.error('[SERVER] Offer create exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create offer' });
    }
  });

  // PATCH /api/offers/:id - Update offer status
  app.patch('/api/offers/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const { status, package_lpa, offer_date } = req.body;

      const { data: existingOffer } = await supabaseServerClient
        .from('offers')
        .select('id, student_id, status')
        .eq('id', id)
        .maybeSingle();

      const studentId = existingOffer?.student_id;
      const payload: Record<string, any> = {};
      if (status !== undefined) payload.status = status;
      if (package_lpa !== undefined) payload.package_lpa = parseFloat(String(package_lpa)) || 0;
      if (offer_date !== undefined) payload.offer_date = offer_date;

      const { data, error } = await supabaseServerClient
        .from('offers')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) {
        console.error('[SERVER] Offer update error:', error);
        return res.status(400).json({ error: error.message });
      }

      // Handle student placement status update
      if (studentId && status) {
        if (status === 'Accepted') {
          await supabaseServerClient
            .from('students')
            .update({ placement_status: 'Placed' })
            .eq('id', studentId);
        } else if (['Rejected', 'Withdrawn', 'Declined'].includes(status)) {
          const { data: remainingOffers } = await supabaseServerClient
            .from('offers')
            .select('id, status')
            .eq('student_id', studentId)
            .neq('id', id)
            .eq('status', 'Accepted');

          if (!remainingOffers || remainingOffers.length === 0) {
            await supabaseServerClient
              .from('students')
              .update({ placement_status: 'Unplaced' })
              .eq('id', studentId);
          }
        }
      }

      return res.json({ success: true, data: data?.[0] });
    } catch (err: any) {
      console.error('[SERVER] Offer update exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to update offer' });
    }
  });

  // DELETE /api/offers/:id - Delete offer
  app.delete('/api/offers/:id', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id } = req.params;
      const { error } = await supabaseServerClient
        .from('offers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SERVER] Offer delete error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[SERVER] Offer delete exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete offer' });
    }
  });

  // ==========================================
  // 7. AUTH & PROFILES API ENDPOINTS
  // ==========================================

  // POST /api/auth/login - Email/Password login via server Supabase Auth
  app.post('/api/auth/login', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Supabase authentication is not configured on server' });
    }
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { data, error } = await supabaseServerClient.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error || !data?.user) {
        return res.status(401).json({ error: error?.message || 'Invalid credentials' });
      }

      // Fetch profile from public.profiles
      let userProfile = null;
      try {
        const { data: profData } = await supabaseServerClient
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profData) {
          userProfile = {
            id: profData.id,
            email: profData.email,
            role: profData.role || 'student',
            student_id: profData.student_id || null,
            company_id: profData.company_id || null,
            created_at: profData.created_at
          };
        }
      } catch (profErr) {
        console.warn('[SERVER] Could not query profiles table:', profErr);
      }

      return res.json({
        user: data.user,
        session: data.session,
        profile: userProfile
      });
    } catch (err: any) {
      console.error('[SERVER] Auth login exception:', err);
      return res.status(500).json({ error: err?.message || 'Authentication error' });
    }
  });

  // POST /api/auth/logout - Sign out
  app.post('/api/auth/logout', async (req, res) => {
    if (!supabaseServerClient) {
      return res.json({ success: true });
    }
    try {
      await supabaseServerClient.auth.signOut();
      return res.json({ success: true });
    } catch (err: any) {
      return res.json({ success: true });
    }
  });

  // GET /api/auth/profile/:userId - Fetch user profile
  app.get('/api/auth/profile/:userId', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { userId } = req.params;
      const { data, error } = await supabaseServerClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) return res.status(400).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Profile not found' });

      return res.json({
        data: {
          id: data.id,
          email: data.email,
          role: data.role || 'student',
          student_id: data.student_id || null,
          company_id: data.company_id || null,
          created_at: data.created_at
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch profile' });
    }
  });

  // POST /api/auth/profile - Upsert user profile
  app.post('/api/auth/profile', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { id, email, role, student_id, company_id } = req.body;
      if (!id || !email) {
        return res.status(400).json({ error: 'id and email are required' });
      }

      const payload = {
        id,
        email,
        role: role || 'student',
        student_id: student_id || null,
        company_id: company_id || null
      };

      const { data, error } = await supabaseServerClient
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

      if (error) return res.status(400).json({ error: error.message });

      return res.json({ success: true, data: data || payload });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to upsert profile' });
    }
  });

  // ==========================================
  // 8. SYNC ALL & SEED DATA ENDPOINTS
  // ==========================================

  // GET /api/sync/all - Fetch all main tables in parallel
  app.get('/api/sync/all', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const [sRes, cRes, dRes, aRes, oRes] = await Promise.all([
        supabaseServerClient.from('students').select('*').order('full_name', { ascending: true }),
        supabaseServerClient.from('companies').select('*').order('company_name', { ascending: true }),
        supabaseServerClient.from('placement_drives').select('*').order('drive_date', { ascending: false }),
        supabaseServerClient.from('applications').select('*'),
        supabaseServerClient.from('offers').select('*')
      ]);

      const companiesMap = new Map<string, any>((cRes.data || []).map((c: any) => [String(c.id), c]));
      const studentsMap = new Map<string, any>((sRes.data || []).map((s: any) => [String(s.id), s]));
      const drivesMap = new Map<string, any>((dRes.data || []).map((d: any) => [String(d.id), d]));

      // Map students
      const students = (sRes.data || []).map((row: any) => ({
        id: String(row.id),
        name: row.full_name || 'Student',
        enrollmentNumber: row.enrollment_no || '',
        email: row.email || '',
        phone: row.phone || '',
        branch: row.branch || 'CSE',
        cgpa: parseFloat(String(row.cgpa ?? 0)) || 0,
        backlogs: parseInt(String(row.backlogs ?? 0), 10) || 0,
        attendance: parseInt(String(row.attendance ?? 75), 10) || 75,
        placementStatus: row.placement_status || 'Unplaced',
        graduationYear: parseInt(String(row.graduation_year ?? 2026), 10) || 2026,
        skills: Array.isArray(row.skills) ? row.skills : ['React', 'TypeScript', 'Data Structures'],
        gender: row.gender || 'Not Specified',
        offers: []
      }));

      // Map companies
      const companies = (cRes.data || []).map((row: any) => {
        const compName = row.company_name || row.name || 'Company';
        return {
          id: String(row.id),
          name: compName,
          company_name: compName,
          industry: row.industry || 'Technology',
          tier: (row.industry === 'Investment Banking' || row.industry === 'Fintech' ? 'Super Dream' : 'Dream'),
          openDrivesCount: 0,
          averagePackage: 10.0,
          minPackage: 6.0,
          maxPackage: 18.0,
          status: row.status || 'Active',
          website: row.website || '',
          location: row.location || 'Gurugram, India',
          contactPerson: row.contact_person || row.contact_name || '',
          contactEmail: row.contact_email || '',
          contactPhone: row.contact_phone || '',
          totalHiredHistory: 12,
          logo: row.logo || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=128&auto=format&fit=crop&q=80',
          created_at: row.created_at
        };
      });

      // Map drives
      const drives = (dRes.data || []).map((row: any) => {
        const joinedComp = companiesMap.get(String(row.company_id));
        const compName = joinedComp?.company_name || joinedComp?.name || 'Company';
        const compLogo = joinedComp?.logo || '';
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
          companyName: compName,
          companyLogo: compLogo,
          role: row.role || 'Software Engineer',
          jobDescription: '',
          packageLPA: pkg,
          tier: (pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core'),
          minCgpa: parseFloat(String(row.min_cgpa ?? 0)) || 0,
          maxBacklogs: parseInt(String(row.max_backlogs ?? 0), 10) || 0,
          eligibleBranches: branches,
          minAttendance: parseInt(String(row.min_attendance ?? 75), 10) || 75,
          graduationYear: parseInt(String(row.graduation_year ?? 2026), 10) || 2026,
          offer_limit_lpa: row.offer_limit_lpa ? parseFloat(String(row.offer_limit_lpa)) : undefined,
          offerPolicyRule: 'Dream Upgrade Only (>= 1.5x)',
          driveDate: row.drive_date || '',
          registrationDeadline: row.drive_date || '',
          location: 'On-Campus',
          status: row.status || 'Active',
          rounds: ['Online Assessment', 'Technical Interview', 'HR Interview']
        };
      });

      // Map applications
      const applications = (aRes.data || []).map((row: any) => {
        const s = studentsMap.get(String(row.student_id));
        const d = drivesMap.get(String(row.drive_id));
        const c = d ? companiesMap.get(String(d.company_id)) : undefined;

        return {
          id: String(row.id),
          studentId: String(row.student_id || ''),
          studentName: s?.full_name || 'Student',
          studentEnrollment: s?.enrollment_no || '',
          studentBranch: s?.branch || 'CSE',
          studentCgpa: parseFloat(String(s?.cgpa ?? 0)) || 0,
          studentAttendance: parseInt(String(s?.attendance ?? 75), 10) || 75,
          driveId: String(row.drive_id || ''),
          companyName: c?.company_name || d?.company_name || 'Company',
          companyLogo: c?.logo || '',
          role: d?.role || 'Software Engineer',
          packageLPA: parseFloat(String(d?.package_lpa ?? 0)) || 0,
          appliedDate: row.applied_at ? String(row.applied_at).split('T')[0] : new Date().toISOString().split('T')[0],
          eligibilityStatus: 'Eligible',
          ineligibilityReasons: [],
          status: row.status || 'Applied',
          currentRound: d?.rounds?.[0] || 'Application Review'
        };
      });

      // Map offers
      const offers = (oRes.data || []).map((row: any) => {
        const s = studentsMap.get(String(row.student_id));
        const d = drivesMap.get(String(row.drive_id));
        const c = companiesMap.get(String(row.company_id)) || (d ? companiesMap.get(String(d.company_id)) : undefined);
        const pkg = parseFloat(String(row.package_lpa ?? d?.package_lpa ?? 0)) || 0;

        return {
          id: String(row.id),
          studentId: String(row.student_id || ''),
          studentName: s?.full_name || 'Student',
          studentEnrollment: s?.enrollment_no || '',
          studentBranch: s?.branch || 'CSE',
          driveId: String(row.drive_id || ''),
          companyId: String(row.company_id || ''),
          companyName: c?.company_name || c?.name || d?.companyName || 'Company',
          companyLogo: c?.logo || '',
          role: d?.role || 'Software Engineer',
          packageLPA: pkg,
          offerDate: row.offer_date || (row.created_at ? String(row.created_at).split('T')[0] : new Date().toISOString().split('T')[0]),
          status: row.status || 'Offered',
          updateStatus: 'synced',
          policyCheckPassed: true,
          tier: (pkg >= 14 ? 'Super Dream' : pkg >= 8 ? 'Dream' : 'Core')
        };
      });

      return res.json({
        students,
        companies,
        drives,
        applications,
        offers
      });
    } catch (err: any) {
      console.error('[SERVER] Sync all exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to sync database records' });
    }
  });

  // POST /api/sync/seed - Seed initial data
  app.post('/api/sync/seed', async (req, res) => {
    if (!supabaseServerClient) {
      return res.status(503).json({ error: 'Database client not configured on server' });
    }
    try {
      const { students = [], companies = [], drives = [], applications = [], offers = [] } = req.body;

      // Seed companies first
      if (companies.length > 0) {
        const compRows = companies.map((c: any) => ({
          id: ensureUUID(c.id),
          company_name: c.company_name || c.name || 'Company',
          industry: c.industry || 'Technology',
          website: c.website || null,
          contact_name: c.contactPerson || c.contact_person || 'HR',
          contact_person: c.contactPerson || c.contact_person || 'HR',
          contact_email: c.contactEmail || c.contact_email || null,
          contact_phone: c.contactPhone || c.contact_phone || null,
          status: c.status || 'Active'
        }));
        await supabaseServerClient.from('companies').upsert(compRows, { onConflict: 'id' });
      }

      // Seed students
      if (students.length > 0) {
        const studentRows = students.map((s: any) => ({
          id: ensureUUID(s.id),
          full_name: s.full_name || s.name || 'Student',
          enrollment_no: s.enrollment_no || s.enrollmentNumber || 'ENR-001',
          email: s.email || 'student@university.edu',
          branch: s.branch || 'CSE',
          cgpa: parseFloat(String(s.cgpa ?? 0)) || 0,
          backlogs: parseInt(String(s.backlogs ?? 0), 10) || 0,
          attendance: parseInt(String(s.attendance ?? 75), 10) || 75,
          placement_status: s.placement_status || s.placementStatus || 'Unplaced',
          graduation_year: parseInt(String(s.graduation_year ?? s.graduationYear ?? 2026), 10) || 2026
        }));
        await supabaseServerClient.from('students').upsert(studentRows, { onConflict: 'id' });
      }

      // Seed drives
      if (drives.length > 0) {
        const driveRows = drives.map((d: any) => ({
          id: ensureUUID(d.id),
          company_id: ensureUUID(d.companyId || d.company_id),
          role: d.role || 'Software Engineer',
          package_lpa: parseFloat(String(d.packageLPA ?? d.package_lpa ?? 0)) || 0,
          min_cgpa: parseFloat(String(d.minCgpa ?? d.min_cgpa ?? 6.0)) || 6.0,
          max_backlogs: parseInt(String(d.maxBacklogs ?? d.max_backlogs ?? 0), 10) || 0,
          min_attendance: parseInt(String(d.minAttendance ?? d.min_attendance ?? 75), 10) || 75,
          eligible_branches: Array.isArray(d.eligibleBranches || d.eligible_branches) ? (d.eligibleBranches || d.eligible_branches) : ['CSE', 'IT'],
          graduation_year: parseInt(String(d.graduationYear ?? d.graduation_year ?? 2026), 10) || 2026,
          offer_limit_lpa: d.offer_limit_lpa ? parseFloat(String(d.offer_limit_lpa)) : null,
          drive_date: d.driveDate || d.drive_date || new Date().toISOString().split('T')[0],
          status: d.status || 'Active'
        }));
        await supabaseServerClient.from('placement_drives').upsert(driveRows, { onConflict: 'id' });
      }

      return res.json({ success: true, message: 'Initial data seeded successfully' });
    } catch (err: any) {
      console.error('[SERVER] Seed exception:', err);
      return res.status(500).json({ error: err?.message || 'Failed to seed initial data' });
    }
  });

  // ==========================================
  // 9. GEMINI DECISION EXPLANATION CHAT API
  // ==========================================

  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const {
        message,
        studentId,
        driveId,
        clientData
      } = req.body;

      const currentQuestion = (message || '').trim();

      if (!currentQuestion) {
        return res.status(400).json({ error: 'Query message is required.' });
      }

      // Fetch or use placement database records
      let students = clientData?.students || [];
      let drives = clientData?.drives || [];
      let applications = clientData?.applications || [];
      let offers = clientData?.offers || [];
      let companies = clientData?.companies || [];
      let offerPolicy = clientData?.offerPolicy || null;

      // If server Supabase client is connected and client didn't supply records, query Supabase
      if (supabaseServerClient && (!students.length || !drives.length)) {
        try {
          const [sRes, dRes, aRes, oRes, cRes] = await Promise.all([
            supabaseServerClient.from('students').select('*'),
            supabaseServerClient.from('placement_drives').select('*'),
            supabaseServerClient.from('applications').select('*'),
            supabaseServerClient.from('offers').select('*'),
            supabaseServerClient.from('companies').select('*')
          ]);
          if (sRes.data && sRes.data.length > 0) students = sRes.data;
          if (dRes.data && dRes.data.length > 0) drives = dRes.data;
          if (aRes.data && aRes.data.length > 0) applications = aRes.data;
          if (oRes.data && oRes.data.length > 0) offers = oRes.data;
          if (cRes.data && cRes.data.length > 0) companies = cRes.data;
        } catch (dbErr) {
          console.warn('[SERVER] Supabase query notice:', dbErr);
        }
      }

      // Deterministic Query-Routing Layer
      const { questionType, relevantContext } = determineQueryRouteAndContext(currentQuestion, {
        students,
        drives,
        applications,
        offers,
        companies,
        offerPolicy,
        studentId,
        driveId
      });

      console.log('AI QUESTION:', currentQuestion);
      console.log('QUESTION TYPE:', questionType);
      console.log('AI CONTEXT:', relevantContext);

      const systemInstruction = `You are PlaceFlow AI, an assistant for a college Training & Placement Cell.
Answer the user's question using ONLY the supplied placement data.
Never invent placement statistics.
Never change eligibility decisions.
Never change offer-policy decisions.
If the required information is unavailable, say that the information is not available.`;

      const promptContent = `USER QUESTION:
${currentQuestion}

PLACEMENT DATA:
${JSON.stringify(relevantContext, null, 2)}`;

      const ai = getGeminiClient();
      if (!ai) {
        console.error('[SERVER] Gemini API Technical Error: GEMINI_API_KEY environment variable is not configured.');
        return res.status(503).json({
          error: 'PlaceFlow AI is temporarily unavailable. Please try again.',
          response: 'PlaceFlow AI is temporarily unavailable. Please try again.'
        });
      }

      console.log('[SERVER] Calling Gemini API for question:', currentQuestion);

      let responseText = '';
      let usedProvider = 'gemini-3.7-flash';

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: promptContent,
          config: {
            systemInstruction,
            temperature: 0.2
          }
        });
        responseText = response.text || '';
      } catch (geminiError: any) {
        console.warn('[SERVER] Primary model notice, attempting fallback model:', geminiError?.message || geminiError);
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: promptContent,
            config: {
              systemInstruction,
              temperature: 0.2
            }
          });
          responseText = response.text || '';
          usedProvider = 'gemini-flash-latest';
        } catch (secondaryError: any) {
          console.error('[SERVER] Gemini API Technical Error:', secondaryError?.message || secondaryError);
          return res.status(503).json({
            error: 'PlaceFlow AI is temporarily unavailable. Please try again.',
            response: 'PlaceFlow AI is temporarily unavailable. Please try again.'
          });
        }
      }

      if (!responseText.trim()) {
        return res.status(503).json({
          error: 'PlaceFlow AI is temporarily unavailable. Please try again.',
          response: 'PlaceFlow AI is temporarily unavailable. Please try again.'
        });
      }

      return res.json({
        response: responseText.trim(),
        provider: usedProvider,
        questionType,
        status: 'ok'
      });
    } catch (err: any) {
      console.error('[SERVER] Internal Server Technical Error in /api/gemini/chat:', err?.message || err);
      return res.status(503).json({
        error: 'PlaceFlow AI is temporarily unavailable. Please try again.',
        response: 'PlaceFlow AI is temporarily unavailable. Please try again.'
      });
    }
  });

  // Vite middleware for development & SPA static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PlaceFlow Full-Stack Server running on http://localhost:${PORT}`);
  });
}

/**
 * Deterministic Query-Routing Layer
 * Classifies the current placement query and extracts targeted structured Supabase data
 */
function determineQueryRouteAndContext(
  currentQuestion: string,
  data: {
    students: any[];
    drives: any[];
    applications: any[];
    offers: any[];
    companies: any[];
    offerPolicy?: any;
    studentId?: string;
    driveId?: string;
  }
): { questionType: string; relevantContext: Record<string, any> } {
  const q = (currentQuestion || '').toLowerCase();
  const { students = [], drives = [], applications = [], offers = [], companies = [], studentId, driveId } = data;

  const selectedStudent = students.find((s: any) => s.id === studentId);
  const selectedDrive = drives.find((d: any) => d.id === driveId);

  const isPlaced = (s: any) => {
    const status = (s.placement_status || s.placementStatus || '').toLowerCase();
    return status === 'placed' || status === 'dream placed' || (Array.isArray(s.offers) && s.offers.length > 0);
  };

  const getStudentOfferInfo = (s: any) => {
    if (Array.isArray(s.offers) && s.offers.length > 0) {
      const off = s.offers[0];
      return {
        company: off.companyName || off.company_name || 'Accepted Company',
        role: off.role || 'Engineer',
        packageLPA: off.packageLPA || off.package_lpa || 0
      };
    }
    const matchedOffer = offers.find((o: any) => o.student_id === s.id || o.studentId === s.id);
    if (matchedOffer) {
      return {
        company: matchedOffer.company_name || matchedOffer.companyName,
        role: matchedOffer.role,
        packageLPA: matchedOffer.package_lpa || matchedOffer.packageLPA
      };
    }
    return null;
  };

  // 1. UNPLACED STUDENTS QUESTION
  if (
    q.includes('unplaced') ||
    q.includes('not placed') ||
    q.includes('pending placement') ||
    q.includes('students unplaced')
  ) {
    const unplacedStudents = students.filter(s => !isPlaced(s));
    const totalStudents = students.length;
    const totalUnplaced = unplacedStudents.length;

    return {
      questionType: 'unplaced_students',
      relevantContext: {
        totalStudents,
        totalUnplaced,
        unplacedPercentage: totalStudents > 0 ? `${((totalUnplaced / totalStudents) * 100).toFixed(1)}%` : '0%',
        unplacedStudents: unplacedStudents.map(s => ({
          name: s.name || s.full_name,
          enrollmentNumber: s.enrollment_number || s.enrollmentNumber || s.enrollment_no,
          branch: s.branch,
          cgpa: s.cgpa,
          backlogs: s.backlogs,
          attendance: s.attendance,
          skills: s.skills || []
        }))
      }
    };
  }

  // 2. PLACED STUDENTS QUESTION
  if (
    (q.includes('placed') && !q.includes('rate') && !q.includes('percentage') && !q.includes('branch')) ||
    q.includes('how many students are placed') ||
    q.includes('placed students') ||
    q.includes('total placed')
  ) {
    const placedStudents = students.filter(s => isPlaced(s));
    const totalStudents = students.length;
    const totalPlaced = placedStudents.length;

    return {
      questionType: 'placed_students',
      relevantContext: {
        totalStudents,
        totalPlaced,
        placementPercentage: totalStudents > 0 ? `${((totalPlaced / totalStudents) * 100).toFixed(1)}%` : '0%',
        placedStudentsList: placedStudents.map(s => {
          const offerInfo = getStudentOfferInfo(s);
          return {
            name: s.name || s.full_name,
            enrollmentNumber: s.enrollment_number || s.enrollmentNumber || s.enrollment_no,
            branch: s.branch,
            cgpa: s.cgpa,
            placementStatus: s.placement_status || s.placementStatus,
            company: offerInfo?.company || 'Recruiting Partner',
            packageLPA: offerInfo?.packageLPA || 0
          };
        })
      }
    };
  }

  // 3. HIGHEST PACKAGE / TOP PAYING COMPANY
  if (
    q.includes('highest package') ||
    q.includes('highest salary') ||
    q.includes('top package') ||
    q.includes('max package') ||
    q.includes('maximum package') ||
    q.includes('highest ctc') ||
    q.includes('best package') ||
    (q.includes('highest') && (q.includes('company') || q.includes('offer') || q.includes('drive')))
  ) {
    const sortedDrives = [...drives].sort((a, b) => {
      const pkgA = a.package_lpa ?? a.packageLPA ?? 0;
      const pkgB = b.package_lpa ?? b.packageLPA ?? 0;
      return pkgB - pkgA;
    });

    const topDrive = sortedDrives[0] || null;

    const sortedOffers = [...offers].sort((a, b) => {
      const pkgA = a.package_lpa ?? a.packageLPA ?? 0;
      const pkgB = b.package_lpa ?? b.packageLPA ?? 0;
      return pkgB - pkgA;
    });

    const topOffer = sortedOffers[0] || null;

    return {
      questionType: 'highest_package_company',
      relevantContext: {
        highestPackageDrive: topDrive ? {
          companyName: topDrive.company_name || topDrive.companyName,
          role: topDrive.role,
          packageLPA: topDrive.package_lpa ?? topDrive.packageLPA,
          tier: topDrive.tier,
          minCgpa: topDrive.min_cgpa ?? topDrive.minCgpa,
          eligibleBranches: topDrive.eligible_branches || topDrive.eligibleBranches
        } : null,
        highestAcceptedOffer: topOffer ? {
          studentName: topOffer.student_name || topOffer.studentName,
          companyName: topOffer.company_name || topOffer.companyName,
          role: topOffer.role,
          packageLPA: topOffer.package_lpa ?? topOffer.packageLPA,
          status: topOffer.status
        } : null,
        allDrivesByPackage: sortedDrives.map(d => ({
          companyName: d.company_name || d.companyName,
          role: d.role,
          packageLPA: d.package_lpa ?? d.packageLPA,
          tier: d.tier
        }))
      }
    };
  }

  // 4. BRANCH-WISE STATISTICS / PLACEMENT RATE BY BRANCH
  if (
    q.includes('branch') ||
    q.includes('placement rate') ||
    q.includes('percentage') ||
    q.includes('stream') ||
    q.includes('department') ||
    q.includes('branchwise')
  ) {
    const branches = ['CSE', 'IT', 'ECE', 'EE'];
    const branchStats = branches.map(b => {
      const inBranch = students.filter(s => (s.branch || '').toUpperCase() === b);
      const placedInBranch = inBranch.filter(s => isPlaced(s));
      const total = inBranch.length;
      const placed = placedInBranch.length;
      const unplaced = total - placed;
      const rateNumber = total > 0 ? (placed / total) * 100 : 0;
      const avgCgpa = total > 0 ? (inBranch.reduce((acc, s) => acc + (s.cgpa || 0), 0) / total).toFixed(2) : '0.00';

      return {
        branch: b,
        totalStudents: total,
        placedCount: placed,
        unplacedCount: unplaced,
        placementRate: `${rateNumber.toFixed(1)}%`,
        placementRateNumber: rateNumber,
        averageCgpa: avgCgpa
      };
    });

    const sortedByRate = [...branchStats].sort((a, b) => b.placementRateNumber - a.placementRateNumber);
    const highestBranch = sortedByRate[0];
    const lowestBranch = sortedByRate[sortedByRate.length - 1];

    return {
      questionType: 'branch_placement_statistics',
      relevantContext: {
        branchStats: branchStats.map(({ placementRateNumber, ...rest }) => rest),
        highestPlacementBranch: highestBranch ? {
          branch: highestBranch.branch,
          placementRate: highestBranch.placementRate,
          placedCount: highestBranch.placedCount,
          totalStudents: highestBranch.totalStudents
        } : null,
        lowestPlacementBranch: lowestBranch ? {
          branch: lowestBranch.branch,
          placementRate: lowestBranch.placementRate,
          placedCount: lowestBranch.placedCount,
          totalStudents: lowestBranch.totalStudents
        } : null,
        totalInstitutionalStudents: students.length,
        totalInstitutionalPlaced: students.filter(s => isPlaced(s)).length
      }
    };
  }

  // 5. DRIVE ELIGIBILITY COUNT
  if (
    (q.includes('eligible') || q.includes('eligibility')) &&
    !q.includes('why') &&
    (q.includes('how many') || q.includes('count') || q.includes('who') || q.includes('for'))
  ) {
    const matchedDrive = drives.find(d => {
      const name = (d.company_name || d.companyName || '').toLowerCase();
      return name && q.includes(name);
    }) || selectedDrive || drives[0];

    if (matchedDrive) {
      const minCgpa = matchedDrive.min_cgpa ?? matchedDrive.minCgpa ?? 6.0;
      const maxBacklogs = matchedDrive.max_backlogs ?? matchedDrive.maxBacklogs ?? 0;
      const minAtt = matchedDrive.min_attendance ?? matchedDrive.minAttendance ?? 75;
      const branches = (matchedDrive.eligible_branches || matchedDrive.eligibleBranches || ['CSE', 'IT']).map((b: string) => b.toUpperCase());

      const eligibleList: any[] = [];
      const ineligibleList: any[] = [];

      students.forEach(s => {
        const studentBranch = (s.branch || '').toUpperCase();
        const studentCgpa = s.cgpa ?? 0;
        const studentBacklogs = s.backlogs ?? 0;
        const studentAtt = s.attendance ?? 0;

        const reasons: string[] = [];
        if (studentBacklogs > maxBacklogs) reasons.push(`Backlogs: ${studentBacklogs} (Max allowed: ${maxBacklogs})`);
        if (studentCgpa < minCgpa) reasons.push(`CGPA: ${studentCgpa.toFixed(2)} (Min required: ${minCgpa.toFixed(2)})`);
        if (studentAtt < minAtt) reasons.push(`Attendance: ${studentAtt}% (Min required: ${minAtt}%)`);
        if (branches.length > 0 && !branches.includes(studentBranch)) reasons.push(`Branch: ${studentBranch} (Eligible: ${branches.join(', ')})`);

        if (reasons.length === 0) {
          eligibleList.push({
            name: s.name || s.full_name,
            enrollmentNumber: s.enrollment_number || s.enrollmentNumber || s.enrollment_no,
            branch: s.branch,
            cgpa: s.cgpa,
            backlogs: s.backlogs,
            attendance: s.attendance
          });
        } else {
          ineligibleList.push({
            name: s.name || s.full_name,
            branch: s.branch,
            reasons
          });
        }
      });

      return {
        questionType: 'drive_eligibility_count',
        relevantContext: {
          targetDrive: {
            companyName: matchedDrive.company_name || matchedDrive.companyName,
            role: matchedDrive.role,
            packageLPA: matchedDrive.package_lpa ?? matchedDrive.packageLPA,
            tier: matchedDrive.tier,
            criteria: {
              minCgpa,
              maxBacklogs,
              minAttendance: minAtt,
              eligibleBranches: branches
            }
          },
          totalStudentsEvaluated: students.length,
          totalEligible: eligibleList.length,
          totalIneligible: ineligibleList.length,
          eligibleStudents: eligibleList,
          ineligibleStudentsSample: ineligibleList.slice(0, 8)
        }
      };
    }
  }

  // 6. STUDENT INELIGIBILITY EXPLANATION
  if (
    q.includes('why') ||
    q.includes('ineligible') ||
    q.includes('rejected') ||
    q.includes('block') ||
    q.includes('reason') ||
    q.includes('policy') ||
    q.includes('criteria mismatch')
  ) {
    const targetStudent = students.find(s => {
      const name = (s.name || s.full_name || '').toLowerCase();
      const first = name.split(' ')[0];
      const enroll = (s.enrollment_number || s.enrollmentNumber || s.enrollment_no || '').toLowerCase();
      return (name && q.includes(name)) || (first && first.length > 2 && q.includes(first)) || (enroll && q.includes(enroll));
    }) || selectedStudent || students[0];

    const targetDrive = drives.find(d => {
      const name = (d.company_name || d.companyName || '').toLowerCase();
      return name && q.includes(name);
    }) || selectedDrive || drives[0];

    if (targetStudent && targetDrive) {
      const minCgpa = targetDrive.min_cgpa ?? targetDrive.minCgpa ?? 6.0;
      const maxBacklogs = targetDrive.max_backlogs ?? targetDrive.maxBacklogs ?? 0;
      const minAtt = targetDrive.min_attendance ?? targetDrive.minAttendance ?? 75;
      const branches = (targetDrive.eligible_branches || targetDrive.eligibleBranches || ['CSE', 'IT']).map((b: string) => b.toUpperCase());

      const studentBranch = (targetStudent.branch || '').toUpperCase();
      const studentCgpa = targetStudent.cgpa ?? 0;
      const studentBacklogs = targetStudent.backlogs ?? 0;
      const studentAtt = targetStudent.attendance ?? 0;

      const reasons: string[] = [];
      if (studentBacklogs > maxBacklogs) {
        if (studentBacklogs === 1 && maxBacklogs === 0) {
          reasons.push('You have one backlog while this company allows zero backlogs.');
        } else {
          reasons.push(`You have ${studentBacklogs} active backlogs while this company allows a maximum of ${maxBacklogs}.`);
        }
      }
      if (studentCgpa < minCgpa) {
        reasons.push(`Your CGPA (${studentCgpa.toFixed(2)}) is below the required minimum of ${minCgpa.toFixed(2)}.`);
      }
      if (studentAtt < minAtt) {
        reasons.push(`Your attendance (${studentAtt}%) is below the minimum required (${minAtt}%).`);
      }
      if (branches.length > 0 && !branches.includes(studentBranch)) {
        reasons.push(`Your branch (${studentBranch}) is not among the eligible branches (${branches.join(', ')}).`);
      }

      const studentOffers = offers.filter(o => o.student_id === targetStudent.id || o.studentId === targetStudent.id);
      let policyBlockReason: string | null = null;

      if (studentOffers.length > 0) {
        const topOffer = studentOffers[0];
        const offerPkg = topOffer.package_lpa ?? topOffer.packageLPA ?? 0;
        const offerComp = topOffer.company_name || topOffer.companyName || 'an existing company';
        const drivePkg = targetDrive.package_lpa ?? targetDrive.packageLPA ?? 0;
        const policyRule = targetDrive.offer_policy_rule || targetDrive.offerPolicyRule || 'Dream Upgrade (1.5x CTC)';

        if (drivePkg < offerPkg * 1.5) {
          policyBlockReason = `Student already holds a placement offer from ${offerComp} with a CTC of ₹${offerPkg} LPA. Under the institutional "${policyRule}" rule, candidates can only apply for drives offering at least 1.5× their current package (₹${(offerPkg * 1.5).toFixed(2)} LPA). ${targetDrive.company_name || targetDrive.companyName} offers ₹${drivePkg} LPA.`;
        }
      }

      const recordedApp = applications.find(a =>
        (a.student_id === targetStudent.id || a.studentId === targetStudent.id) &&
        (a.drive_id === targetDrive.id || a.driveId === targetDrive.id)
      );

      return {
        questionType: 'student_ineligibility_explanation',
        relevantContext: {
          student: {
            name: targetStudent.name || targetStudent.full_name,
            enrollmentNumber: targetStudent.enrollment_number || targetStudent.enrollmentNumber || targetStudent.enrollment_no,
            branch: targetStudent.branch,
            cgpa: targetStudent.cgpa,
            backlogs: targetStudent.backlogs,
            attendance: targetStudent.attendance,
            placementStatus: targetStudent.placement_status || targetStudent.placementStatus,
            existingOffers: studentOffers.map(o => ({
              companyName: o.company_name || o.companyName,
              packageLPA: o.package_lpa ?? o.packageLPA,
              status: o.status
            }))
          },
          targetDrive: {
            companyName: targetDrive.company_name || targetDrive.companyName,
            role: targetDrive.role,
            packageLPA: targetDrive.package_lpa ?? targetDrive.packageLPA,
            tier: targetDrive.tier,
            minCgpa,
            maxBacklogs,
            minAttendance: minAtt,
            eligibleBranches: branches,
            offerPolicyRule: targetDrive.offer_policy_rule || targetDrive.offerPolicyRule
          },
          isEligible: reasons.length === 0 && policyBlockReason === null,
          storedIneligibilityReasons: reasons,
          offerPolicyStatus: policyBlockReason ? { isBlocked: true, reason: policyBlockReason } : { isBlocked: false },
          recordedApplication: recordedApp ? {
            status: recordedApp.status,
            eligibilityStatus: recordedApp.eligibility_status || recordedApp.eligibilityStatus,
            ineligibilityReasons: recordedApp.ineligibility_reasons || recordedApp.ineligibilityReasons
          } : null
        }
      };
    }
  }

  // 7. GENERAL PLACEMENT OVERVIEW (Fallback Context)
  const placedList = students.filter(s => isPlaced(s));
  const unplacedList = students.filter(s => !isPlaced(s));

  return {
    questionType: 'general_placement_overview',
    relevantContext: {
      totalStudents: students.length,
      totalPlaced: placedList.length,
      totalUnplaced: unplacedList.length,
      totalActiveDrives: drives.length,
      totalOffers: offers.length,
      activeStudentContext: selectedStudent ? {
        name: selectedStudent.name || selectedStudent.full_name,
        branch: selectedStudent.branch,
        cgpa: selectedStudent.cgpa,
        backlogs: selectedStudent.backlogs,
        attendance: selectedStudent.attendance,
        placementStatus: selectedStudent.placement_status || selectedStudent.placementStatus
      } : null,
      activeDriveContext: selectedDrive ? {
        companyName: selectedDrive.company_name || selectedDrive.companyName,
        role: selectedDrive.role,
        packageLPA: selectedDrive.package_lpa ?? selectedDrive.packageLPA,
        minCgpa: selectedDrive.min_cgpa ?? selectedDrive.minCgpa
      } : null,
      drivesSummary: drives.map(d => ({
        companyName: d.company_name || d.companyName,
        role: d.role,
        packageLPA: d.package_lpa ?? d.packageLPA
      }))
    }
  };
}

startServer();
