# Drishti → Geojit SignalDesk: Sandbox integration

**Status:** Manager-only **read-only evaluation** of Indian capital-market headline coverage. This is not an AI-enabled or public Drishti content feed. Initial adapter is deliberately narrow until source rights and sample relevance are checked.

## Connect your new Drishti key

1. In the Drishti developer console, generate or copy your API key. **Do not paste it into ChatGPT, a GitHub issue, front-end code, or a screen recording.**
2. Open [SignalDesk Netlify Environment Variables](https://app.netlify.com/projects/geojitsignaldesk/configuration/env) and create:
   - **Key:** `DRISHTI_API_KEY`
   - **Value:** The secret Drishti key copied from your console
   - **Contains secret values:** Enabled
   - **Specific scope:** Functions
   - **Deploy context:** Production
3. Save and **redeploy** the site so Netlify Functions can use the new environment value.
4. Open https://geojitsignaldesk.netlify.app/#discover (hard refresh).
5. Select **Indian Markets · Trial**.
6. If prompted, connect the existing **SignalDesk manager access key** in Studio → AI connection settings. This is **not** your Drishti API key.
7. Return to Indian Markets and click **Check connection**. This uses the **free** Drishti `GET /v1/account` endpoint to verify authentication, News product enablement, plan and remaining balance. Your key and account identity are not exposed to the browser.
8. Once the panel says Drishti connection successful, click **Load news · 1 credit**. It requests `GET /v1/news?page=1&limit=20` without a symbol filter to test whether the subscription covers both broad-market and company-specific news.
9. Inspect headline quality, source attribution, freshness, company coverage and links for the first live page. **No purchase is required** for Sandbox REST testing.

## Implementation

- Serverless function: `netlify/functions/drishti-news.mjs`
- Manager-authenticated routes:
  - `/.netlify/functions/drishti-news?mode=status` (account status; free/non-billable)
  - `/.netlify/functions/drishti-news?mode=news` (20 records maximum; costs 1 credit if the page has results)
- Drishti API host: `https://developers.manasija.in`. Authentication via **server-only** `X-API-Key`.
- Requests are generated from fixed paths; API key is **never** placed in query strings.
- Headlines, short summaries, source labels, original HTTPS links and publication timestamps shown in a dedicated manager-only panel. Source dates are preserved; records without a known publication date are labelled **Publication time not supplied**, never presented as fresh.
- Netlify in-memory cache for 15 minutes per warm function instance. This reduces duplicate billable calls but is **not a global quota guarantee** if Netlify starts multiple instances. Only click **Load news** when needed.
- The existing RBI, SEBI, PIB and manually curated MarketsMojo sources remain unchanged.
- Drishti records **are not** added to the public Discover list, automated news alerts, shared drafts, AI requests or publishing workflows. The app does not auto-poll this source or connect WebSockets.
- Manager authorisation is via existing `MANAGER_ACCESS_KEY`; the news feed is not returned to visitors without that key.

## Why the restricted evaluation?

As of November 2026 Drishti's public Terms (dated 5 June 2026) provide rights for internal use and genuine customer derivatives, but reserve other rights and mention downstream restrictions on third-party content, proprietary notices, permitted displays, model uses and redistribution. They require reviewing the plan's Order Form and incorporated terms. A personal GitHub sign-up does **not**, by itself, prove Geojit has all company/internal-user or public-social rights.

Before pushing provider metadata to OpenAI or publishing Geojit posts based on it, obtain confirmation that Geojit may:
1. Use the feed in its private internal editorial application, across authorised users.
2. Send the permitted fields to an **external AI service (OpenAI API)** for draft creation.
3. Distribute original, verified derivative social posts publicly, with correct attribution/disclosures.
4. Retain the necessary source metadata and any required review/audit records.

Do not replicate a publisher feed, market data terminal, or proprietary analyses; this POC is a tool to assess the source for original Geojit editorial content.

## Suggested review benchmarks

| Metric | Evaluate |
|---|---|
| Indian-market relevance | How many of 20 records are genuinely useful for Indian market communications? |
| Company vs broad market | Count company earnings, corporate developments, index/sector news and RBI/SEBI context separately |
| Timeliness | Compare Drishti article date/time with original-source publication |
| Provenance | Number with reliable publisher and verifiable original URL |
| Story usefulness | Number suitable for verified Geojit posts with factual detail rather than sentiment |
| Duplicates | Repeated URLs, syndicated duplicates, stale content |

**Decision point:** If breadth and timestamps are satisfactory, request permission for AI-assisted original social posts, then integrate Drishti metadata into SignalDesk's editorial categories, with authorisation, rights, evidence and compliance gates.

### Sources

- [Authentication](https://drishti.manasija.in/docs/guides/authentication)
- [News endpoint](https://drishti.manasija.in/docs/api-reference/news/list-news-feed-items)
- [Account endpoint](https://drishti.manasija.in/docs/api-reference/account/get-live-account-profile)
- [Plans / pricing](https://drishti.manasija.in/docs/pricing)
- [Drishti terms](https://drishti.manasija.in/legal/terms-and-conditions)

**Pricing caveat:** Drishti's homepage and docs have displayed different plan names/credit figures. Use the entitlements and remaining credit balance reported by your *own console/key*, not an assumed price list.
