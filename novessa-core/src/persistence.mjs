const MAX_STATE_BYTES = 900000;
const ALLOWED_KINDS = new Set(['book','sheets']);

function config(){
  const url=String(process.env.NOVESSA_PERSISTENCE_SUPABASE_URL||'').trim().replace(/\/+$/,'');
  const key=String(process.env.NOVESSA_PERSISTENCE_SUPABASE_SERVICE_ROLE_KEY||'').trim();
  return {url,key};
}

function workspaceId(){
  const value=String(process.env.NOVESSA_WORKSPACE_ID||'owner').trim();
  return /^[A-Za-z0-9._:-]{1,100}$/.test(value)?value:'owner';
}

function kindOf(value){
  const kind=String(value||'').trim().toLowerCase();
  return ALLOWED_KINDS.has(kind)?kind:null;
}

function fail(status,error,extra={}){
  return {status,error,...extra};
}

export function persistenceStatus(){
  const {url,key}=config();
  return {
    status:url&&key?'configured':'not_configured',
    provider:'supabase-rest',
    server_side:true,
    workspace_id:workspaceId(),
    multi_user_auth:false,
    error:url&&key?undefined:'persistence_requires_server_supabase_url_and_service_role_key'
  };
}

async function restRequest(path,{method='GET',body,fetchImpl=fetch}={}){
  const {url,key}=config();
  if(!url||!key) return fail('provider_unavailable','persistence_not_configured');
  let parsed;
  try{parsed=new URL(url);}catch{return fail('invalid_data','persistence_url_invalid');}
  const base=parsed.toString().replace(/\/$/,'')+'/rest/v1';
  const headers={
    apikey:key,
    authorization:'Bearer '+key,
    accept:'application/json'
  };
  if(body!==undefined){
    headers['content-type']='application/json';
    headers.prefer='resolution=merge-duplicates,return=representation';
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetchImpl(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
    const raw=await response.text();
    let data=null;
    try{data=raw?JSON.parse(raw):null;}catch{}
    if(!response.ok){
      return fail('error','persistence_http_error',{http_status:response.status,details:data?.message||data?.hint||'persistence_provider_error'});
    }
    return {status:'verified',data};
  }catch(error){
    return fail('provider_unavailable',error?.name==='AbortError'?'persistence_timeout':'persistence_unreachable');
  }finally{clearTimeout(timer);}
}

function safeState(state){
  if(!state||typeof state!=='object'||Array.isArray(state)) return null;
  try{
    const serialized=JSON.stringify(state);
    if(serialized.length>MAX_STATE_BYTES) return null;
  }catch{return null;}
  return state;
}

export async function loadWorkspace(input={},options={}){
  const kind=kindOf(input.kind);
  if(!kind) return fail('input_incomplete','workspace_kind_required',{allowed_kinds:[...ALLOWED_KINDS]});
  const id=workspaceId();
  const path='/novessa_workspaces?workspace_id=eq.'+encodeURIComponent(id)+'&kind=eq.'+encodeURIComponent(kind)+'&select=workspace_id,kind,state,version,updated_at&limit=1';
  const result=await restRequest(path,{fetchImpl:options.fetchImpl||fetch});
  if(result.status!=='verified') return result;
  const row=Array.isArray(result.data)?result.data[0]:null;
  if(!row) return {status:'not_found',workspace_id:id,kind};
  return {status:'verified',workspace_id:id,kind,state:row.state&&typeof row.state==='object'?row.state:{},version:Number(row.version)||1,updated_at:row.updated_at||null};
}

export async function saveWorkspace(input={},options={}){
  const kind=kindOf(input.kind);
  if(!kind) return fail('input_incomplete','workspace_kind_required',{allowed_kinds:[...ALLOWED_KINDS]});
  const state=safeState(input.state);
  if(!state) return fail('input_incomplete','workspace_state_invalid_or_too_large',{max_state_bytes:MAX_STATE_BYTES});
  const id=workspaceId();
  const version=Number.isInteger(Number(input.version))&&Number(input.version)>0?Number(input.version)+1:Date.now();
  const updated_at=new Date().toISOString();
  const result=await restRequest('/novessa_workspaces',{method:'POST',body:{workspace_id:id,kind,state,version,updated_at},fetchImpl:options.fetchImpl||fetch});
  if(result.status!=='verified') return result;
  const row=Array.isArray(result.data)?result.data[0]:result.data;
  return {status:'verified',workspace_id:id,kind,version:Number(row?.version)||version,updated_at:row?.updated_at||updated_at};
}

export async function appendEvent(input={},options={}){
  const kind=String(input.kind||'').trim();
  if(!kind) return fail('input_incomplete','event_kind_required');
  const payload=input.payload&&typeof input.payload==='object'&&!Array.isArray(input.payload)?input.payload:{};
  const result=await restRequest('/novessa_events',{method:'POST',body:{
    workspace_id:workspaceId(),
    event_kind:kind,
    request_id:String(input.request_id||'').slice(0,128)||null,
    payload,
    created_at:new Date().toISOString()
  },fetchImpl:options.fetchImpl||fetch});
  if(result.status!=='verified') return result;
  return {status:'verified'};
}
