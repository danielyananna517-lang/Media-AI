import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { localGenerate } from './providers/local.mjs';
import { openaiGenerate } from './providers/openai.mjs';
import { geminiGenerate } from './providers/gemini.mjs';
import { getProviderStatus, generateWithFallback, researchWithFallback } from './providers/registry.mjs';
import { compareSources, buildProductionPlan, toSrt, analyzeLearning, buildResearchBrief } from './workflow.mjs';
import { ProviderManager } from './providers/provider-layer.mjs';
import { openaiImageProvider } from './providers/openai-image.mjs';
import { openaiSpeechProvider } from './providers/openai-speech.mjs';
import { openaiVideoProvider } from './providers/openai-video.mjs';
import { validateImageBuffer } from './assets/validators.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join('/', root, 'public');
const providerManager = new ProviderManager();
providerManager.register(openaiImageProvider);
providerManager.register(openaiSpeechProvider);
providerManager.register(openaiVideoProvider);

const state = globalThis.__MEDIA_AI_STATE || {
  assets: [],
  content: { items: [], updatedAt: null },
  videos: new Map()
};
globalThis.__MEDIA_AI_STATE = state;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

function json(res, status, value, extra = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    ...extra
  });
  res.end(JSON.stringify(value));
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 3_000_000) reject(new Error('Request body too large.'));
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function errorStatus(e) {
  const code = e?.details?.httpStatus;
  if (code === 429) return 429;
  if (code && code >= 400 && code < 500) return code;
  return 502;
}

function qaCheck(input = {}) {
  const text = String(input.text || '').trim();
  const findings = [];
  if (!text) findings.push({ level: 'error', code: 'EMPTY_TEXT', message: 'Content text is empty.' });
  if (text && text.length < 120) findings.push({ level: 'warning', code: 'SHORT_CONTENT', message: 'Content is very short; check whether the format requires more context.' });
  if (!/\b(source|source:|citation|according to)\b/i.test(text)) findings.push({ level: 'warning', code: 'NO_SOURCE_MARKER', message: 'No source/citation marker found. Factual claims should be checked against sources before publication.' });
  if (/\[check facts\]|\[source\]|\{source\}/i.test(text)) findings.push({ level: 'warning', code: 'UNRESOLVED_PLACEHOLDER', message: 'The draft still contains a source/fact-check placeholder.' });
  if (!/(subscribe|next video|watch|follow|comment|share)/i.test(text)) findings.push({ level: 'info', code: 'NO_CTA', message: 'No clear audience action was detected.' });
  return { status: findings.some(f => f.level === 'error') ? 'blocked' : findings.some(f => f.level === 'warning') ? 'review' : 'pass', findings };
}

function adaptContent(input = {}) {
  const source = String(input.text || '').trim();
  const topic = input.topic || 'your topic';
  const platforms = Array.isArray(input.platforms) && input.platforms.length ? input.platforms : ['youtube_shorts','instagram_reels','tiktok','facebook'];
  const base = source || `A useful explanation about ${topic}.`;
  const rules = {
    youtube_shorts: { label:'YouTube Shorts', max:60, cta:'Watch the full explanation on the channel.' },
    instagram_reels: { label:'Instagram Reels', max:90, cta:'Save this and follow for the next part.' },
    tiktok: { label:'TikTok', max:60, cta:'Follow for more practical explanations.' },
    facebook: { label:'Facebook', max:180, cta:'Share this with someone who would find it useful.' }
  };
  return platforms.map(platform => {
    const r = rules[platform] || { label:platform, max:180, cta:'Follow for more.' };
    return { platform, label:r.label, suggestedDurationSeconds:r.max, text:`HOOK: ${topic}\n\n${base}\n\nCTA: ${r.cta}` };
  });
}

function bookPlan(input = {}) {
  const title = String(input.title || input.topic || 'Untitled Book').trim();
  const language = input.language || 'en';
  const pages = Math.max(1, Math.min(Number(input.pages || 24), 120));
  const size = input.size || '8.5x11';
  const style = input.style || 'clean children\'s coloring-book line art';
  const pageList = Array.from({ length: pages }, (_, i) => ({
    pageNumber: i + 1,
    text: i === 0 ? title : `Page ${i + 1}: a simple activity or scene related to ${title}`,
    illustrationPrompt: `${style}, black and white outline, white background, no shading, centered subject, print-safe, page ${i + 1} for the book "${title}"`,
    output: 'IMAGE'
  }));
  return { bookId: `book_${randomUUID()}`, title, language, pages, size, style, cover: { frontPrompt: `Color cover for "${title}", friendly children's publishing style, clean composition, title-safe empty area` }, pageList };
}

export async function handler(req, res) {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-origin':'*', 'access-control-allow-methods':'GET,POST,OPTIONS', 'access-control-allow-headers':'content-type' });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, {
        ok:true, app:'Media AI Independent', version:'7.7.0', deployment:'standalone',
        providers:{...getProviderStatus(), openaiImage:Boolean(process.env.OPENAI_API_KEY), openaiSpeech:Boolean(process.env.OPENAI_API_KEY), openaiVideo:Boolean(process.env.OPENAI_API_KEY)}
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/assets') return json(res, 200, { assets: state.assets });
    if (req.method === 'POST' && url.pathname === '/api/image/generate') {
      const data = await parseBody(req); const prompt = String(data.prompt || '').trim();
      if (!prompt) return json(res,400,{error:'Prompt is required'});
      try {
        const result = await providerManager.generate({type:'IMAGE',prompt,model:data.model || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',size:data.size || '1024x1536',format:data.format || 'png',metadata:{quality:data.quality||'auto'}},'openai-image');
        const validation = validateImageBuffer(result.bytes,result.mimeType); if (!validation.valid) throw new Error('IMAGE_VALIDATION_FAILED');
        const ext = result.mimeType === 'image/jpeg' ? 'jpg' : result.mimeType === 'image/webp' ? 'webp' : 'png';
        const asset = { assetId:`asset_${randomUUID()}`, type:'IMAGE', provider:result.provider, model:result.model, prompt, size:data.size||null, format:ext, generationId:result.generationId, createdAt:new Date().toISOString(), status:'READY', uri:`data:${result.mimeType};base64,${result.bytes.toString('base64')}`, sizeBytes:result.bytes.length, checksum:createHash('sha256').update(result.bytes).digest('hex'), sourceModule:'CREATIVE_STUDIO', sourceEntityId:null, metadata:{quality:data.quality||'auto'} };
        state.assets.unshift(asset); state.assets = state.assets.slice(0,20); return json(res,200,{ok:true,asset});
      } catch(e){ return json(res,errorStatus(e),{error:e.message,provider:e.provider||'openai-image',details:e.details||{}}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/audio/speech') {
      const data = await parseBody(req); const input = String(data.input || data.text || '').trim();
      if (!input) return json(res,400,{error:'Text is required'});
      try {
        const result = await providerManager.generate({type:'AUDIO',prompt:input.slice(0,4096),input:input.slice(0,4096),model:data.model || process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',voice:data.voice || 'alloy',responseFormat:data.response_format || 'mp3',instructions:data.instructions || ''},'openai-speech');
        return json(res,200,{ok:true,audio:{assetId:`asset_${randomUUID()}`,type:'AUDIO',provider:result.provider,model:result.model,format:result.format,mimeType:result.mimeType,generationId:result.generationId,createdAt:new Date().toISOString(),status:'READY',uri:`data:${result.mimeType};base64,${result.bytes.toString('base64')}`,sizeBytes:result.bytes.length}});
      } catch(e){ return json(res,errorStatus(e),{error:e.message,provider:e.provider||'openai-speech',details:e.details||{}}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/video/create') {
      const data = await parseBody(req); const prompt = String(data.prompt || '').trim();
      if (!prompt) return json(res,400,{error:'Prompt is required'});
      try {
        const result = await providerManager.generate({type:'VIDEO',prompt,model:data.model || process.env.OPENAI_VIDEO_MODEL || 'sora-2',seconds:String(data.seconds || '4'),size:data.size || '720x1280'},'openai-video');
        const job = {assetId:`asset_${randomUUID()}`,type:'VIDEO',provider:result.provider,model:result.model,prompt,generationId:result.generationId,status:result.status,createdAt:new Date().toISOString(),videoId:result.videoId,seconds:result.seconds,size:result.size,progress:result.progress||0};
        state.videos.set(result.videoId,job); return json(res,202,{ok:true,video:job});
      } catch(e){ return json(res,errorStatus(e),{error:e.message,provider:e.provider||'openai-video',details:e.details||{}}); }
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/video/')) {
      const videoId = url.pathname.split('/').pop();
      if (videoId.endsWith(':content')) return json(res,400,{error:'Invalid route'});
      try {
        const result = await openaiVideoProvider.retrieve(videoId);
        const prior = state.videos.get(videoId) || {};
        const job = {...prior,...result,assetId:prior.assetId || `asset_${randomUUID()}`}; state.videos.set(videoId,job); return json(res,200,{ok:true,video:job});
      } catch(e){ return json(res,errorStatus(e),{error:e.message,provider:'openai-video',details:e.details||{}}); }
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/video-content/')) {
      const videoId = url.pathname.split('/').pop();
      try {
        const response = await openaiVideoProvider.download(videoId);
        const headers = {'content-type':response.headers.get('content-type') || 'video/mp4','cache-control':'no-store'};
        res.writeHead(response.status,headers);
        if (response.body) { for await (const chunk of response.body) res.write(chunk); }
        return res.end();
      } catch(e){ return json(res,errorStatus(e),{error:e.message,provider:'openai-video',details:e.details||{}}); }
    }
    if (req.method === 'GET' && url.pathname === '/api/settings') return json(res,200,await readJson(path.join(root,'data/settings.json'),{}));
    if (req.method === 'GET' && url.pathname === '/api/content') return json(res,200,state.content);
    if (req.method === 'POST' && url.pathname === '/api/content') { const data=await parseBody(req); const item={id:randomUUID(),createdAt:new Date().toISOString(),status:'draft',...data}; state.content.items.unshift(item); state.content.items=state.content.items.slice(0,50); state.content.updatedAt=new Date().toISOString(); return json(res,201,item); }
    if (req.method === 'POST' && url.pathname === '/api/generate') { const data=await parseBody(req); if(!['strategy','script'].includes(data.task)) return json(res,400,{error:'Unsupported task'}); const settings=await readJson(path.join(root,'data/settings.json'),{}); return json(res,200,await generateWithFallback(data.task,data.input||{},settings.providerPriority||['openai','gemini','local'])); }
    if (req.method === 'POST' && url.pathname === '/api/qa') return json(res,200,qaCheck(await parseBody(req)));
    if (req.method === 'POST' && url.pathname === '/api/adapt') return json(res,200,{source:'local',adaptations:adaptContent(await parseBody(req))});
    if (req.method === 'POST' && url.pathname === '/api/analytics/learning') { const data=await parseBody(req); return json(res,200,analyzeLearning(data.metrics||data,state.content.items)); }
    if (req.method === 'POST' && url.pathname === '/api/analyze-research') { const data=await parseBody(req); const research=data.research||{}; const comparison=data.comparison||compareSources(research); return json(res,200,buildResearchBrief(research,comparison)); }
    if (req.method === 'POST' && url.pathname === '/api/pipeline') { const data=await parseBody(req); const topic=String(data.topic||'').trim(); if(!topic) return json(res,400,{error:'Topic is required'}); const settings=await readJson(path.join(root,'data/settings.json'),{}); const research=await researchWithFallback(topic,8,settings.researchProviderPriority||['exa','url','local'],data.urls||[]); const sourceComparison=compareSources(research); const researchBrief=buildResearchBrief(research,sourceComparison); const strategy=await generateWithFallback('strategy',{topic,researchBrief},settings.providerPriority||['openai','gemini','local']); const script=await generateWithFallback('script',{topic},settings.providerPriority||['openai','gemini','local']); const adaptations=adaptContent({topic,text:script.text||JSON.stringify(script)}); const production=buildProductionPlan({topic,script,adaptations}); const qa=qaCheck({text:script.text||JSON.stringify(script)}); const item={id:randomUUID(),createdAt:new Date().toISOString(),topic,research,sourceComparison,researchBrief,strategy,script,qa,adaptations,production,subtitlesSrt:toSrt(production.subtitles),status:qa.status==='pass'&&sourceComparison.total>=2?'ready_for_publish':'ready_for_qa'}; state.content.items.unshift(item); state.content.updatedAt=new Date().toISOString(); return json(res,200,item); }
    if (req.method === 'POST' && url.pathname === '/api/research') { const data=await parseBody(req); if(!data.query) return json(res,400,{error:'Query is required'}); const settings=await readJson(path.join(root,'data/settings.json'),{}); return json(res,200,await researchWithFallback(data.query,Math.min(Number(data.numResults||8),20),settings.researchProviderPriority||['exa','url','local'],data.urls||[])); }
    if (req.method === 'POST' && url.pathname === '/api/compare-sources') { const data=await parseBody(req); return json(res,200,compareSources(data.research||data)); }
    if (req.method === 'POST' && url.pathname === '/api/production') { const plan=buildProductionPlan(await parseBody(req)); return json(res,200,{...plan,subtitlesSrt:toSrt(plan.subtitles)}); }
    if (req.method === 'GET' && url.pathname === '/api/youtube/status') return json(res,200,{configured:Boolean(process.env.YOUTUBE_CLIENT_ID&&process.env.YOUTUBE_CLIENT_SECRET&&process.env.YOUTUBE_REFRESH_TOKEN),autoPublish:false,manualApproval:true});
    if (req.method === 'POST' && url.pathname === '/api/book/plan') return json(res,200,{ok:true,book:bookPlan(await parseBody(req))});

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/creative' || url.pathname === '/creative/')) {
      const html = await fs.readFile(path.join(root,'public/creative.html'),'utf8'); res.writeHead(200,{'content-type':mime['.html'],'cache-control':'no-store'}); return res.end(html);
    }
    if (req.method === 'GET') {
      const rel=decodeURIComponent(url.pathname).replace(/^\/+/, ''); const candidate=path.normalize(path.join(publicDir, rel || 'index.html'));
      if (!candidate.startsWith(publicDir)) return json(res,403,{error:'Forbidden'});
      try { const ext=path.extname(candidate); const content=await fs.readFile(candidate); res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream'}); return res.end(content); } catch { return json(res,404,{error:'Not found'}); }
    }
    return json(res,404,{error:'Not found'});
  } catch(e) { return json(res,500,{error:e.message}); }
}
