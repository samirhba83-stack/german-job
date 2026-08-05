# 12. Loading Experience

## The one absolute rule

**Never display fake progress.** Every indicator that implies something is happening must correspond to something that actually is. This document exists to make "waiting" feel calm and informative rather than anxious — and the single fastest way to destroy that is a progress bar or "working on it" message with nothing real behind it, which is a direct violation of [Trust Architecture](03-trust-architecture.md) applied to time instead of data.

## The four loading patterns, and when each applies

### Skeletons
**When**: any content-shaped fetch — a screen, a list, a detail view ([M20 §10](../frontend-architecture/10-ux-principles.md) already establishes this as the default). **Feel**: the layout is already visible, so the wait feels bounded and specific — the user knows roughly what's coming and how much of it. **Duration signal**: implicit — a skeleton that resolves in 200ms or 2s both feel acceptable because the shape itself sets the expectation.

### Progress indicators (determinate)
**When**: an operation with a real, known quantity — a file upload's byte progress (once [OQ-2](../frontend-architecture/13-risks-and-open-questions.md) is resolved), a multi-step wizard's step count. **Feel**: concrete, controllable — the user can see exactly how much is left. **Rule**: only ever bound to a real value (§11's Design System Component rule already states this structurally — reused here as an experience rule, not just a component contract).

### Background preparation
**When**: an action that's been submitted and is being processed server-side without the user watching a determinate value (e.g. a campaign transitioning through its lifecycle guard checks). **Feel**: a brief, honest "processing" state, kept short by design (these are fast domain operations, not long-running jobs) — if it's ever taking long enough to need a message beyond a brief inline spinner, that's itself a signal something about the operation needs investigating, not a cue to add a fancier loading animation to disguise the wait.

### Live execution updates
**When**: exactly the one narrow case [M20 §6](../frontend-architecture/06-api-consumption-architecture.md) already carves out — polling `GET /campaigns/:id/execution-status` while a campaign is `RUNNING`, because that endpoint reflects real, live Campaign-aggregate state. **Feel**: this is the closest the product gets to "the platform is actively working" made visible in real time, and it earns that feeling honestly because the data is real. **Explicit boundary**: this pattern must never be generalized to the deeper execution pipeline (recommendations → decision → planning → orchestration → runtime → worker) while those remain 🟡 dormant with nothing driving them — a "live" indicator for that pipeline today would be the single clearest fake-progress violation available in this whole product, and M20's own repeated warnings (§2 step 7, §6) exist specifically to prevent it.

## Estimated duration

Only ever shown when backed by real historical data (e.g. "similar campaigns typically start seeing replies within 5–10 days," once enough real campaign history exists to support that statistic) — never a guessed or arbitrary estimate. Until real historical data exists to support an estimate, the honest choice is no estimate at all, not a plausible-sounding invented one. This is the loading-experience application of [Transparency Principles §4](04-transparency-principles.md)'s "incomplete information" rule.

## Meaningful status messages

A loading state's accompanying text (where one exists at all — most skeleton states need none) should say what's actually happening, at the level of specificity the backend can actually support: "Loading your campaigns" is honest and sufficient; "Analyzing thousands of data points to find your perfect match" is the kind of inflated, unverifiable claim [AI Communication Style §8](08-ai-communication-style.md) already rules out — the same discipline applies to a loading message as to a recommendation's headline.

## How loading feels across the emotional journey's Waiting stage

This document's biggest stakes are at [§2's Waiting stage](02-emotional-journey.md) — the point where "loading" isn't a two-second spinner but a multi-day real-world wait for a company reply. The loading-experience answer there isn't a spinner at all — it's [Progress Psychology's](05-progress-psychology.md) funnel narrative, doing the emotional work a literal loading indicator can't do for a wait measured in days rather than seconds. Recognizing which kind of "waiting" a given screen represents — seconds-scale (use a skeleton/spinner) vs. days-scale (use a progress narrative, never a perpetual spinner) — is itself a design decision every future screen must make deliberately, not default into.
