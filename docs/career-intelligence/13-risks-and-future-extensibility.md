# 13. Risks, Mitigations, and Future Extensibility

## Risks and mitigation strategies

### R-1: The reserved intelligence hooks never get populated
**Risk**: `CampaignIntelligence`, `AdaptiveSpeedProfile`, and `CompanyMemoryEntry`'s richer fields have sat reserved and unpopulated since they were created (per this document's own grounding, [§1](01-career-intelligence-principles.md)). If they remain that way indefinitely, most of this blueprint (§4, §5, §7) stays permanently in "not yet available" state.
**Mitigation**: [ADR-001](12-architecture-decision-records.md) keeps the implementation cost bounded (a computation engine plus existing writer hooks, not new structures) specifically to lower the bar for this actually happening. The "not yet available" rendering rule ([ADR-007](12-architecture-decision-records.md)) means the product degrades gracefully, not visibly broken, if this risk materializes.

### R-2: Evidence thresholds tuned wrong in either direction
**Risk**: too strict, and the platform never shows anything personalized even to genuinely experienced users, undermining the "gets smarter over time" promise; too loose, and it shows noise dressed as pattern, undermining trust the moment a user notices a "pattern" that was really coincidence.
**Mitigation**: [§4](04-pattern-detection-blueprint.md) and [§6](06-learning-confidence-framework.md) fix the *existence* of a hard threshold and a stability check as non-negotiable, while deliberately not fabricating a specific numeric threshold in this architecture document — that's a real tuning decision requiring real historical data to calibrate correctly, appropriately deferred to implementation rather than guessed at here.

### R-3: `RecommendationOutcome` (§9) never gets built
**Risk**: this is the one concept in the entire blueprint with no existing reserved home ([§9](09-recommendation-memory.md)) — if it's deprioritized, the "repeated mistakes/strengths" and "why guidance changed because you ignored prior advice" capabilities never materialize, even if every other section's reserved hooks do get populated.
**Mitigation**: scoped narrowly ([ADR-004](12-architecture-decision-records.md)) to keep it a tractable, bounded addition to existing modules rather than a large new subsystem — reduces the activation energy needed to eventually build it.

### R-4: Users optimizing for the score instead of real outcomes
**Risk**: any visible score creates an incentive to game the score itself rather than pursue the real career outcome it's meant to reflect — e.g. a user padding profile fields just to move a Profile Quality number, or sending more applications just to move a completion-rate metric, regardless of fit.
**Mitigation**: every dimension in [§7](07-career-health-score.md) is explained in terms of the real behavior behind it, not presented as a target to be maximized in isolation — and [§7's](07-career-health-score.md) "Weaknesses" framing rule requires every gap to pair with a concrete, quality-oriented next action, not a generic "do more" nudge that would reward volume over fit.

### R-5: Cross-user aggregation (Market Intelligence's company-responsiveness signal) raises scale and privacy considerations
**Risk**: aggregating across users requires care that no individual user's specific campaign/application behavior becomes identifiable through the aggregate, especially for smaller companies with few total applicants.
**Mitigation**: [§10](10-market-intelligence.md) explicitly flags this and requires aggregate-only presentation with no granular breakdown that could de-anonymize a specific user's activity — stated as a hard boundary, not a "consider this later" note.

### R-6: Early-stage "not yet available" states feel discouraging, undermining the "gets smarter" promise before it's had a chance to prove itself
**Risk**: a new user opening the Career Health Score or Personal Growth Dashboard and seeing mostly "not enough history yet" across the board could read the whole Career Intelligence feature as broken or hollow, rather than as an honest, early-stage state.
**Mitigation**: this is squarely a [Product Experience](../product-experience/README.md) framing responsibility, not an architecture one — [§2's Career Knowledge Timeline](02-career-knowledge-timeline.md) exists specifically so the "not yet available" state can be framed as a real, understood stage ("you're at the First Campaign stage — here's what unlocks next") rather than an unexplained gap, directly reusing [Product Experience's Empty State Philosophy](../product-experience/10-empty-state-philosophy.md) template (why / what's next / why it matters) for every "not yet available" instance this blueprint produces.

### R-7: Two dashboard-shaped screens (M20's Dashboard, this milestone's Personal Growth Dashboard) risk navigation confusion
**Risk**: users unclear on which screen answers which question ("what's happening now" vs. "how am I improving over time").
**Mitigation**: named and flagged explicitly in [ADR-008](12-architecture-decision-records.md) as a genuine open placement question for whichever future milestone owns navigation changes — not resolved here, since resolving it would require touching M20, which this milestone is forbidden from doing. Flagged rather than silently left for someone to discover.

## Future extensibility considerations

- **Closing the loop**: `RecommendationOutcome` (§9), once built, is the natural feedback signal for the dormant Recommendation Engine's own strategies to eventually consume — a `CompanyHistoricalSuccessStrategy` that can see which of its own past recommendations succeeded is a strictly more capable version of the same strategy, achievable without changing its architectural shape, only its inputs.
- **Market Intelligence's external adapter**: the port/adapter boundary ([ADR-005](12-architecture-decision-records.md)) means a real labor-market data integration, if ever pursued, is additive — no personal-analytics or Career-Health-Score code needs to change to accommodate it.
- **Document Quality** (§4, §7) becomes real the moment `application-assembly` gains both a controller and a persisted record of which CV/document was used per application — currently blocked on the same dormant-module gap M20 already identified for that module, not on anything new this milestone introduces.
- **Notification integration**: once [Product Experience's Notification Strategy](../product-experience/09-notification-strategy.md) has a real backend (itself flagged as the largest speculative bet in that document set), Career Intelligence insights are natural candidates for its "Information"/"Success" categories ("a new pattern has reached High confidence," "your reply rate improved this month") — not designed further here, since it depends on two separate pieces of future infrastructure (this milestone's insights AND that milestone's delivery mechanism) both existing first.
- **Cross-user pattern sharing beyond company responsiveness**: a longer-term, carefully-scoped possibility (e.g. anonymized, aggregate "candidates with similar profiles saw X" signals) — deliberately not designed in this milestone beyond flagging it exists as a future direction, since it would require its own dedicated privacy and consent architecture that this milestone's scope doesn't cover.

---

# Readiness Assessment: Is the platform prepared to begin Milestone 21 (Design System Implementation)?

**Yes.** Nothing in this milestone blocks M21. Career Intelligence is an architecture for *data and reasoning*, not visual design — it has no dependency on M21's scope, and M21 has no dependency on this milestone being implemented (as opposed to merely documented) first.

**What this milestone contributes to M21, as input rather than a blocker**: several new component *needs* are now identified that M20's original [Design System Foundation](../frontend-architecture/11-design-system-foundation.md) token structure didn't yet anticipate by name — a confidence-band indicator ([§6](06-learning-confidence-framework.md)), a multi-dimension health-score display ([§7](07-career-health-score.md)), and evidence-attached explanation blocks ([§5](05-career-recommendation-evolution.md), extending [Product Experience §7](../product-experience/07-decision-explanation-framework.md)'s existing template). None of these require new token *categories* beyond what M20 §11 already established (spacing, type, semantic color, elevation) — they're new *composite component* specifications to add to [M20's Component Architecture](../frontend-architecture/05-component-architecture.md) inventory when that work is picked up, not a reason to revisit the token foundation itself.

**What remains explicitly unresolved, and correctly so**: whether/when the reserved intelligence hooks get populated (R-1), the exact evidence thresholds (R-2), and whether `RecommendationOutcome` gets built (R-3) are all real, open implementation questions — none of them are design-system questions, and none of them need to be resolved before M21 starts. M21 can proceed against the full, real, already-existing 🟢 surface (Auth, Profile, Campaigns, Applications, Companies, Jobs, per [M20's own readiness assessment](../frontend-architecture/README.md)) exactly as that document already concluded — this milestone doesn't change that conclusion, it extends the backlog of what eventually gets built on top of it.
