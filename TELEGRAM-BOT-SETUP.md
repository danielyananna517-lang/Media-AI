# Connect BotConsol to NOVESSA AI

This integration keeps BotConsol responsible for receiving and sending Telegram messages. BotConsol calls the protected NOVESSA AI endpoint inside its existing flow; the Telegram webhook does not move.

## Render environment variables

On the existing NOVESSA Render service, set:

- `GEMINI_API_KEY`: the key used by the existing server-side Gemini AI endpoint.
- `BOTCONSOL_API_SECRET`: a new random secret. Keep it in Render and BotConsol's secure secret/header field only.

Do not commit either value or paste them into Telegram or a public flow message.

## BotConsol flow

Add an HTTP/API request step between the incoming message and the existing Send Message step:

- Method: `POST`
- URL: `https://novessa-backend.onrender.com/api/botconsol/ai`
- Header: `Authorization: Bearer <BOTCONSOL_API_SECRET>`
- Header: `Content-Type: application/json`
- JSON body: `{"message":"<map the incoming Telegram message text here>"}`

On success, map the response field `reply` to the existing Send Message step. If BotConsol only accepts `prompt` as the request field, the API accepts that too. Keep the current Telegram trigger and current reply step; insert the API call between them. The exact variable syntax depends on the BotConsol editor.

## Endpoint responses

- Success: `{"success":true,"reply":"...","text":"..."}`
- Missing Render secret: HTTP 503
- Wrong/missing Authorization header: HTTP 401
- Empty message: HTTP 400
- Gemini/AI failure: HTTP 502 with a short Armenian message

The endpoint never accepts a Gemini key from BotConsol. It uses `GEMINI_API_KEY` from Render. The endpoint is intended for short private chat text; it does not process attachments or group messages.
