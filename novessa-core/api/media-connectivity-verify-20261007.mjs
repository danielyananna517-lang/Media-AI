import { requestMedia } from '../src/mediaClient.mjs';

const PROBE = 'novessa-core-media-verify-20261007-7f3c9a21';

export default async function handler(req, res) {
  const method = String(req?.method || 'GET').toUpperCase();
  const url = new URL(req?.url || 'https://probe.invalid/');
  const probe = url.searchParams.get('probe') || String(req?.query?.probe || '');

  if (method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed', method });
    return;
  }
  if (probe !== PROBE) {
    res.status(404).json({ ok: false, error: 'not_found' });
    return;
  }

  const result = await requestMedia({
    operation: 'chat',
    input: { message: 'Connectivity verification: reply only with OK.' },
    requestId: 'probe-20261007-7f3c9a21'
  });

  res.status(200).json({
    ok: result?.status === 'success',
    core_to_media_ai_status: result?.status || null,
    media_ai: result
  });
}
