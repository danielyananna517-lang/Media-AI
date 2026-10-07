import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const parts = Array.from({length:15}, (_,i) => readFileSync(`core-part-${String(i+1).padStart(2,'0')}.txt`, 'utf8')).join('');
writeFileSync('core.tar.gz', Buffer.from(parts, 'base64'));
execFileSync('tar', ['-xzf', 'core.tar.gz', '--strip-components=1'], {stdio:'inherit'});

const mediaPath = 'src/mediaClient.mjs';
const media = `import crypto from 'node:crypto';
import { STATUS, result } from './status.mjs';
import { validateGatewayUrl } from './connectors/config.mjs';

function signature(secret, timestamp, requestId, body) {
  const payload = timestamp + ':' + requestId + ':' + body;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function requestMedia({operation, input, requestId, fetchImpl=fetch, nowMs=Date.now()} = {}) {
  const production = String(process.env.NOVESSA_ENV || '').toLowerCase() === 'production';
  const rawBase = String(process.env.NOVESSA_GATEWAY_BASE_URL || '').trim();
  const secret = String(process.env.NOVESSA_GATEWAY_SHARED_SECRET || '');
  if (!rawBase || !secret) return result(STATUS.PROVIDER_UNAVAILABLE, { error:'media_gateway_not_configured' });
  const baseValidation = validateGatewayUrl(rawBase, { production });
  if (!baseValidation.ok) return result(STATUS.PROVIDER_UNAVAILABLE, { error:baseValidation.error });
  const base = baseValidation.url;
  const effectiveRequestId = requestId || ('media-' + crypto.randomUUID());
  const body = JSON.stringify({ operation, input });
  const timestamp = String(Math.trunc(nowMs));
  const headers = {
    'content-type':'application/json',
    'X-Media-Signature':signature(secret,timestamp,effectiveRequestId,body),
    'X-Media-Timestamp':timestamp,
    'X-Media-Service-Id':'novessa-core',
    'X-Media-Request-Id':effectiveRequestId
  };
  try {
    const r = await fetchImpl(base + '/v1/media/request', {method:'POST', headers, body, redirect:'error'});
    const raw = await r.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { return result(STATUS.ERROR,{ error:'media_gateway_invalid_json', http_status:r.status }); }
    const validEnvelope = payload?.request_id === effectiveRequestId;
    const accepted = [STATUS.SUCCESS, STATUS.INPUT_INCOMPLETE, STATUS.PARTIAL, STATUS.VERIFIED, STATUS.ERROR, STATUS.PROVIDER_UNAVAILABLE];
    if (validEnvelope && accepted.includes(payload?.status)) return payload;
    if (!r.ok) return result(STATUS.ERROR,{ http_status:r.status, upstream:payload });
    return result(STATUS.ERROR,{ error:'media_gateway_unrecognized_status', http_status:r.status, upstream:payload });
  } catch (error) {
    return result(STATUS.PROVIDER_UNAVAILABLE, { error:'media_gateway_unreachable' });
  }
}

export { signature as signMediaRequest };
`;
writeFileSync(mediaPath, media);

const indexPath = 'public/index.html';
let index = readFileSync(indexPath, 'utf8');
index = index.replace(/<input id="uiToken"[^>]*>/, '');
index = index.replace(
  '<button id="refreshBtn" class="ghost">Թարմացնել</button>',
  '<button id="refreshBtn" class="ghost">Թարմացնել</button><input id="uiToken" class="ui-token" type="password" placeholder="UI token" aria-label="NOVESSA UI token" autocomplete="off">'
);
writeFileSync(indexPath, index);

const appPath = 'public/app.js';
let app = readFileSync(appPath, 'utf8');
app = app.replace(
  "catch(err){ if(out) out.textContent=pretty(err.body||{status:'error',error:err.message}); }",
  "catch(err){ if(out){ const body=err.body||{}; if(body.error==='ui_auth_required') out.textContent='Այս գործողությունը Production-ում պաշտպանված է։ Մուտքագրիր NOVESSA UI token-ը վերևի դաշտում, ապա կրկին փորձիր։'; else if(body.error==='ui_token_not_configured') out.textContent='UI token-ը Vercel Production-ում կարգավորված չէ։'; else out.textContent=pretty(body||{status:'error',error:err.message}); } }"
);
writeFileSync(appPath, app);

const stylePath = 'public/styles.css';
let style = readFileSync(stylePath, 'utf8');
style += '.ui-token{width:180px!important;max-width:180px!important;padding:8px 10px!important}.ui-token::placeholder{color:#6f7d98}';
writeFileSync(stylePath, style);

