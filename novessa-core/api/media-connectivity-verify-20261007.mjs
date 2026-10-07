import { requestMedia } from '../src/mediaClient.mjs';

const PROBE = 'novessa-core-media-verify-20261007-7f3c9a21';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  if (String(req.query?.probe || '') !== PROBE) {
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
