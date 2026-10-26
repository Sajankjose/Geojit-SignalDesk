# Free Official Feeds POC — live Geojit SignalDesk

## Public-source demo experience
- **Home** `/`: RBI + SEBI official news discovery dashboard. Does not require OpenAI, NewsAPI, Netlify Blobs or a manager key.
- **Alias** `/official-poc.html`: same source-backed demo.
- **Manager studio** `/editorial.html`: the existing editorial tool, which still requires server-side `MANAGER_ACCESS_KEY` and later production hardening.
- **Official RSS** `/.netlify/functions/official-feed`: four curated RBI/SEBI RSS inputs, original-source URLs, up to 30-day published range, 10-minute cache, health diagnostics and no fabricated fallback items.
- **Manual draft** in demo: editable source title with original URL, human-check confirmation and copy. No AI auto-writing or X API actions.

## Deployment
Site is linked to GitHub `main` unless manually changed in Netlify. Merge this PR into `main` only after approval. If continuous deployment is enabled, Netlify should automatically rebuild and publish `/`. The site may already be publicly accessible, so **do not put any internal, licensed or client data in demo routes**. For internal-only access, separately enable site-level visitor protection.
This code uses fixed government RSS URLs and no API tokens. If upstream feeds are unreachable or blocked, the source status panel shows their failure. Live RBI/SEBI reachability must be checked on Netlify.

## Product scope
The demo verifies a free official-source news pipeline; it is **not** a complete six-posts-per-day equity news service. MarketsMojo is not ingested because the existing partnership's rights for this use case and APIs have not yet been confirmed. Respect RBI/SEBI publication terms and keep original-source attribution.
