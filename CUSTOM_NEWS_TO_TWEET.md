# Create a tweet from a URL or pasted news

**In Discover**, click **✦ Create from news**. The feature opens inside the existing Geojit SignalDesk app and keeps the existing RBI/SEBI feed.

## Mode 1 — News link
Paste a public HTTPS article link. With the manager key connected, the backend tries to retrieve **only page-title and meta-description** from an explicit allowlist of public editorial/official websites (RBI, SEBI, PIB, NSE, BSE, Reuters, Business Standard, Mint, Moneycontrol, BusinessLine, Economic Times and CNBC-TV18). No full-page content or paywall bypass is sent to the AI model. Automatic previews fail gracefully for blocked, unsupported or PDF pages; users can expand the **paste headline yourself** field as a fallback. Sites outside the allowlist cannot be fetched from the server, but their URLs can still be cited alongside user-provided permitted text.

## Mode 2 — Paste news text
Paste a headline on the first line, followed by the relevant facts. Add the original HTTPS source URL when available. Pasted text can generate AI drafts without a link, but the **Ready** action is blocked until an original source URL has been added in Studio and a person checks it.

## What happens after submit
- **Generate tweet variants** calls the pre-existing Netlify/OpenAI drafting function (requires `MANAGER_ACCESS_KEY` and `OPENAI_API_KEY` server-side). Produces News update and Investor context, suggested hashtags and draft risks.
- **Continue without AI** saves a basic manual draft with the headline; it does not claim the draft is AI generated.
- Both routes open Content Studio with editable text, source evidence, hashtags and X-length estimate.
- A human must inspect the original, acknowledge the source, mark Ready and **manually** copy/publish to X. No automated social posting exists.
- Existing RBI/SEBI RSS ingestion and ranking are unchanged.
- Submitted text and drafts are stored **in localStorage in the same browser** as an MVP only. No shared, immutable compliance archive. No client confidential information should be pasted.
- The whole app is still publicly accessible unless Netlify Visitor access restriction is enabled.

## API billing
RBI/SEBI feed collection costs ₹0 in third-party news API subscriptions. OpenAI generation uses a separately billed platform API key, configured exclusively as a Netlify Function environment variable. Never paste the OpenAI API key into the webpage or repository.

## UX secondary accents
Use Geojit primary green on important actions and subtle soft apricot, lilac, pale blue and warm yellow on supporting controls and labels. These are POC supporting accents to be reviewed against the approved corporate design system before production.
