# 6. Learning Confidence Framework

## Confidence is a function of evidence, not a feeling

Every insight this system ever produces — a Tier B analytic ([§3](03-personal-success-analytics.md)), a pattern ([§4](04-pattern-detection-blueprint.md)), a `CampaignIntelligence` prediction ([§1](01-career-intelligence-principles.md)) — carries a confidence level derived mechanically from two real inputs: **sample size** (how much evidence exists) and **stability** (has it held up as more evidence arrived, per [§4](04-pattern-detection-blueprint.md)). This directly extends the confidence discipline [Product Experience §4](../product-experience/04-transparency-principles.md) already established for `DecisionReport.confidenceScore` — the same honesty rule, applied over a longer evidence horizon (accumulated history) instead of one decision's immediate inputs.

## The four bands

| Band | What it requires | What it's allowed to claim |
|---|---|---|
| **Low** | Evidence exists but is below the pattern-detection minimum ([§4](04-pattern-detection-blueprint.md)) | An observation, explicitly hedged ("early signal, not yet established") — never framed as advice to act on |
| **Moderate** | Above minimum, but not yet stability-checked across multiple recomputations | A suggestion, hedged ("this may be worth considering") |
| **High** | Above minimum, stability-checked at least once with no reversal | A recommendation, stated directly with its evidence |
| **Very High** | Sustained stability across multiple independent recomputations, large real sample | A recommendation the user can act on with strong confidence — still never stated as certainty |

No band is ever "certain." Even Very High confidence is a strong statistical claim about the past, not a guarantee about the future — copy at every band stays within [Product Experience's calibrated-language rules](../product-experience/08-ai-communication-style.md), never crossing into absolute language regardless of band.

## How confidence grows

Confidence is **never manually set** — it is derived, every time, from the same two mechanical inputs (sample size, stability), recomputed whenever new real evidence arrives. This means:

- A user's first campaign: every personalized insight is either absent (nothing to base it on) or Low (barely enough to observe, not enough to trust).
- Multiple campaigns, [Historical Trends stage (§2)](02-career-knowledge-timeline.md): sample sizes grow past the pattern-detection minimum — insights that were absent become Low, Low becomes Moderate.
- Sustained, stable patterns across many real campaigns: Moderate becomes High, and — only with genuinely large, consistently-reproduced evidence — High becomes Very High.

Growth is never assumed from elapsed time alone — a user who ran one campaign eight months ago has the same confidence level as a user who ran one campaign yesterday, because *time* isn't the input, *evidence volume and stability* are (Principle 9, [§1](01-career-intelligence-principles.md)).

## The confidence display contract

Every insight surface ([§3](03-personal-success-analytics.md)'s analytics, [§4](04-pattern-detection-blueprint.md)'s patterns, [§7](07-career-health-score.md)'s health dimensions, [§8](08-personal-growth-dashboard.md)'s dashboard) must display its band using the same visual/copy treatment everywhere — one shared component contract (a Career Intelligence-specific extension of [M20's Status Badge](../frontend-architecture/05-component-architecture.md) pattern, reusing that component's existing tone-mapping convention rather than inventing a parallel one), so a user learns the meaning of "Low confidence" once and can recognize it anywhere in the product, rather than each screen inventing its own confidence visual language.

## What this framework forbids

- **Rounding a band up.** A Moderate-confidence pattern is never shown with High-confidence phrasing because it "seems obviously true" — the mechanical derivation is the only source of truth, overriding any implementer's intuition about what the pattern probably means.
- **Hiding the band to simplify the UI.** Every insight shows its confidence; there is no "confidence-free" display mode, because an insight with an undisclosed confidence is functionally an overstated one (the reader assumes competence/certainty by default when none is stated).
- **A confidence score with no visible evidence behind it.** Confidence without the evidence that produced it is unfalsifiable — exactly the "black-box behavior" the milestone's own Core Philosophy explicitly rules out. Every confidence band ships attached to the evidence summary that earned it, always.
