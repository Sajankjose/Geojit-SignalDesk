# SignalDesk notifications — opt-in desktop POC

## What is live in this version

**In-app bell:** Already supported and always available. The official RBI/SEBI feed is checked when SignalDesk loads and then approximately every five minutes while the page is visible. New, not-previously-seen stories enter the unread list; stories ranked 77+ show in the bell's high-priority list. The first load establishes a baseline rather than flagging every existing story as new.

**Desktop alerts (new):** Open the bell, click **Enable alerts**, and grant permission in your browser. This is an explicit user action; permission is never requested on page load. The control shows **Turn off** when enabled and includes a **Test** button that sends a harmless test notification to the operating system. Notification preferences and recently notified story IDs are stored in browser localStorage, not a server-side account.

Only **newly discovered, high-priority RBI/SEBI** updates published within the past **24 hours** trigger a desktop notification. Older releases and low-ranked updates stay in the in-app bell where applicable; they do not trigger OS notifications. Stories already seen at the first launch do not create a flood of alerts. If several fresh high-priority stories arrive together, a single summary notification is shown. Clicking a notification focuses SignalDesk and opens the in-app bell to review the original source.

The newsworthiness score is a **heuristic editorial ranking**, not a verified risk rating, stock advice or an emergency signal. No automatic X posting, article forwarding, manager key entry or OpenAI call is triggered by notifications.

## Browser and lifecycle limitations

- Supported on compatible **desktop browsers** over HTTPS when users grant site notification permission. OS Focus / Do Not Disturb settings may suppress popups even with site permission.
- The page **must remain open**. When an opt-in session is enabled, the existing five-minute checks are allowed to continue while the tab is hidden, subject to browser background timer throttling. Notification timings are approximate and may not be reliable under sleep, suspended tabs or energy-saving modes.
- **Closing the tab/browser stops monitoring.** There is **no service worker, web push subscription, background worker or central event queue** in this POC. Mobile browsers might not support the current desktop API.
- The RBI/SEBI feed is public and already queried by the app. Manually curated MarketsMojo POC stories are **not** auto-monitored or notified. PIB isn't included in browser alerts because its RSS metadata lacks reliable per-item publication dates.
- Browser notifications include the regulator name and public headline. Do not assume notifications represent a verified investment conclusion.
- If site permission was denied, enable notifications from the browser's site permission controls; SignalDesk cannot override an OS/browser denial.
- In-app bell and browser permission are separate. Disabling desktop alerts does not stop the normal feed or in-app unread indicator.

## Later production options

For alerts **when SignalDesk is closed**, implement an authorised server-side polling pipeline, shared audited notification queue, per-user identity/consent, a service worker and push subscriptions (or an approved internal email/Teams/WhatsApp alert channel). This should be separately designed, security reviewed, and scoped to licensed data sources. Do not imply that the browser-only POC already supports such background delivery.
