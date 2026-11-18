# Connect @Novessa_bot to NOVESSA AI

This adds Telegram private-chat replies to the same Gemini-backed `/api/ai` endpoint used by the Mini App.

## Render environment

On the existing `novessa-backend` Render service, set:

- `GEMINI_API_KEY`: your Gemini API key (server-side only)
- `TELEGRAM_BOT_TOKEN`: the token for `@Novessa_bot`
- `TELEGRAM_WEBHOOK_SECRET`: a random 32–128 character value using letters, numbers, underscores, or hyphens
- `TELEGRAM_WEBHOOK_BASE_URL`: `https://novessa-backend.onrender.com`

Never commit these values or send them in Telegram messages.

## Activate

1. Deploy this branch to the existing Render service.
2. In the Render Shell, run `node scripts/set-telegram-webhook.mjs` once after the environment variables are saved.
3. In Telegram, send `/start` to `@Novessa_bot`, then send a short question.

Registering this webhook replaces the bot's current Telegram webhook, so BotConsol will stop receiving updates for this bot. The code change alone does not change the current webhook.

## Included behavior

- Checks Telegram's webhook secret header.
- Uses the existing server-side `/api/ai` endpoint; no Gemini key is sent from Telegram or stored in the chat.
- Responds to private text messages and `/start` or `/help`.
- Splits long answers to fit Telegram's message limit.
- Ignores groups and non-text updates, and limits each user to 10 questions per minute.
- `/api/telegram/webhook` returns 503 until the bot token and webhook secret are configured.
