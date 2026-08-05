# 4. Pattern Detection Blueprint

## A pattern is a claim, and claims need evidence — same rule as everywhere else in this project

"Cities generating higher interview rates" is a statistical claim about a *correlation*. This document defines the discipline that must sit between raw data and any such claim being shown to a user, because pattern detection is the single easiest place in this whole milestone to accidentally violate the "no fabricated analytics" constraint — a pattern computed from too little data isn't a smaller, humbler version of a real pattern, it's noise wearing a pattern's clothes.

## The nine requested pattern categories, and their real backend anchor

| Pattern | Real anchor | Reserved computation target |
|---|---|---|
| Cities generating higher interview rates | `CompanyLocation.city` × `ApplicationLifecycleStatus` outcomes ([§3](03-personal-success-analytics.md) Tier B) | New read-model (not reserved anywhere specific yet) |
| Industries producing more replies | `Company.industry` × outcomes | Same |
| Companies with better response behavior | Per-company `CompanyMemoryEntry.historicalSuccessScore`/`.interviewCount`/`.offerCount` — **already has a reserved home** | `CompanyMemoryEntry`, once its writer exists ([§9](09-recommendation-memory.md)) |
| Campaign timing effectiveness | `AdaptiveSpeedProfile.timeOfDayFactor`/`.weekdayFactor`/`.germanHolidayFactor` — **already reserved** | `AdaptiveSpeedProfile` |
| Batch size effectiveness | `CampaignIntelligence.bestBatchSize` — **already reserved** | `CampaignIntelligence` |
| Execution window effectiveness | `AdaptiveSpeedProfile.companyWorkingHoursFactor`/`.timeOfDayFactor` — **already reserved** | `AdaptiveSpeedProfile` |
| CV performance | `CvSelectionResult` outcomes, once persisted per-application ([§3](03-personal-success-analytics.md) Document effectiveness gap) | `CampaignIntelligence.bestResumeSelection` — **already reserved** |
| Motivation letter performance | Same as above, for `CertificateSelectionResult`/motivation-letter selection | `CampaignIntelligence.bestMotivationLetterSelection` — **already reserved** |

Five of the eight land directly on fields that already exist in the domain model, unpopulated, waiting for a real writer. This changes the nature of the work from "design a new subsystem" to "design the evidence discipline that governs when it's honest to write to the subsystem that already exists" — which is exactly this document's scope.

## Pattern confidence and pattern stability — the two gates every pattern must pass

**Confidence** (how much evidence supports this specific pattern) and **stability** (has the pattern held up as more evidence arrived, or did it flip) are two different, both-required properties. A pattern can have decent confidence from a reasonable sample and still be unstable (it looked real at 10 data points, reversed at 20) — both gates exist because either failure mode alone produces a false pattern.

### Minimum evidence thresholds (illustrative structure, not tuned production constants)

A pattern is not shown at all below a **minimum sample size** per group being compared (e.g. comparing two cities requires a real minimum count of applications *in each city*, not just in total — an imbalanced sample, like 50 applications in one city and 2 in another, cannot honestly support "city A outperforms city B," only "we don't have enough data on city B yet"). A pattern is shown as **low confidence** between the minimum and a higher threshold, and only reaches **moderate/high confidence** ([§6](06-learning-confidence-framework.md)) above that — the exact numeric thresholds are a tuning decision for implementation, not something this architecture document fabricates a specific number for; what's fixed here is that thresholds must exist, be applied uniformly, and never be silently bypassed for a pattern the platform "really wants" to show.

### Stability check

A pattern is re-evaluated every time new evidence arrives (Principle 4, continuous improvement). If a recomputation flips the pattern's direction or drops its confidence band, the platform does not keep showing the old, now-contradicted version — it updates immediately, and (per Principle 3, historical consistency) the old version remains inspectable as "what we said before, and why it changed" rather than silently vanishing. See [§5](05-career-recommendation-evolution.md) for exactly how a changed pattern gets communicated to the user.

## What this blueprint explicitly forbids

- **Cross-user pattern leakage presented as personal insight.** If a future version of this system ever aggregates patterns across multiple users (e.g. "candidates targeting Berlin see X% more replies platform-wide"), that must be clearly labeled as a platform-wide observation, never blended into or presented as the individual user's own personal pattern — conflating the two would misrepresent whose evidence is behind the claim. (This distinction anticipates [§10 Market Intelligence](10-market-intelligence.md), which is the correct, explicitly-separated home for any cross-user observation — never absorbed into Personal Success Analytics.)
- **Pattern detection acting as a filter that hides options from the user.** A low-response-rate city is a fact to disclose, never a company/job the platform silently deprioritizes without telling the user why (Principle 6, human supervision, [§1](01-career-intelligence-principles.md); also [§11 Ethical Intelligence Rules](11-ethical-intelligence-rules.md)).
- **A pattern presented as causal when it's only correlational.** "Applications sent on Tuesdays got more replies in your history" is a legitimate, evidenced observation; "sending on Tuesday causes more replies" is a stronger claim the data can't support — copy must stay in the weaker, honest form (directly reuses [Product Experience Copywriting Guidelines'](../product-experience/14-copywriting-guidelines.md) "survive the question 'based on what?'" test).
