# 3. Personal Success Analytics

## Two tiers of metric, by real implementation cost — stated honestly, not glossed over

Every metric below is derived only from real execution data (per the milestone's own constraint), but they are **not** all equally close to buildable. Tier A metrics are pure aggregation over a single existing live endpoint — no new backend module required, only aggregation logic (which could live client-side today, or in a small future analytics endpoint for efficiency at scale). Tier B metrics require *joining* data across modules (Applications × Companies × Jobs) that no existing endpoint does today — they need a dedicated future read-model, even though every field they'd join is itself real.

### Tier A — single-resource aggregation, buildable today

| Metric | Formula | Source |
|---|---|---|
| Delivery success | `count(status=DELIVERED) / count(status=SENT)` | `GET /applications/search?status=X`, 🟢 |
| Reply rate | `count(status=COMPANY_REPLIED or later) / count(status=DELIVERED or later)` | Same, 🟢 |
| Interview rate | `count(status=INTERVIEW_SCHEDULED or later) / count(status=DELIVERED or later)` | Same, 🟢 |
| Campaign completion rate | `count(CampaignStatus=COMPLETED) / count(all non-DRAFT campaigns)` | `GET /campaigns/search?status=X`, 🟢 |

All four are ratios over the real 15-state `ApplicationLifecycleStatus` and 10-state `CampaignStatus` enums (confirmed exact values in [M20 §1](../frontend-architecture/01-information-architecture.md)) — "or later" means any status that implies the earlier one already happened (e.g. `OFFER_RECEIVED` implies `DELIVERED` already occurred), since the lifecycle is a real, ordered state machine, not an independent flag set.

### Tier B — cross-module joins, need a dedicated future read-model

| Metric | What it needs | Why it's not Tier A |
|---|---|---|
| Regional success | Application outcomes grouped by the target company's `CompanyLocation.city`/`.federalState` (real fields, confirmed in [M19's schema work](../M19-VALIDATION-REPORT.md)) | No existing endpoint joins Applications to Company location — would require fetching every application's company individually, which doesn't scale, or a dedicated aggregation query |
| Industry success | Application outcomes grouped by `Company.industry` (real, live field) | Same join problem as above |
| Language-level performance | Application outcomes grouped by the target job's German/English level requirement (real `Job` fields) | Same join problem, across Applications × Jobs |
| Document effectiveness | Which CV/motivation-letter version was used per application, correlated with outcome | Needs two things that don't exist yet: (1) `application-assembly`'s `CvSelectionResult`/`CertificateSelectionResult` (🟡, real shape, no controller — [Product Experience §3](../product-experience/03-trust-architecture.md)) isn't persisted anywhere against the specific application it was used for, and (2) a join from that persisted record to the application's eventual outcome |
| Career growth trends | Any of the above, as a time series | Compounds the join problem with a real-date windowing requirement (§2's Historical Trends stage) |

### Application quality — deliberately not a single number

"Application quality" is not modeled as one score because the domain doesn't have one real field to source it from — instead, it's a composite the frontend renders as its real constituent facts: profile completeness at time of application (a real, derivable fact per [Product Experience §5](../product-experience/05-progress-psychology.md)), whether a CV was attached, whether the target job's requirements were met by the candidate's profile (a real comparison the frontend can make from two already-fetched resources: `ApplicationResponseDto`'s snapshot and `JobResponseDto`'s requirements). Never collapsed into a fabricated single "quality score" unless a future, explicitly-justified formula is designed and documented as its own ADR (§12) — a vague quality score with an undisclosed formula would violate [Principle 5, Explainability](01-career-intelligence-principles.md) on day one.

## Minimum sample size — the rule that applies to every metric above

No ratio is displayed with an implied precision the sample can't support. A reply rate computed from 2 applications is not "50%" in any meaningful sense — it's "1 of 2." Below a stated minimum sample (a real, documented threshold — not an arbitrary one hidden in code; see [§6](06-learning-confidence-framework.md) for how the threshold ties to confidence banding), the UI shows the raw counts ("1 reply from 2 applications sent") rather than a computed percentage, exactly matching [Product Experience Progress Psychology's](../product-experience/05-progress-psychology.md) "never invent a stage" discipline applied to statistics instead of funnel stages.

## What this section explicitly does not do

It does not propose a new `career-analytics` backend module's internal implementation (that's out of this milestone's scope — "do not implement algorithms"). It states which metrics are cheap aggregation, which need a real join layer, and the one hard rule (minimum sample size) that applies regardless of which tier a given metric falls into — the architectural facts a future implementer needs before writing a single query.
