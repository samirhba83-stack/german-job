# 12. Architecture Decision Records

Same format as [M20's ADRs](../frontend-architecture/12-architecture-decision-records.md) and [Product Experience's UX-DRs](../product-experience/16-ux-decision-records.md): Context, Decision, Consequences, Alternatives Considered.

---

### ADR-001: Populate the existing reserved intelligence hooks; do not build parallel new structures

**Context**: direct inspection of `campaigns/domain/entities/campaign.entity.ts` found `CampaignIntelligence`, `AdaptiveSpeedProfile`, and `CompanyMemoryEntry` already exist, fully modeled, explicitly reserved, and unpopulated ([§1](01-career-intelligence-principles.md)).

**Decision**: every future Career Intelligence computation writes to these existing structures via their existing `recordIntelligenceAssessment()`/`recordAdaptiveSpeedAssessment()`/`recordCompanyInteraction()` hooks, rather than introducing a new, parallel data model for the same concepts.

**Consequences**: implementation work is real but bounded — a computation engine and its writer, not a new aggregate. Requires future implementers to actually read the existing reserved VOs' field definitions before designing anything, rather than assuming a blank slate.

**Alternatives considered**: a wholly new `career-intelligence` bounded context with its own entities mirroring the same concepts (rejected — would duplicate structures the domain already reserves for exactly this purpose, violating this project's own DRY discipline and creating two sources of truth for "what does the platform know about this campaign's likely outcomes").

---

### ADR-002: Career Health Score is nine independently-explained dimensions, never a single opaque composite

**Context**: [§7](07-career-health-score.md) needed to decide between one aggregate number (simpler UI) and a full per-dimension breakdown (more complex, more honest).

**Decision**: nine separate, independently-scored, independently-evidenced dimensions, always shown together; no single number replaces the breakdown.

**Consequences**: more UI surface than a single score badge. In exchange, every claim the Career Health Score makes is individually falsifiable against real evidence — a user can check "why is my Campaign Health rated this way" and get a real, specific answer, which a single composite number could never honestly provide without the same breakdown anyway.

**Alternatives considered**: a single weighted composite with an expandable breakdown (a real middle option — not rejected outright, but deferred: if ever built, the weighting formula itself would need its own ADR, since an undisclosed weighting is exactly the kind of "black-box behavior" [§11](11-ethical-intelligence-rules.md) forbids).

---

### ADR-003: Minimum evidence thresholds are a hard gate, not a soft default

**Context**: [§3](03-personal-success-analytics.md), [§4](04-pattern-detection-blueprint.md), and [§6](06-learning-confidence-framework.md) all depend on a real minimum sample size below which a metric/pattern isn't shown as a computed value at all.

**Decision**: the gate is absolute — below the minimum, the UI shows raw counts, never a computed ratio/pattern/prediction, with no override.

**Consequences**: early users (per [§2's](02-career-knowledge-timeline.md) First Campaign stage) see visibly less personalized content than experienced users — a real, intentional asymmetry, not a bug to smooth over with an early estimate. Prevents any future pressure ("but it would look nicer with a number here") from quietly eroding the evidence discipline this entire blueprint depends on.

**Alternatives considered**: a "provisional" estimate shown with heavy caveats below the threshold (rejected — even a heavily-caveated fabricated-feeling number risks being read at face value; the raw-counts fallback is unambiguous by construction).

---

### ADR-004: `RecommendationOutcome` is scoped to the existing `decision-intelligence`/`recommendations` modules

**Context**: [§9](09-recommendation-memory.md) identified the one genuine net-new concept this blueprint requires — nothing tracks whether a recommendation was acted on or what followed.

**Decision**: scope it as an extension of the existing dormant `recommendations`/`decision-intelligence` modules (referencing their real `Recommendation.id`/`DecisionReport.id`), not a new bounded context.

**Consequences**: keeps the "recommendation" concept and its "was it acted on" outcome in one coherent domain, consistent with this project's one-hop-upstream dependency discipline (confirmed clean across all 25 modules in [M19's architecture validation](../M19-VALIDATION-REPORT.md)). Requires those two modules to eventually gain both a controller (already true dependency, per M20) and this new outcome-tracking capability before §9 can compute anything real.

**Alternatives considered**: a dedicated new `recommendation-memory` module (rejected as unnecessary bounded-context proliferation for a concept that's fundamentally "what happened after a decision this module already owns").

---

### ADR-005: Market Intelligence uses a port/adapter boundary; only the internal signal ships conceptually now

**Context**: [§10](10-market-intelligence.md) needed to keep five genuinely-external signals from creating pressure to fabricate them, while still allowing the one internal signal (company responsiveness) to be designed now.

**Decision**: a `MarketIntelligencePort`-shaped boundary (matching this project's existing Ports & Adapters convention, e.g. `EmailProviderPort`, `TaskExecutionPort`) separates internal aggregation from any future external data source; only the internal implementation is architected in this milestone.

**Consequences**: external market data can be added later as a new adapter without touching personal-analytics or Career-Health-Score code, matching this project's established DI/port-swap discipline. No external data appears anywhere in the product until an explicit future decision adds it.

**Alternatives considered**: deferring Market Intelligence entirely until an external data decision is made (rejected — the milestone explicitly requested the architecture now, and the internal signal has real value independent of any external sourcing decision).

---

### ADR-006: Confidence is always mechanically derived, never manually assigned

**Context**: [§6](06-learning-confidence-framework.md) could have allowed a human curator or a heuristic override to set a confidence band directly, which would be simpler to implement in some cases.

**Decision**: confidence is always computed from the same two real inputs (sample size, stability) — no manual override path exists anywhere in the architecture.

**Consequences**: removes an entire class of future "we manually bumped this to High confidence because it seemed right" incidents, which would be a direct, hard-to-detect violation of [§11's](11-ethical-intelligence-rules.md) "never overstate confidence" rule. Slightly less flexible for handling genuinely edge-case-y real patterns a human might recognize before the mechanical threshold does — an accepted tradeoff in favor of a rule that can't quietly erode over time.

**Alternatives considered**: a human-reviewable override queue (rejected — reintroduces exactly the kind of unaccountable, undisclosed judgment call this blueprint's evidence discipline exists to prevent).

---

### ADR-007: Missing evidence renders as "not yet available," never as a default/neutral value

**Context**: [§7](07-career-health-score.md) and [§8](08-personal-growth-dashboard.md) both need a rendering rule for dimensions/widgets with insufficient real evidence.

**Decision**: an explicit, visually-distinct "not enough history yet" state — never a numeric default (e.g. never a silent "50/100" standing in for "unknown").

**Consequences**: some screens look visibly incomplete for early users — an honest cost, not hidden by this decision. Removes the risk of a default value ever being misread as a real, evidenced middling score.

**Alternatives considered**: omitting the dimension/widget entirely when data is insufficient (rejected — silently absent is worse than explicitly "not yet available," since the former could be mistaken for a bug or for the feature not existing at all, per [Product Experience's Empty State Philosophy](../product-experience/10-empty-state-philosophy.md) "why it's empty" rule, applied here).

---

### ADR-008: The Personal Growth Dashboard is a new, additional surface — M20's Dashboard is not redesigned

**Context**: the milestone explicitly forbids redesigning any previous milestone's documents.

**Decision**: [§8](08-personal-growth-dashboard.md) specifies a distinct future screen, architecturally a sibling of [M20's Dashboard Home](../frontend-architecture/04-dashboard-architecture.md), not a replacement or extension of it.

**Consequences**: two dashboard-shaped screens will eventually exist in the product (current-state Dashboard, growth-over-time Personal Growth Dashboard) — a real navigation/IA decision for a future milestone to place correctly (flagged in [§13](13-risks-and-future-extensibility.md)), not resolved here, since resolving it would mean touching M20's navigation architecture.

**Alternatives considered**: extending M20's existing Dashboard Home with growth widgets directly (rejected — explicitly prohibited by this milestone's own constraint against modifying M20).
