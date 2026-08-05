# 5. Opportunity Intelligence

## What was asked for

Every company should expose an Opportunity Score, Confidence Score, Compatibility Score, Priority, Reasoning, Business Explanation, Evidence, and Recommended Next Action — and, explicitly: "Never expose unexplained scores. Every score must explain itself."

## What's real

Nothing, at the `Company` level. This is worth stating plainly because it's a *stronger* gap than any other reserved-intelligence pattern already established in this codebase:

- **Campaign** has a real, live `CampaignIntelligenceResponseDto` shape — always `null` in production, but the DTO exists, the endpoint exists, and the domain entity has an (unused) `recordIntelligenceAssessment()` method ready to receive real data the day a producer exists.
- **Application** has a real, live `IntelligenceResponseDto` shape too — same status.
- **Company has none of this.** `CompanyDto` has no intelligence field of any shape. `Company`'s domain entity has no `recordX()` method for anything resembling a score, reasoning, or recommendation. There is no per-(candidate,company) compatibility computation anywhere in the codebase — verified by an exhaustive repository-wide search for `compatibility`, `matchScore`, and `opportunityScore` during this milestone's research pass, turning up zero real backend hits.

## What was built

`OpportunityIntelligencePanel` — a single, honest, permanently-empty-today panel stating plainly that no scoring or recommendation engine has a live backend surface, and that nothing shown elsewhere in the workspace is a substitute guess for it. This is the literal, direct application of "never expose unexplained scores": the panel doesn't show a score with a thin explanation bolted on after the fact — it explains, correctly, that there is no score.

## What would need to be real for this to change

At minimum, all of the following would need to exist, none of which do today:
1. A real domain concept on `Company` (or a new aggregate) capable of holding a computed score, its computedAt/computedBy provenance, and a real textual explanation — mirroring `CampaignIntelligence`'s shape.
2. A real producer — some command, job, or service that actually computes and calls a `recordOpportunityAssessment()`-equivalent method, the way nothing in this codebase currently calls `Campaign.recordIntelligenceAssessment()` either.
3. A real, live `GET /companies/:id` (or dedicated) endpoint exposing that field.
4. For "Compatibility Score" specifically: a real link between a candidate's `Profile` and a `Company`/`Job`, and a real scoring computation between them — none of which exists in any form today, reserved or otherwise.

The moment any of this exists, `OpportunityIntelligencePanel` is a contained, additive change — swap its permanently-empty body for a real render of the new field, following the exact pattern `SmartRecommendationPanel` (Campaign Workspace, M23) already uses for `campaign.intelligence?.recommendationExplanation`. No other part of the Company Workspace needs to change.
