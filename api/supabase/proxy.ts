const DEFAULT_SUPABASE_URL = 'https://plwslckyaxdkjultrlca.supabase.co';
const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseUrl = rawSupabaseUrl.includes('plwsickyaxdkjultrlca')
  ? rawSupabaseUrl.replace('plwsickyaxdkjultrlca', 'plwslckyaxdkjultrlca')
  : rawSupabaseUrl;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { targetUrl: rawTargetUrl, method = 'GET', headers = {}, body } = req.body || {};
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
}
