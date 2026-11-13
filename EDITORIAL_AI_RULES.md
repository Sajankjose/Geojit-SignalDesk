# SignalDesk AI editorial rules — standalone news and supported context

These guardrails apply to both RBI/SEBI feed stories and user-submitted news links/text in the shared `/.netlify/functions/draft` endpoint.

## Geojit-owned editorial voice — all news sources
- **The post is Geojit's publication, not the provider's narration.** The source publisher is metadata for verification and required attribution, not the subject/author of a tweet. Never begin with "MarketsMojo's observation", "According to MarketsMojo", "A Marketaux report says" or equivalent publisher narration when the publisher is not itself the story.
- **Do not invent Geojit Research opinions.** Avoid "Geojit believes", "our analysts expect", investment recommendations, predictions and proprietary views unless a verified, authorised Geojit Research statement is explicitly supplied.
- **Factual, balanced, clear and approachable:** name the company, regulator, policy or development and report supported facts in ordinary language. Avoid hype, fear, exaggerated significance, unsupported claims of investor confidence, market impact or sentiment, and generic filler.
- **Avoid incomplete tweets.** AI should produce full sentences of up to 165 characters. The server accepts a complete sentence or substitutes a suitable neutral verified-headline draft; it never blindly slices a model response mid-word or mid-thought.
- **When insufficient support exists:** withhold "Why It Matters" and show the precise source facts needed. A draft is not a verified Geojit view.

**Example — avoid**
> MarketsMojo's observation of mixed trends in large-cap stocks indicates changing investor sentiment, which can help investors...

**Example — Geojit tone (only if the source facts establish it)**
> Large-cap stocks showed mixed performance across defensive and cyclical sectors.

**Attribution boundary:** The original source, publisher and URL remain in the Studio reference section. For MarketsMojo's current *internal demonstration only*, the source is kept out of the post preview so it cannot be mistaken for the author of Geojit's narrative. External publishing and copying remain disabled until licensing and attribution requirements are approved. Other official news flows continue to show normal source attribution. Source metadata must not be stripped from records.

Existing MarketsMojo POC drafts containing publisher-framed wording are reset for regeneration on first opening in the new version; the user is shown an explanatory note.

## News Update — WHAT happened?
- Starts with the named actor/event, such as "RBI has announced ..." or "SEBI has issued ...".
- States specific facts from the supplied headline/excerpt only; no speculation, investment advice, invented effects or predictions.
- Must make sense as a standalone X post without a preceding news headline.

## Why It Matters — WHAT distinct relevance is supported?
- Begins with the actor/event again, never an ambiguous "This development" or "The move".
- Offers grounded audience context or investor awareness if the supplied details actually support it.
- Does not force sector/stock-price/investor-confidence interpretations when only a headline is available.
- The model returns `contextStatus: needs_source` and an **empty insight** rather than an unsupported explanatory post if evidence is insufficient.
- The Studio warns "More evidence needed" so an editor can read the source and add verified context manually.

## What AI has actually read
The evidence strip states whether the input was headline-only, headline plus short RSS excerpt, or user-supplied news text. The model **does not fetch or independently verify the full article**. Its output remains a draft, not a fact-check or approval. Source links are kept for review.

## Additional checks
The server rejects or replaces particularly vague openings and sweeping ungrounded market-benefit phrases. This deterministic defence cannot detect all hallucinations: every claim, number, date and implication must still be checked by the manager. The final Ready check and manual publishing flow are unchanged.

## Security and deployment
OpenAI model calls remain server-side using `OPENAI_API_KEY` and `MANAGER_ACCESS_KEY` Netlify Functions variables. No automatic X posting. Drafts and history are still browser-local in the POC, not an immutable internal audit database; site-level visitor access remains an additional production requirement.
