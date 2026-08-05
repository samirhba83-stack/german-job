# 9. Recommendation Memory

## The one genuine gap this whole blueprint has to name plainly

Every other section in this document set found a real, reserved home for its concept somewhere in the existing domain model. This one doesn't, fully. `CompanyMemoryEntry` tracks real *outcomes* per company (`interviewCount`, `offerCount`, `historicalSuccessScore`) — but nothing today tracks whether a specific `Recommendation` (identified by its own real `id`, per [Product Experience §3](../product-experience/03-trust-architecture.md)) was ever shown to a user, and if so, whether they acted on it. **This is a real, currently-nonexistent capability**, not a reserved-but-dormant one like `CampaignIntelligence` — stated honestly here rather than implied to already have a home.

## What it would need — architecture, not implementation

A new concept, `RecommendationOutcome` (illustrative name), linking:
- The specific `Recommendation.id` (or `DecisionReport.id`) that was shown,
- Whether the user acted on it (a real, observable fact — e.g. did the campaign's subsequent configuration match the recommendation, or did the next real batch's timing match the suggested window),
- The real outcome that followed (via the same Application/Campaign lifecycle data every other section already uses).

This is naturally scoped as an extension of the `decision-intelligence`/`recommendations` modules (both 🟡, already the correct architectural home per [M20's information architecture](../frontend-architecture/01-information-architecture.md)) — not a new bounded context, since it's fundamentally about the *outcome* of a decision already made in those modules, not a new domain concern.

## The six requested memory categories, and how each would be derived

| Category | Requires | Derivation |
|---|---|---|
| Previously accepted advice | `RecommendationOutcome.acted = true` | A record where the user's subsequent real behavior matched the recommendation |
| Previously ignored advice | `RecommendationOutcome.acted = false` | A record where it didn't, observed after a reasonable window has passed |
| Previously successful strategies | Accepted advice + a real positive outcome afterward | Joins `RecommendationOutcome` to the real Application/Campaign outcome that followed |
| Previously unsuccessful strategies | Accepted advice + a real negative/neutral outcome afterward | Same join, opposite result |
| Repeated mistakes | The same *category* of ignored advice or unsuccessful strategy recurring across multiple campaigns | Requires enough `RecommendationOutcome` history to compare across campaigns — same minimum-evidence discipline as [§4](04-pattern-detection-blueprint.md) |
| Repeated strengths | The same *category* of successful strategy recurring | Same |

## How this would influence future guidance, honestly bounded

If a user has previously ignored a specific class of recommendation twice, a future recommendation of that same class should say so plainly rather than repeating the identical pitch a third time as if for the first time — "We've suggested adjusting your execution window before; if the timing isn't the issue, here's another angle worth trying" respects the user's own prior choice ([Product Experience Principle 6, human supervision](../product-experience/01-product-personality.md)) rather than nagging. This is explicitly **not** license to stop surfacing a recommendation the evidence still supports — ignored advice that remains evidenced stays available, just reframed with its history acknowledged, never silently withdrawn (withdrawing it would itself be a form of the platform making a decision on the user's behalf that [§11 Ethical Intelligence Rules](11-ethical-intelligence-rules.md) reserves for the user).

## Why this section is placed after, not before, Recommendation Evolution and Confidence

Recommendation Memory only makes evidentiary sense once [§5's](05-career-recommendation-evolution.md) tiered-guidance model and [§6's](06-learning-confidence-framework.md) confidence bands exist — "was this advice successful" presupposes the advice itself was given with a real, inspectable rationale and confidence level at the time, which those two sections define. Building `RecommendationOutcome` before those exist would have nothing coherent to attach memory *to*.
