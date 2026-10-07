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
function base64url(buffer){ return buffer.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
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
  ['Novessa-ն միավորում է ապրանքները, վաճառքը, շահույթը, marketplace-ների տվյալները, SEO-ն և կանոնների վերահսկումը մեկ համակարգում։','Novessa-ն միավորում է ապրանքները, վաճառքը, շահույթը, շուկաների տվյալները, SEO-ն և կանոնների վերահսկումը մեկ համակարգում։']
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
  const baseText = new WeakMap();
  let currentLang = localStorage.getItem('novessa_ui_language') || 'hy';
  let rendering = false;

  function captureBaseText(root=document.body){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    for(const node of nodes){
      const parent=node.parentElement;
      if(!parent || /^(SCRIPT|STYLE|PRE|CODE|OPTION)$/i.test(parent.tagName)) continue;
      if(!baseText.has(node)) baseText.set(node,node.nodeValue);
    }
  }

  const translations = {
    hy: {
      'REAL CORE • DETERMINISTIC • AUDITABLE':'ԻՐԱԿԱՆ CORE • ՀԱՇՎԱՐԿԱՅԻՆ • ՍՏՈՒԳԵԼԻ',
      'Core':'Core',
      'Ready':'Պատրաստ է',
      'Connectors':'Միացումներ',
      'Store':'Խանութ',
      'Rules':'Կանոններ',
      'Publishing':'Հրապարակում',
      'implemented':'միացված է',
      'partial':'մասամբ',
      'not_verified':'չի հաստատված',
      'not_ready':'պատրաստ չէ',
      'Core աշխատում է':'Core-ը աշխատում է',
      'Core-ը պահանջում է ստուգում':'Core-ը պահանջում է ստուգում',
      'Տվյալ չկա':'Տվյալ չկա',
      'Working…':'Աշխատում է…',
      'Աշխատում է…':'Աշխատում է…',
      'JSON input-ի սխալ':'JSON մուտքային տվյալների սխալ',
      'Rule packs':'Կանոնների փաթեթներ',
      'Pending cases':'Սպասող դեպքեր',
      'Store records':'Խանութի գրառումներ',
      'Status':'Կարգավիճակ',
      'Settings':'Կարգավորումներ',
      'Language':'Լեզու',
      'Access code':'Մուտքի կոդ'
    },
    ru: {
      'Core':'Core',
      'Ready':'Готово',
      'Connectors':'Подключения',
      'Store':'Магазин',
      'Rules':'Правила',
      'Publishing':'Публикация',
      'implemented':'подключено',
      'partial':'частично',
      'not_verified':'не подтверждено',
      'not_ready':'не готово',
      'Core-ը աշխատում է':'Core работает',
      'Core աշխատում է':'Core работает',
      'Core-ը պահանջում է ստուգում':'Core требует проверки',
      'Տվյալ չկա':'Нет данных',
      'Working…':'Выполняется…',
      'Աշխատում է…':'Выполняется…',
      'JSON մուտքային տվյալների սխալ':'Ошибка входного JSON',
      'Rule packs':'Пакеты правил',
      'Pending cases':'Ожидающие случаи',
      'Store records':'Записи магазина',
      'ԻՐԱԿԱՆ CORE • ՀԱՇՎԱՐԿԱՅԻՆ • ՍՏՈՒԳԵԼԻ':'REAL CORE • РАСЧЁТНЫЙ • ПРОВЕРЯЕМЫЙ',
      'ՄԱՍԱՄԲ / ՉԻ ՀԱՍՏԱՏՎԱԾ':'ЧАСТИЧНО / НЕ ПОДТВЕРЖДЕНО',
      'սերվերային հաշվարկային շարժիչ':'серверный расчётный движок',
      'Յունիտ-էկոնոմիկա':'Юнит-экономика',
      'Շահույթի վերահսկում':'Контроль прибыли',
      'Վաճառքի ձագար':'Воронка продаж',
      'Միջնորդավճար, %':'Комиссия, %',
      'Լոգիստիկա / միավոր':'Логистика / шт.',
      'Պահեստավորում / միավոր':'Хранение / шт.',
      'Հարկ, %':'Налог, %',
      'Գովազդի ծախս':'Расходы на рекламу',
      'JSON տվյալներ':'JSON-данные',
      'Գնված պատվերներ':'Выкупленные заказы',
      'Ապրանքի քարտ / SEO / ստեղծարար պլանավորում':'Карточка товара / SEO / креативное планирование',
      'AI փոխանցում':'Передача в AI',
      'փաստային ստուգում':'проверка фактов',
      'Ապրանքի քարտի ստուգում':'Проверка карточки товара',
      'SEO օպտիմիզատոր':'SEO-оптимизатор',
      'Ապրանքի տվյալների JSON':'JSON данных товара',
      'Քարտի դիզայնի brief':'Бриф дизайна карточки',
      'Մուտքային JSON':'Входной JSON',
      'Ինֆոգրաֆիկայի brief':'Бриф инфографики',
      'Գիրք → YouTube արշավ':'Книга → YouTube-кампания',
      'Հրապարակման հնարավորություններ':'Возможности публикации',
      'Amazon KDP փաթեթ':'Пакет Amazon KDP',
      'Արշավի JSON':'JSON кампании',
      'Google Intelligence / կանոնների կառավարում':'Google Intelligence / управление правилами',
      'Սպասող governance դեպքեր':'Ожидающие случаи governance',
      'Խանութը ստուգված է':'Магазин проверен',
      'Կանոնները ստուգված են':'Правила проверены',
      'Հրապարակումը ստուգված է':'Публикация проверена',
      'Կարգավորումներ':'Настройки',
      'Լեզու':'Язык',
      'Մուտքի կոդ':'Код доступа',
      'Ինտերֆեյսի լեզու':'Язык интерфейса',
      'Յուրաքանչյուր օգտատեր կարող է ընտրել իր ինտերֆեյսի լեզուն։ Ընտրությունը պահպանվում է այս սարքում։':'Каждый пользователь может выбрать свой язык интерфейса. Выбор сохраняется на этом устройстве.',
      'Ակնարկ':'Обзор',
      'Հաշվարկներ':'Расчёты',
      'Աղյուսակներ / Excel':'Таблицы / Excel',
      'Քարտ / SEO':'Карточка / SEO',
      'Գիրք / YouTube':'Книга / YouTube',
      'Կանոններ':'Правила',
      'Հրապարակում':'Публикация',
      'Գին':'Цена',
      'Ինքնարժեք / հատ':'Себестоимость / шт.',
      'Վաճառք':'Продажи',
      'Ցուցումներ':'Показы',
      'Անցումներ':'Переходы',
      'Զամբյուղներ':'Корзины',
      'Պատվերներ':'Заказы',
      'Անվանում':'Название',
      'Նկարագրություն':'Описание',
      'Profile':'Профиль',
      'Generic':'Общий',
      'Ստուգել':'Проверить',
      'Վերլուծել ձագարը':'Анализировать воронку',
      'Դետերմինիստիկ հաշվարկային բլոկներ':'Детерминированные расчётные блоки',
      'Առևտրի վերլուծության Core':'Core бизнес-аналитики',
      'Միացումներ':'Подключения',
      'Հիմնական տվյալների պահոց':'Основное хранилище данных',
      'Վերլուծել store-ը':'Анализировать магазин',
      'Հաշվել':'Рассчитать',
      'Հաշվել շահույթը':'Рассчитать прибыль',
      'Ստուգել քարտը':'Проверить карточку',
      'Կատարել SEO ստուգում':'Проверить SEO',
      'Կառուցել brief':'Создать бриф',
      'Ցուցադրել publishing capabilities-ը':'Показать возможности публикации',
      'Թարմացնել rule status':'Обновить статус правил',
      'Ցուցադրել pending cases':'Показать ожидающие случаи',
      'Գիրք / Amazon KDP / YouTube':'Книга / Amazon KDP / YouTube',
      'Կարգավիճակները բերվում են հենց Novessa Core-ից, ոչ թե ցուցադրական տվյալներից։':'Статусы загружаются из Novessa Core, а не из демонстрационных данных.',
      'Novessa-ն միավորում է ապրանքները, վաճառքը, շահույթը, շուկաների տվյալները, SEO-ն և կանոնների վերահսկումը մեկ համակարգում։':'Novessa объединяет товары, продажи, прибыль, данные маркетплейсов, SEO и контроль правил в одной системе.',

      'Ցուցադրել canonical model-ը':'Показать canonical model'
    },
    en: {
      'Core':'Core',
      'Ready':'Ready',
      'Connectors':'Connectors',
      'Store':'Store',
      'Rules':'Rules',
      'Publishing':'Publishing',
      'implemented':'connected',
      'partial':'partial',
      'not_verified':'not verified',
      'not_ready':'not ready',
      'Core-ը աշխատում է':'Core works',
      'Core աշխատում է':'Core works',
      'Core-ը պահանջում է ստուգում':'Core requires review',
      'Տվյալ չկա':'No data',
      'Working…':'Working…',
      'Աշխատում է…':'Working…',
      'JSON մուտքային տվյալների սխալ':'Invalid input JSON',
      'Rule packs':'Rule packs',
      'Pending cases':'Pending cases',
      'Store records':'Store records',
      'ԻՐԱԿԱՆ CORE • ՀԱՇՎԱՐԿԱՅԻՆ • ՍՏՈՒԳԵԼԻ':'REAL CORE • DETERMINISTIC • AUDITABLE',
      'ՄԱՍԱՄԲ / ՉԻ ՀԱՍՏԱՏՎԱԾ':'PARTIAL / NOT VERIFIED',
      'սերվերային հաշվարկային շարժիչ':'server-side calculation engine',
      'Յունիտ-էկոնոմիկա':'Unit Economics',
      'Շահույթի վերահսկում':'Profit Guardian',
      'Վաճառքի ձագար':'Sales Funnel',
      'Միջնորդավճար, %':'Commission, %',
      'Լոգիստիկա / միավոր':'Logistics / unit',
      'Պահեստավորում / միավոր':'Storage / unit',
      'Հարկ, %':'Tax, %',
      'Գովազդի ծախս':'Ad spend',
      'JSON տվյալներ':'JSON input',
      'Գնված պատվերներ':'Buyout orders',
      'Ապրանքի քարտ / SEO / ստեղծարար պլանավորում':'Product Card / SEO / Creative planning',
      'AI փոխանցում':'AI handoff',
      'փաստային ստուգում':'factual validation',
      'Ապրանքի քարտի ստուգում':'Product Card validation',
      'SEO օպտիմիզատոր':'SEO optimizer',
      'Ապրանքի տվյալների JSON':'Product data JSON',
      'Քարտի դիզայնի brief':'Card design brief',
      'Մուտքային JSON':'Input JSON',
      'Ինֆոգրաֆիկայի brief':'Infographic brief',
      'Գիրք → YouTube արշավ':'Book → YouTube campaign',
      'Հրապարակման հնարավորություններ':'Publishing capabilities',
      'Amazon KDP փաթեթ':'Amazon KDP package',
      'Արշավի JSON':'Campaign JSON',
      'Google Intelligence / կանոնների կառավարում':'Google Intelligence / Rule Governance',
      'Սպասող governance դեպքեր':'Pending governance cases',
      'Խանութը ստուգված է':'Store verified',
      'Կանոնները ստուգված են':'Rules verified',
      'Հրապարակումը ստուգված է':'Publishing verified',
      'Միացումները ստուգված են':'Connectors verified',
      'Կարգավորումներ':'Settings',
      'Լեզու':'Language',
      'Մուտքի կոդ':'Access code',
      'Ինտերֆեյսի լեզու':'Interface language',
      'Յուրաքանչյուր օգտատեր կարող է ընտրել իր ինտերֆեյսի լեզուն։ Ընտրությունը պահպանվում է այս սարքում։':'Each user can choose their interface language. The selection is saved on this device.',
      'Ակնարկ':'Overview',
      'Հաշվարկներ':'Calculations',
      'Աղյուսակներ / Excel':'Tables / Excel',
      'Քարտ / SEO':'Card / SEO',
      'Գիրք / YouTube':'Book / YouTube',
      'Կանոններ':'Rules',
      'Հրապարակում':'Publishing',
      'Գին':'Price',
      'Ինքնարժեք / հատ':'Cost / unit',
      'Վաճառք':'Sales',
      'Ցուցումներ':'Impressions',
      'Անցումներ':'Clicks',
      'Զամբյուղներ':'Carts',
      'Պատվերներ':'Orders',
      'Անվանում':'Name',
      'Նկարագրություն':'Description',
      'Profile':'Profile',
      'Generic':'Generic',
      'Ստուգել':'Check',
      'Վերլուծել ձագարը':'Analyze funnel',
      'Դետերմինիստիկ հաշվարկային բլոկներ':'Deterministic calculation blocks',
      'Առևտրի վերլուծության Core':'Commerce Analytics Core',
      'Միացումներ':'Connectors',
      'Հիմնական տվյալների պահոց':'Canonical data store',
      'Ցուցադրել canonical model-ը':'Show canonical model',
      'Վերլուծել store-ը':'Analyze store',
      'Հաշվել':'Calculate',
      'Հաշվել շահույթը':'Calculate profit',
      'Ստուգել քարտը':'Validate card',
      'Կատարել SEO ստուգում':'Run SEO check',
      'Կառուցել brief':'Build brief',
      'Ցուցադրել publishing capabilities-ը':'Show publishing capabilities',
      'Թարմացնել rule status':'Refresh rule status',
      'Ցուցադրել pending cases':'Show pending cases',
      'Գիրք / Amazon KDP / YouTube':'Book / Amazon KDP / YouTube',
      'Կարգավիճակները բերվում են հենց Novessa Core-ից, ոչ թե ցուցադրական տվյալներից։':'Statuses are loaded from Novessa Core, not from demo data.',
      'Novessa-ն միավորում է ապրանքները, վաճառքը, շահույթը, շուկաների տվյալները, SEO-ն և կանոնների վերահսկումը մեկ համակարգում։':'Novessa combines products, sales, profit, marketplace data, SEO, and rule control in one system.',

    }
  };

  function applyLanguage(lang){
    currentLang=translations[lang] ? lang : 'hy';
    rendering=true;
    document.documentElement.lang=currentLang;
    captureBaseText();
    const dict=translations[currentLang];
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    for(const node of nodes){
      const parent=node.parentElement;
      if(!parent || /^(SCRIPT|STYLE|PRE|CODE|OPTION)$/i.test(parent.tagName)) continue;
      const base=baseText.get(node);
      if(base!=null) node.nodeValue=dict[base] || base;
    }
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
      const key=el.getAttribute('data-i18n-placeholder');
      if(key && dict[key]) el.placeholder=dict[key];
    });
    const token=document.getElementById('uiToken');
    if(token && currentLang==='ru') token.setAttribute('aria-label','Код доступа');
    else if(token && currentLang==='en') token.setAttribute('aria-label','Access code');
    else if(token) token.setAttribute('aria-label','Մուտքի կոդ');
    const select=document.getElementById('languageSelect');
    if(select) select.value=currentLang;
    rendering=false;
  }

  function setLang(lang){
    localStorage.setItem('novessa_ui_language',lang);
    applyLanguage(lang);
  }

  const observer=new MutationObserver(mutations=>{
    if(rendering) return;
    for(const m of mutations){
      if(m.type==='childList'){
        m.addedNodes.forEach(node=>{
          if(node.nodeType===Node.TEXT_NODE){
            if(!baseText.has(node)) baseText.set(node,node.nodeValue);
          } else if(node.nodeType===Node.ELEMENT_NODE){
            captureBaseText(node);
          }
        });
      }
    }
    applyLanguage(currentLang);
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:false});

  document.addEventListener('change',event=>{
    if(event.target?.id==='languageSelect') setLang(event.target.value);
  });

  captureBaseText();
  applyLanguage(currentLang);
})();
</script>`;
index = index.replace('</body>', localizedRuntimeScript + '</body>');
writeFileSync(indexPath, index);

const stylePath = 'public/styles.css';
let style = readFileSync(stylePath, 'utf8');
style += ".ui-token{display:block!important;width:100%;max-width:520px;padding:10px 12px}\n.novessa-premium{}\n:root{\n  --novessa-bg:#070713;\n  --novessa-surface:#0f1022;\n  --novessa-surface-2:#161832;\n  --novessa-purple:#6d35c9;\n  --novessa-violet:#8b5cf6;\n  --novessa-cobalt:#315cff;\n  --novessa-text:#f6f4ff;\n  --novessa-muted:#a9a7bc;\n  --novessa-border:rgba(139,92,246,.22);\n}\nbody{\n  background:\n    radial-gradient(circle at 12% 8%, rgba(109,53,201,.23), transparent 34%),\n    radial-gradient(circle at 88% 12%, rgba(49,92,255,.18), transparent 32%),\n    linear-gradient(135deg,#060610 0%,#0a0b19 48%,#0b0c1d 100%);\n  color:var(--novessa-text);\n}\n.panel,.card,article.panel,.metric-card,.status-card{\n  background:linear-gradient(145deg,rgba(22,24,50,.92),rgba(10,11,28,.94));\n  border:1px solid var(--novessa-border);\n  box-shadow:0 18px 45px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.025);\n  backdrop-filter:blur(14px);\n  border-radius:18px;\n}\nbutton,.tab,.secondary,.ghost{\n  border-radius:12px;\n}\nbutton:not(.ghost),.primary{\n  background:linear-gradient(135deg,var(--novessa-cobalt),var(--novessa-purple));\n  border:1px solid rgba(139,92,246,.34);\n  box-shadow:0 8px 24px rgba(49,92,255,.18);\n}\nbutton:hover,.tab:hover{\n  transform:translateY(-1px);\n}\ninput,select,textarea{\n  background:#0c0d1c;\n  color:var(--novessa-text);\n  border:1px solid rgba(139,92,246,.28);\n  border-radius:12px;\n}\ninput:focus,select:focus,textarea:focus{\n  outline:none;\n  border-color:var(--novessa-cobalt);\n  box-shadow:0 0 0 3px rgba(49,92,255,.14);\n}\n.tab.active{\n  background:linear-gradient(135deg,rgba(49,92,255,.22),rgba(109,53,201,.22));\n  border-color:rgba(139,92,246,.45);\n}\n.section-title h1,.section-title h2,.section-title h3{\n  letter-spacing:-.02em;\n}\n.muted{\n  color:var(--novessa-muted);\n}\n.json{\n  background:#090a15;\n  border:1px solid rgba(139,92,246,.16);\n  border-radius:14px;\n  padding:14px;\n  overflow:auto;\n}\ntable{\n  border-collapse:separate;\n  border-spacing:0;\n}\nth,td{\n  border-color:rgba(139,92,246,.13)!important;\n}\n@media (max-width:820px){\n  .grid-2,.grid-3{grid-template-columns:1fr!important}\n  .toolbar{flex-wrap:wrap}\n  .tab{width:100%}\n}";
writeFileSync(stylePath, style);

