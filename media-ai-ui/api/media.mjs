import crypto from 'node:crypto';

function sign(secret, timestamp, requestId, body) {
  return crypto.createHmac('sha256', secret)
    .update(timestamp + ':' + requestId + ':' + body)
    .digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ status: 'error', error: 'method_not_allowed' });
  }

  const base = String(process.env.MEDIA_AI_BASE_URL || '').trim().replace(/\/$/, '');
  const secret = String(process.env.MEDIA_API_SECRET || '');

  if (!base || !secret) {
    return res.status(503).json({
      status: 'provider_unavailable',
      error: 'media_ai_not_configured'
    });
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ status: 'error', error: 'invalid_json' });
  }

  const operation = String(payload?.operation || '');
  const input = payload?.input ?? {};
  if (!operation) {
    return res.status(400).json({ status: 'input_incomplete', error: 'operation_required' });
  }

  const requestId = 'ui-' + crypto.randomUUID();
  const timestamp = String(Date.now());
  const body = JSON.stringify({ operation, input });

  try {
    const upstream = await fetch(base + '/v1/media/request', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Media-Signature': sign(secret, timestamp, requestId, body),
        'X-Media-Timestamp': timestamp,
        'X-Media-Service-Id': 'media-ai-internal',
        'X-Media-Request-Id': requestId
      },
      body
    });

    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); }
    catch { data = { status: 'error', error: 'media_ai_invalid_json', http_status: upstream.status }; }

    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch {
    return res.status(503).json({ status: 'provider_unavailable', error: 'media_ai_unreachable' });
  }
}
