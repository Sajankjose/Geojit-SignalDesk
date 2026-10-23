# SignalDesk — Production deployment runbook

**Status:** Release candidate; not published as a live site. The social media manager is the only operational user. No automatic X publishing. Do not connect an X API key.

## 1. Deployment in Netlify
1. Protect the GitHub repository by changing **Sajankjose/Geojit-SignalDesk** from public to private (Settings → General → Danger Zone → Change repository visibility), subject to existing collaborators' access requirements.
2. In Netlify, create a new project from **GitHub** → select the repository and `main` branch after production changes have been reviewed/merged.
3. Build command: **none**; publish directory: **.**; functions directory: **netlify/functions** (defined in `netlify.toml`). Root `package.json` installs the Netlify Blobs dependency.
4. Under **Project configuration → General → Visitor access → Password Protection**, choose *All deploys* and enable **Team Login** or equivalent restricted access. A shared site password is a weaker fallback; private identity-based access is preferred.
5. In Netlify environment variables for Functions:
   - `MANAGER_ACCESS_KEY`: 24+ random characters, kept out of GitHub/chat.
   - `OPENAI_API_KEY`: required for the AI drafting service.
   - `OPENAI_MODEL`: optionally set model suitable for your account; default is `gpt-4o-mini`.
   - `NEWSAPI_KEY`: OPTIONAL, only with an eligible paid business licence and rights for editorial metadata use; without it there are official RBI / SEBI / PIB feeds and manual entry.
6. Redeploy after environment variables are set. Log in to the restricted site and enter the manager key. Then open **Settings** and enter Compliance-approved legal registered-name and SEBI number prefix. This prefix is required before marking a post Ready.
7. Test the live connected news endpoint and AI-generated drafts in the restricted deployment. Review the full original source before publishing the text manually via X.

## 2. Architecture
- `/.netlify/functions/news`: authenticated source feed aggregation, scoring and deduplication.
- `/.netlify/functions/draft`: authenticated OpenAI rewriter, structured news/insight drafts and relevant hashtags. It only receives headline/excerpt metadata, not a verified full article.
- `/.netlify/functions/workspace`: authenticated current-IST-day workspace. Server-side Netlify Blobs is the source of truth; local browser storage is a fallback cache.
- Data namespaces differ for `production`, `deploy-preview` and branch contexts. This prevents preview code from overwriting the live workspace.
- Historical market feed data is not shown. Existing saved workspace records from earlier days are not automatically deleted, pending an approved financial-communication retention policy.

## 3. Required live acceptance test
- [ ] Site requires internal login on desktop AND mobile; unauthenticated users cannot see newsroom content.
- [ ] Manager key is at least 24 random characters and enforced by Functions.
- [ ] News source cards show real publisher, original URL, timestamp in IST and sensible relevance.
- [ ] Check source failure indicators; actual RSS endpoints can change or be blocked in certain server regions.
- [ ] Verify licensed-provider policy and actual result availability (official feeds alone will not consistently produce 6 useful equity updates).
- [ ] Press "Generate" for several verified source stories; no invented numbers, prices, recommendations or attribution.
- [ ] Hashtags are relevant and limited; X's weighted character count can differ from raw browser length, especially for links.
- [ ] Enter approved disclosure prefix; ensure final composed post fits X and is reviewed by the manager.
- [ ] Mark Ready, refresh and sign in on another authorised device; same-day status and edits should survive.
- [ ] Copy → Open X (manual) → publish yourself → record the *actual X status link*; verify persisted Published and locked text.
- [ ] Source modification or disclosure change resets Ready to Draft.
- [ ] Confirm no X API credentials, scheduled tweets, automated posting or multi-level approval.
- [ ] Test public access restrictions, secret exposure, browser refresh, offline notice, mobile view and Netlify Function logs.
- [ ] Define retention policy, access logging, incident response and annual compliance review before relying on it for regulated communication.

## 4. Known controls / restrictions
1. A key typed into the app is a pilot second gate, not SSO. Site-level access protection is mandatory.
2. A single-manager Blob document uses last-write-wins semantics; avoid concurrent editing across devices. Later switch to a transactional store if required.
3. This version's workspace is not a tamper-proof communications audit archive; Geojit must retain final X posts and evidence externally in accordance with its own compliance policy.
4. "Ready" means a human has checked the original. The AI's language is not verification.
5. Reuters, Bloomberg, Mint and other publishers need licensed integration and permitted use. No bypass of paywalls or automated scraping.
6. Some feeds (especially SEBI orders) may be irrelevant to ordinary retail investors. Editorial screening matters.
7. No live deployment link should be shared until site access is restricted and the smoke tests pass.

## 5. Rollback
Netlify supports reverting to a previous deploy. If a defect affects source integrity, stop content preparation until the publisher links and drafts have been checked. Roll back the deployed code through Netlify. Netlify Blobs is not automatically rolled back with a code deploy; take a protected export of operational records if needed.

## 6. Next increment after the pilot
- A licensed market news feed with Indian equity, corporate earnings, markets and global cues coverage.
- Better primary-evidence checks and time-based expiry for intraday price-sensitive news.
- Geojit Research as an approved source with explicit publication rights.
- SSO and compliant immutable event/audit storage.
- Fully reconciled Figma design tokens/components and automated X weighted-character validation.
