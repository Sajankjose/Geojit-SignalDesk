# SignalDesk — minimal POC + AI variants

## What changed
- Three small nav items: **Discover / Studio / Published**.
- Compact news list with RBI + SEBI source badges, date, original link and **Create post**.
- One focused content editor with **Generate 2 AI versions**, switchable **News update / Investor context**, final preview and verified-source check.
- Source health, disclosure options, and manual post recording are behind expandable sections.
- Existing browser-local drafts and manual publication records retain the same localStorage key; no data migration needed.
- **No automatic X publishing** and no use of proprietary MarketsMojo data.

## Turn on actual AI drafting in your Netlify deployment
Live AI variants use the serverless `/.netlify/functions/draft` endpoint. They are **not** fake template variants and **not** included with a ChatGPT consumer subscription.

1. In the Netlify project `geojitsignaldesk`, open **Project configuration → Environment variables**.
2. Add a new strong random `MANAGER_ACCESS_KEY` (at least 24 characters) and your own OpenAI **API** key as `OPENAI_API_KEY`. Put both only in Netlify. Never add them to GitHub code, this chat, or the frontend.
3. Optionally add `OPENAI_MODEL` (otherwise the server defaults to `gpt-4o-mini`).
4. Ensure the variables are available to **Functions** in the production deploy context; trigger a fresh deploy.
5. Open the main app → **Discover** → **Create post** → **Generate 2 AI versions**.
6. The first time, expand **AI connection settings**, enter your **manager access key** (NOT your OpenAI API key) and click **Connect AI**. The key is stored only in that browser tab.
7. Click Generate again. Verify both versions against the original before final approval and manual X publication.

A checked `/.netlify/functions/ai-status` endpoint confirms that the manager key is valid and that the OpenAI key is configured. This endpoint does not disclose secret values or call OpenAI.

**OpenAI API usage is billed separately** from ChatGPT plans; free RBI/SEBI news ingestion remains free of paid data-provider subscriptions. Limits, permissions and OpenAI API billing are managed by the user's OpenAI API account.

## Safety limits
- Live Netlify website may be publicly accessible until **Visitor access** is restricted at the site level. This POC must not be used for client-confidential or unapproved material.
- Drafts and publication logs are stored only in the current browser, not a server-backed team database or regulatory archive.
- AI receives only RSS title, date, publisher and excerpt; it has not read the full official document. Human checking is mandatory.
- Source publication time/date may be approximate; SEBI publishes date-only RSS entries.
- No automatic posting, X API credentials, scheduled messages, investor-specific advice, or unlicensed third-party article copying.

## Acceptance checks
- RBI and SEBI feed cards load, and Discover filters work on desktop/mobile.
- Each card's Source link opens an authentic primary-source URL.
- Create post enters the in-page Studio and shows a manual draft without any API key.
- Without configured keys, Connect AI explains the missing server-side setup without claiming success.
- With configured keys, AI returns two short grounded alternatives in their tabs; editing invalidates verification.
- Only checked Ready posts can be copied or have an X publication URL recorded.
