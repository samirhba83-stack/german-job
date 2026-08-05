# Milestone 20.5 — Product Experience Blueprint (Human-Centered Experience Architecture)

**Date**: 2026-07-25
**Scope**: the emotional, psychological, behavioral, and communication architecture every future screen must follow. No visual design, no React code, no backend/API changes. [Milestone 20's](../frontend-architecture/README.md) structural documents (information architecture, screens, navigation, state, API mapping, design tokens) are treated as fixed and are not modified anywhere in this document set — this blueprint sits on top of them, answering "how does it feel," never "where does it live."

## How this complements Milestone 20

M20 defines structure; this defines experience. Concretely: when M20 says a screen shows `CampaignStatus`, this blueprint says how that status should be worded, what emotion the user is likely feeling when they see it, and what the platform owes them at that moment. Every document below cross-references the specific M20 section it sits on top of — nothing here duplicates M20's structural facts, and nothing here should ever be read as authorizing a structural change M20 didn't already make.

## Deliverable map

The milestone requested 11 specific outputs; here is exactly where each lives, since several are covered by more than one file working together:

| Requested deliverable | Where it lives |
|---|---|
| Executive Summary | This document, below |
| Experience Principles | [15-experience-principles.md](15-experience-principles.md) |
| Emotional Journey | [02-emotional-journey.md](02-emotional-journey.md) |
| Trust Blueprint | [03-trust-architecture.md](03-trust-architecture.md) + [04-transparency-principles.md](04-transparency-principles.md) + [07-decision-explanation-framework.md](07-decision-explanation-framework.md) |
| Product Personality | [01-product-personality.md](01-product-personality.md) |
| AI Communication Guide | [08-ai-communication-style.md](08-ai-communication-style.md) |
| Notification Guide | [09-notification-strategy.md](09-notification-strategy.md) |
| Copywriting Standards | [14-copywriting-guidelines.md](14-copywriting-guidelines.md) |
| Progress Psychology | [05-progress-psychology.md](05-progress-psychology.md) |
| Motivation Framework | [06-motivation-system.md](06-motivation-system.md) |
| UX Decision Records | [16-ux-decision-records.md](16-ux-decision-records.md) |

Plus three supporting documents the milestone's own 15-section body required that don't map one-to-one onto the summary list above: [10-empty-state-philosophy.md](10-empty-state-philosophy.md), [11-error-experience.md](11-error-experience.md), [12-loading-experience.md](12-loading-experience.md), and [13-delight-moments.md](13-delight-moments.md).

---

## Executive Summary

The core reframe this blueprint makes is not aspirational — it's a fact this project's own backend already substantiates: the German Job Engine has real, precisely-modeled explainability data (`Recommendation.explanation`/`.reasonCode`, `DecisionReport.businessJustification`/`.confidenceScore`/`.conflicts`/`.supportingEvidence`, `CvSelectionResult`'s selected/rejected reasoning) sitting behind dormant modules with no HTTP exposure yet. "Feel like an intelligent career companion, not a dashboard" is achievable specifically *because* that data already exists in the domain model — this blueprint's job was to make sure the interface, once built, actually uses it faithfully instead of defaulting to generic dashboard neutrality or, worse, inventing a friendlier-sounding but ungrounded version of it.

Every one of the 15 requested content areas is delivered, organized into 16 documents plus this index. The throughline across all of them is the same discipline this entire project has followed since its M1 architecture charter and its M19 validation report: **never claim more than the system can back up.** Applied to backend code, that discipline produced an honest 🟢/🟡/⚪ grounding system in M20. Applied to product experience, it produces the rule stated eighteen different ways across this document set and compressed once, finally, in [Experience Principle #18](15-experience-principles.md): *every claim must survive the question "based on what?"*

Three product-experience risks were surfaced by this work that are worth flagging explicitly, beyond what any individual document covers:

1. **Mission Control is the highest-stakes moment in the entire emotional journey** ([§2](02-emotional-journey.md)) — precisely because it's the point where the product's core promise ("we're working for you") meets a real backend gap (no controller exists). Getting the honest "not connected yet" treatment right there matters more than any other single screen in the product.
2. **The Waiting stage is structurally the longest, most anxiety-prone part of the journey**, and it's also the stage this platform is best positioned to handle well, because real funnel data (Applications Prepared → Delivered → Replies → Interviews, all 🟢 live today per [§5](05-progress-psychology.md)) already exists to reframe silence as visible movement — this is close to a solved problem architecturally; it just needs to be built with the discipline this document specifies.
3. **Every trust mechanism in this blueprint depends on the backend's dormant explainability modules eventually getting HTTP exposure.** Until `recommendations`, `decision-intelligence`, and `application-assembly` gain controllers, the richest parts of the Trust Blueprint and Decision Explanation Framework remain designed-but-not-buildable, exactly like Mission Control in M20. This blueprint doesn't change that timeline — it makes sure the frontend work is ready the moment it does.

## Readiness assessment

**Is the experience philosophy ready to guide frontend implementation? Yes, completely — with the same tiered caveat M20 already established.** Every principle, tone rule, and template in this document set applies immediately to the 🟢 live surface (Auth, Profile, Campaigns, Applications, Companies, Jobs) and can be implemented today alongside M20's structural blueprint. The richest trust/explanation mechanisms (§3, §7) are fully specified but — like their M20 counterparts — wait on the same backend controllers Mission Control and Trust Center wait on. Nothing in this document should be read as blocked on anything *this* milestone could have resolved; the blocking dependencies are entirely backend-controller work already itemized in [M20's open questions](../frontend-architecture/13-risks-and-open-questions.md) and [risks](../frontend-architecture/13-risks-and-open-questions.md).

This document set is the permanent reference. Every future screen, message, notification, and interaction should be checkable against it — and where a future implementer finds a real product moment this blueprint doesn't yet cover, the right move is to extend it following the same grounding discipline, not to improvise a one-off exception.
