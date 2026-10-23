# SignalDesk v0.1 — System architecture and editorial controls

## What fetches the news?
**Netlify Function `/.netlify/functions/news`** runs server-side when the manager opens or refreshes the app. It fetches:
1. **RBI official RSS** — primary regulatory / banking information.
2. **SEBI official RSS** — circulars, releases and market-regulation information.
3. **NewsAPI** — OPTIONAL news-discovery metadata from preselected established financial publishers, only with an eligible paid licence (`NEWSAPI_KEY`). NewsAPI is a provider/aggregator, not the author of the story or a copyright grant. Copyright and feed-use rights must be checked separately.

The news function normalises source name, publication timestamp, original article URL, title and excerpt; filters financial topics, scores likely relevance, clusters near-duplicate headlines, returns current/recent candidate stories, and reports failed sources. The manager sees **real source attribution**, publication time, source link and optional supporting publishers. The collected excerpts are not full article verification.

We deliberately do **not** auto-fetch Mint or Economic Times RSS into a commercial newsroom under personal-use feed terms, nor scrape paywalls. Reuters, Bloomberg and other paid outlets can be included via a separately licensed commercial news/data integration or pasted as a source URL for the manager to check manually.

## Draft engine
`/.netlify/functions/draft` sends ONLY the displayed headline/excerpt metadata to OpenAI (optional `OPENAI_API_KEY`). It requests two structured outputs:
- **News update:** what is supported by the metadata.
- **Investor insight:** cautious, general educational context supported by the metadata.

The prompt follows Geojit writing principles: trustworthy, knowledgeable, composed, clear, accessible, evidence-led; no hype, guaranteed returns, unsupported targets or new factual claims. Drafts include 1–2 relevant hashtags. Source attribution is added by the editor. The manager can edit text and inspect the original URL.

## Human workflow
Discover → Open source → Start draft → Generate/edit → Set legally approved SEBI disclosure prefix → Verify checkbox → Ready → Copy post → Publish manually in X → Paste actual X status URL → Published.

There is **no X API client, scheduled X publishing, auto-tweeting, autonomous approval, or approval hierarchy**.

Saved statuses: New (not selected), Draft, Ready, Published, Skipped. Published text is frozen when the manager records an X link. Source selection and browser data are scoped to the current IST editorial day and cleared on the next day (not a compliant communications archive).

## User access / hosting
- App lives on GitHub; Netlify hosts static frontend and two backend functions.
- `MANAGER_ACCESS_KEY` is checked on the backend for both functions. The manager types it each browser session. This is an MVP shared-secret gate, **not full identity management**.
- Protect the Netlify site via Private/Team Login or an equivalent organisational identity solution; do not rely on the access key alone. GitHub repo is currently public — keep secrets exclusively as protected Netlify environment variables.
- Use a private Netlify deployment rather than assuming a GitHub repository link means the application is hosted.

## Day-only storage
The initial release uses browser `localStorage` with an IST-day-specific key for curated sources, drafts, verification checkboxes, X links and statuses. This is fast for one manager on one device. Limitations: local clearing loses data, multiple devices do not sync, and it is **not a regulatory archive**. Upgrade later to Postgres or Netlify Blobs with versioning and retention rules. Preserve published-content records as required by Compliance, regardless of whether market-news history is wanted.

## Risks and recommended mitigations
| Risk | MVP mitigation | Production improvement |
|---|---|---|
| Insufficient breadth from official RSS | Manual source addition and optional licensed NewsAPI | Negotiate rights to Reuters/Bloomberg/Indian financial publisher feeds |
| Copyright/licensing | Metadata and links only; no full-article scraping | Rights review for each provider and AI transformation rights |
| Wrong figures, dates, partial excerpts | Source link, manual verification checkbox, restrained prompts | Independent numeric check against regulator/exchange/company filings |
| Old intraday news | Source timestamps and manager review | Market-session expiry/refresh rules and data reconciliation |
| Duplicate stories | Headline clustering with original-source preservation | Better entity/event clustering |
| SEBI social disclosure obligations | Manager configures approved registered-name/number prefix; Ready blocked if absent | Category-specific templates, compliance policy audits |
| Text too long for X | Local approximate 280-character check | X weighted-character validation using twitter-text |
| Manager's verification not truly verified | Explicit acknowledgement and evidence URL | Audit checks, editorial training and spot reviews |
| Secret leaked in public code | Backend environment secrets only | SSO, protected deployment, rate limiting and key rotation |
| Browser-only saved statuses | Current-day local persistence | Durable encrypted store and compliant retention |
| AI-hallucinated research opinions | No stock tips, no unsourced Geojit views in prompt | Approved Geojit Research integration with citation IDs |
| News feed outage | Per-source failure reporting, manual addition | Licensed-provider failover and monitoring |

## Geojit design reference
Figma: https://www.figma.com/design/hDmsIdye34FxtTFpcUOwHu/Geojit---Website-Design-System?node-id=0-1&m=dev

Checked Figma Colors: primary green #09877B, dark green #004C44, green text #032420, orange accent #FF7E4D. Key design text uses Manrope. CSS implementation maps core brand values; a complete component/token/accessibility audit remains for production.

## Acceptance checks before launch
- Manager cannot call server functions without correct access key.
- Verify RBI/SEBI RSS output from actual deployed Netlify region and check failures.
- Confirm licences before adding third-party publisher endpoints.
- Verify no stock price, date, or recommendation appears that the source does not support.
- Confirm the correct SEBI-registered name/number prefix for each intended posting capacity.
- Verify that edited Ready posts return to Draft and previously published text stays unchanged.
- Verify copy/Open X never sends a post programmatically.
- Confirm a real published X URL must be recorded manually.
- Test responsive layouts and readability; do not expose unpublished drafts publicly.
- Agree on minimum required records/retention with Geojit Compliance.

## Recommended next increment
1. Licence a financial news discovery feed covering Indian markets and macro news.
2. Configure Netlify Private access, manager key, OpenAI key and source provider.
3. Pilot 5–7 market days. Evaluate number of truly useful sources, time-to-ready, accuracy flags and editing frequency.
4. Only then add secure cross-device state/history and precise design-system component mapping.
