# Discover ranking, alerts and hashtags (POC)

## Editorial ranking
The public RBI/SEBI RSS endpoint assigns a provisional **relevance score (10–95)** from release topic, date recency and whether the headline appears to be routine/procedural. High priority starts at **77**. Routine repo auctions and enforcement/recovery notices are deliberately downgraded even when new. The signal is explainable on each card; it is **not** fact-checking, an investment recommendation, market-impact prediction or a personalised feed.

Filters: Top stories (score-first), Latest (date-first), High priority (score >=77), and New (previously unseen items after an established visit); existing RBI/SEBI filters, date window and search still work.

## How alerts work
- On first successful fetch, the browser stores the current article IDs as a **baseline**; it does **not** notify about every already-present story.
- On later visits or refreshes, newly encountered stories published within the previous 7 days appear under New. If their editorial score is at least 77, the header bell displays a badge and links to them.
- The page checks again every 5 minutes **only while open and active**. Server-side RSS results may be cached for 10 minutes; an update can therefore take longer to appear. Clicking Source or Create post marks that story read.
- The alert panel has Mark all seen. Data is stored in that browser's localStorage only; it does not sync between devices.
- There are **no OS-level push notifications, email or WhatsApp alerts**, no background monitoring while closed, and no automatic X posts. The production version would need a secure, scheduled backend, deduplication and opt-in notification channels.

## Hashtag workflow
- The RSS service suggests at most two **topic-relevant** tags (e.g. `#MonetaryPolicy #RBI`, `#MutualFunds #SEBI`).
- Content Studio displays editable hashtags and optional suggestions, included **once** in the final preview and 280-character estimated length.
- Server-side AI variants now return hashtags separately from draft text; the editor can replace, delete or change them. Tags are never auto-posted.
- A user must still verify original claims, disclosures and appropriateness of the hashtags before marking the draft Ready.

## Deliberate limitations
No automatic claim that a story will move markets. RSS headlines/excerpts may be incomplete. Not all high-priority stories should become X posts. The main website is not automatically internal/private; Netlify visitor protection remains necessary. Drafts/alerts are browser-local and not a compliance archive.
