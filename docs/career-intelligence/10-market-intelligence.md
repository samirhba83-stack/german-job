# 10. Market Intelligence

## Explicitly the most optional section in this entire blueprint — by the milestone's own instruction

"The architecture must remain modular and optional. No external data assumptions." This section is written to that instruction precisely: it separates what could honestly be derived from data the platform **already has internally** (cross-user, but still first-party) from what would require **external data sources** the platform has no access to, no integration plan for, and — per the milestone's constraint against fabrication — must never simulate.

## Internal — derivable from the platform's own aggregate data, no external source needed

| Signal | Real basis | Note |
|---|---|---|
| **Company responsiveness** | Aggregate `CompanyMemoryEntry`/Application-outcome data **across all users** who've targeted a given company | This is the one Market Intelligence signal fully within reach architecturally — it's [§4's](04-pattern-detection-blueprint.md) "companies with better response behavior" pattern, generalized from one user's view to the platform's aggregate view. Must be presented as a platform-wide observation, explicitly separated from personal analytics ([§4's](04-pattern-detection-blueprint.md) own forbidding of blending the two) |

## External — genuinely out of reach without a new, explicit data-sourcing decision

| Signal | Why it needs an external source |
|---|---|
| Regional demand trends | Requires labor-market data (job posting volume, hiring rates by region) this platform doesn't collect — its own job data reflects only what's posted *on this platform*, not the German labor market broadly |
| Industry hiring trends | Same — platform-internal job postings are not a representative sample of an entire industry's hiring activity |
| Language demand | Same — would need broader labor-market signal, not just this platform's own job listings |
| Skill demand | Same |
| Competition intensity | Requires knowing how many *other candidates* are targeting the same roles/companies — this platform has no visibility into other candidates' campaigns from any single user's perspective, and exposing it would also be a real privacy concern (see below) |

## Why "modular and optional" is the correct architecture, not a hedge

Each external signal above, if ever sourced (a future integration with a labor-market data provider, an explicit product decision — not assumed or planned by this milestone), should plug into this system as an **independent, clearly-attributed input**, never blended into personal analytics or the Career Health Score without a visible "sourced from [X], as of [date]" attribution. This modularity is what makes it safe to build the *internal* signal (Company responsiveness) now, fully compatible with Clean Architecture's port/adapter pattern the rest of this platform already uses (a `MarketIntelligencePort` with the internal aggregate as one implementation and any future external provider as another, never coupling personal analytics code directly to an external vendor's data shape) — without that decision creating pressure to fabricate the external signals in the meantime just to fill out the section.

## The competition-intensity privacy note

Even if this platform later gains visibility into aggregate demand for a given role/company (e.g. "N candidates on this platform have applied here recently"), that number must never reveal or imply any specific other user's identity or individual campaign details — an aggregate count is acceptable within normal platform-analytics privacy norms; anything more granular is not, and this architecture explicitly flags that boundary now rather than leaving it for an implementer to discover under time pressure later.

## What ships from this section today

Nothing computes yet — this is architecture only, per the milestone's constraints. What's fixed is the **shape**: one real, internal, buildable-eventually signal (Company responsiveness), clearly separated from five genuinely external signals that require an explicit future sourcing decision this milestone does not make.
