# 8. Personal Growth Dashboard

## Learning, not statistics — the framing that governs every widget below

A statistics dashboard shows "47 applications, 12% reply rate." A growth dashboard shows "your reply rate improved from 8% to 12% since you started sending in the afternoon — here's what to try next." Same underlying numbers, different framing: every widget here answers "what does this mean for what I do next," never just "what happened." This is [Product Experience's Progress Psychology](../product-experience/05-progress-psychology.md) and [Motivation System](../product-experience/06-motivation-system.md) applied specifically to the longer, cross-campaign time horizon this milestone adds — this dashboard is architecturally a sibling of [M20's Dashboard Home](../frontend-architecture/04-dashboard-architecture.md), not a replacement for it, and follows the same independent-fetch-boundary-per-widget rule.

## Widgets

| Widget | Shows | Real source | Status |
|---|---|---|---|
| **Career Progress** | The [§2 Knowledge Timeline](02-career-knowledge-timeline.md) stage the user has reached, and what's next | Derived from real evidence counts | 🟢/🟡 mixed |
| **Historical Performance** | [§3's](03-personal-success-analytics.md) Tier A metrics, across all campaigns | `GET /applications/search` aggregation | 🟢 |
| **Recent Improvements** | A real, dated comparison — this window vs. the last (per [§2's](02-career-knowledge-timeline.md) Historical Trends stage) | Same, windowed | 🟡 (needs the windowing) |
| **Emerging Opportunities** | Low/Moderate-confidence patterns not yet actionable but worth watching ([§4](04-pattern-detection-blueprint.md), [§6](06-learning-confidence-framework.md)) | Pattern detection | 🟡/⚪ |
| **Strengths** | The dimensions of [§7's Career Health Score](07-career-health-score.md) that are evidenced and high | Career Health Score | 🟡 (depends on §7) |
| **Weaknesses** | The dimensions that are evidenced and low — framed as opportunities, never as judgment (see tone note below) | Career Health Score | 🟡 |
| **Long-term Trends** | Multi-window time series, real dates only | Historical aggregation | 🟡 |
| **Recommended Next Actions** | [§5's](05-career-recommendation-evolution.md) current-tier guidance, ranked by expected benefit | Recommendation Evolution | 🟡 |

## The tone rule for "Weaknesses" specifically

This is the one widget most likely to be built wrong if this document doesn't say so explicitly: a "weakness" in this system is never phrased as a judgment of the user — it's a phrased as a gap between current state and better-evidenced outcomes, with a concrete next step attached. "Your interview rate for roles requiring German B2+ has been lower than your other applications" is the honest, useful form; "You're weak in B2-level roles" is not — same underlying fact, and the difference is entirely in whether it respects [Product Experience's Product Personality](../product-experience/01-product-personality.md) (respectful, reassuring) or violates it. Every "Weakness" widget entry pairs directly with a "Recommended Next Actions" entry — a weakness is never shown standalone without its corresponding actionable response, per [Product Experience Principle: "explain every important action"](../product-experience/15-experience-principles.md) extended here to "never surface a gap without a path forward."

## Why this dashboard is described as "future" even though M20/M20.5's Dashboard exists today

[M20's Dashboard Home](../frontend-architecture/04-dashboard-architecture.md) is real and buildable today (campaign summaries, recent activity, quick actions — all 🟢). This Personal Growth Dashboard is a **distinct, additional** surface, not a redesign of that one — it's reserved for once enough of §3–§7's underlying evidence exists to make "growth," not just "current state," a meaningful thing to show. Building it prematurely (before real historical trends exist to show) would produce exactly the empty, unconvincing dashboard the milestone's Core Philosophy warns against — see [§2's](02-career-knowledge-timeline.md) Multiple Campaigns/Historical Trends stages for the evidence threshold this dashboard's *existence as a populated, meaningful screen* depends on, distinct from M20's dashboard which is meaningful from day one.
