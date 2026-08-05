# 4. Transparency Principles

These are the enforceable rules behind [Trust Architecture](03-trust-architecture.md) — where that document explains *why* trust matters and what mechanisms build it, this document is the specific, checkable rule set implementers apply to every screen.

## What should always be visible

- **Current status of anything the user committed to** — a campaign's real `CampaignStatus`, an application's real `ApplicationLifecycleStatus` (both 🟢, per [M20 §3](../frontend-architecture/03-screen-inventory.md)), always shown, never summarized away behind a vaguer label ("in progress" is not an acceptable substitute for the real, specific status).
- **The reasoning behind any recommendation or decision, adjacent to the recommendation itself** — not gated behind a separate click-to-expand that most users won't take (a collapsed-by-default "why" is a soft form of hiding).
- **Every action the platform is about to take on the user's behalf, before it's irreversible** — Campaign Creation's preview (§2), any lifecycle action's confirmation (M20 §10).
- **What data the platform has and hasn't been given** — profile completeness (§5), stated plainly against what's actually missing, never a vague percentage with no breakdown.
- **Known limitations of the current build** — see "How limitations should be communicated," below.

## What should never be hidden

- **A rejected alternative** — if a `DecisionReport` considered and rejected a company/action, that rejection and its reason are as visible as the accepted one, not buried. Hiding the "no" makes every "yes" look less earned.
- **A failure**, of any kind — a provider being unavailable, a validation error, a network failure. Silence about a failure is the single fastest trust-destroying pattern this platform could adopt (see [11-error-experience.md](11-error-experience.md)).
- **The fact that a feature isn't connected yet** — Mission Control, Trust Center, Notifications (all 🟡/⚪ per M20). A feature that's visually present but silently non-functional is a hidden limitation; the rule is to *name* it, not remove it (M20 ADR-008) and not disguise it as "loading."
- **Which role is required for an action** — if a button is hidden because the current user's role doesn't permit it, that's a UX courtesy (M20 §8's own "hidden ≠ secured" framing), but the *reason* a permission boundary exists should never be a mystery if the user asks ("why can't I do this?" always has a stated answer).

## How uncertainty should be communicated

Uncertainty is a real, quantified thing in this system (`confidenceScore`, 0–1) — it should be communicated as a *range or number*, not laundered into false certainty or false doubt:

- **High confidence** (e.g. ≥0.75): stated plainly as a recommendation, with the score still visible but not the headline.
- **Moderate confidence** (roughly 0.4–0.75): stated as a suggestion with visible hedging language ("this may be a good fit, though the signal is mixed") — the score is now part of the headline, not just supporting detail.
- **Low confidence** (<0.4, or `finalRecommendation: null` — a real, valid "no clear recommendation" outcome the domain model explicitly supports): stated as "we don't have a strong recommendation here" — never forced into a confident-sounding suggestion just to avoid an empty state. A null recommendation is not a bug to paper over; it's the system being honest that the evidence didn't clear its own bar.

Never convert a numeric confidence into vague, non-committal language that obscures the actual number ("we think this could maybe work" when the real score is 0.82 undersells real confidence; the same vague phrasing when the real score is 0.3 oversells it). State the number, or a direct, calibrated translation of it — never a phrase disconnected from the underlying value.

## How limitations should be communicated

A fixed, three-part pattern, used everywhere a 🟡/⚪ surface appears (Mission Control, Trust Center, Notifications, Billing beyond its one live endpoint):

1. **What this would do** (the real product intent — Mission Control's cross-campaign visibility, stated plainly).
2. **That it isn't connected yet** (plain statement, no jargon like "🟡 dormant module" — that's this document set's internal vocabulary, never user-facing copy).
3. **What *is* available right now instead**, if anything (e.g. Campaign Detail's real, live execution-status tab, as a partial substitute for full Mission Control).

Never phrase a limitation as an apology-heavy dead end ("Sorry, this isn't ready") — phrase it as a status fact with a redirect toward what *does* work, matching the platform's calm, non-anxious personality (§1).

## How AI confidence should be displayed

Directly reuses the uncertainty rules above — "AI confidence" in this product is not a separate concept from `DecisionReport.confidenceScore`/`Recommendation.expectedImpactScore`; it's the same data. Display rule: a visible numeric or clearly-banded indicator (not just a color, per accessibility requirements already set in [M20 §10](../frontend-architecture/10-ux-principles.md)) attached to every AI-originated claim, always paired with the underlying reasoning (§3), never shown as an isolated score with no explanation nearby.

## How incomplete information should be presented honestly

- **A profile field left blank**: stated as "not provided" (fact), never inferred or defaulted silently in a way the user wouldn't notice (e.g. never silently assume a salary expectation or availability status that wasn't actually given).
- **A recommendation made with partial context** (e.g. `CandidateProfileSnapshot` is null because no profile exists yet — a real, handled case in the recommendation engine's own context-building) — if a recommendation is ever shown despite partial context, that partiality is disclosed as part of the "why," not silently absorbed into a normal-looking recommendation.
- **A metric derived from a small sample** (e.g. "reply time" data early in a campaign's life, before enough data exists to be meaningful) — never state a statistic that isn't actually well-supported yet; either withhold it or explicitly caveat its sample size, per §5's "meaningful, not manufactured" progress rule.

## The single unifying test

Before shipping any copy or state: *if the user could see the actual backend data behind this screen right now, would this screen's claim match it exactly?* If the honest answer is "no, this is closer than that" or "this implies more than we know," the copy needs to change, not the standard.
