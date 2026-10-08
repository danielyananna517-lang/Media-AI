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
const sheetsSection = "\n    <section class=\"tab-panel\" id=\"tab-sheets\">\n      <div class=\"section-title\"><div><h2>Google Sheets / Excel</h2><p>Վաճառքի, ապրանքի, ինքնարժեքի, մնացորդի և վերլուծության տվյալների միասնական աղյուսակ։</p></div></div>\n      <div class=\"grid-2\">\n        <article class=\"panel\">\n          <h3>Google Sheets</h3>\n          <p id=\"sheetsStatus\" class=\"muted\">Live Google account կապը դեռ միացված չէ։</p>\n          <div class=\"field wide\"><label>Google Sheets հղում</label><input id=\"sheetUrl\" type=\"url\" placeholder=\"https://docs.google.com/spreadsheets/...\"></div>\n          <div class=\"toolbar\"><button id=\"sheetLinkBtn\" class=\"secondary\" type=\"button\">Բացել Google Sheets-ը</button></div>\n          <p class=\"muted\">Կարող ես տվյալները արտահանել CSV և բացել Google Sheets-ում։</p>\n        </article>\n        <article class=\"panel\">\n          <h3>Excel / CSV</h3>\n          <div class=\"toolbar\"><button id=\"csvTemplateBtn\" class=\"secondary\" type=\"button\">Ներբեռնել ձևանմուշ</button><label class=\"secondary\" style=\"display:inline-flex;align-items:center;gap:8px;cursor:pointer\">Ներմուծել CSV<input id=\"csvFile\" type=\"file\" accept=\".csv,text/csv\" hidden></label></div>\n          <pre id=\"out-sheets\" class=\"json\"></pre>\n        </article>\n      </div>\n      <article class=\"panel\">\n        <h3>Հաշվարկային տվյալների աղյուսակ</h3>\n        <div class=\"grid-3\">\n          <div class=\"field\"><label>Ապրանք</label><input id=\"sheetProduct\" placeholder=\"Ապրանքի անվանում\"></div>\n          <div class=\"field\"><label>Գին</label><input id=\"sheetPrice\" inputmode=\"decimal\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Ինքնարժեք</label><input id=\"sheetCost\" inputmode=\"decimal\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Քանակ</label><input id=\"sheetQty\" inputmode=\"numeric\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Վաճառք</label><input id=\"sheetSales\" inputmode=\"numeric\" placeholder=\"0\"></div>\n          <div class=\"field\"><label>Մնացորդ</label><input id=\"sheetStock\" inputmode=\"numeric\" placeholder=\"0\"></div>\n        </div>\n        <div class=\"toolbar\"><button id=\"addSheetRowBtn\" type=\"button\">Ավելացնել տող</button><button id=\"exportSheetBtn\" class=\"secondary\" type=\"button\">Արտահանել CSV</button><button id=\"exportXlsxBtn\" class=\"secondary\" type=\"button\">Արտահանել Excel (.xlsx)</button></div>\n        <div style=\"overflow:auto\"><table id=\"sheetsTable\"><thead><tr><th>Ապրանք</th><th>Գին</th><th>Ինքնարժեք</th><th>Քանակ</th><th>Վաճառք</th><th>Մնացորդ</th></tr></thead><tbody></tbody></table></div>\n      </article>\n    </section>";
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
const sheetsAppCode = "const sheetRows=(()=>{try{const saved=JSON.parse(localStorage.getItem('novessa_sheet_rows_v2')||'[]');return Array.isArray(saved)?saved:[]}catch{return []}})(); window.__novessaSheetRows=sheetRows;\nconst sheetI18n={hy:{added:'Տողը ավելացվեց։',imported:'Ներմուծված տողեր՝ ',url:'Մուտքագրիր Google Sheets-ի հղումը։',host:'Թույլատրվում է միայն Google հղումը։',bad:'Google Sheets-ի հղումը ճիշտ չէ։'},ru:{added:'Строка добавлена.',imported:'Импортировано строк: ',url:'Введи ссылку Google Sheets.',host:'Разрешена только ссылка Google.',bad:'Ссылка Google Sheets неверна.'},en:{added:'Row added.',imported:'Imported rows: ',url:'Enter the Google Sheets link.',host:'Only a Google link is allowed.',bad:'The Google Sheets link is invalid.'}}; function sheetMsg(key,extra=''){const lang=document.documentElement.lang||'hy';return (sheetI18n[lang]||sheetI18n.hy)[key]+extra;}\nfunction csvEscape(v){const s=String(v??'');return '\"' + s.replace(/\"/g,'\"\"') + '\"';}\nfunction renderSheetRows(){\n  const body=$('#sheetsTable tbody'); if(!body) return;\n  body.innerHTML=sheetRows.map(r=>'<tr>'+r.map(v=>'<td>'+String(v).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</td>').join('')+'</tr>').join('');\n}\n$('#addSheetRowBtn')?.addEventListener('click',()=>{\n  const r=[$('#sheetProduct')?.value||'', $('#sheetPrice')?.value||'', $('#sheetCost')?.value||'', $('#sheetQty')?.value||'', $('#sheetSales')?.value||'', $('#sheetStock')?.value||''];\n  if(!r[0]) return;\n  sheetRows.push(r); window.__novessaSheetRows=sheetRows; localStorage.setItem('novessa_sheet_rows_v2',JSON.stringify(sheetRows)); renderSheetRows();\n  ['sheetProduct','sheetPrice','sheetCost','sheetQty','sheetSales','sheetStock'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});\n  const out=$('#out-sheets'); if(out) out.textContent=sheetMsg('added');\n});\n$('#exportXlsxBtn')?.addEventListener('click',async()=>{\n  const out=$('#out-sheets');\n  try{\n    const r=await fetch('/ui/api/action/sheets-xlsx',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({headers:['Ապրանք','Գին','Ինքնարժեք','Քանակ','Վաճառք','Մնացորդ'],rows:sheetRows})});\n    if(!r.ok){const t=await r.text();let b={};try{b=JSON.parse(t)}catch{};throw new Error(b.error||'xlsx_export_failed');}\n    const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='novessa-sheets.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);\n    if(out)out.textContent='Excel (.xlsx) պատրաստ է։';\n  }catch(error){if(out)out.textContent=String(error.message||error);}\n});\n$('#exportSheetBtn')?.addEventListener('click',()=>{\n  const rows=[['Ապրանք','Գին','Ինքնարժեք','Քանակ','Վաճառք','Մնացորդ'],...sheetRows];\n  const csv='\\ufeff'+rows.map(r=>r.map(csvEscape).join(',')).join('\\n');\n  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='novessa-sheets.csv'; a.click();\n});\n$('#csvTemplateBtn')?.addEventListener('click',()=>{\n  const csv='\\ufeffԱպրանք,Գին,Ինքնարժեք,Քանակ,Վաճառք,Մնացորդ\\n';\n  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='novessa-sheets-template.csv'; a.click();\n});\n$('#csvFile')?.addEventListener('change',async(e)=>{\n  const file=e.target.files?.[0]; if(!file) return;\n  const raw=await file.text();\n  const lines=raw.replace(/^\\ufeff/,'').split(/\\r?\\n/).filter(Boolean);\n  const parsed=lines.slice(1).map(line=>line.split(',').map(v=>v.replace(/^\"|\"$/g,'').replace(/\"\"/g,'\"'))).filter(r=>r.length>=6);\n  sheetRows.push(...parsed.map(r=>r.slice(0,6))); window.__novessaSheetRows=sheetRows; localStorage.setItem('novessa_sheet_rows_v2',JSON.stringify(sheetRows)); renderSheetRows();\n  const out=$('#out-sheets'); if(out) out.textContent=sheetMsg('imported',parsed.length);\n});\n$('#sheetLinkBtn')?.addEventListener('click',()=>{\n  const url=$('#sheetUrl')?.value?.trim(), out=$('#out-sheets');\n  if(!url){if(out)out.textContent=sheetMsg('url');return;}\n  try{\n    const u=new URL(url);\n    if(!/^(docs\\.google\\.com|drive\\.google\\.com)$/.test(u.hostname)){if(out)out.textContent='Թույլատրվում է միայն Google հղումը։';return;}\n    window.open(u.href,'_blank','noopener');\n  }catch{if(out)out.textContent=sheetMsg('bad');}\n});\n\n";
app += '\n' + sheetsAppCode;

const persistenceEnhancer = String.raw`
// === NOVESSA PERSISTENCE ENHANCER ===
(function(){
  const el=id=>document.getElementById(id);
  const token=()=>String(el('uiToken')?.value||sessionStorage.getItem('novessa_ui_token')||'');
  const call=async(action,payload={})=>{
    const headers={'content-type':'application/json'};const t=token();
    if(t){headers['x-novessa-ui-token']=t;sessionStorage.setItem('novessa_ui_token',t);}
    const r=await fetch('/ui/api/action/'+action,{method:'POST',headers,body:JSON.stringify(payload)});
    const raw=await r.text();let body={};try{body=JSON.parse(raw)}catch{}
    if(!r.ok)throw Object.assign(new Error(body.error||'persistence_request_failed'),{body,status:r.status});
    return body;
  };
  let enabled=false;
  const bookMsg=m=>{const n=el('bookStatus');if(n)n.textContent=m;};
  const sheetMsg=m=>{const n=el('out-sheets');if(n)n.textContent=m;};
  const authMsg=()=>({hy:'Backend պահպանումը միացված է, բայց մուտքի կոդ է պահանջվում։',ru:'Серверное хранение включено, но требуется код доступа.',en:'Backend storage is enabled, but an access code is required.'}[document.documentElement.lang||'hy']);
  const bookState=()=>{
    let plan={};try{plan=JSON.parse(el('bookPlan')?.textContent||'{}')}catch{}
    const raw=String(el('bookEditor')?.value||'');
    const chapters=raw.split(/\\n\\s*##\\s+/).map((chunk,i)=>{
      const clean=chunk.replace(/^##\\s+/,'').trim();if(!clean)return null;
      const pos=clean.indexOf('\\n');
      return{title:pos>0?clean.slice(0,pos).trim():('Chapter '+(i+1)),text:pos>0?clean.slice(pos).trim():clean};
    }).filter(Boolean);
    return{title:String(el('bookTitle')?.value||''),author:String(el('bookAuthor')?.value||''),topic:String(el('bookTopic')?.value||''),audience:String(el('bookAudience')?.value||''),language:String(el('bookLanguage')?.value||'en'),market_query:String(el('bookMarketQuery')?.value||''),plan,chapters};
  };
  const applyBook=state=>{
    if(!state||typeof state!=='object')return;
    for(const k of ['title','author','topic','audience','language']){const n=el('book'+k[0].toUpperCase()+k.slice(1));if(n&&state[k]!==undefined)n.value=state[k]||'';}
    const q=el('bookMarketQuery');if(q&&state.market_query!==undefined)q.value=state.market_query||'';
    if(el('bookPlan'))el('bookPlan').textContent=JSON.stringify(state.plan||{},null,2);
    if(el('bookEditor'))el('bookEditor').value=(state.chapters||[]).map((ch,i)=>'## '+(ch.title||('Chapter '+(i+1)))+'\\n\\n'+(ch.text||'')).join('\\n\\n');
  };
  const saveBook=async()=>{
    if(!enabled)return false;
    const result=await call('workspace-save',{kind:'book',state:bookState()});
    if(result.status==='verified'){bookMsg('Գրքի workspace-ը պահպանված է backend-ում։');return true;}
    return false;
  };
  const loadBook=async()=>{
    if(!enabled)return;
    const result=await call('workspace-load',{kind:'book'});
    if(result.status==='verified'&&result.state){applyBook(result.state);bookMsg('Գրքի workspace-ը բեռնված է backend-ից։');}
    else if(result.status==='not_found')bookMsg('Backend-ը միացված է։ Գրքի workspace-ը դեռ չի ստեղծվել։');
  };
  const bookSave=el('bookSaveBtn');
  bookSave?.addEventListener('click',()=>{saveBook().catch(error=>{bookMsg(error.status===401?authMsg():'Backend պահպանումը ձախողվեց։');});});
  el('bookEditor')?.addEventListener('input',()=>{if(!enabled)return;clearTimeout(window.__novessaBookSaveTimer);window.__novessaBookSaveTimer=setTimeout(()=>saveBook().catch(()=>{}),700);});
  const waitForBookChange=id=>{
    el(id)?.addEventListener('click',()=>{
      if(!enabled)return;
      const before=JSON.stringify(bookState());let tries=0;
      const timer=setInterval(async()=>{
        tries++;
        const now=JSON.stringify(bookState());
        if(now!==before||tries>=60){clearInterval(timer);if(now!==before)await saveBook().catch(error=>bookMsg(error.status===401?authMsg():'Backend պահպանումը ձախողվեց։'));}},1000);
    });
  };
  waitForBookChange('bookPlanBtn');waitForBookChange('bookWriteBtn');

  const sheetRows=()=>Array.isArray(window.__novessaSheetRows)?window.__novessaSheetRows:[];
  const renderSheets=()=>{
    const body=el('sheetsTable')?.querySelector('tbody');if(!body)return;
    body.innerHTML=sheetRows().map(r=>'<tr>'+r.map(v=>'<td>'+String(v??'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</td>').join('')+'</tr>').join('');
  };
  const saveSheets=async()=>{
    if(!enabled)return false;
    const result=await call('workspace-save',{kind:'sheets',state:{headers:['Ապրանք','Գին','Ինքնարժեք','Քանակ','Վաճառք','Մնացորդ'],rows:sheetRows()}});
    if(result.status==='verified'){sheetMsg('Sheets workspace-ը պահպանված է backend-ում։');return true;}
    return false;
  };
  const loadSheets=async()=>{
    if(!enabled)return;
    const result=await call('workspace-load',{kind:'sheets'});
    if(result.status==='verified'&&Array.isArray(result.state?.rows)){
      const rows=sheetRows();rows.splice(0,rows.length,...result.state.rows);localStorage.setItem('novessa_sheet_rows_v2',JSON.stringify(rows));renderSheets();sheetMsg('Sheets workspace-ը բեռնված է backend-ից։');
    } else if(result.status==='not_found')sheetMsg('Backend-ը միացված է։ Sheets workspace-ը դեռ չի ստեղծվել։');
  };
  const tbody=el('sheetsTable')?.querySelector('tbody');
  if(tbody&&window.MutationObserver){
    const observer=new MutationObserver(()=>{if(!enabled)return;clearTimeout(window.__novessaSheetSaveTimer);window.__novessaSheetSaveTimer=setTimeout(()=>saveSheets().catch(error=>sheetMsg(error.status===401?authMsg():'Backend պահպանումը ձախողվեց։')),500);});
    observer.observe(tbody,{childList:true,subtree:true});
  }
  fetch('/api/production/capabilities').then(r=>r.json()).then(async data=>{
    enabled=data?.persistence?.status==='configured';
    if(!enabled){bookMsg('Backend պահպանումը դեռ միացված չէ։ Գիրքը/Sheets-ը այս պահին պահվում են միայն այս դիտարկիչում։');return;}
    try{await loadBook();await loadSheets();}catch(error){const msg=error.status===401?authMsg():'Backend persistence-ի runtime կապը ՉԻ ՀԱՍՏԱՏՎԱԾ։';bookMsg(msg);sheetMsg(msg);}
  }).catch(()=>{enabled=false;});
  window.__novessaPersistence={enabled:()=>enabled,saveBook,saveSheets,loadBook,loadSheets};
})();
`;
app += '\n' + persistenceEnhancer;
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


/* === NOVESSA COMMAND CENTER v2 === */
const commandCenterHtml = String.raw`
<section class="novessa-command-center" id="novessa-command-center" data-novessa-command-center>
  <div class="cc-hero">
    <div class="cc-hero-copy">
      <div class="cc-eyebrow">NOVESSA • COMMAND CENTER</div>
      <h1>Բիզնեսը մեկ հայացքով</h1>
      <p>Մի տեղում՝ ինչ է կատարվում, որտեղ է ռիսկը, և որն է հաջորդ լավագույն քայլը։ NOVESSA-ն չի լրացնում բաց տվյալները հորինված թվերով։</p>
      <div class="cc-hero-actions">
        <button id="ccOpenDecision" type="button">Բացել Decision Center</button>
        <button id="ccOpenOperator" type="button" class="secondary">Բացել AI Operator</button>
      </div>
    </div>
    <div class="cc-health">
      <span class="cc-health-dot" id="ccHealthDot"></span>
      <div><small>Համակարգի վիճակ</small><strong id="ccHealthText">Ստուգում…</strong></div>
    </div>
  </div>

  <div class="cc-kpis" aria-label="NOVESSA status">
    <article class="cc-kpi"><span>Core</span><strong id="ccCore">—</strong><small id="ccCoreMeta">—</small></article>
    <article class="cc-kpi"><span>Տվյալների պահոց</span><strong id="ccPersistence">—</strong><small id="ccPersistenceMeta">—</small></article>
    <article class="cc-kpi"><span>Wildberries</span><strong id="ccWB">—</strong><small id="ccWBMeta">—</small></article>
    <article class="cc-kpi"><span>Workspace տվյալներ</span><strong id="ccRows">—</strong><small id="ccRowsMeta">—</small></article>
  </div>

  <div class="cc-grid">
    <article class="cc-card cc-focus-card">
      <div class="cc-card-head">
        <div><span class="cc-tag">TODAY</span><h2>Ուշադրության կենտրոնում</h2></div>
        <button id="ccRefresh" class="ghost" type="button">Թարմացնել</button>
      </div>
      <div id="ccAttention" class="cc-attention">
        <div class="cc-skeleton"></div><div class="cc-skeleton"></div><div class="cc-skeleton"></div>
      </div>
    </article>

    <article class="cc-card">
      <div class="cc-card-head">
        <div><span class="cc-tag">WORKFLOW</span><h2>Մեկ աշխատանքային շղթա</h2></div>
      </div>
      <div class="cc-flow">
        <button class="cc-flow-step" data-cc-scroll="novessa-decision-center"><b>01</b><strong>Research</strong><small>Շուկա • մրցակից • keyword</small></button>
        <span class="cc-flow-arrow">→</span>
        <button class="cc-flow-step" data-cc-scroll="novessa-decision-center"><b>02</b><strong>Economics</strong><small>Գին • ծախս • profit</small></button>
        <span class="cc-flow-arrow">→</span>
        <button class="cc-flow-step" data-cc-scroll="novessa-production-layer"><b>03</b><strong>Decision</strong><small>AI Operator • guardrails</small></button>
        <span class="cc-flow-arrow">→</span>
        <button class="cc-flow-step" data-cc-tab="sheets"><b>04</b><strong>Data</strong><small>Sheets • Excel</small></button>
      </div>
    </article>
  </div>


  <article class="cc-card cc-product-card">
    <div class="cc-card-head">
      <div><span class="cc-tag">ACTIVE PRODUCT</span><h2>Ապրանքի միասնական պրոֆիլ</h2></div>
      <span id="ccProductState" class="cc-product-state">Դեռ չկա</span>
    </div>
    <p>Ապրանքի հիմնական տվյալները պահվում են մեկ workspace-ում և փոխանցվում են NOVESSA-ի հաշվարկներին։</p>
    <div class="cc-product-fields">
      <label><span>Ապրանք</span><input id="ccProductName" placeholder="օր.՝ Jeans"></label>
      <label><span>SKU / Артикул</span><input id="ccProductSku" placeholder="օր.՝ JNS-001"></label>
      <label><span>Գին</span><input id="ccProductPrice" type="number" inputmode="decimal" step="0.01" min="0"></label>
      <label><span>Ինքնարժեք</span><input id="ccProductCost" type="number" inputmode="decimal" step="0.01" min="0"></label>
      <label><span>Մնացորդ</span><input id="ccProductStock" type="number" inputmode="numeric" step="1" min="0"></label>
      <label><span>Վաճառք</span><input id="ccProductSales" type="number" inputmode="numeric" step="1" min="0"></label>
      <label><span>Միջնորդավճար %</span><input id="ccProductCommission" type="number" inputmode="decimal" step="0.01" min="0"></label>
      <label><span>Լոգիստիկա / միավոր</span><input id="ccProductLogistics" type="number" inputmode="decimal" step="0.01" min="0"></label>
      <label><span>Պահեստավորում / միավոր</span><input id="ccProductStorage" type="number" inputmode="decimal" step="0.01" min="0"></label>
      <label><span>Հարկ %</span><input id="ccProductTax" type="number" inputmode="decimal" step="0.01" min="0"></label>
      <label><span>Գովազդի ծախս</span><input id="ccProductAds" type="number" inputmode="decimal" step="0.01" min="0"></label>
    </div>
    <div class="cc-hero-actions">
      <button id="ccSaveProduct" type="button">Պահպանել ապրանքը</button>
      <button id="ccUseProduct" type="button" class="secondary">Ուղարկել հաշվարկին</button>
    </div>
    <div id="ccProductMessage" class="cc-product-message" aria-live="polite"></div>
  </article>

  <div class="cc-bottom-grid">
    <article class="cc-card">
      <div class="cc-card-head"><div><span class="cc-tag">NEXT BEST ACTION</span><h2 id="ccNextTitle">Սկսել ապրանքի տվյալներից</h2></div></div>
      <p id="ccNextText">Մուտքագրիր առաջին ապրանքը, որպեսզի NOVESSA-ն կարողանա կառուցել հաշվարկների հիմքը։</p>
      <button id="ccNextBtn" type="button">Ավելացնել ապրանք</button>
    </article>

    <article class="cc-card">
      <div class="cc-card-head"><div><span class="cc-tag">MODULES</span><h2>Գործիքները մեկ միջավայրում</h2></div></div>
      <div class="cc-modules">
        <button data-cc-tab="commerce"><b>Market</b><span>Research</span></button>
        <button data-cc-tab="finance"><b>Profit</b><span>Calculations</span></button>
        <button data-cc-tab="content"><b>Card</b><span>SEO</span></button>
        <button data-cc-tab="publishing"><b>Book</b><span>Publishing</span></button>
        <button data-cc-tab="sheets"><b>Sheets</b><span>Excel</span></button>
        <button data-cc-scroll="novessa-production-layer"><b>AI</b><span>Operator</span></button>
      </div>
    </article>
  </div>

  <div class="cc-note">
    <span>✓</span>
    <p><strong>NOVESSA principle:</strong> Evidence → Calculation → Decision → Approval → Action → History.</p>
  </div>
</section>`;

if(!index.includes('data-novessa-command-center')){
  const before=index;
  index=index.replace(/(<main\b[^>]*>)/i,match=>match+commandCenterHtml);
  if(index===before) index=index.replace(/(<body\b[^>]*>)/i,match=>match+commandCenterHtml);
  if(!index.includes('data-novessa-command-center')) throw new Error('NOVESSA Command Center insertion failed');
}

const commandCenterScript = String.raw`
<script data-novessa-command-center-script>
(function(){
  const root=document.querySelector('[data-novessa-command-center]'); if(!root)return;
  const byId=id=>document.getElementById(id);
  const scrollToId=id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
  const clickTab=name=>document.querySelector('.tab[data-tab="'+name+'"]')?.click();
  const statusText=value=>value==='configured'||value===true?'Միացված':'ՉԻ ՀԱՍՏԱՏՎԱԾ';
  const setStatus=(id,value,state)=>{
    const n=byId(id);if(!n)return;n.textContent=value;n.dataset.state=state||'';
  };
  const renderAttention=(items)=>{
    const box=byId('ccAttention');if(!box)return;
    box.innerHTML=items.map(item=>'<div class="cc-attention-item '+(item.level||'info')+'"><div class="cc-attention-icon">'+(item.level==='warn'?'!':item.level==='good'?'✓':'•')+'</div><div><strong>'+item.title+'</strong><p>'+item.text+'</p></div><button type="button" data-cc-action="'+(item.action||'decision')+'">'+(item.button||'Բացել')+'</button></div>').join('');
    box.querySelectorAll('[data-cc-action]').forEach(button=>{
      button.addEventListener('click',()=>{
        const action=button.getAttribute('data-cc-action');
        if(action==='sheets')clickTab('sheets');
        else if(action==='finance')clickTab('finance');
        else if(action==='commerce')clickTab('commerce');
        else if(action==='content')clickTab('content');
        else if(action==='publishing')clickTab('publishing');
        else if(action==='operator')scrollToId('novessa-production-layer');
        else if(action==='settings')clickTab('settings');
        else scrollToId('novessa-decision-center');
      });
    });
  };

  const productKey='novessa_active_product_v1';
  const productIds=['Name','Sku','Price','Cost','Stock','Sales','Commission','Logistics','Storage','Tax','Ads'];
  const productNode=s=>byId('ccProduct'+s);
  const readProduct=()=>{
    const obj={name:String(productNode('Name')?.value||''),sku:String(productNode('Sku')?.value||'')};
    for(const key of productIds.slice(2)){const v=Number(productNode(key)?.value);obj[key.toLowerCase()]=Number.isFinite(v)?v:null;}
    return obj;
  };
  const applyProduct=p=>{
    if(!p||typeof p!=='object')return;
    const map={Name:p.name,Sku:p.sku,Price:p.price,Cost:p.cost,Stock:p.stock,Sales:p.sales,Commission:p.commission,Logistics:p.logistics,Storage:p.storage,Tax:p.tax,Ads:p.ads};
    for(const [key,value] of Object.entries(map)){const n=productNode(key);if(n&&value!==undefined&&value!==null)n.value=value;}
    const state=byId('ccProductState');if(state)state.textContent=p.name?'Պատրաստ է':'Դեռ չկա';
  };
  const productMsg=m=>{const n=byId('ccProductMessage');if(n)n.textContent=m;};
  const productToken=()=>String(byId('uiToken')?.value||sessionStorage.getItem('novessa_ui_token')||'');
  const persistenceCall=async(action,payload)=>{
    const h={'content-type':'application/json'},t=productToken();if(t)h['x-novessa-ui-token']=t;
    const r=await fetch('/ui/api/action/'+action,{method:'POST',headers:h,body:JSON.stringify(payload)});
    const raw=await r.text();let body={};try{body=JSON.parse(raw)}catch{}
    if(!r.ok)throw Object.assign(new Error(body.error||'request_failed'),{body,status:r.status});
    return body;
  };
  const loadProduct=async()=>{
    let local=null;try{local=JSON.parse(localStorage.getItem(productKey)||'null')}catch{}
    try{
      const caps=await fetch('/api/production/capabilities').then(r=>r.json());
      if(caps?.persistence?.status==='configured'){
        const result=await persistenceCall('workspace-load',{kind:'commerce'});
        if(result.status==='verified'&&result.state){applyProduct(result.state);localStorage.setItem(productKey,JSON.stringify(result.state));productMsg('Ապրանքի պրոֆիլը բեռնված է backend-ից։');return;}
      }
    }catch{}
    if(local){applyProduct(local);productMsg('Ապրանքի պրոֆիլը բեռնված է այս դիտարկիչից։');}
  };
  const saveProduct=async()=>{
    const product=readProduct();if(!product.name){productMsg('Ապրանքի անունը պարտադիր է։');return;}
    localStorage.setItem(productKey,JSON.stringify(product));
    try{
      const result=await persistenceCall('workspace-save',{kind:'commerce',state:product});
      if(result.status==='verified'){productMsg('Ապրանքի պրոֆիլը պահպանված է backend-ում։');return;}
    }catch(error){
      if(error.status===401){productMsg('Backend-ը պաշտպանված է։ Ապրանքը պահվել է այս դիտարկիչում։');return;}
    }
    productMsg('Backend պահպանումը ՉԻ ՀԱՍՏԱՏՎԱԾ․ օգտագործվում է browser fallback։');
  };
  const useProduct=()=>{
    const p=readProduct();
    const map={dcProduct:'name',dcPrice:'price',dcCost:'cost',dcSales:'sales',dcCommission:'commission',dcLogistics:'logistics',dcStorage:'storage',dcTax:'tax',dcAds:'ads',npPrice:'price',npCost:'cost',npSales:'sales',npCommission:'commission',npLogistics:'logistics',npStorage:'storage',npTax:'tax',npAds:'ads',npStock:'stock'};
    for(const [id,key] of Object.entries(map)){const n=byId(id);if(n&&p[key]!==null&&p[key]!==undefined)n.value=p[key];}
    scrollToId('novessa-decision-center');
  };
  byId('ccSaveProduct')?.addEventListener('click',()=>saveProduct().catch(()=>productMsg('Ապրանքի պահպանումը ՉԻ ՀԱՍՏԱՏՎԱԾ։')));
  byId('ccUseProduct')?.addEventListener('click',useProduct);
  loadProduct();

  const refresh=async()=>{
    setStatus('ccCore','Ստուգում…','loading');
    setStatus('ccPersistence','Ստուգում…','loading');
    setStatus('ccWB','Ստուգում…','loading');
    setStatus('ccRows','—','loading');
    try{
      const responses=await Promise.all([
        fetch('/api/ui/status'),
        fetch('/api/connectors/status'),
        fetch('/api/connectors/wildberries/status'),
        fetch('/api/production/capabilities')
      ]);
      const ui=await responses[0].json(),conn=await responses[1].json(),wb=await responses[2].json(),caps=await responses[3].json();
      const coreOk=ui?.status==='verified'||ui?.status==='ready'||ui?.status==='ok';
      const persisted=caps?.persistence?.status==='configured';
      const liveWb=wb?.configured===true;
      const rows=(()=>{try{const v=JSON.parse(localStorage.getItem('novessa_sheet_rows_v2')||'[]');return Array.isArray(v)?v.length:0}catch{return 0}})();
      setStatus('ccCore',coreOk?'Core OK':'Partial',coreOk?'ok':'warn');
      byId('ccCoreMeta').textContent='Core status';
      setStatus('ccPersistence',persisted?'Միացված':'ՉԻ ՀԱՍՏԱՏՎԱԾ',persisted?'ok':'warn');
      byId('ccPersistenceMeta').textContent= persisted?'server-side':'browser fallback';
      setStatus('ccWB',liveWb?'Live':'Կապ չկա',liveWb?'ok':'warn');
      byId('ccWBMeta').textContent=liveWb?'Wildberries API':'integration';
      setStatus('ccRows',String(rows),rows>0?'ok':'warn');
      byId('ccRowsMeta').textContent='Sheets workspace տող';
      const healthy=coreOk&&(persisted||rows>0);
      byId('ccHealthText').textContent=healthy?'Աշխատանքային վիճակ':'Ուշադրություն է պետք';
      byId('ccHealthDot').dataset.state=healthy?'ok':'warn';

      const items=[];
      if(!persisted)items.push({level:'warn',title:'Տվյալների մշտական պահպանումը դեռ միացված չէ',text:'Արդյունքները հիմա կարող են մնալ միայն այս browser-ում։ Backend persistence-ը պետք է կարգավորվի։',button:'Տեսնել',action:'settings'});
      if(rows===0)items.push({level:'warn',title:'Ապրանքի տվյալներ դեռ չկան',text:'Առաջին ապրանքը ավելացրու Sheets / Excel workspace-ում, հետո անցիր հաշվարկին։',button:'Ավելացնել',action:'sheets'});
      if(!liveWb)items.push({level:'info',title:'Wildberries live կապ չկա',text:'NOVESSA-ն չի ներկայացնում marketplace-ը որպես live data, քանի դեռ connector-ը չի հաստատվել։',button:'Marketplace',action:'commerce'});
      if(rows>0)items.push({level:'good',title:'Տվյալների աշխատանքային հիմքը պատրաստ է',text:'Հաջորդ քայլը՝ անցնել Unit Economics և ստուգել ապրանքի շահույթը։',button:'Հաշվել',action:'finance'});
      if(!items.length)items.push({level:'good',title:'Հիմնական ստուգված շերտերը պատրաստ են',text:'Հիմա կարելի է անցնել Decision Center → Operator workflow-ին։',button:'Բացել',action:'operator'});
      renderAttention(items.slice(0,4));
      const next=rows===0
        ? {title:'Սկսել ապրանքի տվյալներից',text:'Ավելացրու առաջին ապրանքը Sheets / Excel workspace-ում։',button:'Ավելացնել ապրանք',action:'sheets'}
        : !persisted
        ? {title:'Միացնել մշտական պահպանումը',text:'Backend persistence-ը դեռ չի կարգավորվել, ու տվյալները կարող են մնալ browser fallback-ում։',button:'Տեսնել կարգավորումները',action:'settings'}
        : !liveWb
        ? {title:'Ստուգել marketplace կապը',text:'Wildberries connector-ը live դեռ հաստատված չէ։',button:'Marketplace',action:'commerce'}
        : {title:'Անցնել որոշման շղթային',text:'Տվյալների հիմքը կա․ հաջորդը Economics → Decision → Action։',button:'Բացել Decision Center',action:'decision'};
      byId('ccNextTitle').textContent=next.title;byId('ccNextText').textContent=next.text;
      const nb=byId('ccNextBtn');nb.textContent=next.button;nb.onclick=()=>next.action==='sheets'?clickTab('sheets'):next.action==='settings'?clickTab('settings'):next.action==='commerce'?clickTab('commerce'):scrollToId('novessa-decision-center');
    }catch{
      setStatus('ccCore','ՉԻ ՀԱՍՏԱՏՎԱԾ','bad');setStatus('ccPersistence','ՉԻ ՀԱՍՏԱՏՎԱԾ','bad');setStatus('ccWB','ՉԻ ՀԱՍՏԱՏՎԱԾ','bad');setStatus('ccRows','—','bad');
      byId('ccHealthText').textContent='ՉԻ ՀԱՍՏԱՏՎԱԾ';byId('ccHealthDot').dataset.state='bad';
      renderAttention([{level:'warn',title:'Status API-ները հասանելի չեն',text:'NOVESSA-ն չի հորինում համակարգի վիճակը։',button:'Թարմացնել',action:'decision'}]);
    }
  };
  byId('ccOpenDecision')?.addEventListener('click',()=>scrollToId('novessa-decision-center'));
  byId('ccOpenOperator')?.addEventListener('click',()=>scrollToId('novessa-production-layer'));
  byId('ccRefresh')?.addEventListener('click',refresh);
  root.querySelectorAll('[data-cc-scroll]').forEach(b=>b.addEventListener('click',()=>scrollToId(b.getAttribute('data-cc-scroll'))));
  root.querySelectorAll('[data-cc-tab]').forEach(b=>b.addEventListener('click',()=>clickTab(b.getAttribute('data-cc-tab'))));
  refresh();
})();
</script>`;
if(!index.includes('data-novessa-command-center-script')) index=index.replace('</body>',commandCenterScript+'</body>');

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
const portfolioAnalyzerHtml = String.raw`
<section class="novessa-portfolio-analyzer" id="novessa-portfolio-analyzer" data-novessa-portfolio-analyzer style="margin-top:24px">
  <div class="dc-hero" style="margin-bottom:16px"><div><div class="dc-eyebrow">NOVESSA • PORTFOLIO PROFIT MAP</div><h2>Ապրանքների շահույթի քարտեզ</h2><p class="dc-subtitle">Ներմուծիր քո իրական ապրանքների CSV-ը։ NOVESSA-ն կհաշվի միայն տրված թվերը, կդասավորի ապրանքները և բաց տվյալները չի լրացնի իր կողմից։</p></div><div class="dc-truth" id="paStatus">Տվյալ դեռ չկա</div></div>
  <div class="dc-grid">
    <article class="dc-panel dc-panel-primary"><div class="dc-section-tag">1 • ՏՎՅԱԼՆԵՐ</div><h3>CSV ներմուծում</h3><p>Առաջին տողը թող լինի սյունակների վերնագրերը։ Աջակցվում են հայերեն, ռուսերեն և անգլերեն հիմնական անվանումները։</p><div class="dc-actions" style="flex-wrap:wrap"><button id="paTemplate" type="button">Ներբեռնել CSV ձևանմուշ</button><label class="secondary" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;padding:10px 14px;border-radius:10px">Ընտրել CSV<input id="paFile" type="file" accept=".csv,text/csv" hidden></label></div><div id="paFileName" class="dc-price-help"></div><div id="paPreview" class="dc-price-result"><div class="dc-result-empty">Ֆայլ ընտրելուց հետո այստեղ կերևա տողերի քանակը։</div></div></article>
    <article class="dc-panel"><div class="dc-section-tag">2 • ԱՐԴՅՈՒՆՔ</div><h3>Շահույթի ամփոփում</h3><div id="paSummary" class="dc-price-result"><div class="dc-result-empty">Ամփոփում չկա։</div></div><div class="dc-actions" style="margin-top:12px"><button id="paAnalyze" type="button" disabled>Վերլուծել ապրանքները</button></div></article>
  </div>
  <article class="dc-panel" style="margin-top:16px"><div class="dc-section-tag">3 • ԴԱՍԱԿԱՐԳՈՒՄ</div><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><h3 style="margin:0">Ապրանքների վարկանիշ</h3><span id="paRankMeta" class="dc-price-help">Դեռ չկա</span></div><div id="paRanking" style="overflow:auto;margin-top:12px"><div class="dc-result-empty">Վարկանիշը կհայտնվի հաշվարկից հետո։</div></div></article>
  <div class="dc-note" style="margin-top:16px"><span>✓</span><p><strong>NOVESSA rule:</strong> բաց տվյալը մնում է PARTIAL / NOT VERIFIED։ Ոչ մի շահույթ չի հորինվում։</p></div>
</section>`;
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
      <article class="dc-panel dc-price-panel">
        <div class="dc-section-tag" data-dc="priceTag">4 • ԳԻՆ ԵՎ ԶԵՂՉ</div>
        <h3 data-dc="priceTitle">Գին և զեղչ</h3>
        <p class="dc-price-help" data-dc="priceHelp">Մուտքագրիր գինը և զեղչի տոկոսը։ Հաշվարկը կատարվում է գործող Core pricing route-ով։</p>
        <div class="dc-price-fields">
          <label><span data-dc="listPrice">Գին</span><input id="dcListPrice" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0"></label>
          <label><span data-dc="discountPercent">Զեղչ, %</span><input id="dcDiscountPercent" type="number" inputmode="decimal" step="0.01" min="0" max="100" placeholder="0"></label>
        </div>
        <button id="dcPriceCalculate" type="button" data-dc="calculateDiscount">Հաշվել</button>
        <div id="dcPriceResult" class="dc-price-result" aria-live="polite"></div>
      </article>
      <article class="dc-panel dc-reverse-panel">
        <div class="dc-section-tag" data-dc="reverseTag">5 • ՀԵՏ ՀԱՇՎԱՐԿ</div>
        <h3 data-dc="reverseTitle">Հետ հաշվարկել նպատակային գինը</h3>
        <p class="dc-price-help" data-dc="reverseHelp">Օգտագործում է վերևի Unit Economics թվերը և հաշվարկում է այն գինը, որը պետք է քո ընտրված նպատակին հասնելու համար։</p>
        <div class="dc-price-fields">
          <label><span data-dc="reverseTarget">Նպատակի տեսակ</span><select id="dcReverseTarget"><option value="unit_profit">Շահույթ / միավոր</option><option value="margin">Մարժա, %</option><option value="total_profit">Ընդհանուր շահույթ</option></select></label>
          <label><span data-dc="reverseTargetValue">Նպատակային արժեք</span><input id="dcReverseTargetValue" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0"></label>
        </div>
        <button id="dcReverseCalculate" type="button" data-dc="reverseCalculate">Հետ հաշվարկել գինը</button>
        <div id="dcReverseResult" class="dc-price-result" aria-live="polite"></div>
      </article>
    </div>
  </div>
</section>`;
if(!index.includes('data-novessa-decision-center')) {
  index = index.replace(/(<main\b[^>]*>)/, match => match + decisionCenterHtml);
}


if(!index.includes('data-novessa-portfolio-analyzer')) {
  index = index.replace(/(<main\\b[^>]*>)/, match => match + portfolioAnalyzerHtml);
}
const portfolioAnalyzerScript = String.raw`
<script data-novessa-portfolio-script>
(function(){
  const byId=id=>document.getElementById(id),root=document.querySelector('[data-novessa-portfolio-analyzer]');if(!root)return;
  let mappedRows=[];
  const norm=v=>String(v??'').toLowerCase().trim().replace(/[\\u00a0_\\-\\/]+/g,' ').replace(/\\s+/g,' ');
  const aliases={name:['product','product name','name','товар','название','наименование','ապրանք','ապրանքի անվանում','անվանում'],sku:['sku','артикул','արտիկул','կոդ','product code'],price:['price','цена','գին'],unit_cost:['unit cost','cost','себестоимость','себестоимость ед','ինքնարժեք'],sales:['sales','units sold','quantity sold','продажи','количество продаж','վաճառք','վաճառքի քանակ'],commission_percent:['commission','commission percent','комиссия','комиссия %','միջնորդավճար','միջնորդավճար %'],logistics_per_unit:['logistics','logistics per unit','логистика','логистика ед','լոգիստիկա','լոգիստիկա մեկ միավոր'],storage_per_unit:['storage','storage per unit','хранение','хранение ед','պահեստ','պահեստավորում','պահեստավորում մեկ միավոր'],tax_percent:['tax','tax percent','налог','налог %','հարկ','հարկ %'],ad_spend:['ad spend','ads','advertising','реклама','расход на рекламу','գովազդ','գովազդի ծախս']};
  const aliasMap={};Object.entries(aliases).forEach(([k,v])=>v.forEach(a=>aliasMap[norm(a)]=k));
  const num=v=>{const s=String(v??'').trim().replace(/\\s/g,'').replace(',','.');if(!s)return NaN;const n=Number(s);return Number.isFinite(n)?n:NaN;};
  const parseLine=(line,d)=>{const out=[];let cell='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cell+='"';i++;continue;}q=!q;continue;}if(ch===d&&!q){out.push(cell.trim());cell='';}else cell+=ch;}out.push(cell.trim());return out;};
  const parseCsv=raw=>{const lines=String(raw||'').replace(/^\\uFEFF/,'').split(/\\r?\\n/).filter(x=>x.trim());if(!lines.length)return{headers:[],rows:[]};const first=lines[0],d=(first.match(/,/g)||[]).length>=(first.match(/;/g)||[]).length?',':';';return{headers:parseLine(first,d),rows:lines.slice(1).map(x=>parseLine(x,d))};};
  const mapRows=p=>{const cols=p.headers.map(h=>aliasMap[norm(h)]||null);return p.rows.map(row=>{const x={};cols.forEach((f,i)=>{if(f)x[f]=row[i]??'';});return{name:String(x.name||'').trim(),sku:String(x.sku||'').trim(),price:num(x.price),cost:num(x.unit_cost),sales:num(x.sales),commission_percent:num(x.commission_percent),logistics_per_unit:num(x.logistics_per_unit),storage_per_unit:num(x.storage_per_unit),tax_percent:num(x.tax_percent),ad_spend:num(x.ad_spend)};});};
  const esc=v=>String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const money=v=>Number.isFinite(Number(v))?Number(v).toLocaleString(undefined,{maximumFractionDigits:2}):'—';
  const download=(name,value,mime)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([value],{type:mime}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  const status=(t,k)=>{const e=byId('paStatus');if(e){e.textContent=t;e.dataset.status=k||'';}};
  const renderSummary=s=>{byId('paSummary').innerHTML='<div class="dc-metrics"><div class="dc-metric"><span>Ապրանքներ</span><strong>'+s.rows_total+'</strong></div><div class="dc-metric"><span>Ստուգված</span><strong>'+s.rows_verified+'</strong></div><div class="dc-metric"><span>Թերի</span><strong>'+s.rows_incomplete+'</strong></div><div class="dc-metric"><span>Կորստաբեր</span><strong>'+s.loss_making_rows+'</strong></div><div class="dc-metric"><span>Վաճառք</span><strong>'+money(s.total_sales)+'</strong></div><div class="dc-metric"><span>Ընդհանուր շահույթ</span><strong>'+money(s.total_profit)+'</strong></div><div class="dc-metric"><span>Weighted margin</span><strong>'+money(s.weighted_margin_percent)+'%</strong></div></div>';};
  const renderRanking=r=>{const el=byId('paRanking'),top=Array.isArray(r)?r.slice(0,20):[];byId('paRankMeta').textContent=top.length+' ստուգված ապրանք / առավելագույնը 20';if(!top.length){el.innerHTML='<div class="dc-result-empty">Չկա բավարար ստուգված տվյալ վարկանիշի համար։</div>';return;}el.innerHTML='<table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:8px;text-align:left">#</th><th style="padding:8px;text-align:left">Ապրանք</th><th style="padding:8px;text-align:left">SKU</th><th style="padding:8px;text-align:right">Շահույթ/միավոր</th><th style="padding:8px;text-align:right">Մարժա</th><th style="padding:8px;text-align:right">Ընդհանուր շահույթ</th></tr></thead><tbody>'+top.map(x=>'<tr><td style="padding:8px">'+x.rank+'</td><td style="padding:8px">'+esc(x.name||'—')+'</td><td style="padding:8px">'+esc(x.sku||'—')+'</td><td style="padding:8px;text-align:right">'+money(x.unit_profit)+'</td><td style="padding:8px;text-align:right">'+money(x.margin_percent)+'%</td><td style="padding:8px;text-align:right"><strong>'+money(x.total_profit)+'</strong></td></tr>').join('')+'</tbody></table>';};
  byId('paTemplate')?.addEventListener('click',()=>download('novessa-portfolio-template.csv','Product,SKU,Price,Unit Cost,Sales,Commission %,Logistics / Unit,Storage / Unit,Tax %,Ad Spend\\n','text/csv;charset=utf-8'));
  byId('paFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;byId('paFileName').textContent='Ֆայլ՝ '+f.name;try{mappedRows=mapRows(parseCsv(await f.text())).slice(0,500);byId('paPreview').innerHTML='<div class="dc-metrics"><div class="dc-metric"><span>Տողեր</span><strong>'+mappedRows.length+'</strong></div><div class="dc-metric"><span>Սահման</span><strong>500</strong></div></div>';byId('paAnalyze').disabled=!mappedRows.length;status(mappedRows.length?'Բեռնված է '+mappedRows.length+' տող':'Տվյալ չի ճանաչվել',mappedRows.length?'ok':'bad');}catch{mappedRows=[];byId('paAnalyze').disabled=true;status('CSV-ը չհաջողվեց կարդալ','bad');}});
  byId('paAnalyze')?.addEventListener('click',async()=>{if(!mappedRows.length)return;const b=byId('paAnalyze');b.disabled=true;b.textContent='Հաշվում եմ…';status('Core հաշվարկ…','loading');try{const r=await fetch('/ui/api/action/portfolio-analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({rows:mappedRows})});const body=await r.json();if(!r.ok)throw new Error(body?.error||'portfolio_analysis_failed');renderSummary(body.summary||{});renderRanking(body.ranking||[]);status(body.status==='verified'?'Վերլուծությունը ստուգված է':'Վերլուծությունը մասամբ է ստուգված',body.status==='verified'?'ok':'partial');}catch(err){status(String(err.message||'Վերլուծությունը չհաջողվեց'),'bad');byId('paSummary').textContent='Core արդյունքը հասանելի չէ։ Հորինված թիվ չի ցուցադրվում։';}finally{b.disabled=false;b.textContent='Վերլուծել ապրանքները';}});
})();
</script>`;
if(!index.includes('data-novessa-portfolio-script')) index=index.replace('</body>',portfolioAnalyzerScript+'</body>');
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
      resultTitle:'Core հաշվարկի արդյունք',source:'Source: NOVESSA Core',
      priceTag:'4 • ԳԻՆ ԵՎ ԶԵՂՉ',priceTitle:'Գին և զեղչ',priceHelp:'Մուտքագրիր գինը և զեղչի տոկոսը։ Հաշվարկը կատարվում է գործող Core pricing route-ով.',
      listPrice:'Գին',discountPercent:'Զեղչ, %',calculateDiscount:'Հաշվել',reverseTag:'5 • ՀԵՏ ՀԱՇՎԱՐԿ',reverseTitle:'Հետ հաշվարկել նպատակային գինը',reverseHelp:'Օգտագործում է վերևի Unit Economics թվերը և հաշվարկում է այն գինը, որը պետք է նպատակին հասնելու համար։',reverseTarget:'Նպատակի տեսակ',reverseTargetValue:'Նպատակային արժեք',reverseCalculate:'Հետ հաշվարկել գինը',reverseUnitProfit:'Շահույթ / միավոր',reverseMargin:'Մարժա, %',reverseTotalProfit:'Ընդհանուր շահույթ',reverseFailed:'Հետ հաշվարկը չհաջողվեց։'
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
      resultTitle:'Результат расчёта Core',source:'Source: NOVESSA Core',
      priceTag:'4 • ЦЕНА И СКИДКА',priceTitle:'Цена и скидка',priceHelp:'Введи цену и процент скидки. Расчёт выполняется через рабочий Core pricing route.',
      listPrice:'Цена',discountPercent:'Скидка, %',calculateDiscount:'Рассчитать',reverseTag:'5 • ОБРАТНЫЙ РАСЧЁТ',reverseTitle:'Рассчитать целевую цену',reverseHelp:'Использует поля Unit Economics выше и рассчитывает цену, необходимую для выбранной цели.',reverseTarget:'Тип цели',reverseTargetValue:'Целевое значение',reverseCalculate:'Рассчитать цену',reverseUnitProfit:'Прибыль / ед.',reverseMargin:'Маржа, %',reverseTotalProfit:'Общая прибыль',reverseFailed:'Обратный расчёт не выполнен.'
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
      resultTitle:'Core calculation result',source:'Source: NOVESSA Core',
      priceTag:'4 • PRICE & DISCOUNT',priceTitle:'Price & discount',priceHelp:'Enter the price and discount percentage. The calculation uses the working Core pricing route.',
      listPrice:'Price',discountPercent:'Discount, %',calculateDiscount:'Calculate',reverseTag:'5 • REVERSE CALCULATION',reverseTitle:'Calculate the target price',reverseHelp:'Uses the Unit Economics fields above and calculates the price required to reach your selected target.',reverseTarget:'Target type',reverseTargetValue:'Target value',reverseCalculate:'Calculate price',reverseUnitProfit:'Unit profit',reverseMargin:'Margin, %',reverseTotalProfit:'Total profit',reverseFailed:'Reverse calculation failed.'
    }
  };
  const lang=()=>document.documentElement.lang==='ru'?'ru':document.documentElement.lang==='en'?'en':'hy';
  const setText=()=>{
    const m=textMap[lang()];
    root.querySelectorAll('[data-dc]').forEach(el=>{const k=el.getAttribute('data-dc');if(m[k]!==undefined)el.textContent=m[k];});
    const reverseTarget=byId('dcReverseTarget');
    if(reverseTarget){
      const options=[['unit_profit',m.reverseUnitProfit],['margin',m.reverseMargin],['total_profit',m.reverseTotalProfit]];
      reverseTarget.innerHTML=options.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');
    }
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
  const reverseCalculate=async()=>{
    const m=textMap[lang()];
    const targetType=byId('dcReverseTarget')?.value||'unit_profit';
    const targetValue=priceNum('dcReverseTargetValue');
    const vals={unit_cost:num('dcCost'),sales:num('dcSales'),commission_percent:num('dcCommission'),logistics_per_unit:num('dcLogistics'),storage_per_unit:num('dcStorage'),tax_percent:num('dcTax'),ad_spend:num('dcAds')};
    const out=byId('dcReverseResult');
    if(targetValue===null||targetValue<0||Object.values(vals).some(v=>v===null)){out.textContent=m.invalid;return;}
    out.textContent='…';
    try{
      const r=await fetch('/ui/api/action/reverse-profit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({target_type:targetType,target_value:targetValue,...vals})});
      const body=await r.json();
      if(!r.ok){out.textContent=body?.error||m.reverseFailed;return;}
      out.innerHTML='<div class="dc-metrics">'+
        '<div class="dc-metric"><span>'+m.reversePrice+'</span><strong>'+Number(body.required_price??0).toLocaleString(undefined,{maximumFractionDigits:2})+'</strong></div>'+
        '<div class="dc-metric"><span>'+m.reverseUnitProfit+'</span><strong>'+Number(body.projected_unit_profit??0).toLocaleString(undefined,{maximumFractionDigits:2})+'</strong></div>'+
        '<div class="dc-metric"><span>'+m.reverseMargin+'</span><strong>'+Number(body.projected_margin_percent??0).toLocaleString(undefined,{maximumFractionDigits:2})+'%</strong></div>'+
        '<div class="dc-metric"><span>'+m.reverseTotalProfit+'</span><strong>'+Number(body.projected_total_profit??0).toLocaleString(undefined,{maximumFractionDigits:2})+'</strong></div>'+
      '</div><div class="dc-result-status">'+String(body.provenance||'NOVESSA Core')+'</div>';
    }catch{out.textContent=m.reverseFailed;}
  };
  const priceNum=id=>{const v=Number(byId(id)?.value);return Number.isFinite(v)?v:null;};
  const calculatePriceDiscount=async()=>{
    const m=textMap[lang()],price=priceNum('dcListPrice'),discount=priceNum('dcDiscountPercent'),out=byId('dcPriceResult');
    if(price===null||discount===null||price<0||discount<0||discount>100){out.textContent=m.invalid;return;}
    out.textContent='…';
    try{
      const r=await fetch('/ui/api/action/pricing',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({list_price:price,discount_percent:discount})});
      const body=await r.json();
      if(!r.ok){out.textContent=body?.error||m.failed;return;}
      const source=body?.data??body?.result??body;
      const flat={}; const visit=(obj,prefix='')=>{if(!obj||typeof obj!=='object')return;for(const [k,v] of Object.entries(obj)){const key=prefix?prefix+'.'+k:k;if(v&&typeof v==='object')visit(v,key);else if(v!==undefined&&v!==null)flat[key]=v;}};
      visit(source);
      const rows=Object.entries(flat).filter(([k])=>/price|discount/i.test(k)).slice(0,8).map(([k,v])=>'<div class="dc-price-row"><span>'+k+'</span><strong>'+String(v)+'</strong></div>').join('');
      out.innerHTML=rows||'<div class="dc-price-row"><span>Core</span><strong>'+JSON.stringify(source)+'</strong></div>';
    }catch{out.textContent=m.failed;}
  };
  byId('dcPriceCalculate')?.addEventListener('click',calculatePriceDiscount);
  byId('dcReverseCalculate')?.addEventListener('click',reverseCalculate);
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


.cc-product-card{margin-top:12px}.cc-product-fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px}.cc-product-fields label{display:grid;gap:6px;color:#c0b8d6;font-size:11px}.cc-product-fields input{width:100%;box-sizing:border-box;padding:10px 11px;border-radius:11px;border:1px solid #342b5b;background:#09071b;color:#f7f3ff;outline:none}.cc-product-fields input:focus{border-color:#7257d0;box-shadow:0 0 0 3px rgba(109,40,217,.14)}.cc-product-state{padding:6px 9px;border-radius:999px;background:rgba(109,40,217,.1);border:1px solid #3b2e6e;color:#bbb0db;font-size:10px}.cc-product-message{margin-top:8px;min-height:18px;color:#928aa9;font-size:11px}
@media(max-width:1000px){.cc-product-fields{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:650px){.cc-product-fields{grid-template-columns:1fr 1fr}}@media(max-width:450px){.cc-product-fields{grid-template-columns:1fr}}

/* NOVESSA Command Center v2 */
.novessa-command-center{margin:18px 0 26px;padding:24px;border:1px solid #30245f;border-radius:26px;background:linear-gradient(145deg,rgba(15,10,37,.98),rgba(6,5,20,.98));box-shadow:0 22px 75px rgba(8,5,30,.45)}
.cc-hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.cc-hero-copy{max-width:820px}.cc-eyebrow,.cc-tag{font-size:10px;letter-spacing:.14em;font-weight:850;color:#a78bfa}.cc-hero h1{margin:8px 0 8px;font-size:clamp(28px,4vw,46px);line-height:1.02}.cc-hero p{margin:0;color:#aaa2c4;line-height:1.55;font-size:14px}.cc-hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.cc-health{display:flex;gap:10px;align-items:center;padding:12px 14px;border:1px solid #352a66;border-radius:16px;background:rgba(109,40,217,.11);min-width:170px}.cc-health small{display:block;color:#948cae;font-size:10px;margin-bottom:3px}.cc-health strong{font-size:12px}.cc-health-dot{width:9px;height:9px;border-radius:50%;background:#c4b5fd;box-shadow:0 0 0 4px rgba(167,139,250,.1)}.cc-health-dot[data-state=ok]{background:#86efac}.cc-health-dot[data-state=warn]{background:#fde68a}.cc-health-dot[data-state=bad]{background:#fda4af}
.cc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin:20px 0}.cc-kpi{padding:14px 15px;border:1px solid #2d2454;border-radius:16px;background:rgba(10,8,27,.8)}.cc-kpi span{display:block;color:#928aa8;font-size:11px;margin-bottom:7px}.cc-kpi strong{display:block;font-size:18px}.cc-kpi strong[data-state=ok]{color:#86efac}.cc-kpi strong[data-state=warn]{color:#fde68a}.cc-kpi strong[data-state=bad]{color:#fda4af}.cc-kpi strong[data-state=loading]{color:#d8d3e8}.cc-kpi small{display:block;color:#756d8d;margin-top:4px;font-size:10px}
.cc-grid,.cc-bottom-grid{display:grid;grid-template-columns:1.25fr .95fr;gap:12px}.cc-bottom-grid{margin-top:12px}.cc-card{padding:18px;border:1px solid #2d2454;border-radius:20px;background:linear-gradient(145deg,rgba(17,12,39,.95),rgba(8,6,23,.98));min-width:0}.cc-card-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.cc-card h2{margin:6px 0 0;font-size:19px}.cc-focus-card{min-height:260px}.cc-attention{display:grid;gap:8px;margin-top:14px}.cc-attention-item{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:start;padding:11px 12px;border:1px solid #2d2454;border-radius:14px;background:rgba(8,6,22,.72)}.cc-attention-item.warn{border-color:#5a4822}.cc-attention-item.good{border-color:#24452f}.cc-attention-icon{width:25px;height:25px;border-radius:9px;display:grid;place-items:center;background:#18112f;color:#bdaef0;font-weight:900}.cc-attention-item.warn .cc-attention-icon{color:#fde68a;background:rgba(245,201,106,.08)}.cc-attention-item.good .cc-attention-icon{color:#86efac;background:rgba(134,239,172,.08)}.cc-attention-item strong{font-size:12px}.cc-attention-item p{margin:3px 0 0;color:#9189a8;font-size:11px;line-height:1.4}.cc-attention-item button{min-height:32px;padding:7px 10px;font-size:11px}.cc-skeleton{height:48px;border-radius:12px;background:linear-gradient(90deg,#100d25,#181334,#100d25);background-size:200% 100%;animation:ccpulse 1.4s ease-in-out infinite}.cc-skeleton:nth-child(2){opacity:.7}.cc-skeleton:nth-child(3){opacity:.45}@keyframes ccpulse{0%,100%{background-position:0 0}50%{background-position:100% 0}}
.cc-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;align-items:center;gap:7px;margin-top:14px}.cc-flow-step{padding:12px;border:1px solid #2d2454;border-radius:14px;background:#0a071d;color:#eeeaff;text-align:left}.cc-flow-step b{display:block;color:#847aa0;font-size:10px;margin-bottom:4px}.cc-flow-step strong{display:block;font-size:12px}.cc-flow-step small{display:block;color:#8f87a8;font-size:10px;line-height:1.35;margin-top:4px}.cc-flow-step:hover{border-color:#664dbe}.cc-flow-arrow{color:#706793;font-size:14px}
.cc-next-card{}.cc-card>p{color:#958da9;font-size:12px;line-height:1.5;margin:8px 0 14px}.cc-modules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.cc-modules button{padding:11px 10px;text-align:left;border:1px solid #2d2454;border-radius:13px;background:#0a071d}.cc-modules b{display:block;font-size:11px}.cc-modules span{display:block;color:#817996;font-size:10px;margin-top:2px}.cc-note{display:flex;gap:9px;align-items:flex-start;margin-top:12px;padding:11px 13px;border:1px dashed #3a2e69;border-radius:14px;background:rgba(109,40,217,.06)}.cc-note span{color:#86efac}.cc-note p{margin:0;color:#8e86a6;font-size:10px;line-height:1.45}.cc-note strong{color:#d9d2ee}
@media(max-width:1000px){.cc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.cc-grid,.cc-bottom-grid{grid-template-columns:1fr}.cc-flow{grid-template-columns:1fr 20px 1fr}.cc-flow-step:nth-of-type(7),.cc-flow-arrow:nth-of-type(6){display:none}}
@media(max-width:650px){.novessa-command-center{padding:16px;border-radius:18px}.cc-hero{flex-direction:column}.cc-health{width:100%;box-sizing:border-box}.cc-kpis{grid-template-columns:1fr}.cc-attention-item{grid-template-columns:26px 1fr}.cc-attention-item button{grid-column:2;justify-self:start}.cc-flow{grid-template-columns:1fr}.cc-flow-arrow{display:none}.cc-modules{grid-template-columns:1fr 1fr}}

/* NOVESSA Decision Center v1 */
.dc-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:8px}.dc-metric{padding:14px 15px;border:1px solid #34286a;border-radius:14px;background:rgba(21,15,48,.72)}.dc-metric span{display:block;font-size:11px;color:#aaa2c5;margin-bottom:5px}.dc-metric strong{font-size:20px;line-height:1.1}.dc-result-status{margin-top:10px;font-size:11px;color:#aaa2c5}.dc-details{margin-top:10px;border-top:1px solid #2a2254;padding-top:10px}.dc-detail{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#aaa2c5;padding:5px 0}.dc-detail b{color:#e8e5f1;font-weight:600;text-align:right}@media(max-width:700px){.dc-metrics{grid-template-columns:1fr}}
.novessa-decision-center{margin:26px 0 34px;padding:24px;border:1px solid #34286a;border-radius:26px;background:linear-gradient(145deg,rgba(16,10,40,.96),rgba(7,6,23,.98));box-shadow:0 20px 70px rgba(11,7,40,.45)}
.dc-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.dc-eyebrow,.dc-section-tag{font-size:11px;letter-spacing:.12em;font-weight:800;color:#a78bfa}.dc-hero h2{margin:7px 0 8px;font-size:clamp(24px,3vw,36px);line-height:1.08}.dc-subtitle{max-width:830px;color:#aaa2c5;margin:0;line-height:1.55}.dc-truth{padding:10px 14px;border:1px solid #41347e;border-radius:999px;color:#ddd6fe;background:rgba(109,40,217,.13);white-space:nowrap;font-size:12px;font-weight:700}
.dc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0}.dc-kpi{padding:15px 16px;border:1px solid #2f2559;border-radius:17px;background:rgba(14,10,33,.8)}.dc-kpi span{display:block;color:#a39bbf;font-size:12px;margin-bottom:7px}.dc-kpi strong{font-size:16px;color:#f7f3ff}.dc-kpi strong[data-status=ok]{color:#86efac}.dc-kpi strong[data-status=partial]{color:#fde68a}.dc-kpi strong[data-status=bad]{color:#fda4af}
.dc-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,.85fr);gap:16px}.dc-side{display:grid;gap:16px}.dc-panel{border:1px solid #2f2559;border-radius:20px;background:linear-gradient(145deg,rgba(18,13,39,.94),rgba(9,7,26,.96));padding:20px}.dc-panel-primary{min-width:0}.dc-panel-head h3{margin:7px 0 6px;font-size:22px}.dc-panel-head p{margin:0;color:#a9a2c0;line-height:1.5}
.dc-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}.dc-fields label{display:grid;gap:7px;color:#c6bfdc;font-size:12px;font-weight:650}.dc-fields input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:12px;border:1px solid #342b5b;background:#09071b;color:#f7f3ff;outline:none}.dc-fields input:focus{border-color:#7257d0;box-shadow:0 0 0 3px rgba(109,40,217,.16)}
.dc-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.dc-actions button{min-height:42px}.dc-result{margin-top:16px;padding:16px;border-radius:15px;border:1px dashed #3a2e69;background:#08061a;min-height:92px}.dc-result-empty{color:#89819f;font-size:13px;padding-top:18px}.dc-result-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.dc-result-head strong{font-size:15px}.dc-result-head span{font-size:11px;color:#9289ad}.dc-result pre{margin:0;max-height:310px;overflow:auto;white-space:pre-wrap;color:#d9d3ef;font-size:11px;line-height:1.45}.dc-result-message{font-size:13px;line-height:1.5}.dc-result-message[data-kind=bad]{color:#fda4af}.dc-price-help{font-size:12px;color:#a9a2c0;line-height:1.45;margin:0 0 12px}.dc-price-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}.dc-price-fields label{display:grid;gap:7px;color:#c6bfdc;font-size:12px;font-weight:650}.dc-price-fields input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:12px;border:1px solid #342b5b;background:#09071b;color:#f7f3ff;outline:none}.dc-price-fields input:focus{border-color:#7257d0;box-shadow:0 0 0 3px rgba(109,40,217,.16)}.dc-price-result{margin-top:12px;padding:11px;border-radius:12px;border:1px dashed #3a2e69;background:#08061a;color:#ddd6ef;font-size:12px;min-height:18px}.dc-price-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid rgba(83,68,128,.25)}.dc-price-row:last-child{border-bottom:0}.dc-price-row span{color:#9991b3}.dc-price-row strong{color:#f7f3ff;text-align:right}.dc-next-list{display:grid;gap:8px;margin-top:12px}.dc-next{display:grid;grid-template-columns:34px 1fr 20px;gap:10px;align-items:center;text-align:left;border:1px solid #2c2450;border-radius:14px;padding:11px 12px;background:#0b081f;color:#eee9ff;cursor:pointer}.dc-next:hover{border-color:#634bbd}.dc-next b{font-size:11px;color:#8f83b4}.dc-next strong{display:block;font-size:13px}.dc-next small{display:block;color:#9088a8;line-height:1.35;margin-top:3px}.dc-next i{font-style:normal;color:#a78bfa}
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
