# Geojit SignalDesk
**Internal editorial cockpit for market news curation and Geojit-tone X drafts.** No automatic posting, X API, or multi-level approvals.

## Architecture
```
RBI / SEBI official RSS ─────┐
                            ├─> Netlify Function /news ─> normalize / score / deduplicate ─> manager's Today feed
Licensed NewsAPI (optional) ─┘                                                |
                                                                                v
Manager opens original source, verifies claims ─> /draft (OpenAI) ─> edits ─> Ready
                                                                    |
                                                      Copy text + open X manually
                                                                    |
                                                  Manager records published URL/status
```

**News fetching is performed by a Node.js Netlify Function, not OpenAI, the browser, or GitHub.** AI is only used to help compose from the feed's *limited evidence*. The manager must inspect the original source; neither an article snippet nor AI-generated prose is a fact check.

## Files
- `index.html`, `styles.css`, `app.js`: responsive editorial UI. Current-day statuses/drafts persist in this browser's `localStorage`; manager key lives in `sessionStorage`.
- `netlify/functions/news.mjs`: official RBI and SEBI RSS fetch, optional commercially licensed NewsAPI, editorial ranking, source links and deduplication.
- `netlify/functions/draft.mjs`: optional OpenAI Responses API structured drafting, simple Geojit tone and relevant hashtags.
- `netlify.toml`: deploy and routing.

## Netlify setup
1. Connect this GitHub repo to Netlify. Publish directory: `.`. Functions: `netlify/functions`. No build command required.
2. Set **`MANAGER_ACCESS_KEY`** (random long secret) in the Netlify server environment. Enter that key in the app on first load. Keep it OUT of git and share securely.
3. Set **`OPENAI_API_KEY`** to enable AI drafting. Optionally set `OPENAI_MODEL` (defaults to `gpt-4o-mini`).
4. Set **`NEWSAPI_KEY`** only if Geojit has a paid NewsAPI plan and separately confirms publication/use rights for relevant data. The free developer plan is NOT allowed in internal production use. Without it, the system uses official RBI/SEBI RSS only.
5. Restrict **site access** using Netlify Private/Team Login or equivalent; the in-app shared key is NOT a substitute for full identity/SSO. Only the social media manager should have access.
6. Have Compliance provide the exact **registered legal name + SEBI registration number** disclosure(s) appropriate to each content category. Configure the approved prefix in Settings before marking a securities-related post Ready.
7. Read each original source and check material figures, date, context, publication rights, copyright and regulatory compliance. No autonomous publishing.

## Production caveats
- Official RSS alone cannot cover all daily equity/earnings news; connect a licensed provider or manually add original source links.
- Publisher RSS feeds (e.g. Mint/ET) may disallow commercial use; they are deliberately not scraped here.
- RSS and NewsAPI only provide headlines/excerpts. The AI cannot infer a checked full story from these. Direct quotes, prices, performance and recommendations need confirmed primary evidence.
- `localStorage` is one-browser pilot state, not a database or compliance archive. Clearing site data or using another device loses edits/status. Before production, add authenticated server-side state and approved retention policies. Even without historic market data, financial communication records may need retention.
- The Geojit website Figma design system is used as a **visual reference**. Brand primary green (#09877B), deep green (#004C44), orange accent (#FF7E4D), and Manrope typography were checked against the Figma Colors page. Other component-level tokens remain an implementation reference pending full audit (no Figma changes).
- No connection is made to X. The manager copies the completed post, publishes in X separately, then records its URL.
- Test feed availability and vendor entitlements in your environment; individual sources can change or block server requests.

## Source/license reference
- RBI RSS: https://www.rbi.org.in/Scripts/rss.aspx
- SEBI RSS: https://www.sebi.gov.in/rss.html
- Mint RSS terms: https://www.livemint.com/rss
- ET RSS terms: https://economictimes.indiatimes.com/rss.cms
- NewsAPI terms: https://newsapi.org/terms

This is a functional MVP scaffold, not a licensed live newsroom deployment.
