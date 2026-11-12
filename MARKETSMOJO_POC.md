# Geojit SignalDesk — MarketsMojo Editorial POC

## Goal
Demonstrate **Indian market story → Geojit AI tweet draft → human editorial review** to Geojit management and the MarketsMojo team before negotiating any automated news feed agreement.

## Present scope (deliberately manual, not scraping)
- Discover now has a separate **MarketsMojo (POC)** source next to RBI, SEBI and PIB.
- Editors click **Open MarketsMojo**, select a relevant news item on the publisher's own website, and manually add the **original news URL, headline and brief independently verified facts in their own words**.
- The URL must be HTTPS and belong to `marketsmojo.com/news`. No full article ingestion, automated HTML crawling, RSS probing, bulk collection, price-feed copying or developer authentication takes place.
- Added stories are **browser-local** in `signaldesk:marketsmojo:curated:v1` and become cards in Discover (up to 35 curated entries). This data does not automatically sync between managers or devices.
- Editors can add to Discover or **Add & draft with AI**, opening the existing source-backed News Update / Why It Matters Studio. The latter uses the already configured **Netlify OpenAI function**, not any MarketsMojo API.
- Studio correctly indicates that a MarketsMojo headline and editor-written facts were the only AI input; the app neither fetched an article nor verified any market fact.
- POC drafts remain editable and can be shown internally, but **Mark Ready, Copy Final and Record Published are disabled** for these stories pending appropriate publishing/content permissions. RBI/SEBI/PIB flows remain unchanged, with manual X publishing only.

## Why this boundary matters
The existence of a publicly readable page does not automatically license extraction, redistribution or model processing. This POC makes the future integration visible without implying that MarketsMojo has authorised scraping or external publication. The user must paste only facts they can lawfully use, and verify them against the original and public filings before generating the draft. Avoid full article reproduction, market recommendations, and MarketsMojo proprietary ratings or conclusions.

## Demo walkthrough
1. In Discover, choose **MarketsMojo (POC)** and click **Open MarketsMojo**.
2. Select a **market summary, corporate announcement or quarterly result** (avoid ratings and investment recommendations for the POC).
3. Click **Add news story**, enter the link and headline, and add short, independently verified facts.
4. Click **Add & draft with AI**. If not yet connected, use Studio's existing AI connection with the manager key (the OpenAI API secret remains server-side).
5. Compare the standalone, editable **News Update** and **Why It Matters** drafts. If evidence is insufficient, Why It Matters stays empty with an explanatory note. Discuss safeguards and workflow with the teams.
6. Show that the POC draft cannot be marked Ready for public X posting. No automatic X publication exists anywhere in SignalDesk.

## Proposal for the MarketsMojo team
Request approval for a limited, documented internal trial delivering headline, source URL, publication timestamp and a permitted short summary for 10–20 stories (perhaps via a simple RSS/JSON feed, not necessarily a commercial API). Confirm rights to view, store, transmit to an AI processor, create derivative editorial copy, and publish excerpts and source attribution. Only after written permission should an automatic server-side connector be considered.

## Retired Marketaux
The previous Marketaux tab, data function, session function and API-token integration were removed from this POC. Obsolete Netlify environment variables `MARKETAUX_API_TOKEN` and `MARKETAUX_USAGE_APPROVED` can be removed manually from **Netlify → Environment variables**, once the team confirms that the site no longer uses them. The old browser cookie will expire; it is not used by this version.

## Nonproduction boundaries
No company SSO, Netlify visitor access protection, centralised shared storage or compliance audit log. Do not use POC browser records as production approval/publishing controls.
