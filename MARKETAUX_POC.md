# SignalDesk · Marketaux India financial news POC

## What is implemented

- New **Discover → Indian Markets (POC)** tab alongside RBI/SEBI, which remain independent and free official-source feeds.
- Protected Netlify function `/.netlify/functions/marketaux-news` retrieves up to **three India-linked English financial articles** on demand from Marketaux. The Marketaux token remains a Netlify Function secret; the browser never receives it.
- API query: `/v1/news/all`, `countries=in`, `language=en`, `filter_entities=true`, `group_similar=true`, `limit=3`, `published_after=<7 days ago>`. **Country is the exchange-country associated with identified entities, not necessarily the publisher's country.**
- The dashboard displays publisher/domain, original article link, article publication date, short publisher metadata and a cautious *editorial relevance estimate*; it explicitly distinguishes such reports from verified RBI/SEBI documents and from raw market price/volume data.
- Selected articles can be taken into the existing Content Studio (News Update / Why It Matters, editable hashtags, manual source verification). Never automated X posting.
- Free-plan protections: **manual fetch only**, not in the five-minute RBI/SEBI refresh loop; up to 3 articles per request and 45-minute per-instance server cache plus 45-minute browser re-fetch cooldown. Note: caches are ephemeral per Netlify instance, so a high-traffic deployment could still use more of the free quota.

## Critical usage-rights safeguard

Marketaux's publicly available terms restrict site content to non-commercial use and disallow commercial activities without explicit approval. A registered free API token alone is **not** reliable evidence that Geojit's financial-services commercial editorial use and use of publisher-derived content is licensed.

The endpoint deliberately returns **403 disabled** unless `MARKETAUX_USAGE_APPROVED=true` is explicitly configured as a Netlify **Functions / Production** environment variable after the relevant contractual/permitted API scope is confirmed. Do not set it without that authorisation. We do **not** store article bodies or images, imply publisher content is licensed for X, or automatically post. The original publisher and link must be checked before deriving a Geojit social post.

Suggested permission question to Marketaux or Geojit Legal/MarCom: *Does our free Marketaux API subscription permit server-side retrieval and temporary display of headlines, metadata and article links in Geojit's internal, manager-only commercial editorial dashboard; and does it allow AI summarisation into original social posts that cite those publishers? If not, what subscription or licence is necessary?*

## Enabling after approval

1. Confirm `MARKETAUX_API_TOKEN` exists in Netlify **Project configuration → Environment variables**, with scope **Functions**, deploy context **Production**. Do not reveal it in chat.
2. After permissions are confirmed, add `MARKETAUX_USAGE_APPROVED=true` in the same **Functions → Production** context. Redeploy.
3. Open SignalDesk → **Discover → Indian Markets (POC)**.
4. Enter the existing SignalDesk manager key if prompted, then click **Load 3 stories**. Neither the API token nor OpenAI key is ever entered in the page.
5. Verify publisher, publication time and original URL. Test relevance, article count, quota use and deduplication. Send individual stories to Studio for human review and manual X posting.

## Operational limitations

- Before approval or absent Netlify configuration, the tab provides a **clear disabled/permission error**, not sample/fabricated articles.
- A free account limits article returns to 3 per request, so the feed is a coverage sample, not a comprehensive news monitor.
- Ranking is heuristic only. The API does not provide licensed real-time stock ticks or a validated explanation of why a share price moved.
- OpenAI API billing is separate from free Marketaux/RBI/SEBI discovery.
- Current SignalDesk site is not necessarily restricted to internal users and browser-local drafts are not a formal compliance archive; protect it before real company workflows.
- References: https://www.marketaux.com/documentation · https://www.marketaux.com/pricing · https://www.marketaux.com/tos
