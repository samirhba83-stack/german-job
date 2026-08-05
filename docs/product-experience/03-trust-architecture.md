# 3. Trust Architecture

## Trust is not a UI treatment — it's already a backend design decision this document surfaces

This is the most important grounding fact in this entire blueprint: the explainability the milestone asks for (why a company was selected, why another was rejected, evidence behind a recommendation) is not something the frontend has to invent or fake. It already exists as real, precisely-named domain data — currently sitting behind 🟡 dormant modules with no HTTP exposure (per [M20](../frontend-architecture/01-information-architecture.md)), but structurally real, not aspirational. Trust Architecture's job is to make sure the interface, once that data is exposed, actually *uses* it faithfully — and, in the meantime, never fakes a version of it that isn't backed by anything.

| Trust claim the platform must be able to make | Real backend field it must be sourced from | Status |
|---|---|---|
| "Here's why we recommended this" | `Recommendation.explanation`, `.reasonCode`, `.expectedImpactScore` (0–1), `.producedBy` — `recommendations` module | 🟡 Dormant |
| "Here's why this was the final decision" | `DecisionReport.businessJustification` (why, in business terms), `.explanation` ("suitable for showing directly to the user" — a direct quote from the domain code's own doc comment), `.confidenceScore` (0–1) | 🟡 Dormant |
| "Here's what else we considered, and why it lost" | `DecisionReport.conflicts` (`ConflictGroup[]`, every competing candidate) + `.supportingEvidence` (`EvidenceEntry[]`, `resolvedPriority` + `selected: boolean` for every recommendation weighed, not just the winner) | 🟡 Dormant |
| "Here's why this CV/certificate was used, and why another wasn't" | `CvSelectionResult.selectedCv` / `.rejectedCvs` (each with `reasonCode` + `explanation`), same shape for `CertificateSelectionResult` — `application-assembly` module | 🟡 Dormant |
| "Here's proof this was actually sent" | `ExecutionEvent.summary`/`.explanation`, tied to a real Postgres-persisted, immutable audit trail — `execution-tracking` module | 🟡 Dormant, no controller |
| "Here's this company's trust signal" | `Company.trustScore`, `.hiringQuality` | 🟢 Live (`GET /companies/:id`) |

**The implication for implementation**: the Decision Explanation Framework (§7) and every "why" surface in the product must be built to consume exactly these fields, once exposed — never a summarized or paraphrased approximation invented at the frontend layer. A frontend-authored explanation that isn't sourced from `DecisionReport.explanation` (or equivalent) is not an explanation, it's a guess wearing an explanation's clothes — and the moment a user notices the guess doesn't match reality, every other trust signal in the product degrades with it.

## How trust is continuously earned, stage by stage

Trust isn't a single "we're transparent" banner — it's earned in small, repeated, verifiable moments:

1. **Before commitment** (Visitor stage, §2): real company/job data visible with no signup wall — proof precedes the ask.
2. **At configuration** (Campaign Creation, §2): every setting maps to something the backend actually enforces (`SmartBatchPlan`, `ExecutionWindow`) — nothing decorative.
3. **At recommendation time**: every suggestion carries its `reasonCode`/`explanation`/`expectedImpactScore` — never a bare ranked list with no rationale attached.
4. **At decision time**: the *rejected* alternatives are shown alongside the winner (`conflicts`, `supportingEvidence`) — a trust architecture that only ever shows the winning choice looks confident; one that shows what it turned down and why looks honest, which is the stronger trust signal.
5. **At execution time**: real delivery evidence (`ExecutionEvent`), not an assumed-successful status the moment a button is clicked.
6. **At failure time** (§11): the platform's honesty about `NullEmailProvider`'s current always-unavailable state, or any real provider failure, is itself a trust-building disclosure — a system that admits a limitation is more credible on everything else it claims.
7. **At limitation time** (Mission Control, §2 and §4): stating "not connected yet" plainly is the single highest-leverage trust action available to this product today, precisely because it's the one place a lesser design would be most tempted to fake it.

## Concrete trust mechanisms

- **Evidence before conclusion**: never state a recommendation's headline ("We recommend applying now") without the reasoning directly adjacent, not one click away — adjacency signals nothing is being hidden.
- **Show the runner-up, not just the winner**: `DecisionReport.conflicts` exists specifically so this is possible — use it. A recommendation that appears with no visible alternative looks like an unexplainable black box even when reasoning exists behind it, if that reasoning isn't surfaced.
- **Confidence, stated as confidence, not certainty**: `confidenceScore` is a 0–1 value — display it as a real, sometimes-moderate number ("62% confidence" or an equivalent honest visual), never inflate it into an unqualified "we recommend" if the underlying score is middling. See §4 for the exact rule on communicating uncertainty.
- **Delivery evidence over assumed success**: an application's status only ever reflects a real, recorded transition (`ApplicationLifecycleStatus`, 🟢) — never an optimistic client-side assumption (this is also a hard technical rule in M20 §12 ADR-007: no optimistic updates on lifecycle transitions — the trust and technical rationale converge here).
- **Named limitations, not silent gaps**: every 🟡/⚪ surface in M20's inventory gets an explicit, plainly-worded "not available yet" state (§4) rather than an empty screen or infinite loading state that lets the user *guess* whether it's broken or just slow.

## What erodes trust (avoid these unconditionally)

- A recommendation with no visible reason.
- A confidence claim stronger than the underlying score supports.
- A status implying something happened before the backend confirms it did.
- A loading state that never resolves and never explains why.
- A feature that looks interactive but does nothing when a controller doesn't exist yet (M20's own dormant-surface honesty rule, restated here as a trust principle, not just a UX one).
- Manufactured urgency (§14) — urgency the platform doesn't actually have standing to claim reads, once noticed, as manipulation, and manipulation is the fastest possible trust collapse.
