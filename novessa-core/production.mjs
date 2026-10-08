import { readFileSync, writeFileSync } from 'node:fs';

const coreDir = process.cwd().replace(/\\/g, '/') + '/';
const srcDir = coreDir + 'src/';
const uiPath = coreDir + 'public/index.html';
const appPath = coreDir + 'public/app.js';
const stylePath = coreDir + 'public/styles.css';
const serverPath = coreDir + 'server.mjs';
const runtimePath = srcDir + 'novessaProduction.mjs';

const runtime = String.raw`import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { unitEconomics } from './tools/unitEconomics.mjs';
import { searchWeb } from './discovery/service.mjs';
import { buildKdpPackage } from './publishing/service.mjs';
import { loadWorkspace, saveWorkspace, appendEvent, persistenceStatus } from './persistence.mjs';

const GEMINI_URL='https://generativelanguage.googleapis.com/v1beta/models/';
const DEFAULT_MODEL='gemini-3.8-flash';
const ACTION_TTL_MS=15*60*1000;
const MAX_INPUT=24000;

const out=(status,extra={})=>({status,...extra});
const text=(v,max=MAX_INPUT)=>String(v??'').slice(0,max);
const configured=v=>String(v??'').trim().length>0;

async function geminiGenerate({system,user,json=false}={}){
  const key=String(process.env.GEMINI_API_KEY||'').trim();
  if(!key) return out('provider_unavailable',{error:'gemini_not_configured'});
  const model=String(process.env.GEMINI_MODEL||DEFAULT_MODEL).trim();
  if(!/^[A-Za-z0-9._-]+$/.test(model)) return out('invalid_data',{error:'gemini_model_invalid'});
  const body={
    systemInstruction:{parts:[{text:text(system,12000)}]},
    contents:[{role:'user',parts:[{text:text(user)}]}],
    generationConfig:{temperature:0.2,maxOutputTokens:8192}
  };
  if(json) body.generationConfig.responseMimeType='application/json';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),55000);
  try{
    const r=await fetch(GEMINI_URL+encodeURIComponent(model)+':generateContent',{
      method:'POST',
      headers:{'content-type':'application/json','x-goog-api-key':key},
      body:JSON.stringify(body),
      signal:controller.signal
    });
    const raw=await r.text();
    let payload=null;
    try{payload=JSON.parse(raw);}catch{}
    if(!r.ok) return out('error',{error:'gemini_http_error',http_status:r.status,details:payload?.error?.message||'provider_error'});
    const value=payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    if(!value) return out('error',{error:'gemini_empty_response'});
    return out('verified',{provider:'google-gemini',model,text:value});
  }catch(error){
    return out('provider_unavailable',{error:error?.name==='AbortError'?'gemini_timeout':'gemini_unreachable'});
  }finally{clearTimeout(timer);}
}

function flatten(value,prefix='',result={}){
  if(!value||typeof value!=='object') return result;
  for(const [key,v] of Object.entries(value)){
    const name=prefix?prefix+'.'+key:key;
    if(v&&typeof v==='object') flatten(v,name,result);
    else result[name]=v;
  }
  return result;
}
function firstNumber(value,names){
  const flat=flatten(value);
  for(const name of names){
    for(const [key,v] of Object.entries(flat)){
      if((key===name||key.endsWith('.'+name))&&Number.isFinite(Number(v))) return Number(v);
    }
  }
  return undefined;
}

export function rnp(input={}){
  const stock=Number(input.stock),sales=Number(input.sales_history),period=Number(input.period_days);
  const lead=Number(input.lead_time_days),safety=Number(input.safety_stock_days||0),target=Number(input.target_cover_days);
  if(![stock,sales,period,lead,safety,target].every(Number.isFinite)||stock<0||sales<0||period<=0||lead<0||safety<0||target<=0)
    return out('input_incomplete',{error:'rnp_requires_stock_sales_history_period_lead_time_target_cover'});
  const average_daily_sales=sales/period;
  const days_of_cover=average_daily_sales>0?stock/average_daily_sales:null;
  const reorder_point=Math.ceil(average_daily_sales*(lead+safety));
  const recommended_order=Math.max(0,Math.ceil(average_daily_sales*target-stock));
  const risk=average_daily_sales===0?'no_demand':stock<=reorder_point?'critical':days_of_cover<lead+safety?'high':'normal';
  return out('verified',{method:'deterministic',metrics:{average_daily_sales,days_of_cover,reorder_point,recommended_order,risk},inputs:{stock,sales_history:sales,period_days:period,lead_time_days:lead,safety_stock_days:safety,target_cover_days:target},provenance:'NOVESSA Core deterministic RNP'});
}

function evidenceOf(research){
  const rows=Array.isArray(research?.data?.results)?research.data.results:Array.isArray(research?.results)?research.results:[];
  return rows.slice(0,20).map(item=>({
    title:text(item.title,300),
    url:text(item.url||item.link,600),
    snippet:text(item.snippet||item.highlight||item.text,900)
  })).filter(item=>item.title||item.url||item.snippet);
}

export async function marketResearch(input={}){
  const query=text(input.query||input.product).trim();
  if(!query) return out('input_incomplete',{error:'market_research_query_required'});
  const result=await searchWeb({query,limit:Math.min(20,Math.max(3,Number(input.limit)||8))});
  if(result?.status!=='verified') return result;
  const evidence=evidenceOf(result);
  if(!evidence.length) return out('partial',{error:'research_returned_no_evidence'});
  return out('verified',{
    query,
    evidence,
    metrics_available:false,
    competitors:evidence.filter(e=>/competitor|marketplace|amazon|shopify|wildberries|ozon/i.test(e.title+' '+e.snippet)).slice(0,10),
    provenance:'NOVESSA discovery provider',
    note:'Only provider evidence is returned. Missing demand or sales-volume metrics are not invented.'
  });
}


export async function analyzeProduct(input={},deps={}){
  const product=input?.product&&typeof input.product==='object'?input.product:input;
  const name=text(product?.name||product?.product).trim();
  const sku=text(product?.sku).trim();
  const marketQuery=text(input?.market_query||product?.market_query).trim();
  const numbers={
    price:Number(product?.price),
    unit_cost:Number(product?.cost??product?.unit_cost),
    sales:Number(product?.sales),
    commission_percent:Number(product?.commission??product?.commission_percent),
    logistics_per_unit:Number(product?.logistics??product?.logistics_per_unit),
    storage_per_unit:Number(product?.storage??product?.storage_per_unit),
    tax_percent:Number(product?.tax??product?.tax_percent),
    ad_spend:Number(product?.ads??product?.ad_spend)
  };
  const economicsInputOk=Object.values(numbers).every(Number.isFinite);
  const economics=economicsInputOk
    ? unitEconomics(numbers)
    : out('input_incomplete',{error:'product_analysis_requires_economics_fields',missing:Object.entries(numbers).filter(([,v])=>!Number.isFinite(v)).map(([k])=>k)});
  let market_research=null;
  if(marketQuery){
    const runner=typeof deps.researchRunner==='function'?deps.researchRunner:marketResearch;
    market_research=await runner({query:marketQuery,limit:Math.min(20,Math.max(3,Number(input.research_limit)||8))});
  }
  const profit=firstNumber(economics,['unit_profit','profit_per_unit','net_profit','profit']);
  const margin=firstNumber(economics,['profit_margin','margin']);
  const profitSignal=Number.isFinite(profit)?(profit<0?'loss_making':'positive'):Number.isFinite(margin)?(margin<0?'loss_making':'positive'):'unknown';
  const researchStatus=marketQuery?(market_research?.status||'unknown'):'not_requested';
  const complete=economics.status==='verified'&&(researchStatus==='verified'||researchStatus==='not_requested');
  const status=complete?'verified':(economics.status==='provider_unavailable'||market_research?.status==='provider_unavailable')?'provider_unavailable':'partial';
  return out(status,{
    product:{name,sku},
    economics,
    market_research,
    decision:{
      profit_signal:profitSignal,
      profit,
      margin,
      research_status:researchStatus,
      next_action:profitSignal==='loss_making'?'Վերանայել գինը և ինքնարժեքը':'Տեղեկությունները բավարար են հաջորդ որոշման քայլի համար'
    },
    provenance:'NOVESSA Core product analysis: deterministic economics + provider evidence',
    note:'Missing financial or market data is not invented.'
  });
}


export function reverseProfit(input={}){
  const targetType=text(input.target_type||input.target||'unit_profit').trim().toLowerCase();
  const targetValue=Number(input.target_value??input.target_unit_profit??input.target_margin_percent??input.target_total_profit);
  const fields={
    unit_cost:Number(input.unit_cost??input.cost),
    commission_percent:Number(input.commission_percent??input.commission),
    logistics_per_unit:Number(input.logistics_per_unit??input.logistics),
    storage_per_unit:Number(input.storage_per_unit??input.storage),
    tax_percent:Number(input.tax_percent??input.tax),
    ad_spend:Number(input.ad_spend??input.ads),
    sales:Number(input.sales)
  };
  const missing=Object.entries(fields).filter(([,v])=>!Number.isFinite(v)).map(([k])=>k);
  if(!Number.isFinite(targetValue)||missing.length)return out('input_incomplete',{error:'reverse_profit_requires_target_and_economics_fields',missing:['target_value',...missing].filter((v,i,a)=>a.indexOf(v)===i)});
  if(targetValue<0)return out('invalid_data',{error:'target_value_must_be_non_negative'});
  if(Object.values(fields).some(v=>v<0))return out('invalid_data',{error:'reverse_profit_fields_must_be_non_negative'});
  if((targetType==='total_profit'||fields.ad_spend>0)&&fields.sales<=0)return out('input_incomplete',{error:'reverse_profit_requires_positive_sales_when_ad_spend_or_total_profit_is_used'});
  const commission=fields.commission_percent/100;
  const tax=fields.tax_percent/100;
  if(commission+tax>=1)return out('invalid_data',{error:'commission_plus_tax_must_be_below_100_percent'});
  const adPerUnit=fields.sales>0?fields.ad_spend/fields.sales:0;
  let targetUnitProfit=targetValue;
  let targetMargin=null;
  if(targetType==='margin'){
    targetMargin=targetValue/100;
    if(targetMargin<0||targetMargin>=1)return out('invalid_data',{error:'target_margin_percent_must_be_between_0_and_100'});
  }else if(targetType==='total_profit'){
    targetUnitProfit=targetValue/fields.sales;
  }else if(targetType!=='unit_profit'){
    return out('invalid_data',{error:'unsupported_reverse_profit_target_type'});
  }
  const fixedUnitCost=fields.unit_cost+fields.logistics_per_unit+fields.storage_per_unit+adPerUnit;
  const denominator=1-commission-tax-(targetMargin??0);
  if(denominator<=0)return out('invalid_data',{error:'reverse_profit_target_is_not_mathematically_reachable'});
  const requiredPrice=(fixedUnitCost+(targetMargin===null?targetUnitProfit:0))/denominator;
  if(!Number.isFinite(requiredPrice)||requiredPrice<0)return out('error',{error:'reverse_profit_calculation_failed'});
  const projectedRevenue=requiredPrice*fields.sales;
  const projectedCommission=requiredPrice*commission*fields.sales;
  const projectedTax=requiredPrice*tax*fields.sales;
  const projectedUnitProfit=targetMargin===null?targetUnitProfit:requiredPrice*targetMargin;
  const projectedTotalProfit=projectedUnitProfit*fields.sales;
  const projectedMargin=requiredPrice>0?projectedUnitProfit/requiredPrice*100:0;
  return out('verified',{
    target:{type:targetType,value:targetValue,unit_profit:targetUnitProfit,margin_percent:targetMargin===null?projectedMargin:targetMargin*100},
    required_price:Number(requiredPrice.toFixed(6)),
    projected_unit_profit:Number(projectedUnitProfit.toFixed(6)),
    projected_total_profit:Number(projectedTotalProfit.toFixed(6)),
    projected_margin_percent:Number(projectedMargin.toFixed(6)),
    assumptions:{sales:fields.sales,ad_spend:fields.ad_spend,ad_spend_per_unit:Number(adPerUnit.toFixed(6)),commission_percent:fields.commission_percent,tax_percent:fields.tax_percent,unit_cost:fields.unit_cost,logistics_per_unit:fields.logistics_per_unit,storage_per_unit:fields.storage_per_unit},
    projected_revenue:Number(projectedRevenue.toFixed(6)),
    projected_commission:Number(projectedCommission.toFixed(6)),
    projected_tax:Number(projectedTax.toFixed(6))
  ,provenance:'NOVESSA Core deterministic reverse profit calculation'});
}

function actionSecret(){
  return String(process.env.NOVESSA_OPERATOR_ACTION_SECRET||process.env.NOVESSA_CORE_SHARED_SECRET||'').trim();
}
function sign(payload){
  const secret=actionSecret();
  if(!secret) return null;
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
function verify(token){
  const secret=actionSecret();
  if(!secret||typeof token!=='string') return null;
  const parts=token.split('.');
  if(parts.length!==2) return null;
  const expected=createHmac('sha256',secret).update(parts[0]).digest('base64url');
  const a=Buffer.from(parts[1]),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b)) return null;
  let payload;
  try{payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));}catch{return null;}
  if(!payload?.issued_at||Date.now()-Number(payload.issued_at)>ACTION_TTL_MS) return null;
  return payload;
}

function deterministicFacts(input={}){
  const facts={};
  if(input.economics&&typeof input.economics==='object') facts.economics=unitEconomics(input.economics);
  else if(['price','unit_cost','sales','commission_percent','logistics_per_unit','storage_per_unit','tax_percent','ad_spend'].every(k=>input[k]!==undefined))
    facts.economics=unitEconomics(input);
  if(input.rnp&&typeof input.rnp==='object') facts.rnp=rnp(input.rnp);
  else if(['stock','sales_history','period_days','lead_time_days','target_cover_days'].every(k=>input[k]!==undefined)) facts.rnp=rnp(input);
  if(input.wildberries&&typeof input.wildberries==='object') facts.wildberries=input.wildberries;
  return facts;
}
function actionList(facts){
  const actions=[];
  const margin=firstNumber(facts.economics,['profit_margin','margin']);
  const unitProfit=firstNumber(facts.economics,['unit_profit','profit_per_unit']);
  const recommendedOrder=firstNumber(facts.rnp,['recommended_order']);
  const reorderPoint=firstNumber(facts.rnp,['reorder_point']);
  const risk=facts.rnp?.metrics?.risk;
  if(Number.isFinite(recommendedOrder)&&recommendedOrder>0)
    actions.push({type:'reorder_plan',title:'Պատրաստել լրացման պլանը',reason:'Հաշվարկված մնացորդը չի հասնում նպատակային ծածկույթին։',payload:{recommended_order:recommendedOrder,reorder_point:reorderPoint,risk},execution:'internal_plan'});
  if(Number.isFinite(margin)&&margin<0)
    actions.push({type:'profit_guard',title:'Կանգնեցնել ոչ շահութաբեր գործարկումը',reason:'Հաշվարկված շահույթի մարժան բացասական է։',payload:{profit_margin:margin},execution:'internal_decision_gate'});
  if(Number.isFinite(unitProfit)&&unitProfit<0)
    actions.push({type:'price_cost_review',title:'Վերանայել գինն ու ինքնարժեքը',reason:'Միավորի շահույթը բացասական է։',payload:{unit_profit:unitProfit},execution:'internal_decision_gate'});
  const wb=facts.wildberries;
  if(wb?.warehouse_id&&wb?.chrt_id&&Number.isFinite(recommendedOrder)&&recommendedOrder>0){
    const currentStock=Number(wb.current_stock);
    if(Number.isFinite(currentStock)&&currentStock>=0)
      actions.push({type:'wb_update_stock',title:'Թարմացնել Wildberries մնացորդը',reason:'RNP-ը հաշվարկել է լրացման քանակը, իսկ WB պահեստի և չափի ID-ները տրամադրված են։',payload:{warehouse_id:Number(wb.warehouse_id),chrt_id:Number(wb.chrt_id),amount:Math.ceil(currentStock+recommendedOrder),recommended_order:recommendedOrder},execution:'wildberries_api'});
  }
  if(wb?.campaign_id&&wb.stop_campaign===true)
    actions.push({type:'wb_stop_campaign',title:'Կանգնեցնել Wildberries գովազդային արշավը',reason:'Այս campaign ID-ի stop գործողությունը հատուկ նշված է որպես թույլատրված։',payload:{campaign_id:Number(wb.campaign_id)},execution:'wildberries_api'});
  return actions;
}

export async function operatorRun(input={}){
  const request_id=text(input.request_id||'op-'+randomUUID(),120);
  const facts=deterministicFacts(input);
  if(input.market_query||input.product_research_query){
    const research=await marketResearch({query:input.market_query||input.product_research_query,limit:input.research_limit});
    facts.market_research=research;
  }
  const actions=actionList(facts).map(action=>{
    const issued_at=Date.now();
    const action_id='act-'+randomUUID();
    const approval_token=sign({action_id,type:action.type,payload:action.payload,issued_at,request_id});
    return {...action,action_id,issued_at,approval_required:true,approval_token};
  });
  let interpretation=out('input_incomplete',{error:'operator_objective_not_provided'});
  if(configured(input.objective)||Object.keys(facts).length){
    interpretation=await geminiGenerate({
      system:'You are NOVESSA AI Operator. Use only supplied deterministic calculations and sourced evidence as facts. Never invent financial, stock, demand, sales, ROI or profit numbers. Rank the actual actions. Do not claim an external action was executed unless the backend explicitly executed it. Return JSON: {summary:string, priorities:string[], cautions:string[]}.',
      user:JSON.stringify({objective:text(input.objective,5000),facts},null,2),
      json:true
    });
  }
  return out('verified',{
    request_id,
    operator:{mode:'decision_operator',human_approval_required:true},
    facts,
    interpretation:interpretation.status==='verified'?JSON.parse(interpretation.text):interpretation,
    actions,
    action_count:actions.length
  });
}

export function approveAction(token){
  const payload=verify(token);
  if(!payload) return out('invalid_data',{error:'operator_action_token_invalid_or_expired'});
  const approval_token=sign({...payload,approved:true,approved_at:Date.now()});
  if(!approval_token) return out('provider_unavailable',{error:'operator_action_secret_not_configured'});
  return out('verified',{action_id:payload.action_id,approved:true,approval_token,expires_in_ms:ACTION_TTL_MS});
}

export async function executeApprovedAction(token){
  const payload=verify(token);
  if(!payload) return out('invalid_data',{error:'operator_action_token_invalid_or_expired'});
  if(payload.approved!==true) return out('invalid_data',{error:'operator_action_not_approved'});
  if(payload.type==='reorder_plan') return out('verified',{action_id:payload.action_id,executed:true,execution:'internal_plan_finalized',result:payload.payload});
  if(payload.type==='profit_guard'||payload.type==='price_cost_review')
    return out('verified',{action_id:payload.action_id,executed:true,execution:'internal_decision_gate_recorded',result:payload.payload});
  if(payload.type==='wb_update_stock'){
    const p=payload.payload;
    if(!Number.isInteger(p?.warehouse_id)||p.warehouse_id<=0||!Number.isInteger(p?.chrt_id)||p.chrt_id<=0||!Number.isInteger(p?.amount)||p.amount<0)
      return out('invalid_data',{error:'wb_stock_action_invalid'});
    const result=await wbRequest('https://marketplace-api.wildberries.ru','/api/v3/stocks/'+p.warehouse_id,{method:'PUT',body:{stocks:[{chrtId:p.chrt_id,amount:p.amount}]}});
    return result.status==='verified'?out('verified',{action_id:payload.action_id,executed:true,execution:'wildberries_stock_update',result:p}):result;
  }
  if(payload.type==='wb_stop_campaign'){
    const id=Number(payload.payload?.campaign_id);
    if(!Number.isInteger(id)||id<=0) return out('invalid_data',{error:'wb_campaign_id_invalid'});
    const result=await wbRequest('https://advert-api.wildberries.ru','/adv/v0/stop?id='+encodeURIComponent(id));
    return result.status==='verified'?out('verified',{action_id:payload.action_id,executed:true,execution:'wildberries_campaign_stop',result:{campaign_id:id,http_status:result.http_status}}):result;
  }
  return out('invalid_data',{error:'operator_action_not_supported'});
}

function xmlEscape(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function u16(v){const b=Buffer.alloc(2);b.writeUInt16LE(v);return b;}
function u32(v){const b=Buffer.alloc(4);b.writeUInt32LE(v>>>0);return b;}
function zipFiles(files){
  const locals=[],centrals=[];let offset=0;
  for(const file of files){
    const name=Buffer.from(file.name,'utf8');
    const data=Buffer.isBuffer(file.data)?file.data:Buffer.from(String(file.data),'utf8');
    const store=file.name==='mimetype';
    const method=store?0:8;
    const packed=store?data:deflateRawSync(data);
    const local=Buffer.concat([Buffer.from('PK\\\\x03\\\\x04','binary'),u16(20),u16(0),u16(method),u16(0),u16(0),u32(crc32(data)),u32(packed.length),u32(data.length),u16(name.length),u16(0),name,packed]);
    locals.push(local);
    centrals.push(Buffer.concat([Buffer.from('PK\\\\x01\\\\x02','binary'),u16(20),u16(20),u16(0),u16(method),u16(0),u16(0),u32(crc32(data)),u32(packed.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));
    offset+=local.length;
  }
  const localBuf=Buffer.concat(locals);const centralBuf=Buffer.concat(centrals);
  return Buffer.concat([localBuf,centralBuf,Buffer.concat([Buffer.from('PK\\\\x05\\\\x06','binary'),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralBuf.length),u32(localBuf.length),u16(0)])]);
}

export function buildEpub(input={}){
  const title=text(input.title).trim();const author=text(input.author).trim();const language=text(input.language||'en',20);const chapters=Array.isArray(input.chapters)?input.chapters:[];
  if(!title||!chapters.length) return out('input_incomplete',{error:'epub_requires_title_and_chapters'});
  const id='urn:uuid:'+randomUUID();
  const manifest=chapters.map((_,i)=>'<item id="chap'+(i+1)+'" href="chap'+(i+1)+'.xhtml" media-type="application/xhtml+xml"/>').join('');
  const spine=chapters.map((_,i)=>'<itemref idref="chap'+(i+1)+'"/>').join('');
  const files=[
    {name:'mimetype',data:'application/epub+zip'},
    {name:'META-INF/container.xml',data:'<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'},
    {name:'OEBPS/package.opf',data:'<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">'+xmlEscape(id)+'</dc:identifier><dc:title>'+xmlEscape(title)+'</dc:title><dc:language>'+xmlEscape(language)+'</dc:language><dc:creator>'+xmlEscape(author)+'</dc:creator></metadata><manifest>'+manifest+'</manifest><spine>'+spine+'</spine></package>'}
  ];
  chapters.forEach((chapter,i)=>{
    const heading=xmlEscape(chapter.title||('Chapter '+(i+1)));
    const paragraphs=text(chapter.text).split(String.fromCharCode(10)+String.fromCharCode(10)).map(p=>'<p>'+xmlEscape(p).split(String.fromCharCode(10)).join('<br/>')+'</p>').join('');
    files.push({name:'OEBPS/chap'+(i+1)+'.xhtml',data:'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>'+heading+'</title></head><body><h1>'+heading+'</h1>'+paragraphs+'</body></html>'});
  });
  return out('verified',{filename:(title||'book').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,80)+'.epub',content:zipFiles(files),media_type:'application/epub+zip'});
}

function pdfEscape(v){const slash=String.fromCharCode(92);return String(v??'').split(slash).join(slash+slash).split('(').join(slash+'(').split(')').join(slash+')');}
export function buildPdf(input={}){
  const title=text(input.title).trim();const author=text(input.author).trim();const chapters=Array.isArray(input.chapters)?input.chapters:[];
  if(!title||!chapters.length) return out('input_incomplete',{error:'pdf_requires_title_and_chapters'});
  const width=Number(input.page_width_pt)||432;const height=Number(input.page_height_pt)||648;const margin=Number(input.margin_pt)||48;const fontSize=Number(input.font_size_pt)||11;const leading=Number(input.leading_pt)||16;
  const maxChars=Math.max(30,Math.floor((width-2*margin)/(fontSize*0.52)));
  const lines=[title,...(author?['By '+author]:[]),''];
  const nl=String.fromCharCode(10);
  for(const chapter of chapters){
    lines.push(chapter.title||'');lines.push('');
    for(const paragraph of text(chapter.text).split(nl+nl)){
      let value=paragraph.trim();
      while(value.length>maxChars){let cut=value.lastIndexOf(' ',maxChars);if(cut<20)cut=maxChars;lines.push(value.slice(0,cut));value=value.slice(cut).trim();}
      if(value)lines.push(value);
      lines.push('');
    }
  }
  const perPage=Math.max(1,Math.floor((height-2*margin)/leading));const pages=[];for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage));
  const objects=[];const add=s=>{objects.push(Buffer.from(s,'binary'));return objects.length;};
  const catalog=add(''),pagesObj=add(''),fontObj=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),pageObjs=[];
  for(const pageLines of pages){
    let body='BT'+nl+'/F1 '+fontSize+' Tf'+nl+margin+' '+(height-margin)+' Td'+nl;
    pageLines.forEach((line,i)=>{if(i)body+='0 -'+leading+' Td'+nl;body+='('+pdfEscape(line)+') Tj'+nl;});
    body+='ET';
    const streamObj=add('<< /Length '+Buffer.byteLength(body,'binary')+' >>'+nl+'stream'+nl+body+nl+'endstream');
    pageObjs.push({pageObj:add(''),streamObj});
  }
  objects[pagesObj-1]=Buffer.from('<< /Type /Pages /Kids ['+pageObjs.map(p=>p.pageObj+' 0 R').join(' ')+'] /Count '+pageObjs.length+' >>','binary');
  for(const page of pageObjs)objects[page.pageObj-1]=Buffer.from('<< /Type /Page /Parent '+pagesObj+' 0 R /MediaBox [0 0 '+width+' '+height+'] /Resources << /Font << /F1 '+fontObj+' 0 R >> >> /Contents '+page.streamObj+' 0 R >>','binary');
  objects[catalog-1]=Buffer.from('<< /Type /Catalog /Pages '+pagesObj+' 0 R >>','binary');
  let pdf=Buffer.concat([Buffer.from('%PDF-1.4','binary'),Buffer.from([10,37,255,255,255,255,10])]);const offsets=[0];
  objects.forEach((obj,i)=>{offsets[i+1]=pdf.length;pdf=Buffer.concat([pdf,Buffer.from((i+1)+' 0 obj'+nl,'binary'),obj,Buffer.from(nl+'endobj'+nl,'binary')]);});
  const xref=pdf.length;pdf=Buffer.concat([pdf,Buffer.from('xref'+nl+'0 '+(objects.length+1)+nl+'0000000000 65535 f '+nl,'binary')]);
  for(let i=1;i<offsets.length;i++)pdf=Buffer.concat([pdf,Buffer.from(String(offsets[i]).padStart(10,'0')+' 00000 n '+nl,'binary')]);
  pdf=Buffer.concat([pdf,Buffer.from('trailer'+nl+'<< /Size '+(objects.length+1)+' /Root '+catalog+' 0 R >>'+nl+'startxref'+nl+xref+nl+'%%EOF','binary')]);
  return out('verified',{filename:(title||'book').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,80)+'.pdf',content:pdf,media_type:'application/pdf'});
}

export async function bookPlan(input={}){
  const title=text(input.title).trim(),topic=text(input.topic).trim(),audience=text(input.audience).trim(),language=text(input.language||'en',20);
  if(!title||!topic||!audience) return out('input_incomplete',{error:'book_plan_requires_title_topic_audience'});
  const research=input.market_query?await marketResearch({query:input.market_query,limit:input.research_limit}):null;
  const ai=await geminiGenerate({
    system:'Create a commercially useful book plan. Use supplied market evidence only. Never invent market volume, sales rank, revenue or demand numbers. Return strict JSON: {genre,positioning,reader_promise,chapter_count,chapters:[{number,title,goal,word_target}],keywords:[string],evidence_urls:[string]}.',
    user:JSON.stringify({title,topic,audience,language,research},null,2),
    json:true
  });
  if(ai.status!=='verified') return ai;
  let plan;try{plan=JSON.parse(ai.text);}catch{return out('error',{error:'book_plan_invalid_ai_json'});}
  if(!Array.isArray(plan.chapters)||!plan.chapters.length) return out('error',{error:'book_plan_missing_chapters'});
  return out('verified',{plan,research,provider:ai.provider,model:ai.model});
}

export async function bookWrite(input={}){
  const plan=input.plan;
  if(!plan||!Array.isArray(plan.chapters)||!plan.chapters.length) return out('input_incomplete',{error:'book_write_requires_plan'});
  const ai=await geminiGenerate({
    system:'Write the full book from the supplied plan. Return strict JSON {chapters:[{title,text}]}. Keep each chapter coherent and publishable. Do not invent market facts. Do not add meta commentary.',
    user:JSON.stringify({title:text(input.title),author:text(input.author),audience:text(input.audience),language:text(input.language||'en'),plan},null,2),
    json:true
  });
  if(ai.status!=='verified') return ai;
  let book;try{book=JSON.parse(ai.text);}catch{return out('error',{error:'book_write_invalid_ai_json'});}
  if(!Array.isArray(book.chapters)||book.chapters.length!==plan.chapters.length) return out('error',{error:'book_write_chapter_count_mismatch'});
  if(book.chapters.some(c=>!c?.title||!c?.text)) return out('error',{error:'book_write_chapter_incomplete'});
  return out('verified',{book:{title:text(input.title),author:text(input.author),language:text(input.language||'en'),chapters:book.chapters},provider:ai.provider,model:ai.model});
}

function xlsxColumn(index){
  let n=index+1,s='';
  while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}
  return s;
}
function xlsxCell(value,ref){
  if(typeof value==='number'&&Number.isFinite(value)) return '<c r="'+ref+'"><v>'+value+'</v></c>';
  return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(value)+'</t></is></c>';
}
export function buildXlsx(input={}){
  const headers=Array.isArray(input.headers)&&input.headers.length?input.headers.map(v=>text(v,200)):['Ապրանք','Գին','Ինքնարժեք','Քանակ','Վաճառք','Մնացորդ'];
  const rows=Array.isArray(input.rows)?input.rows.slice(0,5000):[];
  const all=[headers,...rows.map(r=>Array.from({length:headers.length},(_,i)=>r?.[i]??''))];
  const sheetRows=all.map((row,ri)=>{
    const cells=row.map((value,ci)=>xlsxCell(value,xlsxColumn(ci)+(ri+1))).join('');
    return '<row r="'+(ri+1)+'">'+cells+'</row>';
  }).join('');
  const files=[
    {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="NOVESSA" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'},
    {name:'xl/worksheets/sheet1.xml',data:'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+sheetRows+'</sheetData></worksheet>'}
  ];
  return out('verified',{filename:'novessa-sheets.xlsx',content:zipFiles(files),media_type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',row_count:rows.length});
}

export function bookExport(input={}){
  const format=String(input.format||'epub').toLowerCase();
  if(format==='epub') return buildEpub(input);
  if(format==='pdf') return buildPdf(input);
  if(format==='xlsx') return buildXlsx(input);
  if(format==='kdp') return out('verified',{package:buildKdpPackage(input)});
  return out('invalid_data',{error:'unsupported_book_export_format'});
}

export async function workspaceLoad(input={}){
  return loadWorkspace(input);
}

export async function workspaceSave(input={}){
  const result=await saveWorkspace(input);
  if(result.status==='verified') await appendEvent({kind:'workspace_saved',payload:{kind:result.kind,version:result.version}});
  return result;
}

export function productionCapabilities(){
  return {
    status:'verified',
    operator:{ai_provider:'google-gemini',deterministic_metrics:['unit_economics','rnp'],approval:true,external_write_actions:true},
    product_analysis:{unified_workspace:true,deterministic_economics:true,market_evidence:true},
    reverse_calculation:{deterministic:true,target_types:['unit_profit','margin','total_profit']},
    market_research:{provider:'NOVESSA discovery service',real_evidence_only:true},
    book:{workspace:true,plan:true,write:true,epub:true,pdf:true,kdp_package:true},
    sheets:{xlsx_export:true,maximum_rows:5000},
    persistence:persistenceStatus(),
    workspace:{commerce:true,book:true,sheets:true},
    safety:{invented_financial_numbers:false,market_metrics_without_source:false}
  };
}
`;

writeFileSync(runtimePath,runtime);

const newline=String.fromCharCode(10);
let server=readFileSync(serverPath,'utf8');
if(!server.includes('__novessaProduction')){
  server=server.replace("const rateLimiter = createRateLimiter","const __novessaProduction = await import('./src/novessaProduction.mjs');"+newline+"const rateLimiter = createRateLimiter");
  server=server.replace("    if(req.method==='GET'&&u.pathname==='/api/product/plans')","    if(req.method==='GET'&&u.pathname==='/api/production/capabilities') return send(res,200,__novessaProduction.productionCapabilities());"+newline+"    if(req.method==='GET'&&u.pathname==='/api/product/plans')");
  const uiHandlers=String.raw`
      const productionUiActions=['production-operator','production-approve','production-execute','book-plan','book-write','book-export','sheets-xlsx','workspace-load','workspace-save','product-analysis','reverse-profit'];
      if(productionUiActions.includes(actionName)){
        if(actionName==='workspace-load'||actionName==='workspace-save'){
          const access=verifyUiAccess({headers:req.headers,env:process.env});
          if(access.status!=='verified') return send(res,access.http_status||401,{status:access.status,error:access.error||'ui_auth_failed'});
        }
        let uiInput;
        try{uiInput=await readJson(req);}catch(error){return send(res,error.statusCode||400,{status:'error',error:String(error.message||error)});}
        let out;
        if(actionName==='production-operator') out=await __novessaProduction.operatorRun(uiInput);
        else if(actionName==='product-analysis') out=await __novessaProduction.analyzeProduct(uiInput);
        else if(actionName==='reverse-profit') out=__novessaProduction.reverseProfit(uiInput);
        else if(actionName==='workspace-load') out=await __novessaProduction.workspaceLoad(uiInput);
        else if(actionName==='workspace-save') out=await __novessaProduction.workspaceSave(uiInput);
        else if(actionName==='production-approve') out=__novessaProduction.approveAction(String(uiInput.approval_token||''));
        else if(actionName==='production-execute') out=await __novessaProduction.executeApprovedAction(String(uiInput.approval_token||''));
        else if(actionName==='book-plan') out=await __novessaProduction.bookPlan(uiInput);
        else if(actionName==='book-write') out=await __novessaProduction.bookWrite(uiInput);
        else if(actionName==='sheets-xlsx') {
          const generated=__novessaProduction.buildXlsx(uiInput);
          if(generated?.status==='verified'&&generated.content){
            res.writeHead(200,{'content-type':generated.media_type,'content-disposition':'attachment; filename="'+generated.filename+'"','cache-control':'no-store','x-content-type-options':'nosniff'});
            return res.end(generated.content);
          }
          out=generated;
        }
        else {
          const generated=__novessaProduction.bookExport(uiInput);
          if(generated?.status==='verified'&&generated.content){
            const filename=String(generated.filename).replace(/[^A-Za-z0-9._-]/g,'_');
            res.writeHead(200,{'content-type':generated.media_type,'content-disposition':'attachment; filename="'+filename+'"','cache-control':'no-store','x-content-type-options':'nosniff'});
            return res.end(generated.content);
          }
          out=generated;
        }
        const httpStatus=out.status==='invalid_data'||out.status==='input_incomplete'?400:out.status==='provider_unavailable'?503:out.status==='error'?502:200;
        return send(res,httpStatus,out);
      }
      `;
  server=server.replace("      const out=await runUiAction(actionName,uiInput,{env:process.env,activeRecommendationPolicy});",uiHandlers+newline+"      const out=await runUiAction(actionName,uiInput,{env:process.env,activeRecommendationPolicy});");
  const apiRoutes=String.raw`
    if(u.pathname==='/api/production/reverse-profit'){const out=__novessaProduction.reverseProfit(input);return sendApiResult(res,out.status==='input_incomplete'||out.status==='invalid_data'?400:out.status==='error'?502:200,out,requestId);}
     if(u.pathname==='/api/production/product-analysis'){const out=await __novessaProduction.analyzeProduct(input);return sendApiResult(res,out.status==='provider_unavailable'?503:out.status==='input_incomplete'?400:out.status==='error'?502:200,out,requestId);}
    if(u.pathname==='/api/production/workspace/load') return sendApiResult(res,200,await __novessaProduction.workspaceLoad(input),requestId);
    if(u.pathname==='/api/production/workspace/save') return sendApiResult(res,200,await __novessaProduction.workspaceSave(input),requestId);
    if(u.pathname==='/api/production/operator'){const out=await __novessaProduction.operatorRun(input);return sendApiResult(res,out.status==='provider_unavailable'?503:out.status==='input_incomplete'?400:out.status==='error'?502:200,out,requestId);}
    if(u.pathname==='/api/production/action/approve') return sendApiResult(res,200,__novessaProduction.approveAction(String(input.approval_token||'')),requestId);
    if(u.pathname==='/api/production/action/execute') return sendApiResult(res,200,await __novessaProduction.executeApprovedAction(String(input.approval_token||'')),requestId);
    if(u.pathname==='/api/production/market-research'){const out=await __novessaProduction.marketResearch(input);return sendApiResult(res,out.status==='provider_unavailable'?503:out.status==='input_incomplete'?400:out.status==='error'?502:200,out,requestId);}
    if(u.pathname==='/api/production/rnp') return sendApiResult(res,200,__novessaProduction.rnp(input),requestId);
    if(u.pathname==='/api/production/book/plan'){const out=await __novessaProduction.bookPlan(input);return sendApiResult(res,out.status==='provider_unavailable'?503:out.status==='input_incomplete'?400:out.status==='error'?502:200,out,requestId);}
    if(u.pathname==='/api/production/book/write'){const out=await __novessaProduction.bookWrite(input);return sendApiResult(res,out.status==='provider_unavailable'?503:out.status==='input_incomplete'?400:out.status==='error'?502:200,out,requestId);}
    if(u.pathname==='/api/production/sheets/export'){const generated=__novessaProduction.buildXlsx(input);if(generated.status!=='verified')return sendApiResult(res,400,generated,requestId);res.writeHead(200,{'content-type':generated.media_type,'content-disposition':'attachment; filename="'+generated.filename+'"','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':requestId});return res.end(generated.content);}
    if(u.pathname==='/api/production/book/export'){const generated=__novessaProduction.bookExport(input);if(generated.status!=='verified')return sendApiResult(res,generated.status==='input_incomplete'?400:400,generated,requestId);if(input.format==='kdp')return sendApiResult(res,200,generated,requestId);res.writeHead(200,{'content-type':generated.media_type,'content-disposition':'attachment; filename="'+String(generated.filename).replace(/[^A-Za-z0-9._-]/g,'_')+'"','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':requestId});return res.end(generated.content);}
`;
  server=server.replace("    if(u.pathname.startsWith('/api/connectors/shopify/'))",apiRoutes+newline+"    if(u.pathname.startsWith('/api/connectors/shopify/'))");
  writeFileSync(serverPath,server);
}


// === NOVESSA PERSISTENCE SERVER PATCH ===
if(server.includes('__novessaProduction') && !server.includes('/ui/api/action/workspace-save')){
  const persistenceUiHandlers=String.raw`
      const persistenceUiActions=['workspace-load','workspace-save'];
      if(persistenceUiActions.includes(actionName)){
        const access=verifyUiAccess({headers:req.headers,env:process.env});
        if(access.status!=='verified') return send(res,access.http_status||401,{status:access.status,error:access.error||'ui_auth_failed'});
        let uiInput;
        try{uiInput=await readJson(req);}catch(error){return send(res,error.statusCode||400,{status:'error',error:String(error.message||error)});}
        const out=actionName==='workspace-load'
          ? await __novessaProduction.workspaceLoad(uiInput)
          : await __novessaProduction.workspaceSave(uiInput);
        const httpStatus=out.status==='invalid_data'||out.status==='input_incomplete'?400:out.status==='provider_unavailable'?503:out.status==='error'?502:200;
        return send(res,httpStatus,out);
      }
      `;
  server=server.replace("      const out=await runUiAction(actionName,uiInput,{env:process.env,activeRecommendationPolicy});",persistenceUiHandlers+newline+"      const out=await runUiAction(actionName,uiInput,{env:process.env,activeRecommendationPolicy});");
  const persistenceApiRoutes=String.raw`
    if(u.pathname==='/api/production/workspace/load') return sendApiResult(res,200,await __novessaProduction.workspaceLoad(input),requestId);
    if(u.pathname==='/api/production/workspace/save') return sendApiResult(res,200,await __novessaProduction.workspaceSave(input),requestId);
`;
  server=server.replace("    if(u.pathname.startsWith('/api/connectors/shopify/'))",persistenceApiRoutes+newline+"    if(u.pathname.startsWith('/api/connectors/shopify/'))");
  writeFileSync(serverPath,server);
}

let index=readFileSync(uiPath,'utf8');
const ui=String.raw`
<section class="novessa-production-layer" id="novessa-production-layer">
  <div class="np-hero"><div><div class="eyebrow">NOVESSA • AI OPERATOR</div><h2>AI Operator</h2><p>Իրական տվյալներ → Core հաշվարկ → որոշում → Human Approval → գործողություն։</p></div><span id="npStatus" class="np-status">Ստուգում…</span></div>
  <div class="np-grid">
    <article class="panel">
      <h3>Գործնական վերլուծություն</h3>
      <label class="np-label">Նպատակ<input id="npObjective" placeholder="օր.՝ գտնել շահույթի և պաշարի հիմնական ռիսկը"></label>
      <label class="np-label">Շուկայի հարցում<input id="npMarketQuery" placeholder="օր.՝ կանացի jeans Wildberries մրցակիցներ"></label>
      <div class="np-grid-3">
        <label class="np-label">Գին<input id="npPrice" inputmode="decimal"></label><label class="np-label">Ինքնարժեք<input id="npCost" inputmode="decimal"></label><label class="np-label">Վաճառք<input id="npSales" inputmode="numeric"></label>
        <label class="np-label">Միջնորդավճար %<input id="npCommission" inputmode="decimal"></label><label class="np-label">Լոգիստիկա<input id="npLogistics" inputmode="decimal"></label><label class="np-label">Պահեստ<input id="npStorage" inputmode="decimal"></label>
        <label class="np-label">Հարկ %<input id="npTax" inputmode="decimal"></label><label class="np-label">Գովազդ<input id="npAds" inputmode="decimal"></label>
      </div>
      <div class="np-grid-3">
        <label class="np-label">Մնացորդ<input id="npStock" inputmode="numeric"></label><label class="np-label">Պատմական վաճառք<input id="npHistSales" inputmode="numeric"></label><label class="np-label">Շրջան, օր<input id="npPeriodDays" inputmode="numeric"></label>
        <label class="np-label">Մատակարարում, օր<input id="npLeadTime" inputmode="numeric"></label><label class="np-label">Անվտանգության օրեր<input id="npSafetyDays" inputmode="numeric"></label><label class="np-label">Թիրախ ծածկույթ<input id="npTargetCover" inputmode="numeric"></label>
      </div>
      <button id="npRun" type="button">Վերլուծել և կազմել գործողություններ</button>
      <pre id="npResult" class="np-result"></pre>
    </article>
    <article class="panel"><h3>Հաստատման հերթ</h3><div id="npActions" class="np-actions">Դեռ գործողություն չկա։</div><h3 style="margin-top:18px">AI մեկնաբանություն</h3><pre id="npInterpretation" class="json"></pre></article>
  </div>
</section>
<section class="novessa-production-layer" id="novessa-book-workspace">
  <div class="np-hero"><div><div class="eyebrow">NOVESSA • BOOK WORKSPACE</div><h2>Գիրք → Market Research → Plan → Write → EPUB / PDF</h2><p>Խմբագրվող workspace՝ առանց JSON-ը որպես աշխատանքային ինտերֆեյս պարտադրելու։</p></div></div>
  <div class="np-grid">
    <article class="panel">
      <label class="np-label">Վերնագիր<input id="bookTitle"></label><label class="np-label">Հեղինակ<input id="bookAuthor"></label><label class="np-label">Թեմա<input id="bookTopic"></label><label class="np-label">Ընթերցող<input id="bookAudience"></label><label class="np-label">Լեզու<input id="bookLanguage" value="en"></label><label class="np-label">Շուկայի հարցում<input id="bookMarketQuery" placeholder="թեմա / keyword / մրցակից"></label>
      <div class="np-actions-row"><button id="bookPlanBtn" type="button">Ստեղծել պլան</button><button id="bookWriteBtn" type="button">Գրել գիրքը</button></div><pre id="bookPlan" class="json"></pre>
    </article>
    <article class="panel">
      <label class="np-label">Գրքի խմբագրիչ<textarea id="bookEditor" rows="22" placeholder="Գիրքը կհայտնվի այստեղ։ Կարող ես խմբագրել մինչև export-ը։"></textarea></label>
      <div class="np-actions-row"><button id="bookSaveBtn" type="button" class="secondary">Պահպանել</button><button id="bookEpubBtn" type="button" class="secondary">EPUB</button><button id="bookPdfBtn" type="button" class="secondary">PDF</button></div><pre id="bookStatus" class="json"></pre>
    </article>
  </div>
</section>`;
if(!index.includes('id="novessa-production-layer"')) index=index.replace('<main>','<main>'+ui);

/* === NOVESSA ACTIVE PRODUCT ANALYSIS UI === */
let activeProductIndex=readFileSync(uiPath,'utf8');
activeProductIndex=activeProductIndex.replace(
  /(<button id="ccUseProduct"[^>]*>[^<]*<\/button>)/,
  '$1<button id="ccAnalyzeProduct" type="button">Վերլուծել ապրանքը</button>'
);
activeProductIndex=activeProductIndex.replace(
  /(<div class="cc-product-fields">)/,
  '$1<label><span>Շուկայի հարցում</span><input id="ccProductMarketQuery" placeholder="օր.՝ կանացի jeans Wildberries մրցակիցներ"></label>'
);
activeProductIndex=activeProductIndex.replace(
  /(<div id="ccProductMessage"[^>]*><\/div>)/,
  '$1<div id="ccProductAnalysis" class="cc-product-analysis" aria-live="polite"></div>'
);
writeFileSync(uiPath,activeProductIndex);


let app=readFileSync(appPath,'utf8');
const js=String.raw`
(function(){
  const el=id=>document.getElementById(id);
  const num=id=>{const v=Number(el(id)?.value);return Number.isFinite(v)?v:null;};
  const token=()=>String(el('uiToken')?.value||sessionStorage.getItem('novessa_ui_token')||'');
  const call=async(action,payload)=>{const headers={'content-type':'application/json'};const t=token();if(t){headers['x-novessa-ui-token']=t;sessionStorage.setItem('novessa_ui_token',t);}const r=await fetch('/ui/api/action/'+action,{method:'POST',headers,body:JSON.stringify(payload||{})});const raw=await r.text();let body={};try{body=JSON.parse(raw);}catch{}if(!r.ok)throw Object.assign(new Error(body.error||'request_failed'),{body,status:r.status});return body;};
  const pretty=v=>JSON.stringify(v,null,2);
  const operatorPayload=()=>{const p=num('npPrice'),c=num('npCost'),s=num('npSales'),cm=num('npCommission'),l=num('npLogistics'),st=num('npStorage'),tx=num('npTax'),ad=num('npAds');const rs=num('npStock'),hs=num('npHistSales'),pd=num('npPeriodDays'),lt=num('npLeadTime'),sd=num('npSafetyDays'),tc=num('npTargetCover');const body={objective:el('npObjective')?.value||'',market_query:el('npMarketQuery')?.value||''};if([p,c,s,cm,l,st,tx,ad].every(v=>v!==null))body.economics={price:p,unit_cost:c,sales:s,commission_percent:cm,logistics_per_unit:l,storage_per_unit:st,tax_percent:tx,ad_spend:ad};if([rs,hs,pd,lt,tc].every(v=>v!==null))body.rnp={stock:rs,sales_history:hs,period_days:pd,lead_time_days:lt,safety_stock_days:sd||0,target_cover_days:tc};return body;};
  el('npRun')?.addEventListener('click',async()=>{el('npResult').textContent='Աշխատում…';try{const body=await call('production-operator',operatorPayload());el('npResult').textContent=pretty({status:body.status,facts:body.facts,action_count:body.action_count});el('npInterpretation').textContent=pretty(body.interpretation||{});el('npActions').innerHTML='';(body.actions||[]).forEach(action=>{const box=document.createElement('div');box.className='np-action';const title=document.createElement('strong');title.textContent=action.title;const reason=document.createElement('div');reason.textContent=action.reason;const details=document.createElement('pre');details.textContent=pretty(action.payload);const button=document.createElement('button');button.type='button';button.textContent='Հաստատել';button.addEventListener('click',async()=>{try{const approved=await call('production-approve',{approval_token:action.approval_token});const executed=await call('production-execute',{approval_token:approved.approval_token});button.disabled=true;button.textContent=executed.executed?'Կատարված է':'Հաստատված';details.textContent=pretty(executed);}catch(error){details.textContent=pretty(error.body||{error:error.message});}});box.append(title,reason,details,button);el('npActions').appendChild(box);});}catch(error){el('npResult').textContent=pretty(error.body||{error:error.message});}});
  const key='novessa_book_workspace_v2';let state={title:'',author:'',topic:'',audience:'',language:'en',plan:null,chapters:[]};try{state={...state,...JSON.parse(localStorage.getItem(key)||'null')};}catch{}
  function syncForm(){for(const k of ['title','author','topic','audience','language']){const node=el('book'+k[0].toUpperCase()+k.slice(1));if(node)node.value=state[k]||'';}el('bookPlan').textContent=pretty(state.plan||{});el('bookEditor').value=state.chapters.map((chapter,i)=>'## '+(chapter.title||('Chapter '+(i+1)))+'\\\\n\\\\n'+(chapter.text||'')).join('\\\\n\\\\n');}
  syncForm();
  el('bookSaveBtn')?.addEventListener('click',()=>{for(const k of ['title','author','topic','audience','language'])state[k]=el('book'+k[0].toUpperCase()+k.slice(1))?.value||'';state.chapters=parseEditor();localStorage.setItem(key,JSON.stringify(state));el('bookStatus').textContent='Պահպանված է այս դիտարկիչում։';});
  el('bookPlanBtn')?.addEventListener('click',async()=>{const body={title:el('bookTitle').value,author:el('bookAuthor').value,topic:el('bookTopic').value,audience:el('bookAudience').value,language:el('bookLanguage').value||'en',market_query:el('bookMarketQuery').value||''};el('bookStatus').textContent='Պլանը ստեղծվում է…';try{const result=await call('book-plan',body);state={...state,...body,plan:result.plan||null};localStorage.setItem(key,JSON.stringify(state));syncForm();el('bookStatus').textContent=pretty({status:result.status,research:result.research||null});}catch(error){el('bookStatus').textContent=pretty(error.body||{error:error.message});}});
  el('bookWriteBtn')?.addEventListener('click',async()=>{if(!state.plan){el('bookStatus').textContent='Սկզբում ստեղծիր պլանը։';return;}el('bookStatus').textContent='Գիրքը գրվում է…';try{const result=await call('book-write',{title:el('bookTitle').value,author:el('bookAuthor').value,audience:el('bookAudience').value,language:el('bookLanguage').value||'en',plan:state.plan});state.chapters=result.book?.chapters||[];localStorage.setItem(key,JSON.stringify(state));syncForm();el('bookStatus').textContent=pretty({status:result.status,provider:result.provider,model:result.model});}catch(error){el('bookStatus').textContent=pretty(error.body||{error:error.message});}});
  function parseEditor(){const raw=el('bookEditor').value;const chunks=raw.split(/\\\\n\\\\s*##\\\\s+/).map((chunk,i)=>{const clean=chunk.replace(/^##\\\\s+/,'').trim();if(!clean)return null;const pos=clean.indexOf('\\\\n');return{title:pos>0?clean.slice(0,pos).trim():('Chapter '+(i+1)),text:pos>0?clean.slice(pos).trim():clean};}).filter(Boolean);return chunks;}
  async function exportBook(format){const r=await fetch('/ui/api/action/book-export',{method:'POST',headers:{'content-type':'application/json','x-novessa-ui-token':token()},body:JSON.stringify({format,title:el('bookTitle').value,author:el('bookAuthor').value,language:el('bookLanguage').value||'en',chapters:parseEditor()})});if(!r.ok){const t=await r.text();let body={};try{body=JSON.parse(t);}catch{}throw new Error(body.error||t||'export_failed');}const blob=await r.blob();const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=(el('bookTitle').value||'book')+'.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
  el('bookEpubBtn')?.addEventListener('click',async()=>{try{await exportBook('epub');el('bookStatus').textContent='EPUB-ը պատրաստ է։';}catch(error){el('bookStatus').textContent=error.message||String(error);}});
  el('bookPdfBtn')?.addEventListener('click',async()=>{try{await exportBook('pdf');el('bookStatus').textContent='PDF-ը պատրաստ է։';}catch(error){el('bookStatus').textContent=error.message||String(error);}});
  fetch('/api/production/capabilities').then(r=>r.json()).then(data=>{el('npStatus').textContent=data.status==='verified'?'Production Core պատրաստ է':'ՉԻ ՀԱՍՏԱՏՎԱԾ';}).catch(()=>{el('npStatus').textContent='ՉԻ ՀԱՍՏԱՏՎԱԾ';});
})();
`;
if(!app.includes('novessa_book_workspace_v2')) app+=newline+js+newline;

const __novessaProductAnalysis=String.raw`
(function(){
  const el=id=>document.getElementById(id);
  const num=id=>{const v=Number(el(id)?.value);return Number.isFinite(v)?v:null;};
  const productPayload=()=>({
    product:{
      name:String(el('ccProductName')?.value||''),
      sku:String(el('ccProductSku')?.value||''),
      price:num('ccProductPrice'),
      cost:num('ccProductCost'),
      stock:num('ccProductStock'),
      sales:num('ccProductSales'),
      commission:num('ccProductCommission'),
      logistics:num('ccProductLogistics'),
      storage:num('ccProductStorage'),
      tax:num('ccProductTax'),
      ads:num('ccProductAds')
    },
    market_query:String(el('ccProductMarketQuery')?.value||'')
  });
  const escapeHtml=v=>String(v??'').replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  const render=(body)=>{
    const out=el('ccProductAnalysis');if(!out)return;
    const d=body?.decision||{},econ=body?.economics||{},research=body?.market_research;
    const signal=d.profit_signal==='loss_making'?'Շահույթի ռիսկ':d.profit_signal==='positive'?'Դրական շահույթ':'Տվյալը բավարար չէ';
    const status=body?.status||'partial';
    const evidence=Array.isArray(research?.evidence)?research.evidence.slice(0,5):[];
    out.innerHTML='<div class="cc-analysis-head"><strong>Ապրանքի վերլուծություն</strong><span>'+escapeHtml(status)+'</span></div>'+
      '<div class="cc-analysis-grid">'+
      '<div><small>Profit signal</small><b>'+escapeHtml(signal)+'</b></div>'+
      '<div><small>Unit profit</small><b>'+escapeHtml(d.profit===undefined?'—':d.profit)+'</b></div>'+
      '<div><small>Margin</small><b>'+escapeHtml(d.margin===undefined?'—':d.margin)+'</b></div>'+
      '<div><small>Market evidence</small><b>'+escapeHtml(research?String(evidence.length):'Չի հարցվել')+'</b></div>'+
      '</div>'+
      '<p class="cc-analysis-next">'+escapeHtml(d.next_action||'')+'</p>'+
      (research?'<div class="cc-analysis-evidence"><strong>Market evidence</strong>'+(
        evidence.length?evidence.map(e=>'<div><a href="'+escapeHtml(e.url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(e.title||e.url||'Evidence')+'</a><p>'+escapeHtml(e.snippet||'')+'</p></div>').join('')
        :'<p>Evidence չի վերադարձվել։ NOVESSA-ն տվյալ չի հորինում։</p>'
      )+'</div>':'<p class="cc-analysis-note">Շուկայի հարցումը լրացված չէ․ միայն Economics-ն է հաշվարկվել։</p>')+
      '<details class="cc-analysis-details"><summary>Core հաշվարկի տվյալներ</summary><pre>'+escapeHtml(JSON.stringify(econ,null,2))+'</pre></details>'+
      '<button id="ccAnalysisHandoff" type="button" class="secondary">Ուղարկել Decision Center / AI Operator</button>';
  };
  el('ccAnalyzeProduct')?.addEventListener('click',async()=>{
    const out=el('ccProductAnalysis');if(out)out.textContent='Վերլուծությունը կատարվում է…';
    try{
      const r=await fetch('/ui/api/action/product-analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(productPayload())});
      const raw=await r.text();let body={};try{body=JSON.parse(raw)}catch{}
      if(!r.ok){if(out)out.textContent=body.error||'Ապրանքի վերլուծությունը չհաջողվեց։';return;}
      render(body);
      el('ccAnalysisHandoff')?.addEventListener('click',()=>{
        const map={dcProduct:'ccProductName',dcPrice:'ccProductPrice',dcCost:'ccProductCost',dcSales:'ccProductSales',dcCommission:'ccProductCommission',dcLogistics:'ccProductLogistics',dcStorage:'ccProductStorage',dcTax:'ccProductTax',dcAds:'ccProductAds',npPrice:'ccProductPrice',npCost:'ccProductCost',npSales:'ccProductSales',npCommission:'ccProductCommission',npLogistics:'ccProductLogistics',npStorage:'ccProductStorage',npTax:'ccProductTax',npAds:'ccProductAds',npStock:'ccProductStock'};
        for(const [to,from] of Object.entries(map)){const target=el(to),source=el(from);if(target&&source)target.value=source.value||'';}
        const q=el('ccProductMarketQuery')?.value||'';if(el('npMarketQuery'))el('npMarketQuery').value=q;
        document.getElementById('novessa-decision-center')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    }catch(error){if(out)out.textContent=error.message||'Ապրանքի վերլուծությունը ՉԻ ՀԱՍՏԱՏՎԱԾ։';}
  });
})();
`;

app += newline + __novessaProductAnalysis + newline;
writeFileSync(appPath,app);

let style=readFileSync(stylePath,'utf8');
style+=`
.novessa-production-layer{margin:24px 0 32px;padding:22px;border:1px solid #33275e;border-radius:24px;background:linear-gradient(145deg,rgba(16,10,40,.96),rgba(7,6,23,.98));box-shadow:0 18px 60px rgba(11,7,40,.35)}.np-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:14px}.np-hero h2{margin:7px 0;font-size:30px}.np-hero p{margin:0;color:#a8a1c4}.np-status{padding:8px 12px;border:1px solid #43357b;border-radius:999px;color:#ddd6fe;font-size:12px}.np-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.85fr);gap:14px}.np-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.np-label{display:grid;gap:6px;color:#c9c1dc;font-size:12px;margin:9px 0}.np-label input,.np-label textarea{box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid #342b5b;border-radius:12px;background:#09071b;color:#f7f3ff;outline:none}.np-actions{display:grid;gap:9px}.np-actions-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:10px}.np-result{margin-top:11px;padding:12px;border:1px dashed #3a2e69;border-radius:12px;white-space:pre-wrap;min-height:64px}.np-action{padding:12px;border:1px solid #3a2e69;border-radius:12px;background:#0a071d}.np-action strong{display:block;margin-bottom:5px}.np-action button{margin-top:8px}.json{white-space:pre-wrap;overflow:auto;max-height:420px}@media(max-width:950px){.np-grid{grid-template-columns:1fr}}@media(max-width:650px){.np-grid-3{grid-template-columns:repeat(2,minmax(0,1fr))}.np-actions-row{grid-template-columns:1fr}.np-hero{flex-direction:column}}
`;
writeFileSync(stylePath,style);
console.log('NOVESSA production integration build complete');
