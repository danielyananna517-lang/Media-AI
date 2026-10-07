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

function sha256(s){ return crypto.createHash('sha256').update(s).digest('hex'); }
function base64url(buffer){ return buffer.toString('base64').replace(/=/g,'').replace(/\\+/g,'-').replace(/\\\//g,'_'); }
function signature(secret, timestamp, requestId, body){
  const payload = timestamp + '.' + requestId + '.' + sha256(body);
  return base64url(crypto.createHmac('sha256', secret).update(payload).digest());
}

export async function requestMedia({operation, input, requestId='media-' + crypto.randomUUID(), fetchImpl=fetch, nowMs=Date.now()} = {}) {
  const production = String(process.env.NOVESSA_ENV || '').toLowerCase() === 'production';
  const rawBase = String(process.env.NOVESSA_GATEWAY_BASE_URL || '').trim();
  const secret = String(process.env.NOVESSA_GATEWAY_SHARED_SECRET || '');
  if (!rawBase || !secret) return result(STATUS.PROVIDER_UNAVAILABLE, { error:'media_gateway_not_configured' });
  const baseValidation = validateGatewayUrl(rawBase, { production });
  if (!baseValidation.ok) return result(STATUS.PROVIDER_UNAVAILABLE, { error:baseValidation.error });
  const base = baseValidation.url;
  const body = JSON.stringify({ contract_version:'1.0', request_id:requestId, source:'novessa', target:'media-ai', operation, input });
  const timestamp = String(Math.trunc(nowMs));
  const headers = {
    'content-type':'application/json',
    'x-service-id':'novessa-core',
    'x-timestamp':timestamp,
    'x-request-id':requestId,
    'x-service-signature':signature(secret,timestamp,requestId,body)
  };
  try {
    const r = await fetchImpl(base + '/v1/media/request', {method:'POST', headers, body, redirect:'error'});
    const raw = await r.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { return result(STATUS.ERROR,{ error:'media_gateway_invalid_json', http_status:r.status }); }
    if (payload?.status === STATUS.PROVIDER_UNAVAILABLE) return payload;
    const validEnvelope = payload?.contract_version === '1.0' && payload?.request_id === requestId;
    if (validEnvelope && (payload?.status === STATUS.INPUT_INCOMPLETE || payload?.status === STATUS.PARTIAL || payload?.status === STATUS.VERIFIED || payload?.status === STATUS.ERROR || payload?.status === STATUS.PROVIDER_UNAVAILABLE)) return payload;
    if (!r.ok) return result(STATUS.ERROR,{ http_status:r.status, upstream:payload });
    return result(STATUS.ERROR,{ error:'media_gateway_unrecognized_status', http_status:r.status });
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

const appPath = 'public/app.js';
let app = readFileSync(appPath, 'utf8');
app = app.replace(
  "catch(err){ if(out) out.textContent=pretty(err.body||{status:'error',error:err.message}); }",
  "catch(err){ if(out){ const body=err.body||{}; const lang=document.documentElement.lang||'hy'; const m={hy:{auth:'Այս գործողությունը պաշտպանված է։ Մուտքի կոդը մուտքագրիր Կարգավորումներ բաժնում և կրկին փորձիր։',not:'Մուտքի կոդը Vercel Production-ում կարգավորված չէ։'},ru:{auth:'Это действие защищено. Введи код доступа в разделе «Настройки» и попробуй снова.',not:'Код доступа не настроен в Vercel Production.'},en:{auth:'This action is protected. Enter the access code in Settings and try again.',not:'The access code is not configured in Vercel Production.'}}[lang]||{}; if(body.error==='ui_auth_required') out.textContent=m.auth; else if(body.error==='ui_token_not_configured') out.textContent=m.not; else out.textContent=pretty(body||{status:'error',error:err.message}); } }"
);
writeFileSync(appPath, app);
const sheetsAppCode = "const sheetRows=[];\nconst sheetI18n={hy:{added:'Տողը ավելացվեց։',imported:'Ներմուծված տողեր՝ ',url:'Մուտքագրիր Google Sheets-ի հղումը։',host:'Թույլատրվում է միայն Google հղումը։',bad:'Google Sheets-ի հղումը ճիշտ չէ։'},ru:{added:'Строка добавлена.',imported:'Импортировано строк: ',url:'Введи ссылку Google Sheets.',host:'Разрешена только ссылка Google.',bad:'Ссылка Google Sheets неверна.'},en:{added:'Row added.',imported:'Imported rows: ',url:'Enter the Google Sheets link.',host:'Only a Google link is allowed.',bad:'The Google Sheets link is invalid.'}}; function sheetMsg(key,extra=''){const lang=document.documentElement.lang||'hy';return (sheetI18n[lang]||sheetI18n.hy)[key]+extra;}\nfunction csvEscape(v){const s=String(v??'');return '\"' + s.replace(/\"/g,'\"\"') + '\"';}\nfunction renderSheetRows(){\n  const body=$('#sheetsTable tbody'); if(!body) return;\n  body.innerHTML=sheetRows.map(r=>'<tr>'+r.map(v=>'<td>'+String(v).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</td>').join('')+'</tr>').join('');\n}\n$('#addSheetRowBtn')?.addEventListener('click',()=>{\n  const r=[$('#sheetProduct')?.value||'', $('#sheetPrice')?.value||'', $('#sheetCost')?.value||'', $('#sheetQty')?.value||'', $('#sheetSales')?.value||'', $('#sheetStock')?.value||''];\n  if(!r[0]) return;\n  sheetRows.push(r); renderSheetRows();\n  ['sheetProduct','sheetPrice','sheetCost','sheetQty','sheetSales','sheetStock'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});\n  const out=$('#out-sheets'); if(out) out.textContent=sheetMsg('added');\n});\n$('#exportSheetBtn')?.addEventListener('click',()=>{\n  const rows=[['Ապրանք','Գին','Ինքնարժեք','Քանակ','Վաճառք','Մնացորդ'],...sheetRows];\n  const csv='\\ufeff'+rows.map(r=>r.map(csvEscape).join(',')).join('\\n');\n  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='novessa-sheets.csv'; a.click();\n});\n$('#csvTemplateBtn')?.addEventListener('click',()=>{\n  const csv='\\ufeffАպրանք,Цена,Себестоимость,Количество,Продажи,Остаток\\n';\n  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='novessa-sheets-template.csv'; a.click();\n});\n$('#csvFile')?.addEventListener('change',async(e)=>{\n  const file=e.target.files?.[0]; if(!file) return;\n  const raw=await file.text();\n  const lines=raw.replace(/^\\ufeff/,'').split(/\\r?\\n/).filter(Boolean);\n  const parsed=lines.slice(1).map(line=>line.split(',').map(v=>v.replace(/^\"|\"$/g,'').replace(/\"\"/g,'\"'))).filter(r=>r.length>=6);\n  sheetRows.push(...parsed.map(r=>r.slice(0,6))); renderSheetRows();\n  const out=$('#out-sheets'); if(out) out.textContent=sheetMsg('imported',parsed.length);\n});\n$('#sheetLinkBtn')?.addEventListener('click',()=>{\n  const url=$('#sheetUrl')?.value?.trim(), out=$('#out-sheets');\n  if(!url){if(out)out.textContent=sheetMsg('url');return;}\n  try{\n    const u=new URL(url);\n    if(!/^(docs\\.google\\.com|drive\\.google\\.com)$/.test(u.hostname)){if(out)out.textContent='Թույլատրվում է միայն Google հղումը։';return;}\n    window.open(u.href,'_blank','noopener');\n  }catch{if(out)out.textContent=sheetMsg('bad');}\n});\n\n";
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
:root{--bg:#050314;--panel:#0d0a1f;--panel2:#151033;--line:#2a2154;--text:#f6f3ff;--muted:#a8a1c4;--accent:#a78bfa;--accent2:#3b82f6;--warn:#f5c96a;--bad:#fb7185;--shadow:0 18px 60px rgba(14,8,46,.42)}
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

