# 11. Final Deliverables & Principal Engineer Review

**Date**: 2026-07-25
**Scope**: `features/companies/` (new), `features/applications/`'s real API layer (implemented for the first time), `components/ui/stat-tile.tsx` (new shared primitive), `/companies` and `/companies/[id]` (real routes).

---

## Executive Summary

This milestone found the Companies module's real backend surface is narrower than Campaigns' — a 2-value status enum, no timeline endpoint, no setter for its two "score" fields at all — but found one genuinely valuable real capability Campaigns never had: `Application.companyId` is real and validated, and `GET /applications/search?companyId=` is a real, live, filterable endpoint. The Company Workspace is built exactly to that boundary: real Overview/Health/Actions from `CompanyDto`, real History/Communication Timeline/Analytics from real, company-scoped Application data (fetched once, shared across three sections, lazily deepened per application on demand), and a fully honest "not available" statement everywhere the spec asked for intelligence that the backend has no capacity to produce at all. Building this required first repairing a real, pre-existing defect — `packages/shared-types`' `ApplicationDto` was a stub shape that didn't match the real backend — fixed as a prerequisite before any company-specific code was written. A self-audit (this milestone's own explicit requirement) found and fixed two real duplications, one of which retroactively improved the M23 Campaign Workspace's own code.

## Architecture Decisions

Full account in [10-architecture-decision-records.md](10-architecture-decision-records.md). Headline decisions: lazy-fetch tracked independently of `Accordion`'s own state (ADR-001); `StatTile` extracted to a shared primitive after being found duplicated (ADR-002); Company Health shows real status + real evidence rather than an invented 6-state model requiring an un-owned business-rule threshold (ADR-003); client-side ownership gating as an honest UX layer, not a security boundary (ADR-004); a new, deliberate cross-feature dependency (`features/companies` → `features/applications`), directional and duplication-free (ADR-005).

## Component Hierarchy

See [03-component-hierarchy.md](03-component-hierarchy.md), including full Files Created / Files Modified / Files Deleted lists.

## Files Created

19 new files (full list: [03-component-hierarchy.md](03-component-hierarchy.md)) — the entire `features/companies/` slice, two new `features/applications/` hooks, one new shared UI primitive, one new route, and this document set.

## Files Modified

`packages/shared-types/src/dto/application.dto.ts` (corrected shape), `company.dto.ts` (+ pagination type), `features/applications/{types,api}` (real implementations), `lib/status-mappings.ts` (+ `COMPANY_STATUS_TONE`), `app/(dashboard)/companies/page.tsx` (real list), and — the one file outside this milestone's own feature that changed — `features/campaigns/components/operational-analytics.tsx` (StatTile de-duplication, ADR-002).

## API Integration Summary

Six real endpoints consumed: `GET /companies/search`, `GET /companies/:id`, `POST /companies/:id/archive`, `POST /companies/:id/restore`, `GET /applications/search`, `GET /applications/:id/timeline`. Full contract detail, including everything the spec asked for that has no real endpoint, in [02-integration-points.md](02-integration-points.md).

## Performance Review

See [07-performance.md](07-performance.md). Summary: real server-side pagination and filtering on the company list; a real, bounded (100-item) shared application fetch instead of per-section duplicate queries; a genuinely new, well-reasoned lazy-loading pattern for per-application communication timelines, specifically engineered to avoid a real N+1 query risk; zero unjustified memoization added.

## Accessibility Review

See [08-accessibility.md](08-accessibility.md). The M23/M23.1 heading-hierarchy and `SkeletonRegion` lessons were applied from the start this time rather than discovered mid-build — a real sign the discipline is compounding. No automated audit tooling was available, the same standing gap named in every milestone since M22.2.

## Security Review

**Real, and holds up**: every mutation (`archive`/`restore`) is gated server-side by the real `@Roles(EMPLOYER, ADMIN)` decorator — verified by reading the controller directly, not assumed. The client-side `canManageCompany()` check is explicitly documented as a UX convenience, not a security boundary, avoiding the common mistake of a frontend team believing a hidden button is a real access control (`docs/frontend-architecture/08-permission-matrix.md`'s "hidden ≠ secured" principle, applied correctly here). `GET /companies/:id` is confirmed to apply **no ownership or status gating at all** — any company, active or archived, is publicly fetchable by id, authenticated or not. This is real, existing backend behavior (not introduced by this milestone), but worth stating plainly: nothing about the Company Workspace's frontend code assumes otherwise, and nothing here makes that exposure worse — but nothing here fixes it either, and it should be a known, explicit fact for whoever eventually reviews this module's data exposure posture. No secrets, credentials, or sensitive data are logged, hardcoded, or exposed in any new file this milestone added (checked directly).

## Technical Debt Review

1. **Docker/the backend has now been offline for four consecutive milestone passes** (M23, M23.1, M24) — no live HTTP verification of any real contract has happened since M22. Every DTO shape this milestone relies on was verified once, by reading real backend source directly, this session — not re-confirmed against a running server. This is a compounding, real risk: the longer verification stays tooling-only, the more a real backend drift could go undetected.
2. **Zero automated test coverage, still.** This is the fifth consecutive milestone to name this exact gap (M22.2, M22.3, M23, M23.1, now M24) without closing it. At this point, restating it as a "future recommendation" understates the risk — this codebase has shipped four workspace-scale features (Interaction Framework, Campaign Workspace, its integration pass, and now Company Workspace) entirely on manual build/lint/type-check verification. This should stop being deferred.
3. **The lazy-loading pattern (ADR-001), while well-reasoned, adds real per-component complexity** (a manually-tracked `Set<string>` working around a shared primitive's own internal state) — a real, if small, maintenance cost future contributors need to understand before touching `CompanyHistory`.

## Production Readiness Assessment

Clean `pnpm exec tsc --noEmit`, clean `pnpm build` (all 20 real routes compile and statically/dynamically generate correctly, including the two new company routes), clean `pnpm lint`, and a live dev-server smoke test confirming both `/companies` and `/companies/:id` are correctly registered and protected by the existing middleware (307 redirects to `/login` with the correct `returnTo` param for unauthenticated requests) — proving real routing integration, not just a successful compile.

---

## Principal Engineer Review

Reviewing this as the operational heart of a paying-customer-facing product, not a milestone checklist.

**The name of this milestone oversells what shipped, more than any prior milestone's own gap did.** "Opportunity Intelligence Platform" is the section header; the actual, real Opportunity Intelligence available today is exactly zero — not "reserved but sitting at null" (Campaign's honest middle ground), but a complete absence of any backend shape to eventually populate. A user opening this workspace expecting the platform's own name — Opportunity *Intelligence* — to mean something will find an honest, well-written, but entirely empty panel. The engineering response to that gap (build nothing fake, explain the absence clearly) is exactly correct; the product-naming/positioning gap it sits inside is not something engineering can fix, and a Principal review has to say so plainly rather than let good engineering discipline paper over a real expectations mismatch at the product layer.

**The backend has a real, fixable bug worth escalating, not just documenting.** `federalState` is stored, validated, real geographic data (per the domain layer's own comment: "never inferred from city/postalCode") that the response mapper silently drops before it ever reaches any client. This is a one-line backend fix (add three fields to `CompanyResponseMapper.toDto()`) that would immediately make "Region" — a field this exact milestone's spec explicitly asked for — real. Recommend raising this as a real, standalone backend ticket rather than letting it sit as a footnote in a frontend milestone's docs.

**The missing `ownerId` filter / `/companies/me` endpoint is a real gap in the employer use case this workspace nominally serves.** An employer today has no efficient, real way to land on their own company's workspace — only a client-side page-scan through up to 100-per-page public results, or manually knowing their own company's id. For a platform whose one-company-per-owner rule already assumes exactly this use case matters, this is a real, concrete backend gap that should be prioritized before this workspace is positioned as the employer's real operational home, not just noted as a documentation curiosity.

**The lazy-per-application-timeline design is the strongest piece of engineering in this milestone, and also its sharpest usability tradeoff.** It correctly avoids a real N+1 performance problem — but the direct cost is that a user wanting to review a company's full communication history across many applications has to click-expand each one individually, with no "expand all" or aggregate view. For a company with 30 real applications, that's 30 individual clicks to see everything. This is a reasonable, honest tradeoff for a first version, but it is a tradeoff, and should be named as one rather than presented as a pure win.

**The self-audit worked, and that's the real, structural strength worth crediting.** Finding and fixing a real permission-check discrepancy and a real cross-feature duplicate component, in-session, before either could ship and compound, is exactly what "no duplicated logic" as a literal, checked requirement (not just a stated value) is supposed to produce. This is the fourth or fifth milestone in this series where a self-review found something a prior pass missed — the pattern itself (build, then critically re-read before calling it done) is working. What isn't yet working is closing the test-coverage gap that would make this kind of catch automatic rather than dependent on a human (or an AI) remembering to look critically every single time.

### Conclusion

**Is the Company Intelligence Workspace production-ready? YES — as a Company Overview, Health, History, and Analytics workspace, grounded entirely in real data. NO, if "production-ready" is read to include the "Opportunity Intelligence Platform" framing the milestone's own title uses** — that capability doesn't exist anywhere in the backend today, in any form, and no frontend engineering effort can close that gap. Supported by the evidence above: a clean build across 20 real routes, a verified-live middleware/routing integration, zero duplicated queries/hooks/logic (audited and two real instances fixed), and every backend limitation handled honestly rather than papered over. The recommendation, matching M23's own precedent exactly: ship the real Overview/Health/History/Analytics capability now, and do not market or position "Opportunity Intelligence" as a real, active feature until the backend gaps named above — a real scoring domain concept, a real producer, and ideally the `federalState` and `/companies/me` fixes — actually exist.
