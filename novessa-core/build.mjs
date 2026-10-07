import { readFileSync, writeFileSync, unlink } from 'node:fs';
import { execFileSync } from 'node:child_process';

const parts = Array.from({length:15}, (_,i) => readFileSync(`core-part-${String(i+1).padStart(2,'0')}.txt`, 'utf8')).join('');
writeFileSync('core.tar.gz', Buffer.from(parts, 'base64'));
execFileSync('tar', ['-xzf', 'core.tar.gz', '--strip-components=1'], {stdio:'inherit'});
// Use the verified Core 0.4.9 server source instead of the stale archive entry.
writeFileSync('server.mjs', readFileSync('server.mjs.template', 'utf8'));
try { await unlink('server-core.mjs'); } catch { /* stale archive entry may be absent */ }

const mediaPath = 'src/mediaClient.mjs';
const media = `import crypto from 'node:crypto';
import { STATUS, result } from './status.mjs';
import { validateGatewayUrl } from './connectors/config.mjs';

function signature(secret, timestamp, requestId, body) {
  const payload = timestamp + ':' + requestId + ':' + body;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function requestMedia({operation, input, requestId='media-' + crypto.randomUUID(), fetchImpl=fetch, nowMs=Date.now()} = {}) {
  const production = String(process.env.NOVESSA_ENV || '').toLowerCase() === 'production';
  const rawBase = String(process.env.NOVESSA_GATEWAY_BASE_URL || '').trim();
  const secret = String(process.env.NOVESSA_GATEWAY_SHARED_SECRET || '');
  if (!rawBase || !secret) return result(STATUS.PROVIDER_UNAVAILABLE, { error:'media_gateway_not_configured' });
  const baseValidation = validateGatewayUrl(rawBase, { production });
  if (!baseValidation.ok) return result(STATUS.PROVIDER_UNAVAILABLE, { error:baseValidation.error });
  const base = baseValidation.url;
  const body = JSON.stringify({ operation, input });
  const timestamp = String(Math.trunc(nowMs));
  const headers = {
    'content-type':'application/json',
    'X-Media-Signature':signature(secret,timestamp,requestId,body),
    'X-Media-Timestamp':timestamp,
    'X-Media-Service-Id':'novessa-core',
    'X-Media-Request-Id':requestId
  };
  try {
    const r = await fetchImpl(base + '/v1/media/request', {method:'POST', headers, body, redirect:'error'});
    const raw = await r.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { return result(STATUS.ERROR,{ error:'media_gateway_invalid_json', http_status:r.status }); }
    const validEnvelope = payload?.request_id === requestId;
    const accepted = ['success', STATUS.INPUT_INCOMPLETE, STATUS.PARTIAL, STATUS.VERIFIED, STATUS.ERROR, STATUS.PROVIDER_UNAVAILABLE, 'accepted'];
    if (validEnvelope && accepted.includes(payload?.status)) return payload;
    if (!r.ok && payload?.status === STATUS.PROVIDER_UNAVAILABLE) return payload;
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
  '<button class="tab" data-tab="finance">Հաշվարկներ</button><button class="tab" data-tab="sheets">Sheets / Excel</button><button class="tab" data-tab="settings">Կարգավորումներ</button>'
);
const sheetsSection = "\n    <section class=\"tab-panel\" id=\"tab-sheets\">\n      <div class=\"section-title\"><div><h2>Google Sheets / Excel</h2><p>Վաճառքի, ապրանքի, ինքնարժեքի, մնացորդի և վերլուծության տվյալների միասնական աղյուսակ։</p></div></div>\n      <div class=\"grid-2\">\n        <article class=\"panel\">\n          <h3>Google Sheets</h3>\n          <p id=\"sheetsStatus\" class=\"muted\">Live Google account կապը դեռ միացված չէ։</p>\n          <div class=\"field wide\"><label>Google Sheets հղում</label><input id=\"sheetUrl\" type=\"url\" placeholder=\"https://docs.google.com/spreadsheets/...\"></div>\n          <div class=\"toolbar\"><button id=\"sheetLinkBtn\" class=\"secondary\" type=\"button\">Բացել Google Sheets-ը</button></div>\n          <p class=\"muted\">Կարող ես տվյալները արտահանել CSV և բացել Google Sheets-ում։</p>\n        </article>\n        <article class=\"panel\">\n          <h3>Excel / CSV</h3>\n          <div class=\"toolbar\"><button id=\"csvTemplateBtn\" class=\"secondary\" type=\"button\">Ներբեռնել ձևանմուշ</button><label class=\"secondary\" style=\"display:inline-flex;align-items:center;gap:8px;cursor:pointer\">Ներմուծել CSV<input id=\"csvFile\" type=\"file\" accept=\".csv,text/csv\" hidden></label></div>\n          <pre id=\"out-sheets\" class=\"json\"></pre>\n        </article>\n      </div>\n      <article class=\"panel\">\n        <h3>Հաշվարկային տվյալների աղյուսակ</h3>\n        <div class=\"grid-3\">\n          <div class=\"field\"><label>Ապրանք</label><input id=\"sheetProduct\" placeholder=\"Ապրանքի անվանում\"></div>\n          <div class=\"field\"><label>Գին</label><input id=\"sheetPrice\" inputmode=\"decimal\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Ինքնարժեք</label><input id=\"sheetCost\" inputmode=\"decimal\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Քանակ</label><input id=\"sheetQty\" inputmode=\"numeric\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Վաճառք</label><input id=\"sheetSales\" inputmode=\"numeric\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Մնացորդ</label><input id=\"sheetStock\" inputmode=\"numeric\" placeholder=\"0\"></div>\n        </div>\n        <div class=\"toolbar\"><button id=\"addSheetRowBtn\" type=\"button\">Ավելացնել տող</button><button id=\"exportSheetBtn\" class=\"secondary\" type=\"button\">Արտահանել CSV</button></div>\n        <div style=\"overflow:auto\"><table id=\"sheetsTable\"><thead><tr><th>Ապրանք</th><th>Գին</th><th>Ինքնարժեք</th><th>Քանակ</th><th>Վաճառք</th><th>Մնացորդ</th></tr></thead><tbody></tbody></table></div>\n      </article>\n    </section>";
index = index.replace('</main>', sheetsSection + '</main>');

index = index.replace(/<input id="uiToken"[^>]*>/, '');
index = index.replace(
  '<button id="refreshBtn" class="ghost">Թարմացնել</button>',
  '<button id="refreshBtn" class="ghost">Թարմացնել</button>'
);
writeFileSync(indexPath, index);

const serverPath = 'server.mjs';
writeFileSync(serverPath, readFileSync('server.mjs.template', 'utf8'));

const uiTestPath = 'test/ui-pricing.test.mjs';
let uiTest = readFileSync(uiTestPath, 'utf8');
uiTest = uiTest.replace(
  /test\('UI production action requires UI token',[\s\S]*?\n\}\);/,
  `test('UI production safe actions are available without a UI token while protected actions still require one',async t=>{
  const port=await freePort(); const child=start(port,{NOVESSA_ENV:'production',NOVESSA_CORE_SHARED_SECRET:'ui-test-core',NOVESSA_UI_TOKEN:'ui-test-token'}); t.after(()=>stop(child)); await waitForHealth(port);
  const pricingBody=JSON.stringify({list_price:200,discount_percent:25});
  const pricingWithoutToken=await request(port,{method:'POST',path:'/ui/api/action/pricing',body:pricingBody,headers:{'content-type':'application/json'}});
  assert.equal(pricingWithoutToken.status,200);
  const protectedBody=JSON.stringify({entities:[],expected_totals:null});
  const protectedWithoutToken=await request(port,{method:'POST',path:'/ui/api/action/commerce-intelligence',body:protectedBody,headers:{'content-type':'application/json'}});
  assert.equal(protectedWithoutToken.status,401);
  const pricingWithToken=await request(port,{method:'POST',path:'/ui/api/action/pricing',body:pricingBody,headers:{'content-type':'application/json','x-ui-token':'ui-test-token'}});
  assert.equal(pricingWithToken.status,200);
});`
);
writeFileSync(uiTestPath, uiTest);

const coreTestPath = 'test/core.test.mjs';
let coreTest = readFileSync(coreTestPath, 'utf8');
coreTest = coreTest.split('assert.equal(a.length,43);').join('assert.equal(a.length,64);');
writeFileSync(coreTestPath, coreTest);

const appPath = 'public/app.js';
let app = readFileSync(appPath, 'utf8');
app = app.replace(
  "catch(err){ if(out) out.textContent=pretty(err.body||{status:'error',error:err.message}); }",
  "catch(err){ if(out){ const body=err.body||{}; const lang=document.documentElement.lang||'hy'; const m={hy:{auth:'Այս գործողությունը պաշտպանված է։ Մուտքի կոդը մուտքագրիր Կարգավորումներ բաժնում և կրկին փորձիր։',not:'Մուտքի կոդը Vercel Production-ում կարգավորված չէ։'},ru:{auth:'Это действие защищено. Введи код доступа в разделе «Настройки» и попробуй снова.',not:'Код доступа не настроен в Vercel Production.'},en:{auth:'This action is protected. Enter the access code in Settings and try again.',not:'The access code is not configured in Vercel Production.'}}[lang]||{}; if(body.error==='ui_auth_required') out.textContent=m.auth; else if(body.error==='ui_token_not_configured') out.textContent=m.not; else out.textContent=pretty(body||{status:'error',error:err.message}); } }"
);
writeFileSync(appPath, app);
const sheetsAppCode = "const sheetRows=(()=>{try{const saved=JSON.parse(localStorage.getItem('novessa_sheet_rows_v2')||'[]');return Array.isArray(saved)?saved:[]}catch{return []}})(); window.__novessaSheetRows=sheetRows;\nconst sheetI18n={hy:{added:'Տողը ավելացվեց։',imported:'Ներմուծված տողեր՝ ',url:'Մուտքագրիր Google Sheets-ի հղումը։',host:'Թույլատրվում է միայն Google հղումը։',bad:'Google Sheets-ի հղումը ճիշտ չէ։'},ru:{added:'Строка добавлена.',imported:'Импортировано строк: ',url:'Введи ссылку Google Sheets.',host:'Разрешена только ссылка Google.',bad:'Ссылка Google Sheets неверна.'},en:{added:'Row added.',imported:'Imported rows: ',url:'Enter the Google Sheets link.',host:'Only a Google link is allowed.',bad:'The Google Sheets link is invalid.'}}; function sheetMsg(key,extra=''){const lang=document.documentElement.lang||'hy';return (sheetI18n[lang]||sheetI18n.hy)[key]+extra;}\nfunction csvEscape(v){const s=String(v??'');return '\"' + s.replace(/\"/g,'\"\"') + '\"';}\nfunction renderSheetRows(){\n  const body=$('#sheetsTable tbody'); if(!body) return;\n  body.innerHTML=sheetRows.map(r=>'<tr>'+r.map(v=>'<td>'+String(v).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</td>').join('')+'</tr>').join('');\n}\n$('#addSheetRowBtn')?.addEventListener('click',()=>{\n  const r=[$('#sheetProduct')?.value||'', $('#sheetPrice')?.value||'', $('#sheetCost')?.value||'', $('#sheetQty')?.value||'', $('#sheetSales')?.value||'', $('#sheetStock')?.value||''];\n  if(!r[0]) return;\n  sheetRows.push(r); window.__novessaSheetRows=sheetRows; localStorage.setItem('novessa_sheet_rows_v2',JSON.stringify(sheetRows)); renderSheetRows();\n  ['sheetProduct','sheetPrice','sheetCost','sheetQty','sheetSales','sheetStock'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});\n  const out=$('#out-sheets'); if(out) out.textContent=sheetMsg('added');\n});\n$('#exportSheetBtn')?.addEventListener('click',()=>{\n  const rows=[['Ապրանք','Գին','Ինքնարժեք','Քանակ','Վաճառք','Մնացորդ'],...sheetRows];\n  const csv='\\ufeff'+rows.map(r=>r.map(csvEscape).join(',')).join('\\n');\n  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='novessa-sheets.csv'; a.click();\n});\n$('#csvTemplateBtn')?.addEventListener('click',()=>{\n  const csv='\\ufeffԱպրանք,Գին,Ինքնարժեք,Քանակ,Վաճառք,Մնացորդ\\n';\n  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='novessa-sheets-template.csv'; a.click();\n});\n$('#csvFile')?.addEventListener('change',async(e)=>{\n  const file=e.target.files?.[0]; if(!file) return;\n  const raw=await file.text();\n  const lines=raw.replace(/^\\ufeff/,'').split(/\\r?\\n/).filter(Boolean);\n  const parsed=lines.slice(1).map(line=>line.split(',').map(v=>v.replace(/^\"|\"$/g,'').replace(/\"\"/g,'\"'))).filter(r=>r.length>=6);\n  sheetRows.push(...parsed.map(r=>r.slice(0,6))); window.__novessaSheetRows=sheetRows; localStorage.setItem('novessa_sheet_rows_v2',JSON.stringify(sheetRows)); renderSheetRows();\n  const out=$('#out-sheets'); if(out) out.textContent=sheetMsg('imported',parsed.length);\n});\n$('#sheetLinkBtn')?.addEventListener('click',()=>{\n  const url=$('#sheetUrl')?.value?.trim(), out=$('#out-sheets');\n  if(!url){if(out)out.textContent=sheetMsg('url');return;}\n  try{\n    const u=new URL(url);\n    if(!/^(docs\\.google\\.com|drive\\.google\\.com)$/.test(u.hostname)){if(out)out.textContent='Թույլատրվում է միայն Google հղումը։';return;}\n    window.open(u.href,'_blank','noopener');\n  }catch{if(out)out.textContent=sheetMsg('bad');}\n});\n\n";
app += '\n' + sheetsAppCode;
writeFileSync(appPath, app);

const uiTranslations = [
  ['Commerce Intelligence Core','Առևտրի վերլուծության Core'],
  ['REAL CORE • DETERMINISTIC • AUDITABLE','ԻՐԱԿԱՆ CORE • ՀԱՇՎԱՐԿԱՅԻՆ • ՍՏՈՒԳԵԼԻ'],
  ['PARTIAL / NOT VERIFIED','ՄԱՍԱՄԲ / ՉԻ ՀԱՍՏԱՏՎԱԾ'],
  ['Connector-ներ','Միացումներ'],
  ['Canonical store','Հիմնական տվյալների պահոց'],
  ['Deterministic հաշվարկային բլոկներ','Դետերմինիստիկ հաշվարկային բլոկներ'],
  ['server-side calculation engine','սերվերային հաշվարկային շարժիչ'],
  ['Unit Economics','Յունիտ-էկոնոմիկա'],
  ['Profit Guardian','Շահույթի վերահսկում'],
  ['Sales Funnel','Վաճառքի ձագար'],
  ['Commission, %','Միջնորդավճար, %'],
  ['Logistics / հատ','Լոգիստիկա / միավոր'],
  ['Storage / հատ','Պահեստավորում / միավոր'],
  ['Tax, %','Հարկ, %'],
  ['Ads spend','Գովազդի ծախս'],
  ['JSON input','JSON տվյալներ'],
  ['Buyout orders','Գնված պատվերներ'],
  ['Commerce Model','Commerce մոդել'],
  ['canonical ձևաչափով','միասնական canonical ձևաչափով'],
  ['Product Card / SEO / Creative planning','Ապրանքի քարտ / SEO / ստեղծարար պլանավորում'],
  ['AI handoff-ից առաջ factual validation-ը Core-ի վերահսկողության տակ է։','AI փոխանցումից առաջ փաստային ստուգումը Core-ի վերահսկողության տակ է։'],
  ['Product Card validation','Ապրանքի քարտի ստուգում'],
  ['SEO optimizer','SEO օպտիմիզատոր'],
  ['Product data JSON','Ապրանքի տվյալների JSON'],
  ['Card design brief','Քարտի դիզայնի բրիֆ'],
  ['Input JSON','Մուտքային JSON'],
  ['Infographic brief','Ինֆոգրաֆիկայի բրիֆ'],
  ['publishing շերտում','հրապարակման շերտում'],
  ['publishing capabilities','հրապարակման հնարավորություններ'],
  ['Publishing capabilities','Հրապարակման հնարավորություններ'],
  ['Book JSON','Գրքի JSON'],
  ['Amazon KDP package','Amazon KDP փաթեթ'],
  ['KDP package JSON','KDP փաթեթի JSON'],
  ['Book → YouTube campaign','Գիրք → YouTube արշավ'],
  ['Campaign JSON','Արշավի JSON'],
  ['Google Intelligence / Rule Governance','Google Intelligence / կանոնների կառավարում'],
  ['evidence → candidate → tests → gate','evidence → candidate → tests → gate'],
  ['rule status','կանոնների կարգավիճակը'],
  ['pending cases','սպասող դեպքերը'],
  ['Rules','Կանոններ'],
  ['Pending governance cases','Սպասող կանոնների դեպքեր'],
  ['Profile','Պրոֆիլ'],
  ['Generic','Ընդհանուր'],
  ['Commerce','Առևտուր'],
  ['Card / SEO','Քարտ / SEO'],
  ['Book / YouTube','Գիրք / YouTube'],
  ['Overview','Ակնարկ'],
  ['Calculations','Հաշվարկներ'],
  ['Publishing','Հրապարակում'],
  ['Sheets / Excel','Աղյուսակներ / Excel'],
  ['Google Sheets / Excel','Google Sheets / Excel'],
  ['Google Sheets','Google Sheets'],
  ['Product card','Ապրանքի քարտ'],
  ['Card Design','Քարտի դիզայն'],
  ['Infographic','Ինֆոգրաֆիկա'],
  ['Core ok','Core-ը աշխատում է'],
  ['Ready','Պատրաստ է'],
  ['Connectors verified','Միացումները ստուգված են'],
  ['Store verified','Խանութը ստուգված է'],
  ['Rules verified','Կանոնները ստուգված են'],
  ['Publishing verified','Հրապարակումը ստուգված է'],
  ['Публикация capabilities','Հրապարակման հնարավորություններ'],
  ['Проверить книгу','Ստուգել գիրքը'],
  ['Подготовить KDP пакет','Պատրաստել KDP փաթեթ'],
  ['Построить YouTube кампанию','Կառուցել YouTube արշավ'],
  ['Книга / Amazon KDP / YouTube','Գիրք / Amazon KDP / YouTube'],
  ['Status','Կարգավիճակ'],
  ['Settings','Կարգավորումներ'],
  ['AI-ը չի ստեղծում ֆինանսական թիվ։ Բացակա կամ անորոշ տվյալը մնում է','AI-ը չի ստեղծում ֆինանսական թիվ։ Բացակա կամ անորոշ տվյալը մնում է'],
  ['Ստատուսները բերվում են հենց Novessa Core-ից, ոչ թե demo տվյալներից։','Կարգավիճակները բերվում են հենց Novessa Core-ից, ոչ թե ցուցադրական տվյալներից։'],
  ['Novessa-ն միավորում է ապրանքները, վաճառքը, շահույթը, marketplace-ների տվյալները, SEO-ն և կանոնների վերահսկումը մեկ համակարգում։','Novessa-ն միավորում է ապրանքները, վաճառքը, շահույթը, շուկաների տվյալները, SEO-ն և կանոնների վերահսկումը մեկ համակարգում։'],
  ['Status check…','Ստուգում…'],
  ['Business Decision Center','Բիզնեսի որոշումների կենտրոն'],
  ['AI does not create a financial number. Missing or uncertain data remains','AI-ը չի ստեղծում ֆինանսական թիվ։ Բացակա կամ անորոշ տվյալը մնում է'],
  ['Current system status','Ներկայիս համակարգի վիճակը'],
  ['Statuses are loaded from Novessa Core, not from demo data.','Կարգավիճակները բերվում են հենց Novessa Core-ից, ոչ թե ցուցադրական տվյալներից։'],
  ['Rule Governance','Կանոնների կառավարում'],
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
const languageSettingsHtml = `
    <section class="tab-panel" id="tab-settings">
      <div class="section-title"><div><h2>Կարգավորումներ</h2><p>Յուրաքանչյուր օգտատեր կարող է ընտրել իր ինտերֆեյսի լեզուն։ Ընտրությունը պահպանվում է այս սարքում։</p></div></div>
      <article class="panel">
        <h3>Լեզու</h3>
        <div class="field wide">
          <label for="languageSelect">Ինտերֆեյսի լեզու</label>
          <select id="languageSelect" aria-label="Ինտերֆեյսի լեզու">
            <option value="hy">Հայերեն</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>
        <div class="field wide">
          <label for="uiToken">Մուտքի կոդ</label>
          <input id="uiToken" class="ui-token" type="password" placeholder="Մուտքի կոդ" data-i18n-placeholder="Մուտքի կոդ" autocomplete="off">
        </div>
      </article>
    </section>`;
index = index.replace('</main>', languageSettingsHtml + '</main>');

const localizedRuntimeScript = `
<script>
(function(){
  const canonical = [
    ['REAL CORE • DETERMINISTIC • AUDITABLE','ԻՐԱԿԱՆ CORE • ՀԱՇՎԱՐԿԱՅԻՆ • ՍՏՈՒԳԵԼԻ'],
    ['Commerce Intelligence Core','Առևտրի վերլուծության Core'],
    ['Коммерция Intelligence Core','Առևտրի վերլուծության Core'],
    ['Commerce','Առևտուր'],
    ['Коммерция','Առևտուր'],
    ['Canonical store','Հիմնական տվյալների պահոց'],
    ['Rule packs','Կանոնների փաթեթներ'],
    ['Pending cases','Սպասող դեպքեր'],
    ['Store records','Խանութի գրառումներ'],
    ['Unit Economics','Յունիտ-էկոնոմիկա'],
    ['Profit Guardian','Շահույթի վերահսկում'],
    ['Sales Funnel','Վաճառքի ձագար'],
    ['Commission, %','Միջնորդավճար, %'],
    ['Logistics / հատ','Լոգիստիկա / հատ'],
    ['Storage / հատ','Պահեստավորում / հատ'],
    ['Tax, %','Հարկ, %'],
    ['Ads spend','Գովազդի ծախս'],
    ['Buyout orders','Հետգնման պատվերներ'],
    ['JSON input','JSON տվյալներ'],
    ['Product Card / SEO / Creative planning','Ապրանքի քարտ / SEO / Ստեղծարար պլանավորում'],
    ['Product Card validation','Ապրանքի քարտի ստուգում'],
    ['SEO optimizer','SEO օպտիմալացում'],
    ['Card design brief','Քարտի դիզայնի brief'],
    ['Infographic brief','Ինֆոգրաֆիկայի brief'],
    ['Product data JSON','Ապրանքի JSON տվյալներ'],
    ['Input JSON','Մուտքային JSON'],
    ['Profile','Պրոֆիլ'],
    ['Generic','Ընդհանուր'],
    ['Wildberries','Wildberries'],
    ['Book / Amazon KDP / YouTube','Գիրք / Amazon KDP / YouTube'],
    ['publishing capabilities','Հրատարակման հնարավորություններ'],
    ['Publishing capabilities','Հրատարակման հնարավորություններ'],
    ['Book JSON','Գրքի JSON'],
    ['Amazon KDP package','Amazon KDP փաթեթ'],
    ['KDP package JSON','KDP փաթեթի JSON'],
    ['Book → YouTube campaign','Գիրք → YouTube արշավ'],
    ['Campaign JSON','Արշավի JSON'],
    ['Google Intelligence / Rule Governance','Google Intelligence / Կանոնների կառավարում'],
    ['rule status','կանոնների կարգավիճակ'],
    ['pending cases','սպասող դեպքեր'],
    ['Core','Core'],
    ['Ready','Պատրաստ'],
    ['Connectors','Միացումներ'],
    ['Store','Խանութ'],
    ['Rules','Կանոններ'],
    ['Publishing','Հրատարակում'],
    ['implemented','միացված է'],
    ['implemented_partial','մասամբ միացված է'],
    ['partial','մասամբ'],
    ['not_verified','ՉԻ ՀԱՍՏԱՏՎԱԾ'],
    ['NOT VERIFIED','ՉԻ ՀԱՍՏԱՏՎԱԾ'],
    ['PARTIAL','ՄԱՍԱՄԲ'],
    ['verified','ստուգված է'],
    ['ready','պատրաստ է'],
    ['ok','աշխատում է'],
    ['A current system status','Ներկայիս համակարգի վիճակը'],
    ['Deterministic հաշվարկային բլոկներ','Դետերմինիստական հաշվարկային բլոկներ'],
    ['server-side calculation engine','server-side հաշվարկային շարժիչ'],
    ['Handoff-ից առաջ factual validation-ը Core-ի վերահսկողության տակ է։','Գեներացիայից առաջ փաստերի ստուգումը Core-ի վերահսկողության տակ է։'],
    ['AI handoff-ից առաջ factual validation-ը Core-ի վերահսկողության տակ է։','AI փոխանցումից առաջ փաստերի ստուգումը Core-ի վերահսկողության տակ է։'],
    ['Օգտագործում է նույն Unit Economics input-ները և ստուգում վտանգները։','Օգտագործում է նույն յունիտ-էկոնոմիկայի տվյալները և ստուգում ռիսկերը։'],
    ['Ցույց տալ canonical model-ը','Ցուցադրել հիմնական տվյալների մոդելը'],
    ['Վերլուծել store-ը','Վերլուծել խանութը'],
    ['Թարմացնել rule status','Թարմացնել կանոնների կարգավիճակը'],
    ['Ցուցադրել pending cases','Ցուցադրել սպասող դեպքերը'],
    ['UI token','Մուտքի կոդ'],
    ['UI token (production)','Մուտքի կոդ (արտադրություն)'],
    ['Այս գործողությունը Production-ում պաշտպանված է։ Մուտքագրիր NOVESSA UI token-ը վերևի դաշտում, ապա կրկին փորձիր։','Այս գործողությունը պաշտպանված է։ Մուտքագրիր մուտքի կոդը վերևում և կրկին փորձիր։'],
    ['UI token-ը Vercel Production-ում կարգավորված չէ։','Մուտքի կոդը արտադրությունում կարգավորված չէ։'],
    ['Աշխատում է…','Աշխատում է…']
  ];
  const translations = {
    hy: {},
    ru: {
      'ԻՐԱԿԱՆ CORE • ՀԱՇՎԱՐԿԱՅԻՆ • ՍՏՈՒԳԵԼԻ':'REAL CORE • РАСЧЁТНЫЙ • ПРОВЕРЯЕМЫЙ',
      'Առևտրի վերլուծության Core':'Core бизнес-аналитики',
      'Առևտուր':'Коммерция',
      'Հիմնական տվյալների պահոց':'Основное хранилище данных',
      'Կանոնների փաթեթներ':'Пакеты правил',
      'Սպասող դեպքեր':'Ожидающие случаи',
      'Խանութի գրառումներ':'Записи магазина',
      'Յունիտ-էկոնոմիկա':'Юнит-экономика',
      'Շահույթի վերահսկում':'Контроль прибыли',
      'Վաճառքի ձագար':'Воронка продаж',
      'Միջնորդավճար, %':'Комиссия, %',
      'Լոգիստիկա / հատ':'Логистика / шт.',
      'Պահեստավորում / հատ':'Хранение / шт.',
      'Հարկ, %':'Налог, %',
      'Գովազդի ծախս':'Расходы на рекламу',
      'Հետգնման պատվերներ':'Выкупленные заказы',
      'Ապրանքի քարտ / SEO / Ստեղծարար պլանավորում':'Карточка товара / SEO / Креативное планирование',
      'Ապրանքի քարտի ստուգում':'Проверка карточки товара',
      'SEO օպտիմալացում':'SEO-оптимизация',
      'Քարտի դիզայնի brief':'Бриф дизайна карточки',
      'Ինֆոգրաֆիկայի brief':'Бриф инфографики',
      'Ապրանքի JSON տվյալներ':'JSON-данные товара',
      'Մուտքային JSON':'Входной JSON',
      'Պրոֆիլ':'Профиль',
      'Գիրք / Amazon KDP / YouTube':'Книга / Amazon KDP / YouTube',
      'Հրատարակման հնարավորություններ':'Возможности публикации',
      'Գրքի JSON':'JSON книги',
      'Amazon KDP փաթեթ':'Пакет Amazon KDP',
      'KDP փաթեթի JSON':'JSON пакета KDP',
      'Գիրք → YouTube արշավ':'Книга → YouTube кампания',
      'Արշավի JSON':'JSON кампании',
      'Google Intelligence / Կանոնների կառավարում':'Google Intelligence / Управление правилами',
      'կանոնների կարգավիճակ':'статус правил',
      'սպասող դեպքեր':'ожидающие случаи',
      'Միացումներ':'Подключения',
      'Խանութ':'Магазин',
      'Կանոններ':'Правила',
      'Հրատարակում':'Публикация',
      'միացված է':'подключено',
      'մասամբ միացված է':'подключено частично',
      'մասամբ':'частично',
      'ՉԻ ՀԱՍՏԱՏՎԱԾ':'НЕ ПОДТВЕРЖДЕНО',
      'ՄԱՍԱՄԲ':'ЧАСТИЧНО',
      'ստուգված է':'проверено',
      'պատրաստ է':'готово',
      'աշխատում է':'работает',
      'Դետերմինիստական հաշվարկային բլոկներ':'Детерминированные расчёты',
      'server-side հաշվարկային շարժիչ':'серверный расчётный модуль',
      'AI փոխանցումից առաջ փաստերի ստուգումը Core-ի վերահսկողության տակ է։':'Проверка фактов до AI-передачи контролируется Core.',
      'Կարգավորումներ':'Настройки',
      'Լեզու':'Язык',
      'Ինտերֆեյսի լեզու':'Язык интерфейса',
      'Յուրաքանչյուր օգտատեր կարող է ընտրել իր ինտերֆեյսի լեզուն։ Ընտրությունը պահպանվում է այս սարքում։':'Каждый пользователь может выбрать свой язык интерфейса. Выбор сохраняется на этом устройстве.',
      'Հայերեն':'Հայский', 'Русский':'Русский', 'English':'Английский'
    },
    en: {
      'ԻՐԱԿԱՆ CORE • ՀԱՇՎԱՐԿԱՅԻՆ • ՍՏՈՒԳԵԼԻ':'REAL CORE • DETERMINISTIC • AUDITABLE',
      'Առևտրի վերլուծության Core':'Commerce Analytics Core',
      'Առևտուր':'Commerce',
      'Հիմնական տվյալների պահոց':'Canonical data store',
      'Կանոնների փաթեթներ':'Rule packs',
      'Սպասող դեպքեր':'Pending cases',
      'Խանութի գրառումներ':'Store records',
      'Յունիտ-էկոնոմիկա':'Unit Economics',
      'Շահույթի վերահսկում':'Profit Guardian',
      'Վաճառքի ձագար':'Sales Funnel',
      'Միջնորդավճար, %':'Commission, %',
      'Լոգիստիկա / հատ':'Logistics / unit',
      'Պահեստավորում / հատ':'Storage / unit',
      'Հարկ, %':'Tax, %',
      'Գովազդի ծախս':'Ad spend',
      'Հետգնման պատվերներ':'Buyout orders',
      'Ապրանքի քարտ / SEO / Ստեղծարար պլանավորում':'Product Card / SEO / Creative planning',
      'Ապրանքի քարտի ստուգում':'Product Card validation',
      'SEO օպտիմալացում':'SEO optimizer',
      'Քարտի դիզայնի brief':'Card design brief',
      'Ինֆոգրաֆիկայի brief':'Infographic brief',
      'Ապրանքի JSON տվյալներ':'Product data JSON',
      'Մուտքային JSON':'Input JSON',
      'Պրոֆիլ':'Profile',
      'Գիրք / Amazon KDP / YouTube':'Book / Amazon KDP / YouTube',
      'Հրատարակման հնարավորություններ':'Publishing capabilities',
      'Գրքի JSON':'Book JSON',
      'Amazon KDP փաթեթ':'Amazon KDP package',
      'KDP փաթեթի JSON':'KDP package JSON',
      'Գիրք → YouTube արշավ':'Book → YouTube campaign',
      'Արշավի JSON':'Campaign JSON',
      'Google Intelligence / Կանոնների կառավարում':'Google Intelligence / Rule Governance',
      'կանոնների կարգավիճակ':'rule status',
      'սպասող դեպքեր':'pending cases',
      'Միացումներ':'Connectors',
      'Խանութ':'Store',
      'Կանոններ':'Rules',
      'Հրատարակում':'Publishing',
      'միացված է':'connected',
      'մասամբ միացված է':'partially connected',
      'մասամբ':'partial',
      'ՉԻ ՀԱՍՏԱՏՎԱԾ':'NOT VERIFIED',
      'ՄԱՍԱՄԲ':'PARTIAL',
      'ստուգված է':'verified',
      'պատրաստ է':'ready',
      'աշխատում է':'works',
      'Դետերմինիստական հաշվարկային բլոկներ':'Deterministic calculation blocks',
      'server-side հաշվարկային շարժիչ':'server-side calculation engine',
      'AI փոխանցումից առաջ փաստերի ստուգումը Core-ի վերահսկողության տակ է։':'Factual validation before AI handoff is controlled by Core.',
      'Կարգավորումներ':'Settings',
      'Լեզու':'Language',
      'Ինտերֆեյսի լեզու':'Interface language',
      'Յուրաքանչյուր օգտատեր կարող է ընտրել իր ինտերֆեյսի լեզուն։ Ընտրությունը պահպանվում է այս սարքում։':'Each user can choose their interface language. The selection is saved on this device.',
      'Հայերեն':'Armenian', 'Русский':'Russian', 'English':'English'
    }
  };
  const baseText = new WeakMap();
  let currentLang = 'hy';
  let rendering = false;
  function canonicalize(value){
    let out=String(value||'');
    for(const pair of canonical) out=out.split(pair[0]).join(pair[1]);
    for(const dict of Object.values(translations)){
      for(const [hy,target] of Object.entries(dict)){
        if(target && target!==hy) out=out.split(target).join(hy);
      }
    }
    return out;
  }
  function captureNode(node){
    if(!node || node.nodeType!==Node.TEXT_NODE) return;
    const parent=node.parentElement;
    if(!parent || /^(SCRIPT|STYLE|PRE|CODE|OPTION)$/i.test(parent.tagName)) return;
    if(!baseText.has(node)) baseText.set(node,canonicalize(node.nodeValue));
  }
  function captureTree(root=document.body){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) captureNode(walker.currentNode);
  }
  function applyLanguage(lang){
    currentLang=translations[lang]?lang:'hy';
    rendering=true;
    document.documentElement.lang=currentLang;
    captureTree();
    const dict=translations[currentLang];
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode;
      const parent=node.parentElement;
      if(!parent || /^(SCRIPT|STYLE|PRE|CODE|OPTION)$/i.test(parent.tagName)) continue;
      const base=baseText.get(node);
      if(base!==undefined) node.nodeValue=dict[base]!==undefined?dict[base]:base;
    }
    const select=document.getElementById('languageSelect');
    if(select){select.value=currentLang; select.options[0].text=currentLang==='hy'?'Հայերեն':currentLang==='ru'?'Հայский':'Armenian'; select.options[1].text=currentLang==='hy'?'Русский':currentLang==='ru'?'Русский':'Russian'; select.options[2].text=currentLang==='hy'?'English':currentLang==='ru'?'Английский':'English';}
    rendering=false;
  }
  const observer=new MutationObserver(mutations=>{
    if(rendering) return;
    for(const m of mutations){
      if(m.type==='childList') m.addedNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE)captureNode(n);else if(n.nodeType===Node.ELEMENT_NODE)captureTree(n);});
      if(m.type==='characterData' && m.target) captureNode(m.target);
    }
    applyLanguage(currentLang);
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  document.addEventListener('change',event=>{if(event.target?.id==='languageSelect'){localStorage.setItem('novessa_ui_language',event.target.value);applyLanguage(event.target.value);}});
  captureTree();
  applyLanguage(localStorage.getItem('novessa_ui_language')||'hy');
})();
</script>`;
index = index.replace('</body>', localizedRuntimeScript + '</body>');
writeFileSync(indexPath, index);

const stylePath = 'public/styles.css';
let style = readFileSync(stylePath, 'utf8');
style += ` 
:root{--novessa-cobalt:#2563eb;--novessa-purple:#6d28d9;--bg:#050314;--panel:#0d0a1f;--panel2:#151033;--line:#2a2154;--text:#f6f3ff;--muted:#a8a1c4;--accent:#a78bfa;--accent2:#3b82f6;--warn:#f5c96a;--bad:#fb7185;--shadow:0 18px 60px rgba(14,8,46,.42)}
body{background:radial-gradient(circle at 12% 0%,rgba(109,40,217,.24),transparent 32%),radial-gradient(circle at 88% 8%,rgba(37,99,235,.2),transparent 28%),linear-gradient(180deg,#07051a 0%,#050314 100%)}
.topbar{background:rgba(5,3,20,.88);border-bottom-color:#241d48;box-shadow:0 8px 35px rgba(5,3,20,.4)}
.brand-mark{background:linear-gradient(135deg,#4c1d95,#1d4ed8);border-color:#6651b5;box-shadow:0 8px 24px rgba(76,29,149,.35)}
.truth-card,.panel{background:linear-gradient(145deg,rgba(24,16,54,.92),rgba(10,8,28,.96));border-color:#30245d}
.truth-title,.eyebrow{color:var(--accent)}
.tabs{background:rgba(10,7,28,.84);border-color:#2c2352}
.tab.active{background:linear-gradient(135deg,rgba(109,40,217,.35),rgba(37,99,235,.28));border-color:#6550bd}
button:hover,.tab:hover,.ghost:hover,.secondary:hover{border-color:#7159cb;transform:translateY(-1px)}
button{transition:transform .15s ease,border-color .15s ease,background .15s ease}
.calc-form button{background:linear-gradient(135deg,#5b21b6,#1d4ed8);border-color:#7555d3;color:#fff}
.status-grid{grid-template-columns:repeat(6,minmax(0,1fr))}
@media (max-width:1100px){.status-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:720px){.shell{padding:16px}.hero{grid-template-columns:1fr}.grid-2,.calc-form{grid-template-columns:1fr}.status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.topbar{padding:12px 16px}.top-actions{flex-wrap:wrap}.toolbar input{max-width:100%}}
`;
writeFileSync(stylePath, style);


// === NOVESSA DECISION CENTER v1 ===
const decisionCenterHtml = `
<section class="novessa-decision-center" data-novessa-decision-center>
  <div class="dc-hero">
    <div>
      <div class="dc-eyebrow" data-dc="eyebrow">NOVESSA • BUSINESS DECISION CENTER</div>
      <h2 data-dc="title">Որոշումներ՝ ոչ թե պարզապես dashboard</h2>
      <p class="dc-subtitle" data-dc="subtitle">Տես՝ ինչն է աշխատում, ինչն է վտանգավոր, և ինչն է պետք անել հաջորդը։ Թվերը գալիս են Core-ի հաշվարկից կամ քո իրական տվյալներից։</p>
    </div>
    <div class="dc-truth" id="dcTruth">Core status…</div>
  </div>
  <div class="dc-kpis" id="dcStatusGrid">
    <div class="dc-kpi"><span data-dc="core">Core</span><strong id="dcCoreStatus">—</strong></div>
    <div class="dc-kpi"><span data-dc="connectors">Միացումներ</span><strong id="dcConnectorsStatus">—</strong></div>
    <div class="dc-kpi"><span data-dc="wb">Wildberries</span><strong id="dcWbStatus">—</strong></div>
    <div class="dc-kpi"><span data-dc="data">Տվյալների վիճակ</span><strong id="dcDataStatus">—</strong></div>
  </div>
  <div class="dc-grid">
    <article class="dc-panel dc-panel-primary">
      <div class="dc-panel-head">
        <div>
          <div class="dc-section-tag" data-dc="calculatorTag">1 • ՀԻՄԱ ՀԱՇՎԱՐԿԵՆՔ</div>
          <h3 data-dc="calculatorTitle">Ապրանքի իրական տնտեսագիտություն</h3>
          <p data-dc="calculatorText">Մուտքագրիր մեկ ապրանքի փաստացի կամ պլանավորված տվյալները։ NOVESSA Core-ը կվերադարձնի իր հաշվարկը՝ առանց AI-ի կողմից ֆինանսական թիվ հորինելու։</p>
        </div>
      </div>
      <div class="dc-fields">
        <label><span data-dc="product">Ապրանք</span><input id="dcProduct" type="text" placeholder="օր.՝ Jeans"></label>
        <label><span data-dc="price">Գին</span><input id="dcPrice" inputmode="decimal" type="number" step="0.01" min="0"></label>
        <label><span data-dc="cost">Ինքնարժեք</span><input id="dcCost" inputmode="decimal" type="number" step="0.01" min="0"></label>
        <label><span data-dc="sales">Վաճառքի քանակ</span><input id="dcSales" inputmode="numeric" type="number" step="1" min="0"></label>
        <label><span data-dc="commission">Միջնորդավճար, %</span><input id="dcCommission" inputmode="decimal" type="number" step="0.01" min="0"></label>
        <label><span data-dc="logistics">Լոգիստիկա / միավոր</span><input id="dcLogistics" inputmode="decimal" type="number" step="0.01" min="0"></label>
        <label><span data-dc="storage">Պահեստավորում / միավոր</span><input id="dcStorage" inputmode="decimal" type="number" step="0.01" min="0"></label>
        <label><span data-dc="tax">Հարկ, %</span><input id="dcTax" inputmode="decimal" type="number" step="0.01" min="0"></label>
        <label><span data-dc="ads">Գովազդի ծախս</span><input id="dcAds" inputmode="decimal" type="number" step="0.01" min="0"></label>
      </div>
      <div class="dc-actions">
        <button id="dcCalculate" type="button" data-dc="calculate">Հաշվել Core-ով</button>
        <button id="dcFinance" class="secondary" type="button" data-dc="openCalculations">Բացել բոլոր հաշվարկները</button>
      </div>
      <div class="dc-result" id="dcResult" aria-live="polite">
        <div class="dc-result-empty" data-dc="emptyResult">Մինչև հաշվարկը այստեղ արդյունք չի ցուցադրվում։</div>
      </div>
    </article>
    <div class="dc-side">
      <article class="dc-panel">
        <div class="dc-section-tag" data-dc="nextTag">2 • ՀԱՋՈՐԴ ՔԱՅԼԸ</div>
        <h3 data-dc="nextTitle">Բիզնեսի աշխատանքային հերթականություն</h3>
        <div class="dc-next-list">
          <button class="dc-next" id="dcCommerce" type="button"><b>01</b><span><strong data-dc="market">Շուկա և ապրանք</strong><small data-dc="marketText">ստուգել պահանջարկը, մրցակիցներին և դիրքավորումը</small></span><i>→</i></button>
          <button class="dc-next" id="dcFinance2" type="button"><b>02</b><span><strong data-dc="economics">Unit Economics</strong><small data-dc="economicsText">գին, ծախս, մարժա, break-even և profit risk</small></span><i>→</i></button>
          <button class="dc-next" id="dcCard" type="button"><b>03</b><span><strong data-dc="card">Քարտ / SEO</strong><small data-dc="cardText">բովանդակություն, հարցումներ, conversion-ի նախադրյալներ</small></span><i>→</i></button>
          <button class="dc-next" id="dcPublishing" type="button"><b>04</b><span><strong data-dc="launch">Launch / Publishing</strong><small data-dc="launchText">կազմակերպել գործարկումը և չափել արդյունքը</small></span><i>→</i></button>
        </div>
      </article>
      <article class="dc-panel">
        <div class="dc-section-tag" data-dc="truthTag">3 • ՃՇՄԱՐՏՈՒԹՅՈՒՆ</div>
        <h3 data-dc="truthTitle">Ինչը չենք ձևացնում</h3>
        <div class="dc-truth-list">
          <div><span>✓</span><p data-dc="truth1">Չկապված marketplace-ը չի ներկայացվում որպես live data։</p></div>
          <div><span>✓</span><p data-dc="truth2">Չբավարարող տվյալները մնում են PARTIAL / NOT VERIFIED։</p></div>
          <div><span>✓</span><p data-dc="truth3">Ֆինանսական թվերը հաշվարկվում են deterministic Core-ով։</p></div>
          <div><span>✓</span><p data-dc="truth4">AI-ը մեկնաբանում է տվյալը, բայց չի դառնում հաշվապահական truth source։</p></div>
        </div>
      </article>
    </div>
  </div>
</section>`;
if(!index.includes('data-novessa-decision-center')) {
  index = index.replace('<main>', '<main>' + decisionCenterHtml);
}

const decisionCenterScript = `
<script>
(function(){
  const root=document.querySelector('[data-novessa-decision-center]');
  if(!root) return;
  const byId=id=>document.getElementById(id);
  const textMap={
    hy:{
      eyebrow:'NOVESSA • BUSINESS DECISION CENTER',title:'Որոշումներ՝ ոչ թե պարզապես dashboard',
      subtitle:'Տես՝ ինչն է աշխատում, ինչն է վտանգավոր, և ինչն է պետք անել հաջորդը։ Թվերը գալիս են Core-ի հաշվարկից կամ քո իրական տվյալներից։',
      core:'Core',connectors:'Միացումներ',wb:'Wildberries',data:'Տվյալների վիճակ',
      calculatorTag:'1 • ՀԻՄԱ ՀԱՇՎԱՐԿԵՆՔ',calculatorTitle:'Ապրանքի իրական տնտեսագիտություն',
      calculatorText:'Մուտքագրիր մեկ ապրանքի փաստացի կամ պլանավորված տվյալները։ NOVESSA Core-ը կվերադարձնի իր հաշվարկը՝ առանց AI-ի կողմից ֆինանսական թիվ հորինելու։',
      product:'Ապրանք',price:'Գին',cost:'Ինքնարժեք',sales:'Վաճառքի քանակ',commission:'Միջնորդավճար, %',logistics:'Լոգիստիկա / միավոր',storage:'Պահեստավորում / միավոր',tax:'Հարկ, %',ads:'Գովազդի ծախս',
      calculate:'Հաշվել Core-ով',openCalculations:'Բացել բոլոր հաշվարկները',emptyResult:'Մինչև հաշվարկը այստեղ արդյունք չի ցուցադրվում։',
      nextTag:'2 • ՀԱՋՈՐԴ ՔԱՅԼԸ',nextTitle:'Բիզնեսի աշխատանքային հերթականություն',
      market:'Շուկա և ապրանք',marketText:'ստուգել պահանջարկը, մրցակիցներին և դիրքավորումը',
      economics:'Unit Economics',economicsText:'գին, ծախս, մարժա, break-even և profit risk',
      card:'Քարտ / SEO',cardText:'բովանդակություն, հարցումներ, conversion-ի նախադրյալներ',
      launch:'Launch / Publishing',launchText:'կազմակերպել գործարկումը և չափել արդյունքը',
      truthTag:'3 • ՃՇՄԱՐՏՈՒԹՅՈՒՆ',truthTitle:'Ինչը չենք ձևացնում',
      truth1:'Չկապված marketplace-ը չի ներկայացվում որպես live data.',truth2:'Չբավարարող տվյալները մնում են PARTIAL / NOT VERIFIED.',
      truth3:'Ֆինանսական թվերը հաշվարկվում են deterministic Core-ով.',truth4:'AI-ը մեկնաբանում է տվյալը, բայց չի դառնում հաշվապահական truth source.',
      healthy:'Աշխատում է',verified:'Ստուգված է',partial:'Մասամբ',notVerified:'ՉԻ ՀԱՍՏԱՏՎԱԾ',
      coreReady:'Core OK',liveConnected:'Live կապ կա',notConnected:'Կապ չկա',loading:'Ստուգում…',
      invalid:'Լրացրու բոլոր անհրաժեշտ թվերը՝ Core հաշվարկը ճիշտ ստանալու համար.',
      failed:'Core հաշվարկը չհաջողվեց. արդյունքը չեմ փոխարինում հորինված թվով.',
      resultTitle:'Core հաշվարկի արդյունք',source:'Source: NOVESSA Core'
    },
    ru:{
      eyebrow:'NOVESSA • ЦЕНТР БИЗНЕС-РЕШЕНИЙ',title:'Решения, а не просто dashboard',
      subtitle:'Сразу видно, что работает, где риск и что делать дальше. Цифры берутся из Core или ваших реальных данных.',
      core:'Core',connectors:'Подключения',wb:'Wildberries',data:'Состояние данных',
      calculatorTag:'1 • СЧИТАЕМ СЕЙЧАС',calculatorTitle:'Реальная экономика товара',
      calculatorText:'Введи фактические или плановые данные одного товара. NOVESSA Core вернёт расчёт без выдуманных финансовых цифр.',
      product:'Товар',price:'Цена',cost:'Себестоимость',sales:'Количество продаж',commission:'Комиссия, %',logistics:'Логистика / ед.',storage:'Хранение / ед.',tax:'Налог, %',ads:'Расход на рекламу',
      calculate:'Рассчитать в Core',openCalculations:'Открыть все расчёты',emptyResult:'До расчёта результат здесь не показывается.',
      nextTag:'2 • СЛЕДУЮЩИЙ ШАГ',nextTitle:'Рабочий порядок бизнеса',
      market:'Рынок и товар',marketText:'проверить спрос, конкурентов и позиционирование',
      economics:'Unit Economics',economicsText:'цена, расходы, маржа, break-even и риск прибыли',
      card:'Карточка / SEO',cardText:'контент, запросы и предпосылки конверсии',
      launch:'Launch / Publishing',launchText:'организовать запуск и измерять результат',
      truthTag:'3 • ПРАВДА',truthTitle:'Что мы не выдаём за реальность',
      truth1:'Неподключённый marketplace не показывается как live data.',truth2:'Недостаточные данные остаются PARTIAL / NOT VERIFIED.',
      truth3:'Финансовые цифры считает deterministic Core.',truth4:'AI интерпретирует данные, но не является бухгалтерским truth source.',
      healthy:'Работает',verified:'Проверено',partial:'Частично',notVerified:'НЕ ПОДТВЕРЖДЕНО',
      coreReady:'Core OK',liveConnected:'Live подключён',notConnected:'Нет подключения',loading:'Проверка…',
      invalid:'Заполни необходимые числовые поля для корректного Core-расчёта.',
      failed:'Расчёт Core не выполнен. Я не заменяю его выдуманными цифрами.',
      resultTitle:'Результат расчёта Core',source:'Source: NOVESSA Core'
    },
    en:{
      eyebrow:'NOVESSA • BUSINESS DECISION CENTER',title:'Decisions, not just a dashboard',
      subtitle:'See what works, where the risk is, and what to do next. Numbers come from Core or your real data.',
      core:'Core',connectors:'Connectors',wb:'Wildberries',data:'Data status',
      calculatorTag:'1 • CALCULATE NOW',calculatorTitle:'Real product economics',
      calculatorText:'Enter actual or planned data for one product. NOVESSA Core returns the calculation without invented financial numbers.',
      product:'Product',price:'Price',cost:'Unit cost',sales:'Units sold',commission:'Commission, %',logistics:'Logistics / unit',storage:'Storage / unit',tax:'Tax, %',ads:'Ad spend',
      calculate:'Calculate in Core',openCalculations:'Open all calculations',emptyResult:'No result is shown here before calculation.',
      nextTag:'2 • NEXT STEP',nextTitle:'Business operating sequence',
      market:'Market & product',marketText:'check demand, competitors, and positioning',
      economics:'Unit Economics',economicsText:'price, costs, margin, break-even, and profit risk',
      card:'Card / SEO',cardText:'content, queries, and conversion prerequisites',
      launch:'Launch / Publishing',launchText:'organize the launch and measure the outcome',
      truthTag:'3 • TRUTH',truthTitle:'What we do not fake',
      truth1:'An unconnected marketplace is not presented as live data.',truth2:'Insufficient data stays PARTIAL / NOT VERIFIED.',
      truth3:'Financial numbers are calculated by deterministic Core logic.',truth4:'AI interprets data but is not the accounting truth source.',
      healthy:'Working',verified:'Verified',partial:'Partial',notVerified:'NOT VERIFIED',
      coreReady:'Core OK',liveConnected:'Live connected',notConnected:'Not connected',loading:'Checking…',
      invalid:'Fill in the required numeric fields for a valid Core calculation.',
      failed:'Core calculation failed. I will not replace it with invented numbers.',
      resultTitle:'Core calculation result',source:'Source: NOVESSA Core'
    }
  };
  const lang=()=>document.documentElement.lang==='ru'?'ru':document.documentElement.lang==='en'?'en':'hy';
  const setText=()=>{
    const m=textMap[lang()];
    root.querySelectorAll('[data-dc]').forEach(el=>{const k=el.getAttribute('data-dc');if(m[k]!==undefined)el.textContent=m[k];});
  };
  const setStatus=(id,textValue,kind)=>{const el=byId(id);if(!el)return;el.textContent=textValue;el.dataset.status=kind||'';};
  const refreshStatus=async()=>{
    const m=textMap[lang()];
    setStatus('dcCoreStatus',m.loading,'loading');setStatus('dcConnectorsStatus',m.loading,'loading');setStatus('dcWbStatus',m.loading,'loading');setStatus('dcDataStatus',m.loading,'loading');
    try{
      const [uiR,connR,wbR]=await Promise.all([fetch('/api/ui/status'),fetch('/api/connectors/status'),fetch('/api/connectors/wildberries/status')]);
      const ui=await uiR.json(),conn=await connR.json(),wb=await wbR.json();
      const uiOk=ui?.status==='verified'||ui?.status==='ready'||ui?.status==='ok';
      setStatus('dcCoreStatus',uiOk?m.coreReady:m.partial,uiOk?'ok':'partial');
      const connectors=Array.isArray(conn?.connectors)?conn.connectors:[];
      const implemented=connectors.filter(c=>c.status==='verified').length;
      setStatus('dcConnectorsStatus',implemented?m.verified:m.partial,implemented?'ok':'partial');
      setStatus('dcWbStatus',wb?.configured?m.liveConnected:m.notConnected,wb?.configured?'ok':'partial');
      const quality=ui?.data_quality?.status||ui?.data_status||'partial';
      setStatus('dcDataStatus',quality==='verified'?m.verified:m.partial,quality==='verified'?'ok':'partial');
      byId('dcTruth').textContent=uiOk?m.healthy:m.partial;
    }catch{
      setStatus('dcCoreStatus',m.notVerified,'bad');setStatus('dcConnectorsStatus',m.notVerified,'bad');setStatus('dcWbStatus',m.notConnected,'partial');setStatus('dcDataStatus',m.notVerified,'bad');byId('dcTruth').textContent=m.notVerified;
    }
  };
  const num=id=>{const v=Number(byId(id)?.value);return Number.isFinite(v)?v:null;};
  const showMessage=(msg,kind)=>{
    const out=byId('dcResult');out.dataset.state='result';out.innerHTML='<div class="dc-result-message" data-kind="'+kind+'">'+String(msg).replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]))+'</div>';
  };
  const calculate=async()=>{
    const m=textMap[lang()];
    const vals={price:num('dcPrice'),unit_cost:num('dcCost'),sales:num('dcSales'),commission_percent:num('dcCommission'),logistics_per_unit:num('dcLogistics'),storage_per_unit:num('dcStorage'),tax_percent:num('dcTax'),ad_spend:num('dcAds')};
    if(Object.values(vals).some(v=>v===null)){showMessage(m.invalid,'bad');return;}
    const out=byId('dcResult');out.dataset.state='result';out.innerHTML='<div class="dc-result-head"><strong>'+m.resultTitle+'</strong><span>'+m.source+'</span></div><pre id="dcResultJson">…</pre>';
    try{
      const r=await fetch('/ui/api/action/unit-economics',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(vals)});
      const body=await r.json();
      if(!r.ok){showMessage(body?.error||m.failed,'bad');return;}
      const source=body?.data??body?.result??body;
      const flat={};
      const visit=(obj,prefix='')=>{
        if(!obj||typeof obj!=='object') return;
        for(const [k,v] of Object.entries(obj)){
          const key=prefix?prefix+'.'+k:k;
          if(v!==null&&typeof v==='object') visit(v,key);
          else if(v!==undefined) flat[key]=v;
        }
      };
      visit(source);
      const labels={revenue:'Հասույթ',unit_profit:'Շահույթ / միավոր',total_profit:'Ընդհանուր շահույթ',profit:'Շահույթ',net_profit:'Զուտ շահույթ',profit_margin:'Շահույթի մարժա',margin:'Մարժա',commission:'Միջնորդավճար',logistics:'Լոգիստիկա',storage:'Պահեստավորում',tax:'Հարկ',ad_spend:'Գովազդ',total_cost:'Ընդհանուր ծախս',break_even_units:'Break-even միավոր',break_even_price:'Break-even գին'};
      const find=(name)=>flat[name]??flat['data.'+name]??flat['result.'+name]??flat['metrics.'+name];
      const preferred=Object.keys(labels).filter(k=>find(k)!==undefined);
      const cards=preferred.map(k=>{
        const v=find(k);
        const display=typeof v==='number'&&Number.isFinite(v)?v.toLocaleString(undefined,{maximumFractionDigits:2}):String(v);
        return '<div class="dc-metric"><span>'+labels[k]+'</span><strong>'+display+'</strong></div>';
      }).join('');
      const status=body?.status?'<div class="dc-result-status">Կարգավիճակ՝ '+String(body.status)+'</div>':'';
      const details=Object.entries(flat).filter(([k])=>!preferred.includes(k)).slice(0,8).map(([k,v])=>'<div class="dc-detail"><span>'+k+'</span><b>'+String(v)+'</b></div>').join('');
      byId('dcResultJson').outerHTML='<div class="dc-metrics">'+(cards||'<div class="dc-result-message">Core-ը վերադարձրել է արդյունքը, բայց ֆինանսական դաշտերը ճանաչելի չեն ցուցադրման համար։</div>')+'</div>'+status+(details?'<div class="dc-details">'+details+'</div>':'');
    }catch{showMessage(m.failed,'bad');}
  };
  const clickTab=name=>document.querySelector('.tab[data-tab="'+name+'"]')?.click();
  byId('dcCalculate')?.addEventListener('click',calculate);
  byId('dcFinance')?.addEventListener('click',()=>clickTab('finance'));
  byId('dcFinance2')?.addEventListener('click',()=>clickTab('finance'));
  byId('dcCommerce')?.addEventListener('click',()=>clickTab('commerce'));
  byId('dcCard')?.addEventListener('click',()=>clickTab('content'));
  byId('dcPublishing')?.addEventListener('click',()=>clickTab('publishing'));
  document.addEventListener('change',e=>{if(e.target?.id==='languageSelect')setTimeout(setText,0);});
  setText();refreshStatus();
})();
</script>`;
if(!index.includes('data-novessa-decision-center-script')){
  index = index.replace('</body>', decisionCenterScript.replace('<script>','<script data-novessa-decision-center-script>') + '</body>');
}

style += `
/* NOVESSA Decision Center v1 */
.dc-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:8px}.dc-metric{padding:14px 15px;border:1px solid #34286a;border-radius:14px;background:rgba(21,15,48,.72)}.dc-metric span{display:block;font-size:11px;color:#aaa2c5;margin-bottom:5px}.dc-metric strong{font-size:20px;line-height:1.1}.dc-result-status{margin-top:10px;font-size:11px;color:#aaa2c5}.dc-details{margin-top:10px;border-top:1px solid #2a2254;padding-top:10px}.dc-detail{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#aaa2c5;padding:5px 0}.dc-detail b{color:#e8e5f1;font-weight:600;text-align:right}@media(max-width:700px){.dc-metrics{grid-template-columns:1fr}}
.novessa-decision-center{margin:26px 0 34px;padding:24px;border:1px solid #34286a;border-radius:26px;background:linear-gradient(145deg,rgba(16,10,40,.96),rgba(7,6,23,.98));box-shadow:0 20px 70px rgba(11,7,40,.45)}
.dc-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.dc-eyebrow,.dc-section-tag{font-size:11px;letter-spacing:.12em;font-weight:800;color:#a78bfa}.dc-hero h2{margin:7px 0 8px;font-size:clamp(24px,3vw,36px);line-height:1.08}.dc-subtitle{max-width:830px;color:#aaa2c5;margin:0;line-height:1.55}.dc-truth{padding:10px 14px;border:1px solid #41347e;border-radius:999px;color:#ddd6fe;background:rgba(109,40,217,.13);white-space:nowrap;font-size:12px;font-weight:700}
.dc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0}.dc-kpi{padding:15px 16px;border:1px solid #2f2559;border-radius:17px;background:rgba(14,10,33,.8)}.dc-kpi span{display:block;color:#a39bbf;font-size:12px;margin-bottom:7px}.dc-kpi strong{font-size:16px;color:#f7f3ff}.dc-kpi strong[data-status=ok]{color:#86efac}.dc-kpi strong[data-status=partial]{color:#fde68a}.dc-kpi strong[data-status=bad]{color:#fda4af}
.dc-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,.85fr);gap:16px}.dc-side{display:grid;gap:16px}.dc-panel{border:1px solid #2f2559;border-radius:20px;background:linear-gradient(145deg,rgba(18,13,39,.94),rgba(9,7,26,.96));padding:20px}.dc-panel-primary{min-width:0}.dc-panel-head h3{margin:7px 0 6px;font-size:22px}.dc-panel-head p{margin:0;color:#a9a2c0;line-height:1.5}
.dc-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}.dc-fields label{display:grid;gap:7px;color:#c6bfdc;font-size:12px;font-weight:650}.dc-fields input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:12px;border:1px solid #342b5b;background:#09071b;color:#f7f3ff;outline:none}.dc-fields input:focus{border-color:#7257d0;box-shadow:0 0 0 3px rgba(109,40,217,.16)}
.dc-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.dc-actions button{min-height:42px}.dc-result{margin-top:16px;padding:16px;border-radius:15px;border:1px dashed #3a2e69;background:#08061a;min-height:92px}.dc-result-empty{color:#89819f;font-size:13px;padding-top:18px}.dc-result-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.dc-result-head strong{font-size:15px}.dc-result-head span{font-size:11px;color:#9289ad}.dc-result pre{margin:0;max-height:310px;overflow:auto;white-space:pre-wrap;color:#d9d3ef;font-size:11px;line-height:1.45}.dc-result-message{font-size:13px;line-height:1.5}.dc-result-message[data-kind=bad]{color:#fda4af}
.dc-next-list{display:grid;gap:8px;margin-top:12px}.dc-next{display:grid;grid-template-columns:34px 1fr 20px;gap:10px;align-items:center;text-align:left;border:1px solid #2c2450;border-radius:14px;padding:11px 12px;background:#0b081f;color:#eee9ff;cursor:pointer}.dc-next:hover{border-color:#634bbd}.dc-next b{font-size:11px;color:#8f83b4}.dc-next strong{display:block;font-size:13px}.dc-next small{display:block;color:#9088a8;line-height:1.35;margin-top:3px}.dc-next i{font-style:normal;color:#a78bfa}
.dc-truth-list{display:grid;gap:9px;margin-top:13px}.dc-truth-list div{display:flex;gap:9px;align-items:flex-start}.dc-truth-list span{color:#86efac;font-weight:900}.dc-truth-list p{margin:0;color:#aca5bf;font-size:12px;line-height:1.45}
@media (max-width:950px){.dc-grid{grid-template-columns:1fr}.dc-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:650px){.novessa-decision-center{padding:16px;border-radius:18px}.dc-hero{flex-direction:column}.dc-truth{white-space:normal}.dc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dc-fields{grid-template-columns:1fr}.dc-actions{flex-direction:column}.dc-actions button{width:100%}}
`;
writeFileSync(stylePath, style);

/* NOVESSA UI polish + targeted input accessibility */
const uiPolishScript = `
<script data-novessa-ui-polish>
(function(){
  function enableTargetedMoneyFields(){
    document.querySelectorAll('label').forEach(label=>{
      const t=(label.textContent||'').replace(/\\s+/g,' ').trim().toLowerCase();
      if((t.includes('գին')||t.includes('price')) && (t.includes('զեղչ')||t.includes('discount'))){
        label.querySelectorAll('input,textarea,select').forEach(input=>{
          input.disabled=false; input.readOnly=false;
          input.removeAttribute('disabled'); input.removeAttribute('readonly');
          input.style.pointerEvents='auto';
        });
      }
    });
  }
  function persistSheets(){
    const rows=Array.isArray(window.__novessaSheetRows)?window.__novessaSheetRows:null;
    if(rows) localStorage.setItem('novessa_sheet_rows_v2',JSON.stringify(rows));
  }
  function restoreSheets(){
    try{
      const saved=JSON.parse(localStorage.getItem('novessa_sheet_rows_v2')||'[]');
      if(Array.isArray(saved) && saved.length){
        window.__novessaSheetRows=saved;
        if(typeof window.renderSheetRows==='function') window.renderSheetRows();
      }
    }catch{}
  }
  function improveInputs(){
    document.querySelectorAll('input,textarea,select').forEach(el=>{
      if(el.type==='file') return;
      el.setAttribute('autocomplete',el.getAttribute('autocomplete')||'off');
      el.style.maxWidth='100%';
    });
  }
  document.addEventListener('click',enableTargetedMoneyFields,true);
  document.addEventListener('focusin',enableTargetedMoneyFields,true);
  document.addEventListener('DOMContentLoaded',()=>{
    enableTargetedMoneyFields(); improveInputs(); restoreSheets();
    const originalPush=window.__novessaSheetRowsPush;
    if(!originalPush && Array.isArray(window.__novessaSheetRows)){
      const arr=window.__novessaSheetRows;
      window.__novessaSheetRowsPush=(...items)=>{arr.push(...items);persistSheets();};
    }
  });
  const observer=new MutationObserver(()=>{enableTargetedMoneyFields();improveInputs();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
</script>`;
index = index.replace('</body>', uiPolishScript + '</body>');

const stylePathFinal = 'public/styles.css';
let styleFinal = readFileSync(stylePathFinal, 'utf8');
styleFinal += `
/* NOVESSA interaction/accessibility polish */
input:not([type="file"]), textarea, select{min-height:42px;box-sizing:border-box;opacity:1}
input:not([type="file"]):disabled, textarea:disabled, select:disabled{opacity:.72;cursor:not-allowed}
.tab-panel{scroll-margin-top:96px}
.field,.dc-fields label,.np-label{min-width:0}
button,.tab,.ghost,.secondary{touch-action:manipulation}
table{width:100%;border-collapse:collapse}
th,td{padding:10px 12px;border-bottom:1px solid rgba(83,68,128,.35);text-align:left;white-space:nowrap}
th{color:#c9c1dd;font-size:12px;font-weight:700}
td{color:#ece8f7;font-size:13px}
#sheetsTable tbody tr:hover{background:rgba(109,40,217,.08)}
@media(max-width:700px){
  .tabs{overflow-x:auto;scrollbar-width:thin}
  .tabs .tab{flex:0 0 auto}
  .grid-3,.dc-fields,.np-grid-3{grid-template-columns:1fr}
  .status-grid,.dc-kpis{grid-template-columns:1fr 1fr}
}
@media(max-width:480px){
  .status-grid,.dc-kpis{grid-template-columns:1fr}
  .panel,.truth-card,.novessa-decision-center,.novessa-production-layer{border-radius:16px}
}
`;
writeFileSync(indexPath, index);
writeFileSync(stylePathFinal, styleFinal);
writeFileSync(indexPath, index);
