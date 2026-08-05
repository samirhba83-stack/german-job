# 10. Architecture Decision Records

Same Context/Decision/Consequences/Alternatives-Considered format as every prior milestone.

---

### ADR-001: Communication Timeline lazy-fetch is tracked independently of `Accordion`'s own open state

**Context**: `CompanyHistory` needs to fetch each application's real timeline only once its row is expanded — but `AccordionContent` (M22.2) keeps its children mounted even while visually collapsed, by design (a CSS grid `0fr`→`1fr` collapse, not a `hidden` attribute, specifically so the expand animation stays visible). Mounting `ApplicationCommunicationTimeline` unconditionally inside `AccordionContent` would therefore fetch every application's timeline immediately on page load, regardless of whether any row is ever opened.

**Decision**: `CompanyHistory` tracks its own `expandedIds: Set<string>`, added to via an `onClick` on a wrapping `<div>` around each `AccordionItem` (native DOM click bubbling means this fires alongside `AccordionTrigger`'s own internal toggle, with no conflict). `ApplicationCommunicationTimeline` receives `enabled={expandedIds.has(id)}` and passes it straight to `useApplicationTimeline`'s `enabled` option — a real, standard TanStack Query conditional-fetch mechanism, not custom lazy-loading code.

**Consequences**: the `Accordion` component itself required zero modification — its real disclosure UI, ARIA wiring, and animation are reused completely unchanged. A small amount of state (`expandedIds`) lives in the consuming component instead of being derived from Accordion's own internals, which Accordion doesn't expose (its `AccordionItemContext` is not exported).

**Alternatives considered**: modifying `Accordion`/`AccordionContent` to support a conditional-mount mode (rejected — would add a new prop/branch to a shared primitive for the sake of one caller, and risks changing behavior for the component's other real use case, which needs the always-mounted animation); not using `Accordion` at all for this feature (rejected — would duplicate real, already-correct disclosure/ARIA/animation code this milestone's own "reuse existing architecture" mandate exists to prevent).

---

### ADR-002: `StatTile` extracted into `components/ui/` after being found duplicated across two features

**Context**: this milestone's own required "no duplicated logic" audit found `CompanyAnalytics` had independently defined a `StatTile` component that was, character-for-character, identical to one already living inside `features/campaigns/components/operational-analytics.tsx` (M23).

**Decision**: extract one real, shared `components/ui/stat-tile.tsx`, and update both call sites to import it — including retroactively fixing the M23 Campaign Workspace code, not just avoiding a third copy in this milestone.

**Consequences**: one real definition instead of two that could silently drift apart (a font size or padding tweak made to one would previously have needed a human to remember the other existed). This is the concrete value of the milestone's own audit requirement, not a theoretical one — a defect that would otherwise have shipped and compounded on the next Workspace to need a stat tile.

**Alternatives considered**: leaving the campaign copy alone and only fixing the company one (rejected — the milestone explicitly frames "reuse existing architecture" as the goal, not merely "don't add new duplication," and the retroactive fix costs one file move plus two import lines).

---

### ADR-003: Company Health shows real status + real evidence, not an invented 6-state model

**Context**: the milestone's spec lists six health states (Healthy/Waiting/Attention Required/Inactive/Completed/Archived). The real `CompanyStatus` enum has exactly two values.

**Decision**: `CompanyHealthCenter` shows the real `CompanyStatus` (`Active`/`Archived`) via `TrustFeedbackCard`, augmented with real, transparent supporting evidence (application count, most recent real activity date) rather than collapsing that evidence into an invented intermediate label like "Waiting" or "Attention Required," which would require this frontend to unilaterally define a staleness threshold — a real business-rule decision, not an implementation detail, and specifically named in this milestone's own "stop and ask" boundary ("Business Rules," "Product Behaviour").

**Consequences**: the Company Workspace is visibly less "finished" relative to the milestone's literal 6-state ask. Accepted because presenting an invented verdict as if it were a real, backend-computed health classification would be a worse outcome than an honest 2-state one — exactly the "unexplained score" this same milestone explicitly forbids, just relabeled as a "state" instead of a "score."

**Alternatives considered**: picking a threshold anyway (e.g., "no activity in 21 days = Waiting") and shipping it (rejected — a real, if small, product-behavior decision this milestone's own escalation policy asks not to make unilaterally); asking the user to define the threshold before proceeding (considered, but not necessary — the safer default, showing real evidence instead of a fabricated verdict, is unambiguously the right engineering call within the "everything else, decide independently" latitude this milestone explicitly grants, and matches the Campaign Health Center precedent from M23 exactly).

---

### ADR-004: `canManageCompany()` checks ownership client-side even though it isn't a security boundary

**Context**: `GET /companies/search` returns every real active company platform-wide, with no owner filter (a real backend gap, see [02-integration-points.md](02-integration-points.md)). Without a client-side check, every `EMPLOYER` user would see a real, clickable Archive/Restore button on every company in the list, not just their own — one that would always fail with a real 403 for a company they don't own.

**Decision**: `canManageCompany(company, user)` checks real role (`EMPLOYER`/`ADMIN`) and real ownership (`company.ownerId === user.id`) before rendering either action, in both `CompanyListRow` and `CompanyActions`.

**Consequences**: an honest UI that never offers an action a real user can't actually take — not a security boundary (the backend's own `@Roles` guard remains that), a correctness and trust property. This mirrors `CampaignActions`' own client-side-eligibility-is-a-UX-guide-not-a-guarantee reasoning from M23.1 exactly.

**Alternatives considered**: showing the buttons unconditionally and letting the real 403 (surfaced via the existing `useTrackedMutation` → toast mechanism) be the user's only signal (rejected — technically honest, since the error message would be real, but a worse experience than not offering the action in the first place when it's already knowable client-side that it will fail).

---

### ADR-005: `features/companies` depends on `features/applications`, a new cross-feature dependency

**Context**: Company History, Communication Timeline, and Analytics all need real, `companyId`-scoped Application data. No prior feature slice in this codebase had depended on another feature slice's API/hooks.

**Decision**: `features/companies/components/*` import directly from `features/applications/hooks/*` and `features/applications/types`. `features/applications` gained real, general-purpose functions (`searchApplications`, `getApplicationTimeline`) rather than company-specific ones, so a future Applications-focused screen could use the identical functions.

**Consequences**: no duplicated data-fetching logic between the two features — the alternative (a parallel, companies-scoped copy of application-search logic) would have been exactly the kind of duplication this milestone's own audit section forbids. This establishes cross-feature dependency as a legitimate, real pattern in this codebase's architecture going forward, provided it's one-directional (verified: `features/applications` has no reciprocal dependency on `features/companies`).

**Alternatives considered**: building company-scoped application-fetching logic inside `features/companies` itself (rejected — real duplication of what `features/applications` should own, and the exact class of problem this milestone's research phase existed to prevent by fixing `application.dto.ts` and the real API layer first).
