# Milestone 20.6 — Career Intelligence Blueprint (Adaptive Career Intelligence Architecture)

**Date**: 2026-07-25
**Scope**: architecture only — how the platform would transform real execution history into explainable career guidance. No algorithms implemented, no machine learning, no frontend code, no backend logic changed. [Milestone 20](../frontend-architecture/README.md) and [Milestone 20.5](../product-experience/README.md) are unmodified; this document set extends them.

## How this document set relates to what came before

M20 defined structure. M20.5 defined tone, trust, and emotion. This defines **what the platform would actually know, and how it would know it honestly** — the evidentiary layer underneath the trust mechanisms M20.5 already specified. Where M20.5's [Trust Architecture](../product-experience/03-trust-architecture.md) said "every recommendation must be explainable," this document set specifies exactly what evidence would make that true over a multi-campaign time horizon, not just a single decision.

## Deliverable map

| Requested deliverable | Where it lives |
|---|---|
| Executive Summary | This document, below |
| Career Intelligence Principles | [01-career-intelligence-principles.md](01-career-intelligence-principles.md) |
| Analytics Blueprint | [03-personal-success-analytics.md](03-personal-success-analytics.md) |
| Pattern Detection Blueprint | [04-pattern-detection-blueprint.md](04-pattern-detection-blueprint.md) |
| Career Health Blueprint | [07-career-health-score.md](07-career-health-score.md) |
| Recommendation Evolution | [05-career-recommendation-evolution.md](05-career-recommendation-evolution.md) |
| Learning Confidence Framework | [06-learning-confidence-framework.md](06-learning-confidence-framework.md) |
| Market Intelligence Architecture | [10-market-intelligence.md](10-market-intelligence.md) |
| Career Growth Architecture | [02-career-knowledge-timeline.md](02-career-knowledge-timeline.md) + [08-personal-growth-dashboard.md](08-personal-growth-dashboard.md) |
| Architecture Decision Records | [12-architecture-decision-records.md](12-architecture-decision-records.md) |
| Future Expansion Opportunities | [13-risks-and-future-extensibility.md](13-risks-and-future-extensibility.md) |
| Risks and mitigation strategies | [13-risks-and-future-extensibility.md](13-risks-and-future-extensibility.md) |
| Readiness assessment (for Milestone 21) | [13-risks-and-future-extensibility.md](13-risks-and-future-extensibility.md), summarized below |

Plus two documents the milestone's own 11-section body required beyond the summary list: [09-recommendation-memory.md](09-recommendation-memory.md) and [11-ethical-intelligence-rules.md](11-ethical-intelligence-rules.md).

---

## Executive Summary

The single most important finding in this milestone is not a new design — it's a discovery in the existing codebase. Direct inspection of `campaigns/domain/entities/campaign.entity.ts` found a section literally headed `// Reserved intelligence hooks`, containing `CampaignIntelligence` (nullable predictions for reply/interview/offer/contract/risk, best send time, best batch size, best document selections, all paired with explanation fields), `AdaptiveSpeedProfile` (ten named factor slots for timing/health/fatigue/risk), and `CompanyMemoryEntry` (per-company interview/offer counts and a historical success score) — every field nullable, every one explicitly documented as *"reserved architecture only... nothing in this codebase computes them."* This confirms, precisely and in code, what the project's own product-vision memory already stated: the platform was deliberately built with extension points for exactly this milestone's purpose, left unpopulated on purpose rather than left out entirely.

This changes what kind of document set this is. Rather than proposing a new subsystem from nothing, [§1](01-career-intelligence-principles.md) through [§10](10-market-intelligence.md) specify, field by field, how those existing reserved structures would be honestly populated from real execution data — real `ApplicationLifecycleStatus` transitions, real `CampaignHealth` scores, real company location/industry data — under a strict evidence discipline: nothing is shown as a rate, pattern, or prediction below a real minimum sample size ([§3](03-personal-success-analytics.md), [§4](04-pattern-detection-blueprint.md)); every confidence claim is mechanically derived from sample size and stability, never manually set ([§6](06-learning-confidence-framework.md)); every score is a transparent, independently-evidenced dimension, never an opaque composite ([§7](07-career-health-score.md)); and five explicit rules ([§11](11-ethical-intelligence-rules.md)) — never invent, never hide uncertainty, never manipulate, never overstate confidence, never replace user decision-making — govern every section retroactively.

One genuine gap was found and named plainly rather than glossed over: nothing today tracks whether a specific recommendation was acted on or what followed ([§9](09-recommendation-memory.md), Recommendation Memory) — the one concept in this blueprint with no existing reserved home, scoped as a bounded extension of the existing `recommendations`/`decision-intelligence` modules rather than a new bounded context ([ADR-004](12-architecture-decision-records.md)).

## Readiness assessment (full version in §13)

**The platform is ready to begin Milestone 21 (Design System Implementation).** This milestone is a data/reasoning architecture with no dependency on visual design work, and nothing in M21's scope depends on any part of this blueprint being implemented first. This milestone's contribution to M21 is additive input, not a gate: a small set of newly-identified component needs (a confidence-band indicator, a multi-dimension health display, evidence-attached explanation blocks) to fold into [M20's Component Architecture](../frontend-architecture/05-component-architecture.md) inventory when that work is picked up — none of them require revisiting M20's token foundation itself. See [§13](13-risks-and-future-extensibility.md) for the complete reasoning, including which open questions (evidence thresholds, whether `RecommendationOutcome` gets built) remain deliberately unresolved because they're implementation decisions, not design-system ones.
