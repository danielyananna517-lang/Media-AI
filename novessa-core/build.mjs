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
  '<button class="tab" data-tab="finance">Հաշվարկներ</button><button class="tab" data-tab="sheets">Sheets / Excel</button><button class="tab" data-tab="settings">Կարգավորումներ</button>'
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
const sheetsAppCode = "const sheetRows=[];\nfunction csvEscape(v){const s=String(v??'');return '\"' + s.replace(/\"/g,'\"\"') + '\"';}\nfunction renderSheetRows(){\n  const body=$('#sheetsTable tbody'); if(!body) return;\n  body.innerHTML=sheetRows.map(r=>'<tr>'+r.map(v=>'<td>'+String(v).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</td>').join('')+'</tr>').join('');\n}\n$('#addSheetRowBtn')?.addEventListener('click',()=>{\n  const r=[$('#sheetProduct')?.value||'', $('#sheetPrice')?.value||'', $('#sheetCost')?.value||'', $('#sheetQty')?.value||'', $('#sheetSales')?.value||'', $('#sheetStock')?.value||''];\n  if(!r[0]) return;\n  sheetRows.push(r); renderSheetRows();\n  ['sheetProduct','sheetPrice','sheetCost','sheetQty','sheetSales','sheetStock'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});\n  const out=$('#out-sheets'); if(out) out.textContent='Տողը ավելացվեց։';\n});\n$('#exportSheetBtn')?.addEventListener('click',()=>{\n  const rows=[['Ապրանք','Գին','Ինքնարժեք','Քանակ','Վաճառք','Մնացորդ'],...sheetRows];\n  const csv='\\ufeff'+rows.map(r=>r.map(csvEscape).join(',')).join('\\n');\n  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='novessa-sheets.csv'; a.click();\n});\n$('#csvTemplateBtn')?.addEventListener('click',()=>{\n  const csv='\\ufeffАպրանք,Цена,Себестоимость,Количество,Продажи,Остаток\\n';\n  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='novessa-sheets-template.csv'; a.click();\n});\n$('#csvFile')?.addEventListener('change',async(e)=>{\n  const file=e.target.files?.[0]; if(!file) return;\n  const raw=await file.text();\n  const lines=raw.replace(/^\\ufeff/,'').split(/\\r?\\n/).filter(Boolean);\n  const parsed=lines.slice(1).map(line=>line.split(',').map(v=>v.replace(/^\"|\"$/g,'').replace(/\"\"/g,'\"'))).filter(r=>r.length>=6);\n  sheetRows.push(...parsed.map(r=>r.slice(0,6))); renderSheetRows();\n  const out=$('#out-sheets'); if(out) out.textContent='Ներմուծված տողեր՝ '+parsed.length;\n});\n$('#sheetLinkBtn')?.addEventListener('click',()=>{\n  const url=$('#sheetUrl')?.value?.trim(), out=$('#out-sheets');\n  if(!url){if(out)out.textContent='Մուտքագրիր Google Sheets-ի հղումը։';return;}\n  try{\n    const u=new URL(url);\n    if(!/^(docs\\.google\\.com|drive\\.google\\.com)$/.test(u.hostname)){if(out)out.textContent='Թույլատրվում է միայն Google հղումը։';return;}\n    window.open(u.href,'_blank','noopener');\n  }catch{if(out)out.textContent='Google Sheets-ի հղումը ճիշտ չէ։';}\n});\n\n";
app += '\n' + sheetsAppCode;
writeFileSync(appPath, app);

const uiTranslations = [
  ['Unit Economics','Յունիտ-էկոնոմիկա'],
  ['Profit Guardian','Շահույթի վերահսկում'],
  ['Sales Funnel','Վաճառքի ձագար'],
  ['Commission, %','Միջնորդավճար, %'],
  ['Logistics / հատ','Լոգիստիկա / միավոր'],
  ['Storage / հատ','Պահեստավորում / միավոր'],
  ['Tax, %','Հարկ, %'],
  ['Ads spend','Գովազդի ծախս'],
  ['JSON input','JSON տվյալներ'],
  ['Buyout orders','Վերցված պատվերներ'],
  ['UI token','Մուտքի կոդ'],
  ['Commerce','Առևտուր'],
  ['Card / SEO','Քարտ / SEO'],
  ['Book / YouTube','Գիրք / YouTube'],
  ['Rules','Կանոններ'],
  ['Overview','Ակնարկ'],
  ['Calculations','Հաշվարկներ'],
  ['Publishing','Հրապարակում'],
  ['Sheets / Excel','Աղյուսակներ / Excel'],
  ['Google Sheets / Excel','Google Sheets / Excel'],
  ['Google Sheets','Google Sheets'],
  ['Excel / CSV','Excel / CSV'],
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
  ['Публикация capabilities','Հրապարակման հնարավորություններ'],
  ['Проверить книгу','Ստուգել գիրքը'],
  ['Подготовить KDP пакет','Պատրաստել KDP փաթեթ'],
  ['Построить YouTube кампанию','Կառուցել YouTube արշավ'],
  ['Книга / Amazon KDP / YouTube','Գիրք / Amazon KDP / YouTube'],
  ['Status','Կարգավիճակ'],
  ['Settings','Կարգավորումներ']
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
      </article>
    </section>`;
index = index.replace('</main>', languageSettingsHtml + '</main>');

index = index.replace('</main>', '</main>');

const localizedRuntimeScript = `
<script>
(function(){
  const map = [
    ['REAL CORE • DETERMINISTIC • AUDITABLE','ԻՐԱԿԱՆ CORE • ՀԱՇՎԱՐԿԱՅԻՆ • ՍՏՈՒԳԵԼԻ'],
    ['Коммерция Intelligence Core','Առևտրի վերլուծության Core'],
    ['Core ok','Core աշխատում է'],
    ['Connectors verified','Միացումները ստուգված են'],
    ['Store verified','Խանութը ստուգված է'],
    ['Rules verified','Կանոնները ստուգված են'],
    ['Publishing verified','Հրապարակումը ստուգված է'],
    ['Canonical store','Հիմնական տվյալների պահոց'],
    ['Rule packs','Կանոնների փաթեթներ'],
    ['Pending cases','Սպասող դեպքեր'],
    ['Store records','Խանութի գրառումներ'],
    ['implemented_partial','մասամբ միացված է'],
    ['implemented','միացված է'],
    ['NOT VERIFIED','ՉԻ ՀԱՍՏԱՏՎԱԾ'],
    ['PARTIAL','ՄԱՍԱՄԲ'],
    ['verified','ստուգված է'],
    ['ready','պատրաստ է']
  ];
  function localize(){
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    for(const node of nodes){
      const parent=node.parentElement;
      if(!parent || /^(SCRIPT|STYLE|PRE|CODE)$/i.test(parent.tagName)) continue;
      let value=node.nodeValue;
      for(const [from,to] of map) value=value.split(from).join(to);
      node.nodeValue=value;
    }
  }
  localize();
  new MutationObserver(localize).observe(document.body,{subtree:true,childList:true,characterData:true});
  const translations = {
    hy: {},
    ru: {
      'ԻՐԱԿԱՆ CORE • ՀԱՇՎԱՐԿԱՅԻՆ • ՍՏՈՒԳԵԼԻ':'REAL CORE • РАСЧЁТНЫЙ • ПРОВЕРЯЕМЫЙ',
      'Առևտրի վերլուծության Core':'Core бизнес-аналитики',
      'Core աշխատում է':'Core работает',
      'Միացումները ստուգված են':'Подключения проверены',
      'Խանութը ստուգված է':'Магазин проверен',
      'Կանոնները ստուգված են':'Правила проверены',
      'Հրապարակումը ստուգված է':'Публикация проверена',
      'Կարգավորումներ':'Настройки',
      'Լեզու':'Язык',
      'Ինտերֆեյսի լեզու':'Язык интерфейса',
      'Յուրաքանչյուր օգտատեր կարող է ընտրել իր ինտերֆեյսի լեզուն։ Ընտրությունը պահպանվում է այս սարքում։':'Каждый пользователь может выбрать свой язык интерфейса. Выбор сохраняется на этом устройстве.',
      'Հաշվարկներ':'Расчёты',
      'Ակնարկ':'Обзор',
      'Таблицы / Excel':'Таблицы / Excel',
      'Коммерция':'Коммерция',
      'Քարտ / SEO':'Карточка / SEO',
      'Գիրք / YouTube':'Книга / YouTube',
      'Կանոններ':'Правила',
      'Google Таблицы / Excel':'Google Таблицы / Excel',
      'Google Sheets / Excel':'Google Таблицы / Excel',
      'Ապրանքի անվանում':'Название товара',
      'Գին':'Цена',
      'Ինքնարժեք':'Себестоимость',
      'Քանակ':'Количество',
      'Վաճառք':'Продажи',
      'Մնացորդ':'Остаток',
      'Ավելացնել տող':'Добавить строку',
      'Արտահանել CSV':'Экспортировать CSV',
      'Ներբեռնել ձևանմուշ':'Скачать шаблон',
      'Ներմուծել CSV':'Импортировать CSV',
      'Բացել Google Sheets-ը':'Открыть Google Sheets'
    },
    en: {
      'ԻՐԱԿԱՆ CORE • ՀԱՇՎԱՐԿԱՅԻՆ • ՍՏՈՒԳԵԼԻ':'REAL CORE • DETERMINISTIC • AUDITABLE',
      'Առևտրի վերլուծության Core':'Commerce Analytics Core',
      'Core աշխատում է':'Core works',
      'Միացումները ստուգված են':'Connectors verified',
      'Խանութը ստուգված է':'Store verified',
      'Կանոնները ստուգված են':'Rules verified',
      'Հրապարակումը ստուգված է':'Publishing verified',
      'Կարգավորումներ':'Settings',
      'Լեզու':'Language',
      'Ինտերֆեյսի լեզու':'Interface language',
      'Յուրաքանչյուր օգտատեր կարող է ընտրել իր ինտերֆեյսի լեզուն։ Ընտրությունը պահպանվում է այս սարքում։':'Each user can choose their interface language. The selection is saved on this device.',
      'Հաշվարկներ':'Calculations',
      'Ակնարկ':'Overview',
      'Таблицы / Excel':'Tables / Excel',
      'Коммерция':'Commerce',
      'Քարտ / SEO':'Card / SEO',
      'Գիրք / YouTube':'Book / YouTube',
      'Կանոններ':'Rules',
      'Google Таблицы / Excel':'Google Sheets / Excel',
      'Google Sheets / Excel':'Google Sheets / Excel',
      'Ապրանքի անվանում':'Product name',
      'Գին':'Price',
      'Ինքնարժեք':'Cost',
      'Քանակ':'Quantity',
      'Վաճառք':'Sales',
      'Մնացորդ':'Stock',
      'Ավելացնել տող':'Add row',
      'Արտահանել CSV':'Export CSV',
      'Ներբեռնել ձևանմուշ':'Download template',
      'Ներմուծել CSV':'Import CSV',
      'Բացել Google Sheets-ը':'Open Google Sheets'
    }
  };
  function getLang(){ return localStorage.getItem('novessa_ui_language') || 'hy'; }
  function setLang(lang){
    localStorage.setItem('novessa_ui_language',lang);
    document.documentElement.lang=lang;
    renderLanguage(lang);
  }
  function renderLanguage(lang){
    const dict=translations[lang]||{};
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    for(const node of nodes){
      const parent=node.parentElement;
      if(!parent || /^(SCRIPT|STYLE|PRE|CODE|OPTION)$/i.test(parent.tagName)) continue;
      let value=node.nodeValue;
      if(!node.__novessaBaseText) node.__novessaBaseText=value;
      let base=node.__novessaBaseText;
      const currentLang=parent.closest('[data-novessa-language]')?.dataset?.novessaLanguage;
      if(currentLang && currentLang===lang) continue;
      node.nodeValue=dict[base] || base;
    }
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
      const key=el.getAttribute('data-i18n-placeholder');
      if(key && dict[key]) el.placeholder=dict[key];
    });
    const select=document.getElementById('languageSelect');
    if(select) select.value=lang;
  }
  function openSettings(){
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    const panel=document.getElementById('tab-settings');
    if(panel) panel.classList.add('active');
  }
  document.addEventListener('click',event=>{
    if(event.target?.id==='settingsBtn') openSettings();
  });
  document.addEventListener('change',event=>{
    if(event.target?.id==='languageSelect') setLang(event.target.value);
  });
  window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>setLang(getLang()),0));
  setTimeout(localize,250);
  setTimeout(()=>{ localize(); setLang(getLang()); },1000);
})();
</script>`;
index = index.replace('</body>', localizedRuntimeScript + '</body>');
writeFileSync(indexPath, index);

const stylePath = 'public/styles.css';
let style = readFileSync(stylePath, 'utf8');
style += ".novessa-premium{}\n:root{\n  --novessa-bg:#070713;\n  --novessa-surface:#0f1022;\n  --novessa-surface-2:#161832;\n  --novessa-purple:#6d35c9;\n  --novessa-violet:#8b5cf6;\n  --novessa-cobalt:#315cff;\n  --novessa-text:#f6f4ff;\n  --novessa-muted:#a9a7bc;\n  --novessa-border:rgba(139,92,246,.22);\n}\nbody{\n  background:\n    radial-gradient(circle at 12% 8%, rgba(109,53,201,.23), transparent 34%),\n    radial-gradient(circle at 88% 12%, rgba(49,92,255,.18), transparent 32%),\n    linear-gradient(135deg,#060610 0%,#0a0b19 48%,#0b0c1d 100%);\n  color:var(--novessa-text);\n}\n.panel,.card,article.panel,.metric-card,.status-card{\n  background:linear-gradient(145deg,rgba(22,24,50,.92),rgba(10,11,28,.94));\n  border:1px solid var(--novessa-border);\n  box-shadow:0 18px 45px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.025);\n  backdrop-filter:blur(14px);\n  border-radius:18px;\n}\nbutton,.tab,.secondary,.ghost{\n  border-radius:12px;\n}\nbutton:not(.ghost),.primary{\n  background:linear-gradient(135deg,var(--novessa-cobalt),var(--novessa-purple));\n  border:1px solid rgba(139,92,246,.34);\n  box-shadow:0 8px 24px rgba(49,92,255,.18);\n}\nbutton:hover,.tab:hover{\n  transform:translateY(-1px);\n}\ninput,select,textarea{\n  background:#0c0d1c;\n  color:var(--novessa-text);\n  border:1px solid rgba(139,92,246,.28);\n  border-radius:12px;\n}\ninput:focus,select:focus,textarea:focus{\n  outline:none;\n  border-color:var(--novessa-cobalt);\n  box-shadow:0 0 0 3px rgba(49,92,255,.14);\n}\n.tab.active{\n  background:linear-gradient(135deg,rgba(49,92,255,.22),rgba(109,53,201,.22));\n  border-color:rgba(139,92,246,.45);\n}\n.section-title h1,.section-title h2,.section-title h3{\n  letter-spacing:-.02em;\n}\n.muted{\n  color:var(--novessa-muted);\n}\n.json{\n  background:#090a15;\n  border:1px solid rgba(139,92,246,.16);\n  border-radius:14px;\n  padding:14px;\n  overflow:auto;\n}\ntable{\n  border-collapse:separate;\n  border-spacing:0;\n}\nth,td{\n  border-color:rgba(139,92,246,.13)!important;\n}\n@media (max-width:820px){\n  .grid-2,.grid-3{grid-template-columns:1fr!important}\n  .toolbar{flex-wrap:wrap}\n  .tab{width:100%}\n}";
writeFileSync(stylePath, style);

