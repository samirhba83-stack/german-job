# 1. Career Intelligence Principles

## The foundational discovery this milestone is built on

Before stating the principles, one fact has to be established, because it changes what kind of document this is: **the domain model already reserves the exact extension points this milestone is asked to design an architecture for.** This isn't a coincidence — it's the product-vision decision recorded from the project's own history: modules were deliberately built with "reserved-but-unimplemented extension points... rather than leaving no seam for them at all." Direct inspection of `apps/api/src/modules/campaigns/domain/entities/campaign.entity.ts` confirms it, under a section literally headed `// Reserved intelligence hooks`:

- **`CampaignIntelligence`** (value object, `campaigns/domain/value-objects/campaign-intelligence.vo.ts`) — nullable `bestSendTime`, `bestBatchSize`, `bestCompanyOrder`, `bestResumeSelection`, `bestMotivationLetterSelection`, and five `Probability` (0–1) predictions (`replyPrediction`, `interviewPrediction`, `offerPrediction`, `contractPrediction`, `riskPrediction`), plus `decisionExplanation`/`recommendationExplanation` strings and a required `computedBy` field. Its own doc comment: *"Reserved architecture only — every field is nullable and nothing in this codebase computes them."*
- **`AdaptiveSpeedProfile`** — ten named, nullable factor slots (`replyRateFactor`, `bounceRateFactor`, `timeOfDayFactor`, `weekdayFactor`, `germanHolidayFactor`, `companyWorkingHoursFactor`, `campaignHealthFactor`, `companyFatigueFactor`, `userReputationFactor`, `riskScoreFactor`) — same "reserved, nothing reads these" status.
- **`CompanyMemoryEntry`** — per-company memory attached to every `Campaign`: `alreadyApplied` (real, actively written), `interviewCount`, `offerCount`, `historicalSuccessScore` (`Probability | null`), and a field literally named **`futureAiNotes: string | null`**.

This document set's job is therefore not "invent a career-intelligence architecture from nothing" — it's **"specify exactly how these already-reserved fields get populated honestly, from real execution data, and how the rest of the platform consumes them once they are."** Every section below is written against this ground truth.

## The permanent principles

### 1. Learning from outcomes
Every insight originates from a real, recorded outcome — an `ApplicationLifecycleStatus` transition, a `CampaignHealth` assessment, a `CompanyMemoryEntry` update — never from a hypothesis about what probably works. If no outcome has been recorded yet, there is nothing to learn yet, and the architecture must say so (§6).

### 2. Evidence before advice
No recommendation ships without the evidence that produced it visible alongside it — the exact discipline already established for the Recommendation Engine (`Recommendation.explanation`/`.reasonCode`) and Decision Intelligence (`DecisionReport.supportingEvidence`/`.conflicts`) in [Product Experience §3](../product-experience/03-trust-architecture.md) and [§7](../product-experience/07-decision-explanation-framework.md). Career Intelligence extends that same discipline to a longer time horizon (patterns across campaigns, not one decision), not a different one.

### 3. Historical consistency
A pattern or score, once computed, doesn't silently change its own past explanation when recomputed — a later recomputation with more evidence produces a *new*, dated assessment (`computedAt`, already a field on both reserved VOs above), not a retroactive rewrite of what was said before. Users can trust that "why we said X last month" stays answerable even after the platform has learned more since.

### 4. Continuous improvement
Every new real outcome is a chance to refine, never to discard, prior evidence — `CompanyMemoryEntry.recordInteraction()` already models this correctly (an update, not a replacement) and every future intelligence computation must follow the same accumulate-don't-overwrite shape.

### 5. Explainability
Every score, pattern, or recommendation states its calculation logic and evidence in terms a user can verify against their own history — never a bare number with no derivation. `CampaignIntelligence.decisionExplanation`/`.recommendationExplanation` are the exact reserved slots for this; any future writer of this VO that leaves them null has failed this principle.

### 6. Human supervision
Career Intelligence informs; it never acts autonomously on the user's account. Every insight terminates in a suggestion the user chooses to act on, never a triggered side effect (directly consistent with [Product Experience UX-DR-004](../product-experience/16-ux-decision-records.md)'s rejection of the platform acting as an autonomous "I").

### 7. Transparent confidence
Every insight carries a confidence level derived from real evidence volume (§6) — never omitted, never inflated to sound more authoritative than the underlying sample supports.

### 8. Long-term optimization
Career Intelligence exists to make the user's *next* campaign more effective than their *last* one, using their own real history as the primary evidence — not to maximize any platform engagement metric. This is [Product Experience Motivation System's](../product-experience/06-motivation-system.md) anti-manipulation stance, applied to the intelligence layer specifically: the metric this system optimizes for is verifiable career outcomes, never time-on-platform.

### 9. No simulated learning
If a computation would require data that doesn't exist yet (a pattern needing 20 campaigns when the user has 2), the architecture does not approximate, interpolate, or borrow from other users to fill the gap silently — it says the pattern isn't established yet (§4, §6). This is the single most load-bearing principle in this entire milestone, restated in nearly every section that follows.

### 10. Reserved architecture stays reserved until genuinely populated
A `CampaignIntelligence`/`AdaptiveSpeedProfile` field that's still `null` is not "broken" or "loading" — it's an honest, correct state meaning "not computed yet," and every consuming surface (§7's Career Health Score, §8's dashboard) must render that state per [Product Experience's Transparency Principles](../product-experience/04-transparency-principles.md), never paper over it with an invented value.
