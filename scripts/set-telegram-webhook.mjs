const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const baseUrl = String(process.env.TELEGRAM_WEBHOOK_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');

if (!token) throw new Error('Set TELEGRAM_BOT_TOKEN before running this script.');
if (!secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  throw new Error('Set TELEGRAM_WEBHOOK_SECRET to 1–256 letters, numbers, _ or -.');
}
if (!baseUrl.startsWith('https://')) throw new Error('Set TELEGRAM_WEBHOOK_BASE_URL to the public HTTPS Render service URL.');

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: `${baseUrl}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: false
  })
});
const result = await response.json().catch(() => ({}));
if (!response.ok || !result.ok) throw new Error(result.description || `Telegram rejected setWebhook (HTTP ${response.status}).`);
console.log('Webhook registered:', `${baseUrl}/api/telegram/webhook`);
