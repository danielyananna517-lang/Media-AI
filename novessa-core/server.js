'use strict';

const express = require('express');
const path = require('node:path');

const app = express();
const PORT = Number(process.env.PORT || 8080);
const BASE = String(process.env.NOVESSA_GATEWAY_BASE_URL || process.env.MEDIA_AI_BASE_URL || '')
  .trim().replace(/\/+$/, '');
const TIMEOUT_MS = Math.max(5000, Math.min(Number(process.env.NOVESSA_AI_TIMEOUT_MS || 60000), 120000));

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

function fail(message, status) {
  const e = new Error(message);
  e.status = status || 500;
  return e;
}
function text(value, label, limit, optional) {
  if (value === undefined || value === null) {
    if (optional) return '';
    throw fail(label + ' դաշտը պարտադիր է։', 400);
  }
  if (typeof value !== 'string') throw fail(label + ' դաշտը պետք է լինի տեքստ։', 400);
  value = value.trim();
  if (!value && !optional) throw fail(label + ' դաշտը պարտադիր է։', 400);
  if (value.length > limit) throw fail(label + ' դաշտը չափազանց երկար է։', 413);
  return value;
}
function pickReply(data, depth = 0) {
  if (depth > 5 || data == null) return '';
  if (typeof data === 'string') {
    const value = data.trim();
    // Media AI wraps its actual artifact in a JSON string inside the outer "reply" field.
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      try {
        const parsed = JSON.parse(value);
        const extracted = pickReply(parsed, depth + 1);
        if (extracted && extracted !== JSON.stringify(parsed, null, 2)) return extracted;
      } catch (_) {}
    }
    return value;
  }
  // Preferred shape returned by the Media AI Worker.
  if (typeof data?.artifact?.response === 'string' && data.artifact.response.trim()) {
    return data.artifact.response.trim();
  }
  if (typeof data?.reply === 'string' && data.reply.trim()) {
    const value = data.reply.trim();
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      try {
        const parsed = JSON.parse(value);
        const extracted = pickReply(parsed, depth + 1);
        if (extracted) return extracted;
      } catch (_) {}
    }
    return value;
  }
  for (const key of ['text', 'output', 'answer', 'responseText', 'generatedText']) {
    if (typeof data?.[key] === 'string' && data[key].trim()) return data[key].trim();
  }
  for (const key of ['result', 'data', 'response', 'output']) {
    if (data?.[key] !== undefined && data[key] !== data) {
      const nested = pickReply(data[key], depth + 1);
      if (nested) return nested;
    }
  }
  if (Array.isArray(data?.choices)) {
    const c = data.choices[0]?.message?.content || data.choices[0]?.text;
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

async function callMediaAI(message) {
  if (!BASE) throw fail('Media AI-ի հասցեն կարգավորված չէ։ Ստուգեք NOVESSA_GATEWAY_BASE_URL միջավայրի փոփոխականը։', 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(BASE + '/ui/api/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ operation: 'chat', input: { message: message } }),
      signal: controller.signal
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { rawText: raw }; }
    if (!response.ok) throw fail('Media AI հարցման սխալ՝ HTTP ' + response.status + '. ' + (data.error || raw || 'Անհայտ սխալ'), response.status === 429 ? 429 : 502);
    if (data && data.ok === false) throw fail('Media AI-ը չավարտեց հարցումը՝ ' + String(data.error || data.code || 'provider_unavailable'), 502);
    return pickReply(data);
  } catch (e) {
    if (e.name === 'AbortError') throw fail('Media AI-ի պատասխանի սպասման ժամանակը սպառվեց։', 504);
    if (e.status) throw e;
    throw fail('Media AI-ի հետ կապը չհաջողվեց։ ' + (e.message || 'Ցանցային սխալ'), 502);
  } finally { clearTimeout(timer); }
}

const CHAT_RULES = 'Դու NOVESSA AI-ի օգնականն ես։ Պատասխանիր օգտատիրոջ լեզվով՝ ջերմ, պարզ և գործնական։ Օգնում ես Wildberries/Ozon, SEO, ապրանքային քարտեր, Excel, Unit Economics և վաճառքների վերլուծություն թեմաներով։ Մի հորինիր փաստեր, վիճակագրություն, թարմ տվյալներ կամ երաշխիքներ։';

function seoPrompt(input) {
  const platform = input.platform === 'wb' ? 'Միայն Wildberries' :
    input.platform === 'ozon' ? 'Միայն Ozon' : 'Wildberries և Ozon՝ առանձին ենթաբաժիններով';
  return 'Դու NOVESSA AI-ի պրոֆեսիոնալ marketplace SEO և վաճառքային copywriting մասնագետն ես։\n' +
    'Հարթակ՝ ' + platform + '\n' +
    'Ապրանք՝ ' + input.name + '\n' +
    'Հայտնի հատկանիշներ՝ ' + (input.features || 'Չեն տրամադրվել') + '\n' +
    'Լրացուցիչ բառեր/տվյալներ՝ ' + (input.keywords || 'Չկան') + '\n\n' +
    'Ստեղծիր հետևյալ կառուցվածքով արդյունք։ Գնորդի համար պատրաստի քարտը գրիր ռուսերեն, ներքին աուդիտը՝ հայերեն։\n\n' +
    '=== ԲԱԺԻՆ 1. ԳՆՈՐԴԻ ՀԱՄԱՐ ՊԱՏՐԱՍՏԻ ՔԱՐՏ ===\n' +
    'Յուրաքանչյուր ընտրված հարթակի համար՝ SEO վերնագիր, 10–15 առաջարկվող բանալի բառ, գրավիչ բնական վաճառող նկարագրություն, 3–4 ինֆոգրաֆիկայի սլայդի գաղափար և հայտնի հատկանիշներ։\n\n' +
    '=== ԲԱԺԻՆ 2. ՆԵՐՔԻՆ SEO ԱՈՒԴԻՏ (ՀԱՅԵՐԵՆ) ===\n' +
    'Հաստատված տվյալներ, բացակայող տվյալներ, չհաստատված պնդումներ/ռիսկեր, SEO բառերի կարգավիճակ, հրապարակումից առաջ կոնկրետ գործողություններ։\n\n' +
    'Խիստ կանոններ։ Մի հորինիր գույն, չափս, կազմ, քաշ, կոմպլեկտացիա, սեզոն, փափկություն, դիմացկունություն, խնամք կամ արտադրողի խոստումներ։ Մի հորինիր որոնման ծավալներ, բարձր հաճախականության կարգավիճակ, CTR, կոնվերսիա, վերադարձների տոկոս կամ վաճառքի աճի թվեր։ Եթե իրական որոնման տվյալներ չկան, գրիր, որ հաճախականությունը ստուգված չէ։ Բացակայող տվյալները նշիր ներքին աուդիտում, ոչ թե գնորդի վաճառող նկարագրության մեջ։ Գրիր հստակ, կառուցվածքային և գործնական։';
}

app.get('/health', async function (_req, res) {
  const result = {
    status: 'online',
    service: 'NOVESSA AI Unified',
    aiProvider: 'NOVESSA Media AI Worker',
    aiConfigured: Boolean(BASE),
    aiReachable: false,
    checkedAt: new Date().toISOString()
  };
  if (!BASE) return res.status(200).json({ ...result, aiMessage: 'Media AI հասցեն կարգավորված չէ։' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const r = await fetch(BASE + '/health', { signal: controller.signal, headers: { accept: 'application/json' } });
    const d = await r.json().catch(() => ({}));
    result.aiReachable = r.ok && d.ok !== false && d.status !== 'offline';
    result.mediaAiVersion = d.version || null;
    result.aiMessage = result.aiReachable ? 'Media AI կապը հասանելի է։' : 'Media AI առողջության ստուգումը ձախողվեց՝ HTTP ' + r.status;
  } catch (e) {
    result.aiMessage = e.name === 'AbortError' ? 'Media AI ստուգման ժամանակը սպառվեց։' : 'Media AI-ը հասանելի չէ՝ ' + e.message;
  } finally { clearTimeout(timer); }
  return res.json(result);
});

app.post('/api/v1/chat', async function (req, res) {
  try {
    const message = text(req.body?.message, 'Հաղորդագրությունը', 12000, false);
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8).map(function (m) {
      if (!m || !['user', 'assistant', 'model'].includes(m.role) || typeof m.text !== 'string') return '';
      return (m.role === 'user' ? 'Օգտատեր' : 'NOVESSA') + ': ' + m.text.slice(0, 2000);
    }).filter(Boolean).join('\n') : '';
    const prompt = CHAT_RULES + (history ? '\n\nՆախորդ զրույցը:\n' + history : '') +
      '\n\nՕգտատիրոջ ընթացիկ հարցը:\n' + message;
    return res.json({ success: true, reply: await callMediaAI(prompt), provider: 'NOVESSA Media AI Worker' });
  } catch (e) {
    const status = Number(e.status) || 500;
    console.error('[NOVESSA chat]', status, e.message);
    return res.status(status).json({ success: false, error: e.message || 'AI հարցման սխալ։' });
  }
});

app.post('/api/v1/seo', async function (req, res) {
  try {
    const input = {
      name: text(req.body?.name, 'Ապրանքի անվանումը', 500, false),
      features: text(req.body?.features ?? '', 'Հատկանիշները', 6000, true),
      keywords: text(req.body?.keywords ?? '', 'Լրացուցիչ բառերը', 3000, true),
      platform: ['wb', 'ozon', 'both'].includes(req.body?.platform) ? req.body.platform : 'both'
    };
    return res.json({ success: true, reply: await callMediaAI(seoPrompt(input)), provider: 'NOVESSA Media AI Worker', platform: input.platform });
  } catch (e) {
    const status = Number(e.status) || 500;
    console.error('[NOVESSA seo]', status, e.message);
    return res.status(status).json({ success: false, error: e.message || 'SEO գեներացման սխալ։' });
  }
});

app.use(function (req, res) {
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, error: 'API հասցեն չի գտնվել։' });
  return res.status(404).send('Էջը չի գտնվել։');
});

app.listen(PORT, function () {
  console.log('NOVESSA AI Unified listening on port ' + PORT);
  console.log('Media AI gateway configured: ' + Boolean(BASE));
});
