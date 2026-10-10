# NOVESSA AI Core

A standalone NOVESSA project with three connected sections:

- AI Chat: posts user messages to the shared NOVESSA Media AI Worker.
- Unit Economics: performs calculations in the browser without an AI call.
- SEO Card & Audit: generates Russian marketplace copy for Wildberries and/or Ozon plus an Armenian internal audit.

## Production environment

Set `NOVESSA_GATEWAY_BASE_URL` to the existing Media AI Worker URL (or use `MEDIA_AI_BASE_URL`). Do not place API keys in the frontend. The project currently expects:

`NOVESSA_GATEWAY_BASE_URL=https://falling-cake-118b.danielyananna517.workers.dev`

The `/health` route checks the Worker health endpoint. `/api/v1/chat` and `/api/v1/seo` both use the same server-side Worker proxy with different prompts.

SEO keywords are suggestions only. The application must not invent search-frequency statistics, CTR, conversion, returns, or sales-lift figures.

## Deployment

This folder is intended to be the Root Directory for the dedicated Vercel project. It uses Express and the `start` script in `package.json`. The parent Media-AI project files are intentionally untouched.
