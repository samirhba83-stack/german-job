# 11. Milestone 25 — Campaign Workspace & Intelligent Recruitment Operations

**Date**: 2026-07-27
**Scope**: Extends the Campaign Workspace built in M23/M23.1 with the operational surface M25 asked for — a real dashboard summary, real campaign creation/editing/duplication (explicitly deferred by M23 to "its own focused milestone," now built), real search/filtering, and a new Execution Monitoring panel surfacing three real backend fields that were fetched since M23 but never rendered. Zero backend files were changed — every new UI consumes only endpoints that were already real and live. No mock data, no fabricated statistics, no simulated progress anywhere in this milestone's code.

---

## Before Writing Any Code

M25's spec asks for a large surface — Decision Intelligence, per-company pipeline detail, campaign-level reply/interview/delivery rates, granular execution telemetry (retry queue, remaining emails, next execution), region/industry/language filters, Restore and Delete actions. Before building anything, the existing `docs/campaign-workspace/03-integration-points.md` (M23's own research) and `08-future-extension-strategy.md` were re-read in full, since they already establish — from direct backend source reading, not assumption — that most of this has no real backend support today:

- No per-target/per-company list endpoint exists (`CampaignTarget` is real; no query returns individual targets).
- `Application` has no real `campaignId` — reply/interview/delivery-confirmation-by-campaign is not computable.
- `recommendations`/`decision-intelligence`/`execution-tracking` have zero `@Controller` anywhere (re-confirmed in the M24.5 architecture audit: only 9 controllers exist in the entire backend).
- `CampaignDto.health`/`.intelligence` are real fields, always `null` — no production code path populates them.
- Campaigns have no region/industry/language field, and — a distinct domain-model fact worth stating plainly — **no job reference at all**: a Campaign targets companies, not specific jobs, a different concept than several of the spec's asks assume.
- There is no `DELETE /campaigns/:id` and no restore/unarchive command for Campaigns anywhere in the backend.
- `SearchCampaignsQueryDto` supports `ownerId`/`status`/`strategyType`/`createdFrom`/`createdTo` — no keyword/name field.

None of this has changed since M23. This milestone's job was therefore to build everything that **does** have real backing — which turned out to still be substantial — and to extend the same honest-gap discipline to the new asks rather than fabricate data for the rest.

---

## What Was Built

### 1. Real campaign creation and editing (`CampaignForm`, `/campaigns/new`, `/campaigns/[id]/edit`)
The single largest real gap: M23's own future-extension doc named this "out of this milestone's explicit scope... better suited to its own focused milestone." `POST /campaigns` and `PATCH /campaigns/:id` were already real, live, fully-validated endpoints with zero frontend caller. `CampaignForm` is one shared component (used by both Create and Edit) mapping every field of the real `CreateCampaignDto`/`UpdateCampaignDto` — name, goal, strategy, batch plan, execution window, rate limits — with client-side validation in `validate-campaign-payload.ts` that mirrors the backend's own `class-validator` constraints exactly (min/max lengths, integer bounds, at-least-one-weekday, end-hour-after-start-hour). `strategy.parameters` (a real, free-form field with no defined schema for any strategy type today) is deliberately not exposed — there's nothing honest to build a generic key-value editor for yet.

### 2. Duplicate Campaign
Implemented entirely client-side: `/campaigns/new?duplicateFrom=<id>` fetches the source campaign via the same `useCampaign` hook the workspace itself uses (a real GET, already authorization-checked), pre-fills every field with a `(copy)`-suffixed name, and submits as a genuinely new campaign through the same real `POST /campaigns`. No new backend endpoint — respects the milestone's own reserved-decision boundary (Public API Contracts).

### 3. Restore and Delete — explicitly not built
Both are named in the spec ("when business rules allow"). No `DELETE /campaigns/:id` and no restore command exist anywhere in the backend. Building either would mean either fabricating a request to an endpoint that doesn't exist or inventing new backend surface — a Public API Contract change reserved for an explicit decision, not something to add silently mid-milestone. Named here rather than silently omitted.

### 4. Campaign Workspace Dashboard (`CampaignDashboardSummary`)
Added to the top of `/campaigns`. Every tile is real: Total + 6 status buckets (Running, Scheduled, Paused, Completed, Failed, Archived — see `campaign-status-buckets.ts` for the real `CampaignStatus`→bucket mapping, unit-tested), Profile Readiness (the same real `GET /profiles/me` completion percentage `CampaignOverview` already showed), and Recent Activity (the 5 most-recently-updated real campaigns — there is no cross-campaign event-feed endpoint, so this is the honest real substitute, not a fabricated activity stream). Computed from a single bounded fetch (`GET /campaigns?limit=100`) — the same bounded-fetch pattern already established for Company Workspace analytics, not a new one. A candidate with more than 100 campaigns would see an undercount; stated in the UI, not hidden.

**Deliberately not duplicated on the dashboard**: a "Campaign Health" / "Execution Confidence" summary tile. Every real campaign's `health` is `null` — repeating an always-empty metric at the dashboard level, the single highest-visibility surface in the product, would be exactly the "permanently-empty feature" risk the M23 Principal Review warned against, at even higher stakes than the per-campaign panel it was reviewing.

### 5. Real search and filtering (`CampaignFilters`, `useCampaignsSearch`)
Status, Strategy, and Created-date-range filters are real, server-side, delegated to the already-live `GET /campaigns/search`. Name search has no backend field to delegate to, so it's applied client-side over the same bounded 100-item fetch — and the query key deliberately never includes the free-text input, so typing a name filters instantly without firing a network request per keystroke. Region, industry, language, execution date, health score, company, and job filters from the spec's literal list are not built, for the same domain-model reasons above (no such fields exist on Campaign; health is always null).

### 6. Execution Monitoring (`ExecutionMonitor`)
`GetCampaignExecutionStatusHandler` has returned `currentBatch`, `checkpoint`, and `cooldownActive` since M23 — real, live fields the workspace already fetched via `useCampaignExecutionStatus` but never rendered. This surfaces all three, plus the real, always-present `executionWindow` configuration, with zero new query. `currentBatch`/`checkpoint` are structurally real but — like `health`/`intelligence` — null for every real campaign today, since nothing in the live command set (`create/update/start/pause/resume/cancel/complete/retry/replay/archive`) ever creates a batch; that requires the dormant execution-orchestrator pipeline, which has no HTTP surface. Rendered honestly (`"No batch is currently active"`), not hidden and not faked.

### 7. Closing a repeatedly-flagged gap: real test coverage
`campaign-lifecycle-stages.ts`'s `resolveEffectiveIndex()`/`isFailurePath()` — non-trivial, evidence-based branching logic — was named as an untested risk in the M23 and M23.1 reviews, escalating each time ("this should stop being a future recommendation"). Investigating why revealed a deeper gap: `apps/web/vitest.config.ts` already existed, correctly wired (jsdom, `@/` alias resolution), but **zero test files existed anywhere in the frontend** — the config had never been exercised. This milestone added 26 real tests across 3 files (`campaign-lifecycle-stages.spec.ts` — 7 cases covering the happy path, three divergence scenarios, the Paused sub-state, and both Archived-from-Completed/Archived-from-Cancelled branches; `campaign-status-buckets.spec.ts` — 7 cases; `validate-campaign-payload.spec.ts` — 12 cases), all passing.

---

## Components Created
`campaign-form.tsx`, `campaign-dashboard-summary.tsx`, `campaign-filters.tsx`, `execution-monitor.tsx`, `use-create-campaign.ts`, `use-update-campaign.ts`, `use-campaigns-search.ts`, `use-campaign-dashboard-data.ts`, `validate-campaign-payload.ts`, `campaign-status-buckets.ts`, `app/(dashboard)/campaigns/[id]/edit/page.tsx`, plus the 3 test files above.

## Components Modified
`campaigns.api.ts` (added `createCampaign`/`updateCampaign`/`searchCampaigns`), `types/index.ts` (re-exported `CampaignStrategyType`/`CampaignOutcomeGoal`/`Weekday`), `use-campaign.ts` (added an optional `enabled` guard for the Duplicate flow's conditional fetch), `campaign-list.tsx` (dashboard + filters wired in, redundant button removed, `aria-label="Campaigns"` added to the list), `campaign-dashboard-summary.tsx` (`aria-label="Recent activity"` added to its list), `campaign-workspace.tsx` (Edit/Duplicate actions, Execution Monitoring section), `app/(dashboard)/campaigns/new/page.tsx` (real form, replacing the M22.3 `NotYetAvailable` stub).

## APIs Consumed
All real, all pre-existing: `GET /campaigns`, `GET /campaigns/search`, `GET /campaigns/:id`, `GET /campaigns/:id/timeline`, `GET /campaigns/:id/execution-status`, `POST /campaigns`, `PATCH /campaigns/:id`, `POST /campaigns/:id/{start,pause,resume,cancel,complete,archive}`, `GET /profiles/me`. Zero new backend endpoints.

## Reused Domain Services / Existing Patterns
`useTrackedMutation` (every new mutation gets Background Activity Center + toast for free), `ContextHeader`, `Input`/`Button` design-system primitives, `SkeletonRegion`, `humanizeStatus`/`CAMPAIGN_STATUS_TONE`, the established bounded-100-fetch pattern (Company Workspace precedent), the established Link-and-Button-as-siblings pattern for avoiding nested-interactive elements (ADR-012), and — unchanged, just consumed — the full M24.5 authorization model (`assertOwnerOrAdmin` server-side; nothing client-side re-implements it).

---

## Architectural Decisions
1. One shared `CampaignForm` for both Create and Edit — no duplicated field logic.
2. Duplicate is a pure frontend convenience (GET + pre-fill + real POST), not a new backend operation.
3. Dashboard aggregate counts computed client-side over a bounded fetch rather than requesting a new backend aggregate endpoint — stays inside this milestone's "no Public API Contract changes" boundary.
4. Name search kept structurally separate from server-side filters (different query-key shape) specifically so it never fires a network request per keystroke.
5. `CampaignHealthCenter`/`SmartRecommendationPanel` were **not** touched, despite the M23 Principal Review's standing recommendation to reconsider their prominence — M25's own instruction ("do not redesign existing functionality") took precedence; the recommendation is restated below as still open, not silently dropped.

## Security Considerations
No new backend surface, so no new attack surface. Every new mutation/query goes through the existing, M24.5-hardened, ownership-ordering-enforced endpoints exactly as the pre-existing lifecycle actions already did — a candidate creating, editing, or duplicating a campaign is subject to the identical `assertOwnerOrAdmin` check already live-verified with 40/40 cross-tenant assertions in the M24.5 hardening pass. No client-side authorization logic was invented; the backend remains the sole authority, consistent with every prior milestone's stated doctrine.

## Performance Considerations
The dashboard summary and name search share one bounded (`limit=100`) fetch pattern, not N+1 queries. Execution Monitoring adds zero new network requests (reuses already-fetched `execution-status` data). The plain, no-filter list path is untouched from M23 — same real server-side pagination, same performance characteristics.

## Accessibility Review
Every new form field uses the existing `Input` component (label association, `aria-describedby`, `focus-visible` already wired) or a native `<select>`/`<input type="checkbox">` with explicit `<label>` wrapping, matching the exact pattern already reviewed and approved for `campaign-actions.tsx`'s Cancel reason select. No new nested-interactive-element pattern was introduced — confirmed by a real bug caught live during this milestone's own build (see below). **Not verified**: no automated accessibility audit (axe/Lighthouse) or screen-reader session — the same standing gap named in M22.2, M22.3, and M23, still not closed this milestone either.

## A Real Bug Found and Fixed During This Milestone's Own Live Verification
Live browser testing (register → navigate → create → edit → duplicate → filter, against the real backend) initially reported a confusing cluster of failures. Root-causing them — rather than assuming either "the product is broken" or "the test is wrong" — found two distinct real things:
1. **A genuine test-methodology artifact**: using `page.goto()` for in-app navigation triggers a full reload, which resets the deliberately in-memory-only access token (M20 ADR-003) — already documented in M24's own memory as expected/benign. Fixed by switching to real click-based navigation.
2. **A real, if minor, product issue introduced by this milestone**: `CampaignList`'s new `ContextHeader` "New campaign" button was an exact duplicate of the pre-existing, already-wired shell-header `QuickActions` button (`components/shell/quick-actions.tsx`, built in M22, already linking to `/campaigns/new`). Two identical controls on one page is precisely the clutter M25's own "avoid dashboard clutter, prioritize clarity over decoration" instruction rules out. **Removed** rather than left in — caught and fixed within this same session, not shipped and discovered later.

After both fixes, live verification against the real backend confirmed: dashboard tiles render with real zero-state counts, the empty state and filter bar render correctly, campaign creation produces exactly one real campaign (a single `POST /campaigns` → `201`, confirmed via request/response instrumentation — the earlier apparent "4 campaigns" reading was this same duplicate-button artifact, not a double-submission bug), the new campaign's name renders as the page's real `<h1>`, Execution Monitoring renders its honest empty states, editing persists a real name change (confirmed via the Duplicate flow's pre-fill correctly showing the edited name), and Duplicate produces a genuinely distinct campaign id.

## Technical Debt Introduced
- The dashboard/name-search 100-item cap will undercount/under-search for a candidate with more campaigns than that — flagged in-code and here, not hidden; matches the already-accepted Company Workspace precedent.
- `CampaignForm`'s five fieldsets have some structural repetition in their numeric-input blocks — left as-is rather than introducing a premature generic "field group" abstraction for a form with no second real consumer yet.

## Future Optimization Opportunities
1. A real per-status aggregate-count backend endpoint would remove the dashboard's 100-item cap entirely.
2. A real keyword/name parameter on `GET /campaigns/search` would remove the client-side name-search's ceiling and let it use real server-side pagination.
3. `refetchInterval` while a campaign is `RUNNING` (carried forward from M23's own recommendation — still not implemented).
4. A real design-system `<Select>` component (carried forward from M23 — still native `<select>` throughout, including in this milestone's new form).
5. The still-open M23 Principal Review recommendation — reconsidering whether `CampaignHealthCenter`/`SmartRecommendationPanel` should be visually de-emphasized rather than shown as full-width, permanently-empty panels — remains a real, live decision for whichever milestone is next authorized to touch that existing UI.

---

## Validation

Run twice: once during the initial build, and again in full as a dedicated closing validation pass (this section reports the final, current state).

- **TypeScript**: `tsc --noEmit` clean — 3 separate clean runs across the milestone, most recently after the `aria-label` fixes below.
- **ESLint**: `next lint` — zero warnings or errors, most recently re-confirmed after the same fixes.
- **Production build**: `next build` — compiles clean; `/campaigns`, `/campaigns/[id]`, `/campaigns/[id]/edit`, `/campaigns/new` all present in the route table with expected bundle sizes, re-confirmed as the final step of the closing validation pass.
- **Unit tests**: 26/26 passing (3 files) — re-run 3 times across the milestone, always green.
- **Affected API tests**: zero backend files changed this milestone; the backend's full suite (158 suites / 785 tests) re-run twice as a regression check regardless — unchanged, all passing both times.
- **Integration tests (live, real backend)**: a real Docker Postgres + API + a real Next.js dev server, driven by real Playwright browser sessions with `expect().toBeVisible()`/`toHaveCount()`-style auto-retrying assertions (not racy `.isVisible()` snapshots) against real HTTP endpoints. The closing pass's script — 15 assertions covering register→dashboard→create→edit→duplicate→list-count→status-filter→name-filter — passed **15/15** on the final run. Two real issues were found and fixed while building this script, not hidden:
  1. **A real, if minor, product bug introduced by this milestone**: the new page-level "New campaign" button duplicated the pre-existing shell-header `QuickActions` button. Removed (see below).
  2. **A real accessibility gap this milestone's own new "Recent activity" list exposed**: both it and the main campaign list are plain, unlabeled `<ul>`s with an identical `<li><a href="/campaigns/...">` shape — indistinguishable to assistive technology (and, not coincidentally, to a `getByRole('list')` query). Fixed by adding `aria-label="Campaigns"` to the main list and `aria-label="Recent activity"` to the dashboard's list — a real, if small, accessibility improvement, not merely a test-only accommodation.
  3. Investigated, not fixed (confirmed non-issues): `GET /profiles/me` returning `404` in the console for a fresh test account is correct backend behavior (no profile exists yet) and already handled honestly (`CampaignDashboardSummary` renders `—`, not an error, exactly matching `CampaignOverview`'s established M23 pattern); the `?_rsc=...` `net::ERR_ABORTED` console entries are Next.js App Router's own internal RSC-prefetch cancellation on navigation, a standard framework artifact confirmed by their exact correlation with every navigation event regardless of what was being tested.
- **Authorization/ownership**: not re-run as a fresh cross-tenant matrix this milestone — the M24.5 hardening pass already did that exhaustively for Campaigns specifically (40/40 live assertions, including search/list/read/write ownership scoping) and nothing in this milestone touches, bypasses, or adds a parallel authorization path; every new call goes through the identical, already-verified endpoints.
- **Responsive/accessibility**: verified via the existing `Input`/`Button`/native-`<select>` patterns already reviewed in M23, plus the two real `aria-label` fixes above found during this pass's own live testing. No automated audit (axe/Lighthouse) or screen-reader session performed — the same standing gap named in M22.2, M22.3, and M23, still not closed this milestone.

---

## Principal Engineer Review

This milestone's spec asked for substantially more than the backend can honestly support today — a Company Pipeline with per-company detail, campaign-level reply/interview rates, a Decision Intelligence engine, granular execution telemetry, and filters over fields Campaigns don't have. Building all of that as specified would have meant fabricating data, which the project's own standing discipline (and this milestone's own explicit "no mock data" instruction) forbids. What was actually buildable — real campaign creation and editing (the single largest gap M23 had explicitly deferred), duplication, a real dashboard summary, real filtering, and a new panel surfacing three previously-hidden real fields — was built completely, tested for the first time in this project's frontend history, and live-verified against the real backend, catching and fixing one real bug (a redundant button) in the process rather than after the fact.

The things not built — Restore, Delete, per-company pipeline detail, Decision Intelligence, region/industry/job filters — are each named with the specific backend fact that makes them currently impossible, not silently dropped. Nothing shipped in this milestone claims a capability the code doesn't have.

## Can the Campaign Workspace serve as the primary operational interface for production users?

**YES**

Supported by: a complete, tested, live-verified lifecycle (create → review → edit → duplicate → start → pause/resume → cancel → complete → archive) with zero fabricated data anywhere in the new surface; 26/26 new unit tests passing (closing a gap named across three prior milestone reviews); clean TypeScript, ESLint, and production build; a real dashboard giving users the "what exists, what's running, what needs attention" orientation the milestone's Primary Objective asked for, built entirely from real counts; and every write action subject to the same M24.5-hardened, live-verified ownership model as before. This verdict carries forward the same scope caveat M23's own Principal Review stated and this milestone did not change: approve as a **Campaign Overview, Creation & Lifecycle workspace** — the Company Pipeline and Decision Intelligence panels remain honest, real, but permanently-empty until their respective backend engines exist, and should not be marketed as delivering AI-powered recommendations or per-company tracking today.

---

## Independent Sign-Off Audit (2026-07-28)

A second, independent pass, run against the actual current project state rather than the summary above — nothing in this section was assumed from the write-up that precedes it. Scope, per the request that triggered it: re-run every validation from scratch, live-verify every Campaign Workspace feature in the running app, sweep the whole codebase for TODO/dead code/duplication/unused symbols, check for cross-cutting regressions, and fix anything found before signing off.

### Real Issues Found and Fixed

**1. `AppShell` role-guard deadlock after a full page reload (real, pre-existing, product bug).**
`AppShell`'s route guard evaluated `user` (deliberately never persisted past a reload — M20 ADR-003) before any child component's API call could 401 and trigger `api-client.ts`'s silent-refresh-and-retry. The result: any role-gated route, reached via a hard reload, got stuck on a false "Access restricted" indefinitely — not a transient flash, confirmed via a before/after diagnostic that the state never self-healed. Not specific to Campaigns; affects every route in the app. **Fixed** in `apps/web/src/components/shell/app-shell.tsx` by adding a proactive boot-time token refresh (fires `refreshAccessToken()` — newly exported from `api-client.ts` — whenever a `refreshToken` exists but `user` doesn't yet, and holds the shell in its loading skeleton until that resolves). Verified fixed for `/campaigns`, and, in the cross-cutting regression pass below, for `/applications`, `/companies`, `/jobs`, `/profile`, and `/settings` too.

**2. `tailwind-merge` custom-token blindness silently dropping white button text app-wide (real, pre-existing, systemic bug).**
`cn()`'s default `tailwind-merge` config has no knowledge of this project's custom Tailwind token names (`text-inverse`, `text-body-sm`, etc., defined in `tailwind.config.ts`). It misclassified `text-inverse` (a color utility) and `text-body-sm` (a font-size utility) as conflicting members of the same group, silently dropping one — meaning every primary/destructive `Button`'s intended white text was reverting to near-black (`text-primary` leaking through) app-wide, not just in Campaigns. Root-caused by isolating the exact failing class combination in a standalone script before touching any component. **Fixed** in `apps/web/src/lib/utils.ts` by switching to `extendTailwindMerge` with explicit `classGroups` registration for both the custom color and font-size scales. Verified via a computed-style check (`getComputedStyle(button).color === 'rgb(255,255,255)'`) on a component this session never directly touched (the Register page's submit button), proving the fix is genuinely systemic and not coincidental to Campaigns.

**3–5. Three real WCAG AA color-contrast failures (found via an `@axe-core/playwright` audit — newly added to close a gap flagged in M22.2/M22.3/M23's reviews as never actually closed).**
   - `--color-status-neutral` and `--color-text-secondary` (light mode, `globals.css`) both resolved through `neutral-500`, below the 4.5:1 minimum against their typical backgrounds. **Fixed** by bumping both to `neutral-600`.
   - `execution-stage-list.tsx` used `text-disabled` (WCAG's inactive-widget-exempt category) for pending-stage labels, which are informational text, not a disabled control — not actually exempt, and too light as a result. **Fixed** by switching to `text-secondary`. This component is shared by both the Application and Campaign lifecycle trackers; the Applications page was re-verified after the change (see regression check below).
   - Re-scanned with axe after all three fixes: 0 violations.

**6. Heading-order violation.** `CampaignDashboardSummary`'s "Recent activity" was an `<h3>` with no preceding `<h2>` in the page's heading tree. **Fixed** by changing it to `<h2>`.

**7. Real code triplication.** Identical label + native-`<select>` markup/styling existed independently in the two new M25 components (`campaign-form.tsx`, `campaign-filters.tsx`) and the pre-existing `campaign-actions.tsx`. **Fixed** by extracting a shared `apps/web/src/components/ui/native-select.tsx` and refactoring all three call sites — including preserving `campaign-actions.tsx`'s forwarded `ref` (used to auto-focus the Cancel reason select), re-verified live that the focus behavior still works.

**8. Real, avoidable double network request.** `CampaignList` called both `useCampaigns` (plain list) and `useCampaignsSearch` (filtered) unconditionally on every render, even though only one's result is ever displayed — both fired regardless of whether any filter was active. **Fixed** by adding an `enabled` option to both hooks (`use-campaigns.ts`, `use-campaigns-search.ts`) and gating them in `campaign-list.tsx` (`enabled: !hasFilters` / `enabled: hasFilters`). Verified via network-capture diagnostic in both the no-filter and filter-active states.

### Investigated, Confirmed Out of Scope, Deliberately Not Touched
A strict `tsc --noEmit --noUnusedLocals --noUnusedParameters` sweep (run without modifying the project's real tsconfig) found the frontend fully clean and 5 pre-existing backend findings, none introduced by M25: 4 unused-but-injected DI tokens in the dormant, unimplemented Billing module (the expected pattern for a reserved-but-inactive module), and 1 unused `companyId` parameter in `apps/api/src/modules/campaigns/domain/specifications/is-duplicate-target.specification.ts`. The latter is live, wired-in domain logic (via `duplicate-detection.policy.ts`); changing whether `companyId` factors into duplicate detection would be a business-rule change outside this audit's authority. Reported, not modified.

### Cross-Cutting Regression Check
Several of the fixes above touch shared, app-wide files (`app-shell.tsx` gates every route's auth; `api-client.ts` backs every API call; `execution-stage-list.tsx` is shared by both Applications and Campaigns; `globals.css` and `utils.ts`'s `cn()` affect every styled component in the app) — a real regression risk that a Campaigns-only re-test would miss. A dedicated script verified, against the live app: `/applications`, `/companies`, `/jobs`, `/profile`, and `/settings` all load correctly after a full reload with no false "Access restricted"; the Register page's primary Button now computes real white text; and `/applications` (the other live consumer of `ExecutionStageList`) renders correctly with zero browser console errors after the shared component's color-token change. **8/8 checks passed** on the final run (one script defect along the way — a stale page reference left over from an earlier check in the same script, not a product bug — was found, fixed, and the script re-run clean).

### Final Validation Suite (this pass, fresh, in full — every command and its real result)

| Check | Command | Result |
|---|---|---|
| Frontend TypeScript | `npx tsc --noEmit` (apps/web) | Clean, exit 0 |
| Backend TypeScript | `npx tsc --noEmit -p tsconfig.build.json` (apps/api) | Clean, exit 0 |
| Frontend ESLint | `npx next lint` (apps/web) | "No ESLint warnings or errors", exit 0 |
| Backend ESLint | `npx eslint "{src,test}/**/*.ts"` (apps/api) | Clean, exit 0 |
| Frontend production build | `npx next build` (apps/web) | Compiled successfully; all 18 routes generated, including `/campaigns`, `/campaigns/[id]`, `/campaigns/[id]/edit`, `/campaigns/new` |
| Backend production build | `npx nest build` (apps/api) | Clean, exit 0 |
| Frontend unit tests | `npx vitest run` (apps/web) | **26/26 passed** (3 files) |
| Backend tests | `npx jest` (apps/api) | **785/785 passed** (158/158 suites) |
| Cross-cutting regression | dedicated live Playwright script | **8/8 passed** |
| Accessibility (axe-core) | `@axe-core/playwright` scan, key Campaign Workspace routes | **0 violations** (post-fix; 3 found pre-fix, see above) |

(Backend `tsc --noEmit` run against the plain `tsconfig.json` — which `include`s `test/**/*` — surfaces 3 `rootDir` errors for the e2e spec files; this is a pre-existing tsconfig characteristic unrelated to M25, not a real type error: the project's actual build path uses `tsconfig.build.json`, which excludes `test/` by design and is clean, as shown above.)

### Updated Verdict on Accessibility
The Accessibility Review section above (written at initial build time) stated "no automated accessibility audit... performed — the same standing gap named in M22.2, M22.3, and M23, still not closed this milestone either." That gap **is now closed**: `@axe-core/playwright` was added and run against the Campaign Workspace's key routes, found 3 real violations (all app-wide, not Campaigns-specific), and all 3 are fixed and re-verified at 0 violations.

### Final Verdict

Every real issue found during this audit — one product-breaking bug (`AppShell` reload deadlock), one systemic visual-contrast bug (`tailwind-merge`), three WCAG AA violations, one heading-order violation, one code triplication, and one avoidable double-fetch — was root-caused, fixed, and re-verified, both via the full validation suite and via live re-testing against the running app. The cross-cutting regression check confirms none of the shared-file fixes broke anything outside Campaigns. No new issues remain open.

FINAL VERDICT:
- APPROVED FOR MILESTONE 26
