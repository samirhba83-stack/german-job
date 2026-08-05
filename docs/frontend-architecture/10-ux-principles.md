# 10. UX Principles

Product-wide rules — every screen in [03-screen-inventory.md](03-screen-inventory.md) is built to these, not to a per-screen judgment call. Where a principle exists specifically *because* of something this platform's backend does or doesn't do, that's stated explicitly rather than presented as generic UX wisdom.

## 1. Loading consistency

Content-shaped data loads as a skeleton matching its eventual layout (never a centered spinner for a list, table, or detail page — those get skeleton rows/cards/sections). Spinners are reserved for two narrow cases: an inline button mid-action (05, Button `loading` state) and a genuinely-unknown-duration operation with no shape to skeleton. One skeleton system, reused everywhere, not reinvented per screen.

## 2. Error consistency

Every error surfaces from the same normalized shape (`ApiError`, §6), and every screen renders errors through the same small set of patterns: **field-level** (a Form's per-field message, sourced from the backend's `message: string[]` validation-error case), **action-level** (a toast or inline message next to the button that triggered a failed mutation), and **page-level** (a full failed-fetch state with retry, for a screen whose primary data failed to load). A screen never invents a fourth pattern. Error copy states what happened and, where the backend provides it, why — it never says "please contact support" for something the user can self-resolve (a validation error), and it never fabricates a cause the backend didn't actually report (e.g. never guess "network issue" when the response was a real 4xx).

**Backend-specific error honesty**: because `AllExceptionsFilter` masks all non-`HttpException` errors to a generic "Internal server error" (M19 report §5.3, confirmed), the frontend cannot distinguish "a bug" from "an infrastructure hiccup" from a 500 response alone — so a 500's UI copy must stay generic ("something went wrong on our end, try again") rather than guessing at a specific cause the response doesn't actually contain.

## 3. Empty screens

Every empty state is written for the *specific reason* the screen is empty, per the repeated pattern established in 03: "no campaigns yet" (true zero-state, first run) is different copy and a different primary action from "no campaigns match your filters" (filtered zero-state) is different again from "no health assessment recorded yet" (a legitimately-null field, not a failure). A generic "No data" label anywhere in the product is a defect, not a shortcut.

## 4. Confirmation dialogs

Reserved for actions that are either **destructive** (see below) or **hard to undo through normal means** even if not permanently destructive (e.g. `campaign/:id/cancel` — reversible in principle via a new campaign, but not via undo). Never used for routine, safe, or already-confirming-by-nature actions (saving a form is not confirmed twice; navigating away from a clean form is not confirmed at all).

## 5. Destructive actions

A strict, small set: Application `withdraw`, Application `reject`, Campaign `cancel`, Company/Job `archive`. Each requires the `destructive` Button variant (05) and a confirmation Dialog stating specifically what will happen (not a generic "are you sure?") — e.g. Campaign cancel's dialog states that a `reasonCode`/`reasonNote` is required (the backend enforces this — `RequiredCampaignReasonDto`) and surfaces that requirement as part of the confirmation step, not as a separate validation error after the fact.

## 6. Undo behavior

**None exists, and the UI must not imply it does.** No endpoint in the platform supports reversing a committed transition — an `Application.withdraw` or `Campaign.cancel` is a real, terminal(-ish) domain transition, not a soft-delete with an undo window. Where a near-equivalent exists (Company `archive`/`restore` is the one real exception — both endpoints exist, so "archive" *can* be undone via a distinct, explicit Restore action), that's presented as two separate actions, never as a toast-with-an-undo-button pattern that implies a single reversible operation. Don't build toast-undo affordances anywhere else in the product; there's nothing behind them.

## 7. Search behavior

Every search screen (Company Explorer, Job Listings, Campaign List, Application List) debounces input (target: 300ms) before firing the `search` query, uses the URL as the source of truth for the active query (07/09), and the filter set offered is drawn directly from the real backend `search` DTO for that resource (06) — never a filter the backend can't actually apply.

## 8. Filtering behavior

Active filters render as removable chips, filters compose with AND semantics (matching how every `search` endpoint's params are ANDed together server-side, not an assumption — confirmed by reading each `SearchXQuery`'s handler pattern of narrowing a query, not unioning), and clearing all filters is always a single, obvious action distinct from clearing the search keyword alone.

## 9. Accessibility

WCAG 2.1 AA as the floor, not an aspiration: every color pairing meets contrast minimums (verified against the token system in [11-design-system-foundation.md](11-design-system-foundation.md), not checked ad hoc per screen), every interactive element has a visible focus state, every image/icon-only control has alt text or an `aria-label`, every form error is programmatically associated with its field (05).

## 10. Keyboard navigation

Every action reachable by mouse is reachable by keyboard: tab order follows visual order, Dialogs trap focus and return it on close (05), Data Tables support arrow-key row navigation where feasible, and no interactive element is implemented as a non-focusable `div`/`span` with a click handler anywhere in the product — this is a hard rule, not a nice-to-have, enforced at the component-primitive level (05) so individual screens can't violate it by construction.

## 11. Responsive behavior

Mobile-first breakpoints (see [11-design-system-foundation.md](11-design-system-foundation.md) for the exact scale). The Sidebar collapses to an off-canvas Drawer below the tablet breakpoint (04); Data Tables that don't fit narrow viewports degrade to a stacked-card layout per row rather than horizontal-scrolling a table (horizontal scroll is reserved for genuinely wide tabular data like a dense timeline, not the primary pattern); every touch target meets a 44×44px minimum regardless of the desktop-density visual design.

## 12. Honesty about backend state (platform-specific principle)

This entire document set is threaded with 🟢/🟡/⚪ distinctions for a reason that becomes a UX rule in its own right: **the UI never implies backend capability that doesn't exist.** No fake "live" indicators for a pipeline nothing is driving (§2, §4), no simulated real-time notifications polling for a feature that doesn't exist (§3, §7), no undo affordance for an irreversible transition (principle 6, above), no client-only permission check presented as a security boundary (§8). This isn't a style preference — it's the same discipline the M19 backend validation applied to its own reporting (see [../M19-VALIDATION-REPORT.md](../M19-VALIDATION-REPORT.md), "How to read this report"), carried into the product surface: showing the user something that isn't true is a worse failure mode than showing them an honest "not available yet."
