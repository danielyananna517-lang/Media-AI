# Media AI 7.7.0 — Vercel Ready

This is the standalone Media AI package. It has no Floot or BotConsol runtime dependency.

## Included
- Creative Studio web UI
- Research → source comparison → strategy → script → QA → adaptation → production → subtitles pipeline
- Provider Layer with explicit provider availability
- Real OpenAI image generation with binary validation and metadata
- Real OpenAI text-to-speech generation
- Real OpenAI video job creation, polling, and MP4 content proxy
- Book Studio plan with configurable language, size, page count, and illustration prompts
- Asset history in the browser for generated image/audio items
- Manual publishing gate; no automatic social publishing
- Vercel serverless entry point at `api/index.mjs`

## Deploy
1. Open https://vercel.com/drop and sign in.
2. Upload this ZIP (or the extracted project folder).
3. Click **Deploy**.
4. Open **Project → Settings → Environment Variables**.
5. Add `OPENAI_API_KEY` for Production.
6. Redeploy.
7. Open the production URL. `/` and `/creative` both open Media AI.

Optional variables:
- `OPENAI_IMAGE_MODEL=gpt-image-2`
- `OPENAI_TTS_MODEL=gpt-4o-mini-tts`
- `OPENAI_VIDEO_MODEL=sora-2`

## Runtime behavior
- API keys are server-side only.
- Generated image/audio previews are returned to the browser and stored in browser history.
- Video generation uses an asynchronous provider job; the UI polls status and exposes the MP4 when complete.
- Serverless instances are treated as ephemeral. No deployment filesystem persistence is assumed.
- Provider availability is reported from real environment configuration; no fake Connected state is used.
