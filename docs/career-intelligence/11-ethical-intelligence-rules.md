# 11. Ethical Intelligence Rules

## These are constraints, not aspirations — every one is enforceable, and none is new

Every rule below has already been derived, section by section, throughout this document set. This page exists to state them as a single, non-negotiable list — the one page a future implementer should re-check before shipping *any* career-intelligence feature, regardless of which section of this blueprint it came from.

### The platform must never invent recommendations
Every recommendation traces to real evidence — a real `Recommendation.explanation`, a real pattern that passed [§4's](04-pattern-detection-blueprint.md) minimum-evidence gate, a real `CampaignIntelligence` field populated from real computation. If the evidence doesn't exist, the honest output is "not enough data yet" ([§1, Principle 9](01-career-intelligence-principles.md); [§6](06-learning-confidence-framework.md)), never a plausible-sounding placeholder.

### The platform must never hide uncertainty
Every insight ships with its confidence band ([§6](06-learning-confidence-framework.md)), always visible, never optional, never omitted to make a screen look more finished or a recommendation sound more authoritative.

### The platform must never manipulate users
No dark patterns, no artificial urgency, no engagement-optimized nudge disconnected from real career benefit — this is [Product Experience's Motivation System](../product-experience/06-motivation-system.md) restated as a hard rule specifically for the intelligence layer, where the temptation to over-personalize into manipulation is highest (a system that "knows" a lot about a user's history has more leverage to manipulate than one that doesn't, which is exactly why this rule matters more here, not less).

### The platform must never overstate confidence
No band gets rounded up ([§6](06-learning-confidence-framework.md)). No prediction is phrased more strongly than its evidence supports ([§4's](04-pattern-detection-blueprint.md) correlation-vs-causation rule). No "Very High confidence" without genuinely sustained, large, stable evidence behind it.

### The platform must never replace user decision-making
Every insight terminates in information and a suggested next step — never an autonomous action the platform takes on the user's behalf without an explicit, separate action from the user. `CampaignIntelligence.bestBatchSize`, once populated, informs a suggestion in the Campaign Edit screen; it does not silently change a running campaign's batch size itself. This is the direct architectural expression of [§1's Principle 6, human supervision](01-career-intelligence-principles.md), and it is the single most important rule in this list precisely because it's the one most likely to be quietly violated in the name of "helpfulness" by a future well-intentioned implementer trying to reduce friction.

## "Assist, not control" — the test for every future feature

Before any career-intelligence feature ships, it should pass a simple test: **does the user remain the one making every real decision, with the platform's role limited to informing that decision as clearly and honestly as possible?** If a proposed feature would have the platform act, filter, or decide *for* the user without an explicit, separate user action authorizing it, it fails this test regardless of how much better the outcome might be on average — this platform's value proposition is trustworthy assistance, not autonomous control, and every document in this blueprint (and in [Product Experience](../product-experience/README.md) before it) has been built around that same line.

## Enforcement point

These rules apply retroactively to every other section in this document set — if any future extension of §3–§10 is ever found to conflict with one of these five, this page wins. No section's specific mechanism (a health-score dimension, a pattern-detection threshold, a recommendation-evolution tier) may be implemented in a way that violates any rule here, and any future ADR proposing a change to §3–§10 must state explicitly which of these five rules it was checked against.
