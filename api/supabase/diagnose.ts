import dns from 'dns';

const DEFAULT_SUPABASE_URL = 'https://plwslckyaxdkjultrlca.supabase.co';
const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseUrl = rawSupabaseUrl.includes('plwsickyaxdkjultrlca')
  ? rawSupabaseUrl.replace('plwsickyaxdkjultrlca', 'plwslckyaxdkjultrlca')
  : rawSupabaseUrl;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Only diagnose the server-configured Supabase environment
    const rawUrl = (supabaseUrl || '').trim();
    const rawKey = (supabaseAnonKey || '').trim();

    if (!rawUrl || !rawKey) {
      return res.status(200).json({
        success: false,
        reachable: false,
        errorType: 'MISSING_CREDENTIALS',
        message: 'Supabase URL or Anon Key is missing in request.'
      });
    }

    let cleanUrl = rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(cleanUrl);
    } catch (e: any) {
      return res.status(200).json({
        success: false,
        reachable: false,
        errorType: 'INVALID_URL_FORMAT',
        message: `Invalid URL format: ${rawUrl}`
      });
    }

    const hostname = parsed.hostname;

    let resolvedIp = '';
    try {
      const lookupResult = await dns.promises.lookup(hostname);
      resolvedIp = lookupResult.address;
    } catch (dnsErr: any) {
      const isNotFound = dnsErr?.code === 'ENOTFOUND' || dnsErr?.code === 'EAI_AGAIN';
      return res.status(200).json({
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

      // If students table is not accessible or doesn't exist, check root
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
        return res.status(200).json({
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

      return res.status(200).json({
        success: true,
        reachable: true,
        dnsResolved: true,
        resolvedIp,
        httpStatus: resp.status,
        message: `Successfully connected to Supabase endpoint (${hostname}).`
      });
    } catch (httpErr: any) {
      return res.status(200).json({
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
}
