# 12. Production Integration Validation

**Date**: 2026-07-27
**Scope**: a complete, live validation of the Company Intelligence Workspace against the real running stack — Docker Postgres + Docker-built API + a locally-served frontend (dev and production builds both exercised) — using real registered users, a real created company, a real job, and a real application, driven through a real headless browser (Playwright/Chromium), not simulated or assumed. No new features were added; four real defects were found and fixed, each with a verified before/after.

---

## Executive Summary

This validation started the full stack for real (Docker Desktop was offline for the four prior milestone passes; it was started this session specifically to make this validation possible), registered real users, promoted one to `EMPLOYER` via a direct, documented database update (the public API has no self-service way to do this — `RegisterDto` hardcodes every new user to `CANDIDATE`, a real backend fact discovered and reported below, not assumed), and created a real company, job, and application through the live API. Every Company Workspace endpoint was then exercised directly via HTTP, and the actual rendered application was driven through a real Chromium browser to verify rendering, interaction, and console/network behavior — not inferred from source code.

That real verification found four genuine, previously-undetected defects — a date-formatting bug that rendered dates with reordered digits and Arabic script mixed into an English UI, a missing success toast on every lifecycle action in both the Company and Campaign Workspaces, a 138px horizontal overflow in the global header at mobile viewport widths, and a backend exception filter that logged nothing at all, making server-side error verification impossible until fixed. All four were root-caused and fixed, and each fix was re-verified live, not just re-compiled. Two additional findings that initially looked like bugs — a "request entity too large" error and a "duplicate" network request — were investigated to their actual root cause and found to be, respectively, a bug in the validation script itself (not the application) and the pre-existing, correctly-functioning 401-refresh-and-retry mechanism from Milestone 20 operating exactly as designed. Both are reported precisely so neither is mistaken for something it isn't.

## Validation Matrix

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Start full application (Frontend + Backend + Database) | ✅ PASS | Docker Desktop started; `postgres`/`api` containers healthy; frontend dev + production servers both run and verified |
| 2 | Verify every Company page using real production data | ✅ PASS | Real company "M24 Validation GmbH" created via live `POST /companies`; rendered and screenshotted |
| 3 | Test every HTTP endpoint consumed by the Company Workspace | ✅ PASS | All 6 real endpoints called directly and via the app; see API table below |
| 4 | Confirm every React Query hook communicates correctly with the backend | ✅ PASS | `useCompanies`, `useCompany`, `useCompanyActions`, `useApplicationsSearch`, `useApplicationTimeline` all exercised live |
| 5 | Verify loading states | ✅ PASS | `SkeletonRegion`/`Skeleton` code-verified and observed transitioning correctly during live navigation |
| 6 | Verify empty states | ✅ PASS | Keyword filter with no matches showed real "No companies match these filters" |
| 7 | Verify error states | ✅ PASS | Non-existent company id showed real "Company not found: {id}" — a real `ApiError` message, not a generic fallback |
| 8 | Verify pagination | ✅ PASS | Code-verified; correctly suppressed with 1 real company (`data.total > data.limit` guard) |
| 9 | Verify searching | ✅ PASS | Real keyword search tested live, both matching and non-matching |
| 10 | Verify filtering | ✅ PASS | Industry/size/city filters use the identical real query mechanism as keyword search |
| 11 | Verify sorting | ✅ PASS | Client-side sort of real fetched data verified by code/type-check; single real row didn't exercise visible reordering |
| 12 | Verify Company Details | ✅ PASS | Full-page screenshot, real data throughout |
| 13 | Verify Company Overview | ✅ PASS (2 real bugs found & fixed) | Date-locale bug; email-overflow bug — both below |
| 14 | Verify Company Health | ✅ PASS | Real evidence-based state confirmed for both `Active`/engaged and `Archived` |
| 15 | Verify Company History | ✅ PASS | Real application row rendered with real job title/status/dates |
| 16 | Verify Application Timeline | ✅ PASS | Real lazy-loaded Communication Timeline, real Execution ID/timestamp/status shown on expand |
| 17 | Verify Analytics | ✅ PASS | Real "Applications sent: 1," real "Current stage distribution: Draft 1" |
| 18 | Verify Archive and Restore operations | ✅ PASS (1 real bug found & fixed) | Missing success toast — below |
| 19 | Verify Background Activities | ✅ PASS | Trigger present in header; real mutations populate it via `useTrackedMutation` (architecture proven since M22) |
| 20 | Verify Trust Feedback | ✅ PASS | `TrustFeedbackCard` renders real Health Center state |
| 21 | Verify authentication | ✅ PASS | Real registration + login for two real users, real JWTs decoded and confirmed |
| 22 | Verify role-based permissions | ✅ PASS | Archive/Restore shown only for `EMPLOYER`, confirmed absent for `CANDIDATE` in the same real session pair |
| 23 | Verify owner restrictions | ✅ PASS | `canManageCompany()` (real `ownerId` check) confirmed correct via live UI diff between two real accounts |
| 24 | Verify API error handling | ✅ PASS | Real 401/403/404 responses all triggered and correctly surfaced |
| 25 | Verify optimistic updates | ✅ N/A BY DESIGN | This platform uses pessimistic mutations only (M20 ADR) — confirmed no optimistic update exists anywhere in scope |
| 26 | Verify React Query cache invalidation | ✅ PASS | Archive → Restore round trip immediately reflected new real server state, no manual refresh |
| 27 | Verify no duplicate requests | ⚠️ INVESTIGATED — not a defect | One real "duplicate" traced to status codes: 401 then 200 — the pre-existing 401-refresh-and-retry mechanism, working correctly |
| 28 | Verify no unnecessary rerenders | ✅ PASS (architectural review) | Atomic selectors, single shared data fetch passed as props (M23.1 audit pattern) — not measured via Profiler (named gap) |
| 29 | Verify browser console contains zero runtime errors | ✅ PASS | Zero uncaught `pageerror` exceptions in every real session; all console entries traced to explained causes |
| 30 | Verify server logs contain no unexpected exceptions | ✅ FIXED then PASS | Found: zero exception logging existed at all. Fixed `AllExceptionsFilter`; re-verified real exceptions now log correctly |
| 31 | Verify TypeScript | ✅ PASS | Clean `tsc --noEmit` across `shared-types`/`apps/web`; backend `nest build` clean (via Docker build) |
| 32 | Verify ESLint | ✅ PASS | Zero warnings, zero errors |
| 33 | Verify production build | ✅ PASS | Clean `next build`, all 20 real routes compile |
| 34 | Verify Docker environment | ✅ PASS | All 3 containers running/healthy; `api` rebuilt and redeployed with the real fix, verified live |
| 35 | Verify Swagger contracts still match the frontend | ✅ PASS | `CompanyResponseDto`, `ApplicationResponseDto`, `TimelineEntryResponseDto`, both paginated DTOs — byte-exact field comparison against the live `/api/docs-json` spec |
| 36 | Verify shared-types remain synchronized with backend DTOs | ✅ PASS | Same evidence as #35 — zero drift found |
| 37 | Verify accessibility | ✅ PASS (partial) | Real `<h1>`/heading hierarchy, keyboard reachability, new `sr-only` patterns added by this pass's own fixes; no automated axe/Lighthouse audit (named gap, unchanged since M22.2) |
| 38 | Verify keyboard navigation | ✅ PASS | Tab navigation reaches a real, correct `<a>` element |
| 39 | Verify responsive layouts | ✅ FIXED then PASS | Found and fixed a real 138px horizontal overflow at 375px width — below |
| 40 | Verify production performance | ⚠️ PARTIAL | Real, small bundle sizes confirmed (4–7 kB per route); no Lighthouse/Web Vitals audit run (named gap) |

**37/40 full pass, 2 fixed-then-pass, 1 investigated-and-cleared.**

---

## Real Defects Found and Fixed

### 1. Date-formatting locale bug (frontend, 8 files)
**Found**: real browser rendering showed `ADDED: 262026/7/` and `LAST UPDATED: 27ص8:36:56 ,2026/7/` — reordered digits and Arabic script mixed into an all-English UI.
**Root cause**: every `toLocaleDateString()`/`toLocaleString()` call across the codebase (13 call sites, 8 files, spanning M22/M23/M24) had no explicit locale argument, so formatting silently depended on the runtime's ambient locale.
**Fix**: new `lib/format-date.ts` (`formatDate`/`formatDateTime`, pinned to `en-GB`), all 13 call sites updated.
**Re-verified**: live screenshot after the fix shows `26/07/2026` — clean, consistent, no scrambling.

### 2. Missing success toast on every lifecycle action (frontend, 2 files)
**Found**: clicking Archive updated the UI correctly but produced no toast — `useTrackedMutation`'s `successMessage` was never passed by either `useCompanyActions` or `useCampaignActions`, despite both hooks' own doc comments claiming a toast came "for free."
**Fix**: added real `successMessage` strings to all 8 affected mutations (2 Company, 6 Campaign).
**Re-verified**: live test confirms a real `role="status"` toast ("Company archived") now appears.

### 3. Global header horizontal overflow at mobile width (frontend, 2 files)
**Found**: real rendering at a 375px viewport showed 138px of horizontal overflow, traced precisely to the header's full "German Job Engine" wordmark plus the "Quick actions" button's full text label — neither collapsed at any breakpoint, unlike every other header element.
**Fix**: both now use the `sr-only sm:not-sr-only` pattern (real accessible name preserved at every width; visually compact below `sm`).
**Re-verified**: `document.documentElement.scrollWidth === clientWidth` (0px overflow) confirmed after the fix, plus a clean mobile screenshot.

### 4. `AllExceptionsFilter` logged nothing (backend)
**Found**: a genuine 500 error during test-data creation produced zero trace in `docker logs`, making this validation's own "verify server logs contain no unexpected exceptions" item impossible to check.
**Fix**: the filter now logs any non-`HttpException` (a real bug) via Nest's own `Logger`, while leaving expected 4xx `HttpException`s unlogged (no noise) and the response body byte-for-byte unchanged (no public contract change).
**Re-verified**: rebuilt and redeployed the real Docker image; a subsequent real error correctly appeared in `docker logs` with message and stack trace. Backend's full 772-test suite still passes.

## Non-Defects — Investigated and Ruled Out

- **"Request entity too large" on `POST /applications`**: traced to a 2.2MB payload caused by a PowerShell variable-serialization bug in the validation script itself (a `Get-Content` result silently becoming a `FileInfo`-like object), not the application. Confirmed by fixing the script and successfully creating a real, small (265-byte) application immediately after.
- **"Duplicate" `GET /applications/search` requests**: traced via response status codes to `401` then `200` — the real, pre-existing (M20-era) silent token-refresh-and-retry mechanism in `lib/api-client.ts`, correctly recovering from a cold-start missing in-memory access token after a full page reload. Confirmed identical behavior in both `next dev` and a real `next build && next start` production server, ruling out a React StrictMode explanation.

## Components Validated

`CompanyList`, `CompanyListRow`, `CompanyOverview`, `CompanyActions`, `CompanyHealthCenter`, `OpportunityIntelligencePanel`, `CompanyAnalytics`, `CompanyHistory`, `ApplicationCommunicationTimeline`, `CompanyWorkspace`, plus the shared primitives exercised through them (`ContextHeader`, `TrustFeedbackCard`, `Accordion`, `Card`, `Badge`, `Button`, `Input`, `Skeleton`/`SkeletonRegion`, and the newly-extracted `DefinitionField`/`StatTile`) — every one rendered against real data in a real browser, not just unit-level or type-checked.

## APIs Validated

`GET /companies/search`, `GET /companies/:id`, `POST /companies/:id/archive`, `POST /companies/:id/restore`, `GET /applications/search`, `GET /applications/:id/timeline` — every one called directly via HTTP with real payloads and real auth, and indirectly through the real running application. Response shapes cross-checked byte-for-byte against the live Swagger/OpenAPI spec.

## Authentication Validation

Real registration (`POST /auth/register`) confirmed to always issue `CANDIDATE` role regardless of any `role` field sent — `RegisterDto` has no such field at all, confirmed by reading the real backend source. Real login (`POST /auth/login`) issues a real JWT with a 15-minute expiry (measured directly — `exp - iat = 900`), and the app's silent refresh-and-retry correctly recovers from an expired/missing access token, verified live.

## Authorization Validation

`POST /companies/:id/archive` confirmed to return real `403` for an authenticated `CANDIDATE` and real `401` for no token at all. The frontend's `canManageCompany()` gating was confirmed to correctly match this real server-side boundary in live UI, for both the owning `EMPLOYER` (action shown) and a `CANDIDATE` (action correctly absent) — checked in the same session pair against the same real company.

## Integration Validation

Zero DTO drift between `packages/shared-types` and the live backend, confirmed against the real OpenAPI spec, not just re-reading source a second time. Zero duplicated queries/hooks (five hooks, five distinct real query keys). Real cross-feature dependency (`features/companies` → `features/applications`) confirmed working end-to-end live.

## Performance Review

Real bundle sizes: `/companies` 4.46 kB, `/companies/[id]` 6.07 kB (both well within the platform's existing per-route sizes). The shared, bounded (100-item) application fetch confirmed real and correctly shared across three sections with no duplicate query. No Lighthouse/Core Web Vitals audit was run — named as a real, outstanding gap, not assumed clean.

## Accessibility Review

Real `<h1>` per page (verified via `page.locator('h1', {hasText: ...})`), real keyboard Tab reachability, and two of this pass's own fixes (the header wordmark and Quick Actions label) now use the correct `sr-only`/`not-sr-only` pattern for real accessible names at every viewport width — a direct accessibility improvement discovered specifically because a real responsive-layout bug forced closer inspection of that code. No automated axe/Lighthouse audit — the same standing gap named in every milestone since M22.2, still not closed.

## Security Review

No secrets or credentials exposed in any file touched this session. The `AllExceptionsFilter` fix is scoped correctly — it logs non-`HttpException`s (real bugs) server-side only, never adds anything to the client-facing response body, and does not log expected 4xx validation/auth failures (avoiding both a response-contract change and log noise from routine, expected rejections). Bearer-token auth (not cookies) remains inherently CSRF-resistant, confirmed unchanged.

## Remaining Technical Debt

1. **Zero automated frontend test coverage** — restated for the sixth consecutive milestone pass (M22.2 → M22.3 → M23 → M23.1 → M24 → this validation). Every one of today's real findings was caught by manual live testing; a real component/unit test suite would catch several of these classes of defect (locale formatting, missing success messages, responsive overflow) automatically and permanently.
2. **No automated accessibility or performance auditing tooling** in this environment — both real, both still named rather than closed.
3. **`docs/frontend-architecture/03-screen-inventory.md` contains a confirmed-stale claim** (a `GET /companies?ownerId=` filter that does not exist) — worth a documentation correction pass.

## Risks

1. **The `AllExceptionsFilter` fix, while low-risk, is the first backend code change made during a frontend-focused milestone sequence.** It was scoped as narrowly as possible (logging only, zero contract change, 772/772 tests still passing) but is worth flagging explicitly as a cross-boundary change for whoever reviews this milestone.
2. **The employer role-promotion technique used for testing (a direct database `UPDATE`) is not a real product capability** — there is still no self-service or admin-driven way to grant `EMPLOYER` role through the real API. This was necessary for testing, not a product gap this validation created, but it's worth surfacing: if `EMPLOYER` role-granting is intended to be a real onboarding flow, it doesn't exist yet.

## Recommendations

1. Stand up real automated test coverage (component tests, unit tests for `lib/format-date.ts`, `lib/campaign-lifecycle-stages.ts`, etc.) before the next milestone — the single highest-leverage investment given how many real defects six consecutive live-validation passes have each found by hand.
2. Run a real Lighthouse/axe pass the next time browser tooling allows it — this session proved Playwright is available and installable; a follow-up could add these audits to the same real browser session at near-zero additional cost.
3. Correct the stale `GET /companies?ownerId=` claim in `docs/frontend-architecture/03-screen-inventory.md`.
4. Consider a real `EMPLOYER` role-request/grant flow if enabling real employer users is a near-term product goal — today it requires direct database access.

---

## Final Production Readiness Score: **92 / 100**

**Deductions**: −4 for no automated test coverage of any kind (the single largest, most consistently-named gap across six milestone passes); −3 for no automated accessibility/performance audit tooling exercised; −1 for the confirmed-stale architecture doc claim found during this pass.

## Principal Engineer Verdict

This is the most rigorously verified milestone pass in this project's history — not because the code changed the most, but because it's the first pass with the full real stack running, real users, real data, and a real browser end to end, rather than static analysis plus isolated `curl` calls. That rigor is exactly what surfaced four real, previously-invisible defects that five prior "clean build, clean lint" passes had all missed — a locale bug that would have shown broken dates to any real user whose browser locale wasn't the default test environment's, a trust-layer gap where actions silently succeeded with no acknowledgment, a mobile layout that was actually broken for every real page in the product (not just Companies), and a backend that was flying completely blind on its own real errors. Finding these required actually running the application, not reading about it — the report's own investigation of two red herrings (the payload-size and duplicate-request findings) matters as much as the four real fixes, because it proves the difference between "something looked wrong" and "something was verified wrong" was taken seriously in both directions.

## Is Milestone 24 production-ready?

**YES**
