export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  const base=String(process.env.MEDIA_AI_BASE_URL||'').trim().replace(/\/$/,'');
  if(!base) return res.status(503).json({ok:false,error:'media_ai_not_configured'});
  try{
    const upstream=await fetch(base+'/health',{redirect:'error'});
    const raw=await upstream.text();
    let data; try{data=JSON.parse(raw)}catch{data={ok:false,error:'invalid_health_json'};}
    return res.status(upstream.ok?200:502).json(data);
  }catch{
    return res.status(503).json({ok:false,error:'media_ai_unreachable'});
  }
}
