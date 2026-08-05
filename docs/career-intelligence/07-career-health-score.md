# 7. Career Health Score

## Not one number — nine transparent dimensions, each independently explainable

A single composite "career health: 74/100" with no visible breakdown would be exactly the black-box behavior the milestone's Core Philosophy rules out. This model is nine separate, independently-scored dimensions, each with its own real evidence, each individually explainable, displayed together as a profile — never collapsed into one opaque aggregate unless a future ADR explicitly justifies a specific, disclosed weighting formula (and even then, the per-dimension breakdown stays visible alongside it, never replaced by it).

## The nine dimensions, grounded

| Dimension | Real evidence source | Status |
|---|---|---|
| **Profile Quality** | Profile completeness against required fields ([Product Experience §5](../product-experience/05-progress-psychology.md)) | 🟢 Computable today |
| **Campaign Health** | `CampaignHealth.healthScore` — a real, live, already-computed field (`GET /campaigns/:id/health`) | 🟢 Live today, per-campaign |
| **Application Quality** | Composite of real facts per [§3](03-personal-success-analytics.md) (CV attached, requirements met) | 🟢 Computable, composite not a single formula |
| **Interview Potential** | `CampaignIntelligence.interviewPrediction` — reserved | 🟡 Needs the reserved hook populated |
| **Execution Consistency** | Real campaign timeline data — gaps between active periods, pause frequency (`GET /campaigns/:id/timeline`) | 🟡 Needs new aggregation logic, real data exists |
| **Market Alignment** | Requires [Market Intelligence (§10)](10-market-intelligence.md) — explicitly external/optional | ⚪ Depends on §10, which is itself optional |
| **Language Readiness** | Profile `germanLevel`/`englishLevel` (real fields) compared against target market's job requirements | 🟢 Partial (profile side) / 🟡 (market-comparison side needs aggregation) |
| **Document Quality** | `application-assembly`'s `CvSelectionResult`/document explainability | 🟡 Dormant, no controller |
| **Career Momentum** | Recent-activity trend, per [§2's](02-career-knowledge-timeline.md) Historical Trends stage | 🟡 Needs real-date time-series aggregation |

Only two of nine (Profile Quality, Campaign Health) are meaningfully computable with zero new backend work — this is an honest reflection of how much of "Career Health" is genuinely new architecture versus how much already exists, and this table is exactly the kind of upfront clarity that prevents a future implementer from assuming more is ready than actually is.

## What every dimension's score must show — no exceptions

1. **Calculation logic** — the actual formula/method in plain language ("Campaign Health reflects your campaign's real health assessment, computed from risk signals and historical company outcomes" — not "a proprietary algorithm").
2. **Evidence** — the specific real data behind this instance of the score (which applications, which campaigns, which real fields).
3. **Improvement suggestions** — concrete, tied to a real, actionable next step (per [Product Experience's action-oriented copywriting rule](../product-experience/14-copywriting-guidelines.md)) — never a vague "improve your profile," always the specific missing piece.
4. **Confidence** — per [§6's](06-learning-confidence-framework.md) bands, since several dimensions (Interview Potential, Execution Consistency, Career Momentum) are only meaningful once real evidence has accumulated past a minimum threshold.

## A dimension with insufficient evidence is shown as "not yet available," never estimated

Directly enforces [Principle 9](01-career-intelligence-principles.md) at the score level: if a user has one campaign and zero completed executions, **Execution Consistency** and **Career Momentum** render as "not enough history yet to assess this" — never a default middling score (a fabricated "50/100" for lack of data is a lie dressed as neutrality; the honest state is explicitly "unknown," visually and textually distinct from a real, evidenced low score).

## Relationship to the reserved `CampaignIntelligence`/`AdaptiveSpeedProfile` hooks

Several dimensions (Interview Potential, parts of Execution Consistency and Market Alignment) are, structurally, exactly what `CampaignIntelligence`'s prediction fields already reserve space for. The Career Health Score is best understood architecturally as **a user-facing rollup of the same reserved intelligence hooks [§1](01-career-intelligence-principles.md) already identified**, not a parallel scoring system — a future implementer populating `CampaignIntelligence.interviewPrediction` for real is doing the majority of the work Interview Potential needs, not a separate task.
