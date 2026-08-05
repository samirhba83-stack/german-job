# 9. Notification Strategy

## Grounding note — read this before the rest of the document

[M20](../frontend-architecture/01-information-architecture.md) is explicit: **no notification backend module exists at all** — not even dormant. Everything below is genuine forward-looking architecture, not a description of anything buildable end-to-end today. What *is* real is the underlying **events** many of these notifications would fire on — a `COMPANY_REPLIED` transition, an `INTERVIEW_SCHEDULED` transition, and (once wired) an `ExecutionEvent` — because those are real, live, or dormant-but-real domain transitions already. The gap is entirely the delivery mechanism (a notification module subscribing to those events, storing them, pushing them) — see [M20 §13](../frontend-architecture/13-risks-and-open-questions.md) OQ-3. This document specifies the *strategy* so that when that module exists, the frontend and copy work is already done — it does not specify anything the frontend should build a simulated version of in the meantime (M20's explicit warning against client-side-polling-as-fake-notifications applies with full force here).

## Categories

| Category | Priority | Timing | Tone | Channel | Dismiss behavior |
|---|---|---|---|---|---|
| **Information** | Low | Batched, non-intrusive (daily digest or on next visit, never interrupts) | Neutral, brief | In-app panel only | Auto-read on view, no confirmation needed |
| **Success** | Medium | Immediate, at the moment the real transition happens | Calm confirmation (§8) | In-app panel + toast (transient) | Toast auto-dismisses after a few seconds; panel entry persists until read |
| **Warning** | Medium-High | Immediate | Calm, specific about the risk, no alarm styling for non-urgent cases | In-app panel + toast | Requires explicit dismissal (not auto-timed) if it names something the user should act on |
| **Action Required** | High | Immediate, and re-surfaced if unresolved after a reasonable interval | Direct, states exactly what's needed | In-app panel + toast + (future) email if unresolved past a threshold | Persists until the underlying condition is actually resolved — cannot be dismissed into a false "handled" state |
| **Interview** | Highest (personal-stakes category) | Immediate | Warmer register, per §2's Interview stage — still professional | In-app panel + toast + (future) email — this category justifies out-of-band delivery given its stakes | Persists until acknowledged; never auto-dismissed |
| **Campaign** | Medium | Immediate for state changes (paused, completed, stopped); batched for routine progress updates | Calm, factual (§5's progress framing) | In-app panel only for routine; toast for a `STOPPED`/`CANCELLED` transition specifically | Routine updates auto-read; terminal-state notices require dismissal |
| **Subscription** | Medium-High as expiry approaches, otherwise Low | Advance warning before `currentPeriodEnd`, not same-day only | Calm, no false urgency (§14) — a real date is more motivating than manufactured pressure | In-app panel + (future) email | Persists until subscription action taken or explicitly dismissed |
| **System** | Low, unless describing a real outage | Immediate for genuine incidents; otherwise none | Plain, factual | In-app banner (system-wide, not per-user panel) for outages only | Dismissible once the underlying condition (per `GET /health` or equivalent) clears |

## Design rules that apply across every category

1. **A notification exists only because a real event occurred.** No category above is ever populated by a client-side guess, poll-based diff, or simulated trigger — this is the direct notification-layer application of [Transparency Principles §4](04-transparency-principles.md).
2. **Priority governs interruption, not just visual weight.** Low/Medium categories never use a modal or a blocking UI; only genuine Action Required / Interview-category events justify interrupting an in-progress task, and even then, as a dismissible toast, never a forced modal (see [10-ux-principles.md in M20](../frontend-architecture/10-ux-principles.md) — "never interrupt without value," reused directly here as §15 will also state).
3. **Every notification links directly to the relevant screen** — a Campaign notification opens Campaign Detail, an Interview notification opens the specific Application Detail — never a generic notification-center landing with no deep link (consistent with [M20 §9](../frontend-architecture/09-navigation-architecture.md)'s deep-linking requirement).
4. **Dismissed ≠ resolved**, and the UI must never conflate them. Dismissing an Action-Required notification hides it from the panel; it does not change the underlying condition, and the notification's dismiss action must never be phrased in a way that implies otherwise ("Got it" is fine; "Resolved" is not, unless it actually is).
5. **No notification exists purely to drive a return visit.** Every category's timing rule above is anchored to a real event or a real, approaching real-world deadline (`currentPeriodEnd`) — never a re-engagement nudge with no underlying trigger (directly enforces [Motivation System §6](06-motivation-system.md)'s anti-manipulation stance).

## What this means for implementation sequencing

Build the in-app notification panel's UI shell now (per [M20's reserved Notification Center](../frontend-architecture/03-screen-inventory.md)), populated from nothing, honestly empty (§10). Build the category/priority/tone/channel logic in this document as the specification a future notification module's frontend consumer will follow — but the actual triggering requires the backend module described in M20 OQ-3, which is out of scope for both this milestone and M20.
