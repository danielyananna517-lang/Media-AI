import { timingSafeEqual } from 'node:crypto';

function secureEqual(actual, expected) {
  const a = Buffer.from(String(actual || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createBotConsolApi({ askAI }) {
  if (typeof askAI !== 'function') throw new TypeError('askAI must be a function');

  return async function botConsolAi(req, res) {
    const secret = process.env.BOTCONSOL_API_SECRET;
    if (!secret) {
      return res.status(503).json({ success: false, error: 'BotConsol API is not configured.' });
    }
    if (!secureEqual(req.get('authorization'), 'Bearer ' + secret)) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const input = req.body?.message ?? req.body?.prompt;
    if (typeof input !== 'string' || !input.trim()) {
      return res.status(400).json({ success: false, error: 'Հաղորդագրությունը բացակայում է։' });
    }
    if (input.length > 12000) {
      return res.status(413).json({ success: false, error: 'Հաղորդագրությունը չափազանց երկար է։' });
    }

    try {
      const reply = await askAI(input.trim());
      return res.json({ success: true, reply, text: reply });
    } catch (error) {
      console.error('[NOVESSA BotConsol AI]', error.message);
      return res.status(502).json({
        success: false,
        error: 'AI-ը հիմա չի պատասխանում։ Խնդրում ենք մի փոքր անց նորից փորձել։'
      });
    }
  };
}
