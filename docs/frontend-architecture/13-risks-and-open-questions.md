# 13. Risks and Open Questions

## Risks and mitigation strategies

### R-1: Dormant modules stay dormant, and frontend effort on 🟡 areas goes to waste
**Risk**: Mission Control and Trust Center (§1.8–1.9) are fully designed in this blueprint, but nothing in this milestone wires their controllers. If backend priorities shift, the screens could sit permanently unreachable.
**Mitigation**: ADR-008 (§12) keeps their build cost low relative to the payoff — routes and honest-empty-state UI, not full data-layer implementations, so the sunk cost if priorities shift is small. The screens also have standalone product value (they communicate the roadmap honestly to users, per [10-ux-principles.md](10-ux-principles.md) principle 12) even while disconnected.

### R-2: The Billing endpoint's missing auth guard reaches production
**Risk**: `GET /billing/subscriptions/:userId` has no server-side guard today (M19 report §5.1, unfixed as of this milestone). If the Subscription & Billing screen (§3) ships before that's fixed, the frontend is calling a genuinely insecure endpoint — client-side care (only ever calling it with the current user's own id) reduces but does not eliminate the exposure, since the endpoint itself will still answer for *any* id if called directly.
**Mitigation**: explicitly gated in §3 and §12 (ADR references) — this screen should not ship to production until the backend fix lands. Not this milestone's job to fix (backend behavior is out of scope per the milestone's own constraints), but the dependency is called out loudly enough that it can't be missed at implementation time.

### R-3: `shared-types` drifts from actual backend response shapes
**Risk**: ADR-004 depends on backend-side discipline to keep `shared-types` current; nothing enforces this today. A silent mismatch would surface as a runtime error, not a build error, defeating the whole point of the shared-types strategy.
**Mitigation**: OQ-18 (below) — an OpenAPI-schema-generation step would close this gap structurally rather than by discipline; flagged as a near-term follow-up once this blueprint moves to implementation, not deferred indefinitely.

### R-4: Frontend-only permission/completeness checks get mistaken for real enforcement
**Risk**: several rules in this blueprint (profile completeness gating campaign creation, subscription-status gating, application-visibility scoping) are explicitly frontend-only today (§2, §8, §10). A future engineer unfamiliar with this document set could reasonably assume a visible UI restriction implies a server-side one, and build something (or reason about security) on that false assumption.
**Mitigation**: ADR-005's naming convention (`can` vs `intendedCan`) makes the distinction visible in code, not just in documentation. This document set itself is the other half of the mitigation — every such case is flagged at the point it's introduced, not just collected here.

### R-5: The Trust Center bug reaches the frontend before it's fixed
**Risk**: `TrustCenterProjectionService` currently queries by `traceId` alone (M19 report §2.3 finding 3), which can return cross-execution-contaminated data. If a controller is added to unblock the Trust Center screen (§3) without that fix landing first, the frontend would display genuinely wrong data with no way to detect it client-side.
**Mitigation**: called out explicitly in §3's Trust Center Detail screen — implementation should verify the fix landed before wiring this screen's data layer, not just before the controller exists.

### R-6: Scope creep in the "foundation" phase
**Risk**: a 12-section blueprint this large invites over-building — spending implementation time perfecting a design-token system (§11) or a component library (§5) before any real screen ships, rather than building enough foundation to ship the first vertical slice (e.g. Auth → Dashboard → Campaigns) end to end.
**Mitigation**: this is a documentation milestone specifically to prevent that — having the full blueprint up front means implementation can be sequenced deliberately (see the Readiness Assessment in [README.md](README.md)) rather than discovering foundational gaps mid-build and scope-creeping to fix them retroactively.

### R-7: The execution-status polling pattern (§6) generalizes into fake "live" data elsewhere
**Risk**: §6 carves out one narrow, justified exception (poll `execution-status` because it's real data) to the broader "don't simulate real-time activity" rule. A future engineer could reasonably generalize "we poll things" into polling something that isn't actually live, reintroducing the exact problem §2/§4/§10 warn against.
**Mitigation**: §6 states the distinction explicitly (real-data-polled vs. no-data-simulated) specifically so it can't be quietly genericized — flagged here again as a standing risk, not just a one-time note.

---

## Open questions requiring future implementation decisions

| # | Question | Where it surfaces | Blocks |
|---|---|---|---|
| OQ-1 | Should email verification be built (needs a new backend endpoint + email-sending capability, neither of which exist), or is passwordless/no-verification the intended permanent design? | [01](01-information-architecture.md) §1.1, [02](02-user-journeys.md), [03](03-screen-inventory.md) | Register screen's post-submit UX |
| OQ-2 | What object-storage/upload transport backs CV and profile-photo files? (Presigned URL flow? A new backend upload endpoint? Direct client-to-S3?) The current `POST /profiles/me/cv` is metadata-only. | [01](01-information-architecture.md) §1.3–1.4, [02](02-user-journeys.md), [03](03-screen-inventory.md) | CV Management, Profile Photo screens |
| OQ-3 | Is a real Notifications backend module planned, and on what timeline? | [01](01-information-architecture.md) §1.10, [03](03-screen-inventory.md), [04](04-dashboard-architecture.md) | Notification Center, Top Nav bell |
| OQ-4 | When will `GET /billing/subscriptions/:userId` get its auth guard (M19 §5.1)? | [03](03-screen-inventory.md), R-2 above | Subscription & Billing screen's production readiness |
| OQ-5 | Should profile-completeness gating move server-side (e.g. into the dormant `business-policy-enforcement` module's `candidate-completeness` policy, once wired), or stay a frontend-only nudge permanently? | [02](02-user-journeys.md), [08](08-permission-matrix.md) | Campaign Create's validation strictness |
| OQ-6 | Is account suspension a planned feature? If so, does it belong on `User` directly or as a separate moderation-status concept? | [02](02-user-journeys.md), [08](08-permission-matrix.md) | Account Suspended screen, Admin tooling |
| OQ-7 | Should `GET /jobs/:id` (and similarly companies) enforce draft/archived visibility server-side for non-owners, rather than relying on the frontend not to request it? | [03](03-screen-inventory.md) Job Detail | Job Detail's real security posture |
| OQ-8 | Should the backend model an explicit "account type" distinguishing candidate-onboarding from employer-onboarding, rather than the frontend inferring it from `UserRole`? | [03](03-screen-inventory.md) Onboarding Wizard | Onboarding flow branching |
| OQ-9 | Does `TransformInterceptor` (referenced in backend `main.ts`) change any response envelope shape in practice? Verify against a live response before finalizing the fetch wrapper's unwrapping logic. | [06](06-api-consumption-architecture.md) | Fetch wrapper implementation |
| OQ-10 | Will the backend add `httpOnly` cookie-based refresh-token issuance? | [07](07-state-management-strategy.md), ADR-003 | Token storage security posture |
| OQ-11 | Is subscription-based feature gating (§8's 🔶 rows) actually planned for server-side enforcement, and on what timeline? | [08](08-permission-matrix.md) | Whether to invest in `intendedCan` beyond documentation |
| OQ-12 | Is `applications/:id/archive` having no role restriction intentional, or an oversight in the backend? | [08](08-permission-matrix.md) | Archive action's visibility rules |
| OQ-13 | Should `GET /applications/:id` (and `search`) gain server-side ownership scoping? | [08](08-permission-matrix.md) | Application List/Detail's real security posture |
| OQ-14 | Is a future Enterprise/organization account tier actually on the roadmap, and roughly what shape (seats? sub-roles? a new `UserRole` value?) | [08](08-permission-matrix.md) | Whether to design this further at all |
| OQ-15 | Should `GET /health` gain a degraded/maintenance-mode signal, or should maintenance mode be driven by a separate mechanism (env flag, feature flag service)? | [09](09-navigation-architecture.md) | Maintenance Mode screen's trigger |
| OQ-16 | Final typeface and exact color palette selection (deliberately deferred past this milestone per its own scope). | [11](11-design-system-foundation.md) | Visual design pass |
| OQ-17 | Should the Global UI store (ADR-002) be enforced against holding server data via a lint rule, or left to code review? | [12](12-architecture-decision-records.md) ADR-002 | Tooling investment |
| OQ-18 | Should types be generated from the live OpenAPI schema instead of hand-maintained in `shared-types`? | [12](12-architecture-decision-records.md) ADR-004, R-3 above | Type-safety tooling investment |
| OQ-19 | Adopt shadcn/ui's copy-in component model instead of fully hand-built primitives? | [12](12-architecture-decision-records.md) ADR-006 | Component implementation approach |

None of these block *this* milestone's deliverable — the blueprint is complete and internally consistent without their answers, because every place they matter is explicitly flagged with a clearly-scoped interim decision (§12's ADRs) rather than left ambiguous. They block specific pieces of *implementation*, itemized above so the next milestone can triage them rather than discovering them mid-build.
