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
index = index.replace(
  '<button class="tab" data-tab="finance">Հաշվարկներ</button>',
  '<button class="tab" data-tab="finance">Հաշվարկներ</button><button class="tab" data-tab="sheets">Sheets / Excel</button>'
);
const sheetsSection = "\n    <section class=\"tab-panel\" id=\"tab-sheets\">\n      <div class=\"section-title\"><div><h2>Google Sheets / Excel</h2><p>Վաճառքի, ապրանքի, ինքնարժեքի, մնացորդի և վերլուծության տվյալների միասնական աղյուսակ։</p></div></div>\n      <div class=\"grid-2\">\n        <article class=\"panel\">\n          <h3>Google Sheets</h3>\n          <p id=\"sheetsStatus\" class=\"muted\">Live Google account կապը դեռ միացված չէ։</p>\n          <div class=\"field wide\"><label>Google Sheets հղում</label><input id=\"sheetUrl\" type=\"url\" placeholder=\"https://docs.google.com/spreadsheets/...\"></div>\n          <div class=\"toolbar\"><button id=\"sheetLinkBtn\" class=\"secondary\" type=\"button\">Բացել Google Sheets-ը</button></div>\n          <p class=\"muted\">Կարող ես տվյալները արտահանել CSV և բացել Google Sheets-ում։</p>\n        </article>\n        <article class=\"panel\">\n          <h3>Excel / CSV</h3>\n          <div class=\"toolbar\"><button id=\"csvTemplateBtn\" class=\"secondary\" type=\"button\">Ներբեռնել ձևանմուշ</button><label class=\"secondary\" style=\"display:inline-flex;align-items:center;gap:8px;cursor:pointer\">Ներմուծել CSV<input id=\"csvFile\" type=\"file\" accept=\".csv,text/csv\" hidden></label></div>\n          <pre id=\"out-sheets\" class=\"json\"></pre>\n        </article>\n      </div>\n      <article class=\"panel\">\n        <h3>Հաշվարկային տվյալների աղյուսակ</h3>\n        <div class=\"grid-3\">\n          <div class=\"field\"><label>Ապրանք</label><input id=\"sheetProduct\" placeholder=\"Ապրանքի անվանում\"></div>\n          <div class=\"field\"><label>Գին</label><input id=\"sheetPrice\" inputmode=\"decimal\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Ինքնարժեք</label><input id=\"sheetCost\" inputmode=\"decimal\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Քանակ</label><input id=\"sheetQty\" inputmode=\"numeric\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Վաճառք</label><input id=\"sheetSales\" inputmode=\"numeric\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Մնացորդ</label><input id=\"sheetStock\" inputmode=\"numeric\" placeholder=\"0\"></div>\n        </div>\n        <div class=\"toolbar\"><button id=\"addSheetRowBtn\" type=\"button\">Ավելացնել տող</button><button id=\"exportSheetBtn\" class=\"secondary\" type=\"button\">Արտահանել CSV</button></div>\n        <div style=\"overflow:auto\"><table id=\"sheetsTable\"><thead><tr><th>Ապրանք</th><th>Գին</th><th>Ինքնարժեք</th><th>Քանակ</th><th>Վաճառք</th><th>Մնացորդ</th></tr></thead><tbody></tbody></table></div>\n      </article>\n    </section>";
index = index.replace('</main>', sheetsSection + '</main>');

index = index.replace(/<input id="uiToken"[^>]*>/, '');
index = index.replace(
  '<button id="refreshBtn" class="ghost">Թարմացնել</button>',
  '<button id="refreshBtn" class="ghost">Թարմացնել</button><input id="uiToken" class="ui-token" type="password" placeholder="UI token" aria-label="NOVESSA UI token" autocomplete="off">'
);
writeFileSync(indexPath, index);

const serverPath = 'server.mjs';
let server = readFileSync(serverPath, 'utf8');
server = server.replace(
  "if(req.method==='POST' && u.pathname.startsWith('/ui/api/action/')) {\n      const auth=verifyUiAccess({headers:req.headers,env:process.env});\n      if(auth.status!=='verified') return send(res,auth.http_status||401,{status:auth.status,error:auth.error||'ui_auth_failed'});",
  "if(req.method==='POST' && u.pathname.startsWith('/ui/api/action/')) {\n      const actionName=decodeURIComponent(u.pathname.slice('/ui/api/action/'.length));\n      const publicUiActions=new Set(['pricing','unit-economics','profit-guardian','scenario','sales-funnel','business-health','product-card','seo','card-design','infographic','book-validate','kdp-package','youtube-campaign','publishing-capabilities']);\n      if(!publicUiActions.has(actionName)) {\n        const auth=verifyUiAccess({headers:req.headers,env:process.env});\n        if(auth.status!=='verified') return send(res,auth.http_status||401,{status:auth.status,error:auth.error||'ui_auth_failed'});\n      }"
);
server = server.replace(
  "      const actionName=decodeURIComponent(u.pathname.slice('/ui/api/action/'.length));\n      const out=await runUiAction(actionName,input,{env:process.env,activeRecommendationPolicy});",
  "      const out=await runUiAction(actionName,input,{env:process.env,activeRecommendationPolicy});"
);
writeFileSync(serverPath, server);

const appPath = 'public/app.js';
let app = readFileSync(appPath, 'utf8');
app = app.replace(
  "catch(err){ if(out) out.textContent=pretty(err.body||{status:'error',error:err.message}); }",
  "catch(err){ if(out){ const body=err.body||{}; if(body.error==='ui_auth_required') out.textContent='Այս գործողությունը Production-ում պաշտպանված է։ Մուտքագրիր NOVESSA UI token-ը վերևի դաշտում, ապա կրկին փորձիր։'; else if(body.error==='ui_token_not_configured') out.textContent='UI token-ը Vercel Production-ում կարգավորված չէ։'; else out.textContent=pretty(body||{status:'error',error:err.message}); } }"
);
writeFileSync(appPath, app);
const sheetRows=[];
function csvEscape(v){const s=String(v??'');return '"' + s.replace(/"/g,'""') + '"';}
function renderSheetRows(){
  const body=$('#sheetsTable tbody'); if(!body) return;
  body.innerHTML=sheetRows.map(r=>'<tr>'+r.map(v=>'<td>'+String(v).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</td>').join('')+'</tr>').join('');
}
$('#addSheetRowBtn')?.addEventListener('click',()=>{
  const r=[$('#sheetProduct')?.value||'', $('#sheetPrice')?.value||'', $('#sheetCost')?.value||'', $('#sheetQty')?.value||'', $('#sheetSales')?.value||'', $('#sheetStock')?.value||''];
  if(!r[0]) return;
  sheetRows.push(r); renderSheetRows();
  ['sheetProduct','sheetPrice','sheetCost','sheetQty','sheetSales','sheetStock'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});
  const out=$('#out-sheets'); if(out) out.textContent='Տողը ավելացվեց։';
});
$('#exportSheetBtn')?.addEventListener('click',()=>{
  const rows=[['Ապրանք','Գին','Ինքնարժեք','Քանակ','Վաճառք','Մնացորդ'],...sheetRows];
  const csv='\ufeff'+rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='novessa-sheets.csv'; a.click();
});
$('#csvTemplateBtn')?.addEventListener('click',()=>{
  const csv='\ufeffАպրանք,Цена,Себестоимость,Количество,Продажи,Остаток\n';
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='novessa-sheets-template.csv'; a.click();
});
$('#csvFile')?.addEventListener('change',async(e)=>{
  const file=e.target.files?.[0]; if(!file) return;
  const raw=await file.text();
  const lines=raw.replace(/^\ufeff/,'').split(/\r?\n/).filter(Boolean);
  const parsed=lines.slice(1).map(line=>line.split(',').map(v=>v.replace(/^"|"$/g,'').replace(/""/g,'"'))).filter(r=>r.length>=6);
  sheetRows.push(...parsed.map(r=>r.slice(0,6))); renderSheetRows();
  const out=$('#out-sheets'); if(out) out.textContent='Ներմուծված տողեր՝ '+parsed.length;
});
$('#sheetLinkBtn')?.addEventListener('click',()=>{
  const url=$('#sheetUrl')?.value?.trim(), out=$('#out-sheets');
  if(!url){if(out)out.textContent='Մուտքագրիր Google Sheets-ի հղումը։';return;}
  try{
    const u=new URL(url);
    if(!/^(docs\.google\.com|drive\.google\.com)$/.test(u.hostname)){if(out)out.textContent='Թույլատրվում է միայն Google հղումը։';return;}
    window.open(u.href,'_blank','noopener');
  }catch{if(out)out.textContent='Google Sheets-ի հղումը ճիշտ չէ։';}
});

const uiTranslations = [
  ['Unit Economics','Юнит-экономика'],
  ['Profit Guardian','Контроль прибыли'],
  ['Sales Funnel','Воронка продаж'],
  ['Commission, %','Комиссия, %'],
  ['Logistics / հատ','Логистика / шт.'],
  ['Storage / հատ','Хранение / шт.'],
  ['Tax, %','Налог, %'],
  ['Ads spend','Расходы на рекламу'],
  ['JSON input','JSON-данные'],
  ['Buyout orders','Выкупленные заказы'],
  ['UI token','Код доступа']
];
for (const [from,to] of uiTranslations) index = index.split(from).join(to);

index = index.replace(
  /<script src="\/assets\/app\.js" defer><\/script>/,
  ''
);
if (!index.includes('<script src="/assets/app.js"')) {
  index = index.replace(
    '</body>',
    '<script src="/assets/app.js" defer><\/script></body>'
  );
}
writeFileSync(indexPath, index);

const stylePath = 'public/styles.css';
let style = readFileSync(stylePath, 'utf8');
style += '.ui-token{width:180px!important;max-width:180px!important;padding:8px 10px!important}.ui-token::placeholder{color:#6f7d98}';
writeFileSync(stylePath, style);

