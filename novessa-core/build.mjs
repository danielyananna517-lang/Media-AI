import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const parts = Array.from({length:15}, (_,i) => readFileSync(`core-part-${String(i+1).padStart(2,'0')}.txt`, 'utf8')).join('');
writeFileSync('core.tar.gz', Buffer.from(parts, 'base64'));
execFileSync('tar', ['-xzf', 'core.tar.gz', '--strip-components=1'], {stdio:'inherit'});

const mediaPath = 'src/mediaClient.mjs';
let media = readFileSync(mediaPath, 'utf8');
media = media.replace(
  "const payload = \`${timestamp}.${requestId}.${sha256(body)}\`;",
  "const payload = \`${timestamp}:${requestId}:${body}\`;"
);
media = media.replace(
  "    'x-service-id':'novessa-core',\n    'x-timestamp':timestamp,\n    'x-request-id':requestId,\n    'x-service-signature':signature(secret,timestamp,requestId,body)",
  "    'X-Media-Signature':signature(secret,timestamp,requestId,body),\n    'X-Media-Timestamp':timestamp,\n    'X-Media-Service-Id':'novessa-core',\n    'X-Media-Request-Id':requestId"
);
media = media.replace(
  "const body = JSON.stringify({ contract_version:'1.0', request_id:requestId, source:'novessa', target:'media-ai', operation, input });",
  "const body = JSON.stringify({ operation, input });"
);
media = media.replace(
  "const validEnvelope = payload?.contract_version === '1.0' && payload?.request_id === requestId;",
  "const validEnvelope = payload?.request_id === requestId;"
);
media = media.replace(
  "if (validEnvelope && (payload?.status === STATUS.INPUT_INCOMPLETE || payload?.status === STATUS.PARTIAL || payload?.status === STATUS.VERIFIED || payload?.status === STATUS.ERROR || payload?.status === STATUS.PROVIDER_UNAVAILABLE)) return payload;",
  "if (validEnvelope && (payload?.status === STATUS.SUCCESS || payload?.status === STATUS.INPUT_INCOMPLETE || payload?.status === STATUS.PARTIAL || payload?.status === STATUS.VERIFIED || payload?.status === STATUS.ERROR || payload?.status === STATUS.PROVIDER_UNAVAILABLE)) return payload;"
);
writeFileSync(mediaPath, media);

const serverPath = 'server.mjs';
let server = readFileSync(serverPath, 'utf8');
const health = "    if(req.method==='GET'&&u.pathname==='/health') return send(res,200,{status:'ok',service:'novessa-core',version:'0.4.9'});\n";
const probe = "    if(req.method==='GET'&&u.pathname==='/internal/media-connectivity-verify-7f3c9a21'){ const requestId='media-connectivity-'+Date.now(); const result=await requestMedia({operation:'chat',input:{message:'NOVESSA Core 0.4.9 connectivity test to Media AI. Reply only: CONNECTED'},requestId}); return send(res,200,{status:result.status,core:'0.4.9',media_ai:result,request_id:requestId}); }\n";
if (!server.includes("/internal/media-connectivity-verify-7f3c9a21")) {
  server = server.replace(health, health + probe);
}
writeFileSync(serverPath, server);
