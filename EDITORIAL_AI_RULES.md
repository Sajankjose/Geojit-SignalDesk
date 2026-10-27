# SignalDesk AI editorial rules — standalone news and supported context

These guardrails apply to both RBI/SEBI feed stories and user-submitted news links/text in the shared `/.netlify/functions/draft` endpoint.

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
