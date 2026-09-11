import express from 'express';
import path from 'path';
import dns from 'dns';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

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

// Initialize Supabase Client on server if configured
const DEFAULT_SUPABASE_URL = 'https://plwslckyaxdkjultrlca.supabase.co';
const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseUrl = rawSupabaseUrl.includes('plwsickyaxdkjultrlca')
  ? rawSupabaseUrl.replace('plwsickyaxdkjultrlca', 'plwslckyaxdkjultrlca')
  : rawSupabaseUrl;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServerClient = (supabaseUrl && supabaseAnonKey && supabaseAnonKey.length > 15)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      supabaseConfigured: Boolean(supabaseServerClient)
    });
  });

  // Supabase Network & DNS Reachability Diagnostic API
  app.post('/api/supabase/diagnose', async (req, res) => {
    try {
      const rawUrl = (req.body?.url || supabaseUrl || '').trim();
      const rawKey = (req.body?.anonKey || supabaseAnonKey || '').trim();

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
      const restEndpoint = `${cleanUrl}/rest/v1/students?select=id&limit=1`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let resp = await fetch(restEndpoint, {
          method: 'GET',
          headers: {
            apikey: rawKey,
            Authorization: `Bearer ${rawKey}`,
            'User-Agent': 'PlaceFlow-Diagnostic/1.0'
          },
          signal: controller.signal
        });

        if (resp.status === 404) {
          resp = await fetch(`${cleanUrl}/rest/v1/`, {
            method: 'GET',
            headers: {
              apikey: rawKey,
              Authorization: `Bearer ${rawKey}`,
              'User-Agent': 'PlaceFlow-Diagnostic/1.0'
            },
            signal: controller.signal
          });
        }
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

  // Supabase Resilient Server-Side Proxy Endpoint
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
      // Filter safe headers
      for (const [k, v] of Object.entries(headers)) {
        const lower = k.toLowerCase();
        if (['apikey', 'authorization', 'content-type', 'prefer', 'range', 'accept'].includes(lower)) {
          forwardHeaders[k] = String(v);
        }
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
          // If the upstream returned HTML error page (e.g. 502/503 from paused Supabase project),
          // format it as a valid JSON error so client JSON parsers do not throw unexpected token '<'
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

  // Gemini Decision Explanation Chat API
  app.post('/api/gemini/chat', async (req, res) => {
    console.log("AI route called");
    try {
      const {
        question: bodyQuestion,
        message,
        history = [],
        studentId,
        driveId,
        clientData
      } = req.body || {};

      const currentQuestion = (bodyQuestion || message || '').trim();
      console.log("Question received:", currentQuestion);

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

      // If server Supabase client is connected and client didn't supply records, query Supabase with safety timeout
      if (supabaseServerClient && (!students.length || !drives.length)) {
        try {
          const fetchPromise = Promise.all([
            supabaseServerClient.from('students').select('*'),
            supabaseServerClient.from('placement_drives').select('*'),
            supabaseServerClient.from('applications').select('*'),
            supabaseServerClient.from('offers').select('*'),
            supabaseServerClient.from('companies').select('*')
          ]);
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
          const dbResults = await Promise.race([fetchPromise, timeoutPromise]);
          if (dbResults && Array.isArray(dbResults)) {
            const [sRes, dRes, aRes, oRes, cRes] = dbResults;
            if (sRes.data && sRes.data.length > 0) students = sRes.data;
            if (dRes.data && dRes.data.length > 0) drives = dRes.data;
            if (aRes.data && aRes.data.length > 0) applications = aRes.data;
            if (oRes.data && oRes.data.length > 0) offers = oRes.data;
            if (cRes.data && cRes.data.length > 0) companies = cRes.data;
          }
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

      // Required Debug Console Logs
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
        const keyErr = new Error('GEMINI_API_KEY environment variable is not configured.');
        console.error("Gemini route error:", keyErr);
        return res.status(503).json({
          error: 'PlaceFlow AI is temporarily unavailable. Please try again.',
          response: 'PlaceFlow AI is temporarily unavailable. Please try again.',
          text: 'PlaceFlow AI is temporarily unavailable. Please try again.'
        });
      }

      console.log("Gemini request starting");

      const CANDIDATE_MODELS = [
        'gemini-3.6-flash',
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-3.1-flash-lite'
      ];

      let responseText = '';
      let usedProvider = 'gemini-3.6-flash';

      for (const modelName of CANDIDATE_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: promptContent,
            config: {
              systemInstruction,
              temperature: 0.2
            }
          });
          if (response?.text) {
            responseText = response.text;
            usedProvider = modelName;
            console.log("Gemini request completed");
            console.log(`[SERVER] Gemini response successfully received via ${modelName}`);
            break;
          }
        } catch (geminiError: any) {
          console.log(`[SERVER] Model ${modelName} transient load notice, trying next candidate model...`);
        }
      }

      if (!responseText.trim()) {
        const emptyErr = new Error('All Gemini candidate models failed to return a response.');
        console.error("Gemini route error:", emptyErr);
        return res.status(503).json({
          error: 'PlaceFlow AI is temporarily unavailable. Please try again.',
          response: 'PlaceFlow AI is temporarily unavailable. Please try again.',
          text: 'PlaceFlow AI is temporarily unavailable. Please try again.'
        });
      }

      return res.json({
        response: responseText.trim(),
        text: responseText.trim(),
        provider: usedProvider,
        questionType,
        status: 'ok'
      });
    } catch (err: any) {
      console.error("Gemini route error:", err);
      return res.status(503).json({
        error: 'PlaceFlow AI is temporarily unavailable. Please try again.',
        response: 'PlaceFlow AI is temporarily unavailable. Please try again.',
        text: 'PlaceFlow AI is temporarily unavailable. Please try again.'
      });
    }
  });

  // Vite middleware for development
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
    console.log(`PlaceFlow Full-Stack Server running on port ${PORT}`);
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
  const { students = [], drives = [], applications = [], offers = [], companies = [], offerPolicy = null, studentId, driveId } = data;

  // Active student and drive context
  const selectedStudent = students.find((s: any) => s.id === studentId);
  const selectedDrive = drives.find((d: any) => d.id === driveId);

  // Helper to test if a student is placed
  const isPlaced = (s: any) => {
    const status = (s.placement_status || s.placementStatus || '').toLowerCase();
    return status === 'placed' || status === 'dream placed' || (Array.isArray(s.offers) && s.offers.length > 0);
  };

  // Helper to extract student offer company & package
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
          name: s.name,
          enrollmentNumber: s.enrollment_number || s.enrollmentNumber,
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
            name: s.name,
            enrollmentNumber: s.enrollment_number || s.enrollmentNumber,
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

  // 5. DRIVE ELIGIBILITY COUNT (e.g. "How many students are eligible for Microsoft?")
  if (
    (q.includes('eligible') || q.includes('eligibility')) &&
    !q.includes('why') &&
    (q.includes('how many') || q.includes('count') || q.includes('who') || q.includes('for'))
  ) {
    // Find target drive mentioned in query or use selected drive
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
            name: s.name,
            enrollmentNumber: s.enrollment_number || s.enrollmentNumber,
            branch: s.branch,
            cgpa: s.cgpa,
            backlogs: s.backlogs,
            attendance: s.attendance
          });
        } else {
          ineligibleList.push({
            name: s.name,
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

  // 6. STUDENT INELIGIBILITY / ELIGIBILITY / OFFER-POLICY EXPLANATION (e.g. "Why is Rahul not eligible for Microsoft?", "Why am I not eligible?")
  if (
    q.includes('why') ||
    q.includes('ineligible') ||
    q.includes('rejected') ||
    q.includes('block') ||
    q.includes('reason') ||
    q.includes('policy') ||
    q.includes('criteria mismatch')
  ) {
    // Find target student from query or context
    const targetStudent = students.find(s => {
      const name = (s.name || '').toLowerCase();
      const first = name.split(' ')[0];
      const enroll = (s.enrollment_number || s.enrollmentNumber || '').toLowerCase();
      return (name && q.includes(name)) || (first && first.length > 2 && q.includes(first)) || (enroll && q.includes(enroll));
    }) || selectedStudent || students[0];

    // Find target drive from query or context
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

      // Check existing offer holdings and offer policy rule
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

      // Check for any recorded applications
      const recordedApp = applications.find(a =>
        (a.student_id === targetStudent.id || a.studentId === targetStudent.id) &&
        (a.drive_id === targetDrive.id || a.driveId === targetDrive.id)
      );

      return {
        questionType: 'student_ineligibility_explanation',
        relevantContext: {
          student: {
            name: targetStudent.name,
            enrollmentNumber: targetStudent.enrollment_number || targetStudent.enrollmentNumber,
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

  // 7. DRIVE REQUIREMENTS & CRITERIA INQUIRY
  if (
    q.includes('requirement') ||
    q.includes('criteria') ||
    q.includes('minimum') ||
    q.includes('cutoff') ||
    q.includes('drives') ||
    q.includes('companies')
  ) {
    const matchedDrive = drives.find(d => {
      const name = (d.company_name || d.companyName || '').toLowerCase();
      return name && q.includes(name);
    });

    return {
      questionType: 'drive_requirements',
      relevantContext: {
        targetDrive: matchedDrive ? {
          companyName: matchedDrive.company_name || matchedDrive.companyName,
          role: matchedDrive.role,
          packageLPA: matchedDrive.package_lpa ?? matchedDrive.packageLPA,
          tier: matchedDrive.tier,
          minCgpa: matchedDrive.min_cgpa ?? matchedDrive.minCgpa,
          maxBacklogs: matchedDrive.max_backlogs ?? matchedDrive.maxBacklogs,
          minAttendance: matchedDrive.min_attendance ?? matchedDrive.minAttendance,
          eligibleBranches: matchedDrive.eligible_branches || matchedDrive.eligibleBranches
        } : null,
        allActiveDrives: drives.map(d => ({
          companyName: d.company_name || d.companyName,
          role: d.role,
          packageLPA: d.package_lpa ?? d.packageLPA,
          tier: d.tier,
          minCgpa: d.min_cgpa ?? d.minCgpa,
          maxBacklogs: d.max_backlogs ?? d.maxBacklogs,
          minAttendance: d.min_attendance ?? d.minAttendance,
          eligibleBranches: d.eligible_branches || d.eligibleBranches
        }))
      }
    };
  }

  // 8. GENERAL PLACEMENT OVERVIEW (Fallback Context)
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
        name: selectedStudent.name,
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
