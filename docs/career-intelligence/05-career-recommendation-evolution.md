# 5. Career Recommendation Evolution

## Two tiers of guidance, and the honest line between them

**Generic evidence-based guidance** — sourced from the platform's own general domain knowledge (documented defaults, the Recommendation Engine's existing strategy logic — `CampaignHealthRecommendationStrategy`, `CompanyHistoricalSuccessStrategy`, `RiskMitigationStrategy`, all real, 🟡 dormant, per [Product Experience §3](../product-experience/03-trust-architecture.md)) — applies to every user from day one, including one with zero campaign history. It is evidence-based in the sense that the *strategies themselves* are real, tested, deterministic logic — not personalized in the sense of being derived from *this user's own outcomes*, because none exist yet.

**Personalized guidance** — sourced from *this specific user's* accumulated real evidence (`CompanyMemoryEntry`, `CampaignIntelligence`, `AdaptiveSpeedProfile` — all real reserved structures, [§1](01-career-intelligence-principles.md)) — only becomes available once [the Career Knowledge Timeline (§2)](02-career-knowledge-timeline.md) has passed the relevant evidence threshold for that specific insight. Before that threshold, the honest state is still generic guidance — not a weaker or "starter" version of personalized guidance dressed up to look further along than it is.

## How a recommendation communicates a transition between tiers

The moment a recommendation shifts from generic to personalized (or a personalized one changes because new evidence arrived), it must answer all four of the milestone's required questions — this directly extends [Product Experience's Decision Explanation Framework](../product-experience/07-decision-explanation-framework.md) with one new, career-intelligence-specific dimension: *change over time*, not just a single decision's own reasoning.

```
[What changed]
Previously: [prior guidance, or "no personalized guidance yet"]
Now: [new guidance]

Why it changed:
[The specific historical evidence — e.g. "your last 4 applications sent
 in the afternoon had a 25% reply rate vs. 8% for morning sends"]

Expected benefit:
[Concrete, tied to a real metric from §3 — never a vague "this should help"]

Confidence:
[Per §6's banding — stated honestly, including if it's still Low]
```

## Worked example, across the timeline

**Stage: First Campaign** (§2) — "Campaigns with an execution window covering both mornings and afternoons tend to reach more companies during working hours." Generic, sourced from the platform's own domain knowledge (`AdaptiveSpeedProfile.companyWorkingHoursFactor`'s *concept*, not this user's own data) — no personal "why" because there isn't one yet, and the copy must not imply there is.

**Stage: Multiple Campaigns → Historical Trends** (§2) — enough real data exists to check whether *this user's own* sends show a timing pattern. If one holds up through the stability check (§4): "Your afternoon-sent applications have replied at a higher rate than your morning ones across your last 2 campaigns." Now personalized, now citing real evidence, now carrying a real confidence band.

**A later change**: a third campaign's data doesn't confirm the pattern — reply rates evened out. The recommendation updates: "We previously noted a difference between morning and afternoon sends — that pattern hasn't held up in your most recent campaign, so we're not weighting it as strongly now." This is Principle 3 (historical consistency) and Principle 4 (continuous improvement) made concrete: the platform doesn't silently drop the old claim or pretend it was never made — it explains the revision.

## Why this matters more than it might first appear

A system that only ever gets *more* confident over time, never revises downward, is a system quietly violating [Principle 9 (no simulated learning)](01-career-intelligence-principles.md) — real evidence sometimes contradicts earlier real evidence, and an honest learning system has to be able to say so. Designing the "why it changed" communication now, as a first-class part of this framework rather than an afterthought, is what prevents a future implementation from only ever building the "getting smarter" path and quietly never building the "this didn't hold up" path — which would make every confidence claim this system ever makes untrustworthy, since users would have no way to know if a stated pattern had ever been retracted.
