# Official Feeds POC — ₹0 news API cost

This is a **read-only, public-official-metadata demonstration**, separate from the manager-only editorial workspace.

## What it does
- Shows up to 100 recent RSS headlines from RBI Press Releases, RBI Notifications, RBI Speeches and SEBI. It shows original link, publisher, publication time in IST, topic, editorial priority and source connection status.
- Users can filter by RBI/SEBI, search and view 24 hours/7 days/30 days. The default is seven days; the server retains only up to thirty days of source metadata per refresh.
- Manual drafting sandbox lets a presenter build/edit a draft from a **headline only** and original link, with a checked-source confirmation before copying. This does not use OpenAI.
- Backend fetches the four fixed official RSS URLs using a Netlify Function, with 10-minute memory caching and transparent failures. Nothing fabricated if feeds are inaccessible.
- No consumer news sites scraped, no paid news API, no MarketsMojo content, no X API integration or autopublishing.

## Deployment
1. Review and merge `official-feeds-poc` after its automated tests pass, or explicitly select it as the Netlify deploy branch.
2. Trigger a Netlify deploy and open `https://geojitsignaldesk.netlify.app/official-poc.html`.
3. This **demo feed requires no `MANAGER_ACCESS_KEY`**. The separate main `/` editorial app still does require that key to access drafts/manager storage; the read-only demo will work without any manager/AI secrets.
4. If site is meant for internal users only, enable Netlify site-wide password protection separately. The demo page intentionally contains *public official news metadata*, but the overall website is **not automatically private**.
5. If RBI/SEBI is unavailable from Netlify's server region, check the source connectivity panel and Netlify function logs. Do not fill with made-up story data. The regulator may rate-limit or change its XML formats.

## Rights & follow-up
RBI/SEBI provide the official RSS entry point. We only read metadata and link back, for proof-of-concept use; confirm the applicable terms and Geojit compliance requirements before public distribution.
Geojit's MarketsMojo partnership is confirmed in Geojit's Flip user manual, but reuse inside a new tool or on X is **not yet granted/verified**. Request permission / approved internal API feed and data scope through partnership and legal teams.
For a real editorial production workflow, deploy the `production-readiness` manager implementation with `MANAGER_ACCESS_KEY`, OpenAI credential, persistent workspace and access control. This demo does not replace those protections.

## Source documentation
- RBI RSS: https://www.rbi.org.in/Scripts/rss.aspx
- SEBI RSS: https://www.sebi.gov.in/rss.html
- MarketsMojo use terms: https://www.marketsmojo.com/mojo/termsofuse
- Geojit MarketsMojo integration: https://usermanuals.geojit.com/flip-mobile/discover/ideas/mojo
