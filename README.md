# Media AI — Independent Studio

This is a standalone local app. It does **not** depend on Floot, BotConsol, or any single AI website.

## Core architecture

Research → Source comparison → AI analysis → Content Strategy → Script → QA → Production → Subtitles → YouTube → Analytics → Learning Loop

Providers are adapters. OpenAI, Gemini and Exa are optional. Local mode remains usable without any API key.

## Start

1. Copy `.env.example` to `.env` and add only the credentials you actually want to use.
2. Start with:

```bash
npm start
```

3. Open `http://127.0.0.1:3777`

## Current independent core

- Provider status matrix
- Research endpoint with optional Exa adapter
- Strategy generation with OpenAI → Gemini → Local fallback
- Script outline generation with OpenAI → Gemini → Local fallback
- Content Memory stored locally as JSON
- No Floot runtime dependency
- No provider is hard-coded into the core workflow

## Current end-to-end modules

The remaining optional integrations are clean seams for:

- YouTube OAuth + upload scheduling
- YouTube Analytics ingestion
- Image/video/voice providers
- Durable database instead of local JSON

Keep final publishing/payment actions user-controlled until explicitly changed.

## Working modules in this build

- Research adapter with local fallback
- Replaceable text AI adapters (OpenAI / Gemini / local)
- Basic automated QA gate before publication
- Multi-platform adaptation layer
- Local Content Memory
- Analytics → Learning Loop logic
- One-click local pipeline that ties the stages together
- YouTube adapter seam with user-controlled publishing

No module requires Floot.


## Security / control rules

- No API secret is stored in frontend code.
- `.env` is ignored by git and is never required for local-mode workflows.
- Auto-publish is disabled by default.
- The pipeline produces a publish package; final upload remains a user action.
- Provider choice is configured in `data/settings.json`, so the core does not depend on one vendor.

### 0.3 Research Hub
- Optional URL importer works without a search API.
- Research results automatically produce an evidence brief.
- Full Pipeline passes the research brief into strategy generation.
- Private/local network URLs are blocked by the importer.
