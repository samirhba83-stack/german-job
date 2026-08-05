# 16. UX Decision Records

Same format as [M20's ADRs](../frontend-architecture/12-architecture-decision-records.md): Context, Decision, Consequences, Alternatives Considered. These record *experience/product* judgment calls, distinct from M20's *technical* ones — a UX-DR never contradicts a structural decision already made in M20; where the two touch the same surface (e.g. loading states, ADR-007's pessimistic mutations), each document owns its own layer of the decision.

---

### UX-DR-001: No gamification mechanics (streaks, points, badges, levels)

**Context**: [Motivation System](06-motivation-system.md) needed a way to encourage continued engagement without resorting to the standard consumer-app playbook.

**Decision**: explicitly reject streaks, points, levels, and badges as a category, everywhere in the product, permanently — not just for this milestone's initial scope.

**Consequences**: less short-term engagement lift than a gamified alternative would likely produce; a more durable trust relationship, consistent with a platform whose entire value proposition depends on being trusted with something as consequential as someone's career. Also removes an entire category of future feature requests ("can we add a leaderboard?") from consideration by default, rather than leaving the door open.

**Alternatives considered**: a lightweight streak counter tied only to "campaign activity" (rejected — even a soft version punishes the legitimate, expected silence of the Waiting stage, §2); achievement badges tied to real milestones (rejected as redundant with, and less honest than, the real Achievement History mechanism, §6, which already shows real accomplishments without needing a badge abstraction layered on top).

---

### UX-DR-002: AI confidence is always shown as a real number or calibrated band, never omitted or vague-washed

**Context**: `confidenceScore`/`expectedImpactScore` are real 0–1 values in the backend domain model. The easy default would be to hide the number (simpler UI) or convert it to purely qualitative language (softer-feeling copy).

**Decision**: always surface the real value, in a numeric or clearly-banded form, next to any AI-originated claim.

**Consequences**: more visual/copy complexity per recommendation than a simpler "we recommend this" treatment. In exchange, no AI claim in the product can ever be accused of overstating itself, because the actual number is always right there to check against the words around it — see [§4](04-transparency-principles.md).

**Alternatives considered**: qualitative-only bands with no visible number ("High confidence") — rejected as strictly worse for verifiability while barely simpler to build; hiding confidence entirely below a threshold — rejected because a low-confidence recommendation that's shown at all should show its low confidence, not hide the number while still making the suggestion.

---

### UX-DR-003: Dormant and future features are visible, honestly labeled, never hidden entirely

**Context**: mirrors [M20's ADR-008](../frontend-architecture/12-architecture-decision-records.md) at the technical layer; this UX-DR records the experience-philosophy reasoning specifically, since it's a different justification even though it lands on the same technical outcome.

**Decision**: Mission Control, Trust Center, and Notifications are visible in navigation and render an honest "not connected yet" state, rather than being removed from the product surface until backend-ready.

**Consequences**: the product communicates its own roadmap transparently, which is itself a trust-building act (§3) distinct from the purely technical "additive, not a redesign" rationale M20 gives. Risk: an honest "not yet" state that's allowed to go stale (looking outdated, or drifting into implying more than "not yet") actively undermines the trust it's meant to build — this decision requires the "not connected yet" copy to be actively maintained, not set once and forgotten.

**Alternatives considered**: fully hiding unbuilt areas (rejected — loses the transparency benefit, and contradicts M20's explicit instruction to design these areas now); a "coming soon" waitlist-style teaser (rejected as marketing-flavored in a way that doesn't match this product's professional, non-hype personality, §1).

---

### UX-DR-004: No anthropomorphized "I," no named AI persona/mascot

**Context**: many AI-forward products give their assistant a name and first-person voice ("Ava thinks you'd like...").

**Decision**: the platform never speaks in first-person singular, has no named persona, no avatar/mascot. Communication is attributed to "the platform," "we," or stated as a direct fact with no speaker at all.

**Consequences**: a slightly less "friendly-feeling" surface than a named-assistant competitor might have. In exchange, the platform never overstates its own nature (a named "I" implies a kind of continuity and agency this system doesn't actually have — it's a set of deterministic strategies and a decision-aggregation engine, not a persistent conversational agent) — directly serves the "never exaggerate AI capabilities" rule (§14).

**Alternatives considered**: a named advisor persona with a consistent voice — rejected specifically because "professional career advisor" as a *register* (§1, §8) doesn't require a fictional identity, and a fictional identity is one more thing that could eventually overstate the system's actual nature.

---

### UX-DR-005: A retry is never offered for a failure the platform already knows is deterministic

**Context**: `NullEmailProvider` is confirmed (M19) to always report itself unavailable. The default error-UI pattern (show a retry button on any failure) would be actively misleading here.

**Decision**: category-aware retry logic in [Error Experience](11-error-experience.md) — provider-unavailable failures get no retry affordance; only genuinely-possibly-transient failures (network, unmasked 5xx) do.

**Consequences**: requires the frontend to distinguish failure *causes*, not just failure *presence* — more implementation nuance than a single generic error-with-retry component. In exchange, the platform never asks the user to do something pointless, which [§3](03-trust-architecture.md) identifies as a real, if small, trust cost every time it happens.

**Alternatives considered**: a universal retry button on every error (rejected — the simplicity isn't worth the dishonesty of implying a fix might come from trying again when it deterministically won't).

---

### UX-DR-006: The full Notification Strategy is specified now, despite zero backend support

**Context**: unlike Mission Control (real backend, no controller), Notifications has **no backend module at all**, dormant or otherwise (M20 §1.10). Fully speccing category/priority/tone/channel/dismiss for something with zero backend existence is a bigger bet on unbuilt ground than any other section of this document set makes.

**Decision**: specify it fully anyway, as the milestone requested, explicitly labeled as forward architecture rather than near-term buildable scope.

**Consequences**: risk that backend priorities never build the notification module this document assumes, making this the single largest "wasted design" risk in the whole blueprint (see [M20's R-1](../frontend-architecture/13-risks-and-open-questions.md) for the parallel risk on Mission Control, less acute there since that backend already exists). Benefit: if/when a notification module is built, the frontend and copy work is entirely done, and — more importantly — the *category taxonomy itself* (which events deserve which priority/tone) is a real design decision worth having made deliberately rather than ad hoc whenever that module eventually gets scoped.

**Alternatives considered**: deferring this section entirely until backend work exists (rejected — the milestone explicitly requested it, and the taxonomy work has value independent of implementation timing).

---

### UX-DR-007: Celebration intensity scales with real-world significance, capped at "warm professional," never above it

**Context**: [Delight Moments](13-delight-moments.md) needed a ceiling — even a signed contract, the biggest moment in the product, needs a defined maximum intensity so implementers don't escalate it into something childish under the banner of "this is the big one, go all out."

**Decision**: a fixed, single-notch-above-baseline maximum register for even the largest celebration (contract received) — never confetti, sound, or game-like flourish, regardless of how significant the underlying event is.

**Consequences**: some users might subjectively want a bigger, more visceral celebration for a life event this size — a real, acknowledged tradeoff, made deliberately in favor of consistency with the platform's professional personality (§1) over maximizing the celebratory moment in isolation.

**Alternatives considered**: an explicit "bigger" visual treatment reserved only for contract-received (confetti, a dedicated full-screen moment) — rejected as inconsistent with a platform that has spent every other document in this set arguing against exactly that kind of manufactured spectacle.

---

### UX-DR-008: Empty states are never served from one shared generic component/copy string

**Context**: the fastest empty-state implementation is one component with a configurable icon and a single "No data" string. [Empty State Philosophy](10-empty-state-philosophy.md) requires cause-specific copy (zero-state vs. filtered vs. legitimately-null vs. not-yet-built) for every instance.

**Decision**: every empty state gets purpose-written copy following the Why/Next/Matters template — no shared generic fallback string ships to production, even as a temporary placeholder (a "TODO: better empty state copy" is exactly the kind of thing the engineering charter this project has followed since M1 already prohibits leaving behind).

**Consequences**: more copywriting surface area than a generic-component shortcut — every new screen with a list/detail view needs its empty state written, not just its loading/error states. In exchange, no screen in the product ever tells the user "No data" and leaves them to guess why or what to do about it.

**Alternatives considered**: a generic component with per-screen prop overrides that default to something generic if unset (rejected — defaults that are "acceptable but not great" tend to ship permanently in practice; making the copy a required, not optional, input is the stronger guarantee).
