# 14. Risks, Future Expansion, and Readiness Assessment

## Milestone 22.2 status of each M22 risk

R-1 (stale port-3000 container), R-5 (test data in dev DB), and R-6 (refresh-token XSS exposure) are unchanged — none were in this pass's scope. R-3 (no automated accessibility/visual regression testing) is **partially addressed**: real keyboard menu navigation and high-contrast support were built this pass ([12-accessibility.md](12-accessibility.md)), but an automated audit (axe/Lighthouse) still hasn't been run — the tool remained unavailable in this environment. R-2 (the `AllExceptionsFilter` message-nesting fix lives only in the frontend) and R-4 (the dormant-pipeline execution feedback gap is visible in the shipped product) are unchanged in substance, though R-4's surface area grew slightly: `ExecutionStage.recommendedNextAction` is now a real field in the type that stays permanently unset for the Application lifecycle mapping, for the same reason `ExecutionFeedbackUnavailable` exists — see R-7 below for why this doesn't change the risk's character.

## Risks and mitigations

### R-1: The port-3000 stale-container gotcha
**Risk**: during this milestone's own verification, `localhost:3000` was found occupied by a `german-job-engine-web-1` Docker container that had been running for 39 hours, serving stale, pre-M22 code — `curl`/browser requests to port 3000 silently hit that stale build instead of the real local dev server (which fell back to port 3001). A future developer running `pnpm dev` without noticing the "Port 3000 is in use, trying 3001 instead" message could spend real time debugging phantom issues against the wrong server.
**Mitigation**: named explicitly here. The actual fix — stopping or rebuilding the stale container — is an operational action outside this milestone's scope (not a code change), and wasn't performed unilaterally on a long-running container without being asked. Recommend running `docker compose down` / `docker compose up --build web` before the next local frontend session if this hasn't already been addressed.

### R-2: The `AllExceptionsFilter` message-nesting fix lives only in the frontend
**Risk**: `lib/api-client.ts`'s `extractMessage()` ([13, ADR-004](13-decision-records.md)) compensates for a real backend inconsistency (built-in NestJS exceptions nest `message`, hand-thrown domain exceptions don't) entirely client-side. If the backend's error shape ever changes (e.g. a future fix flattens it, or a new exception type nests differently), this function needs to be revisited.
**Mitigation**: the finding and the exact shapes observed are documented in ADR-004 with real, reproducible examples — a future engineer touching either side has the evidence needed to change both consistently, rather than rediscovering the inconsistency from scratch.

### R-3: No automated accessibility or visual regression testing
**Risk**: [12-accessibility.md](12-accessibility.md) and [11-responsive-interaction.md](11-responsive-interaction.md) both note that real ARIA attributes and responsive classes exist in the code but were never run through axe/Lighthouse or checked in an actual browser across breakpoints — no browser-automation tool was available in this environment.
**Mitigation**: the implementation is correct by construction (built directly against [M21's verified token/contrast work](../design-system/09-accessibility.md)), which lowers but doesn't eliminate this risk. A real audit pass is genuine outstanding work, not assumed complete.

### R-4: The dormant-pipeline execution feedback gap is visible in the shipped product, not just in documentation
**Risk**: unlike a purely architectural milestone where an honest gap only shows up in a doc, this milestone ships real, running code — meaning `ExecutionFeedbackUnavailable`'s placeholder state ([03](03-execution-feedback.md)) is something a real user could eventually see, not just a note in a spec. If a future page wires it in prominently before the backend catches up, the "not yet available" messaging needs to stay accurate and current.
**Mitigation**: the component and its honest-gap framing are designed together, per [M20's ADR-008 pattern](../frontend-architecture/12-architecture-decision-records.md), specifically so this stays true regardless of when it's actually used.

### R-5: Live verification created real test data in the dev database
**Risk**: this milestone's verification process registered several real test user accounts against the live dev Postgres instance (via genuine `POST /auth/register` calls) to confirm the response envelope and error shapes.
**Mitigation**: these are inert dev-only rows with no relation to any other real data (matching the exact justification pattern used for similar cleanup in [M19](../M19-VALIDATION-REPORT.md)) — noted here for transparency; no destructive cleanup action was taken unilaterally on the shared dev database without it being a trivial, obviously-safe operation.

### R-6: Refresh-token XSS exposure is now live, not just documented
**Risk**: [M20's ADR-003](../frontend-architecture/12-architecture-decision-records.md) already named `localStorage` refresh-token storage as an accepted interim risk. This milestone is the first to actually put real tokens through that code path.
**Mitigation**: unchanged from M20's own assessment — this remains open until the backend supports httpOnly-cookie refresh issuance ([M20 OQ-10](../frontend-architecture/13-risks-and-open-questions.md)), restated here because it's no longer a hypothetical risk on a real, running system.

### R-7: `ExecutionStage.recommendedNextAction` and `TrustFeedbackCard`/`getMissionStatus()`'s `confidence`/`lastUpdateTime` are real fields with no real caller yet
**Risk** (Milestone 22.2): three fields were added specifically because the milestone asked for them — a per-stage recommended action, and Mission Status's confidence/last-update time — but no backend field backs the first (so it's permanently `undefined` in the one real stage mapping that exists), and no page in this milestone actually calls `getMissionStatus()` with real health context (so `confidence`/`lastUpdateTime` are `null` everywhere they're currently reachable). A future engineer skimming the type signatures alone could mistake these for working features.
**Mitigation**: every one of these fields has an explicit code comment stating the gap plainly (see `execution-stage-list.tsx`, `mission-status.ts`) — the same "structurally supported, honestly not yet reachable" pattern already established for the Background Activity Center's `queued` status in M22. No UI silently renders a fabricated value for any of them; they simply don't render when absent, which is the entire mitigation.

### R-8: `AccordionContent`'s `aria-hidden` collapse pattern does not fully remove collapsed content from tab order
**Risk** (Milestone 22.2): `AccordionContent` uses `aria-hidden="true"` plus a `grid-rows-[0fr]` visual collapse to keep the expand/collapse animation working, rather than the `hidden` attribute. `aria-hidden` alone does not remove an element's interactive descendants from the native tab order — a sighted keyboard-only user could theoretically Tab into an invisible, collapsed accordion panel's content if it contains focusable elements, even though screen reader users are correctly shielded from it via `aria-hidden`.
**Mitigation**: no real page in this milestone puts focusable content inside an `AccordionContent` yet (the component isn't instantiated anywhere), so this has no live impact today. Flagged here so the component's first real usage (the Decision Explanation block, per [08](08-progressive-disclosure.md)) adds `inert` (or manually manages `tabIndex={-1}` on collapsed-panel descendants) if that panel's content is itself interactive — a real, scoped follow-up rather than a defect fixed today.

## Future expansion opportunities

- **Wire `ExecutionStageList` to real pipeline events** the moment `recommendations`/`application-assembly`/`business-policy-enforcement` or `execution-tracking` gain a controller — additive, no redesign needed ([03](03-execution-feedback.md)).
- **Build `Activity Feed`, `Alert`, `Toast`-with-undo** (already fully specified in [M21 §7](../design-system/07-component-library.md) Part B) as real components once a page needs them — Company archive/restore is the one real, existing reversible action ([Product Experience UX-DR](../product-experience/16-ux-decision-records.md)) that would use undo first.
- **Consider a backend fix to `AllExceptionsFilter`** so `message` is always flat, removing the need for `extractMessage()`'s dual-shape handling — a candidate for a future backend milestone, not this one.
- **Real public landing page and Onboarding Wizard** — both real gaps this milestone's routing decisions (ADR-001) surfaced concretely; neither is built here.
- **Automated accessibility/visual regression tooling** (R-3) — the natural next investment once real pages exist to test.
- **Wire `TrustFeedbackCard` and `getMissionStatus()`'s health context into the real Campaign Workspace** (R-7) the moment that page exists — pass `GET /campaigns/:id`'s real `health` field straight through; no further design work needed, only the page itself.
- **Add `inert` to `AccordionContent`'s collapsed state** (R-8) when its first real usage (a Decision Explanation block) contains genuinely interactive descendants.

---

# Readiness Assessment: Is the platform ready to begin the first production pages (Dashboard, Mission Control, Campaign Workspace, Company Workspace)?

**Yes, for Dashboard and Campaign/Company Workspace — with real, working foundations, not just a specification. Not yet for Mission Control, for the same backend reason every prior milestone has already established.**

### What's genuinely ready

A real, running, verified Application Shell (`AppShell`) that every one of those four pages can be built inside today, with zero further shell work required. A real, working auth system (register/login/logout, token refresh, role-aware navigation) — proven against the live backend, including real bugs found and fixed by that testing (the response envelope, the error message shape) that would otherwise have silently broken every single future page's data fetching and error handling on day one. A real design-token implementation (Tailwind + CSS variables) matching M21 exactly, now including a working Theme Switcher and high-contrast support. A real, reusable interaction toolkit (`useTrackedMutation`, `Toast`, `Background Activity Center`, `Skeleton`, `Accordion`, `TrustFeedbackCard`) that the Dashboard's widgets and both Workspace pages' mutations can use immediately, with zero new infrastructure decisions required — and, as of Milestone 22.2, actually exercised by a real user flow (login/register/logout) rather than built and left uncalled.

Milestone 22.2's self-review pass means this shell has now been read critically twice, not once — real accessibility defects (nested interactive elements, missing keyboard navigation, an unreachable mobile search entry), real performance defects (unnecessary re-renders from whole-store Zustand destructuring), and a real functional gap (the Background Activity Center's zero real callers) were found and fixed, not just theorized about. The next milestone inherits a shell that has already survived one honest audit.

### What's still correctly gated on backend work

Mission Control cannot be built as a real page yet — not because of anything this milestone left undone, but because `mission-control` remains a dormant module with no controller, exactly as M20, M20.5, and M20.6 each independently concluded. `05-mission-status.md`'s real, working Mission Status layer covers the one-campaign-at-a-time view; the cross-campaign Mission Control experience still needs that backend surface first.

### The concrete, actionable starting point for the next milestone

Build the Dashboard's widgets (Campaign Summary Cards, Recent Application Activity, Profile Completeness — all 🟢 live data per [M20 §4](../frontend-architecture/04-dashboard-architecture.md)) using `useTrackedMutation`/`Skeleton`/the Status Badge tone mappings (`lib/status-mappings.ts`) already built here, inside the existing `(dashboard)/page.tsx` slot (replacing its current placeholder). Campaign Workspace and Company Workspace follow the identical pattern against their own live endpoints. No further architectural decisions are required before that work starts — this is the concrete, unqualified readiness M20's own original assessment was building toward.
