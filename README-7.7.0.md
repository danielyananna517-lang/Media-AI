# Media AI 7.7.0 — Standalone

This build is independent of Floot and BotConsol.

## Run

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Put your own `OPENAI_API_KEY` in `.env` when you want real image generation.
4. Run `npm start`.
5. Open `http://127.0.0.1:3777/creative`.

## Current implemented phase

- Provider Layer abstraction.
- Real OpenAI image adapter using the Images API.
- Server-side credential handling.
- Asset manifest with provider/model/prompt/size/format/generation ID/creation time/asset ID/checksum.
- Image signature validation before `READY`.
- Rate-limit/error propagation.
- Existing independent core retained alongside the new layer.

The exact historical 7.6.0 source snapshot supplied in earlier work was not available in this runtime, so this package does not falsely claim a fresh 54/54 verification of that historical snapshot. It is a separate 7.7.0 standalone build from the available independent Media AI source.
