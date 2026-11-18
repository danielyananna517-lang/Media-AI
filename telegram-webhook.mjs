import { timingSafeEqual } from 'node:crypto';

const MAX_TELEGRAM_TEXT = 4096;
const rateByUser = new Map();
const seenUpdates = new Map();

function secureEqual(actual, expected) {
  const a = Buffer.from(String(actual || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

function chunks(text, limit = MAX_TELEGRAM_TEXT) {
  const chars = Array.from(String(text || ''));
  const parts = [];
  while (chars.length) parts.push(chars.splice(0, limit).join(''));
  return parts.length ? parts : ['Պատասխան չստացվեց։'];
}

async function telegramCall(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    throw new Error(`Telegram ${method} failed (HTTP ${response.status})`);
  }
  return data.result;
}

function isRateLimited(userId) {
  const now = Date.now();
  const cutoff = now - 60_000;
  const recent = (rateByUser.get(userId) || []).filter(time => time > cutoff);
  if (recent.length >= 10) {
    rateByUser.set(userId, recent);
    return true;
  }
  recent.push(now);
  rateByUser.set(userId, recent);
  if (rateByUser.size > 2000) {
    for (const [id, times] of rateByUser) {
      if (!times.length || times[times.length - 1] <= cutoff) rateByUser.delete(id);
    }
  }
  return false;
}

async function answerUpdate(update, token, askAI) {
  const message = update?.message;
  const chat = message?.chat;
  const user = message?.from;
  if (!message || chat?.type !== 'private' || !user || user.is_bot || typeof message.text !== 'string') return;

  const rawText = message.text.trim();
  if (!rawText) return;
  const command = rawText.split(/\s+/, 1)[0].split('@', 1)[0].toLowerCase();

  if (command === '/start' || command === '/help') {
    await telegramCall(token, 'sendMessage', {
      chat_id: chat.id,
      text: 'Բարև։ Ես NOVESSA AI-ն եմ։ Գրիր հարցդ՝ վաճառքների, Wildberries/Ozon-ի կամ ապրանքի հաշվարկների մասին։'
    });
    return;
  }

  if (rawText.length > 12000) {
    await telegramCall(token, 'sendMessage', { chat_id: chat.id, text: 'Հարցը շատ երկար է։ Խնդրում եմ ուղարկել մինչև 12,000 նիշ։' });
    return;
  }
  if (isRateLimited(user.id)) {
    await telegramCall(token, 'sendMessage', { chat_id: chat.id, text: 'Մի րոպեում հարցերի սահմանը լրացել է։ Խնդրում եմ մի փոքր սպասել։' });
    return;
  }

  await telegramCall(token, 'sendChatAction', { chat_id: chat.id, action: 'typing' }).catch(() => {});
  let reply;
  try {
    reply = await askAI(rawText);
  } catch (error) {
    console.error('[NOVESSA Telegram AI]', error.message);
    reply = 'Այս պահին AI-ը չկարողացավ պատասխանել։ Խնդրում եմ մի փոքր անց նորից փորձել։';
  }
  for (const part of chunks(reply)) {
    await telegramCall(token, 'sendMessage', { chat_id: chat.id, text: part });
  }
}

export function createTelegramWebhook({ askAI }) {
  if (typeof askAI !== 'function') throw new TypeError('askAI must be a function');

  return async function telegramWebhook(req, res) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!token || !secret) {
      return res.status(503).json({ ok: false, error: 'Telegram webhook is not configured.' });
    }
    if (!secureEqual(req.get('x-telegram-bot-api-secret-token'), secret)) {
      return res.status(401).json({ ok: false });
    }

    const update = req.body;
    const updateId = Number(update?.update_id);
    if (!Number.isSafeInteger(updateId)) return res.status(400).json({ ok: false });

    if (seenUpdates.has(updateId)) return res.status(200).json({ ok: true, duplicate: true });
    seenUpdates.set(updateId, Date.now());
    if (seenUpdates.size > 5000) {
      const oldest = seenUpdates.keys().next().value;
      seenUpdates.delete(oldest);
    }

    // Acknowledge promptly so Telegram does not resend a slow AI request.
    res.status(200).json({ ok: true });
    answerUpdate(update, token, askAI).catch(error => {
      console.error('[NOVESSA Telegram webhook]', error.message);
    });
  };
}
