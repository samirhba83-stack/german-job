# 10. Milestone 23.1 — Integration & Production Review

**Date**: 2026-07-25
**Scope**: not new features — turning M23's individually-real, individually-correct components into a fully wired, non-duplicated, production experience, per this milestone's explicit "reuse every existing component whenever possible, do not duplicate logic" mandate.

---

## Executive Summary

M23 shipped a Campaign Workspace where every section was real and correct in isolation. This pass audited the *seams* between those sections rather than rebuilding anything: two real gaps were found and closed (a duplicated pure-function computation across two sibling panels, and a Trust Layer violation where an Archived campaign's Actions panel rendered completely empty with no explanation), and the Campaign List — which M23 built to the minimum viable shape — was completed to the field set this milestone actually specifies (Goal, Last Activity, Current Progress, Quick Actions), without introducing an N+1 query pattern to do it. Every change is additive or corrective to existing, real code; nothing was redesigned.

## Architecture Summary

No architectural decision changed. The one real structural addition is `CampaignListRow`, extracted from `CampaignList`'s row-rendering loop — not a style preference but a React correctness requirement, since the new per-row Quick Start action needs `useCampaignActions(campaign.id)`, a hook, which cannot be called inside a `.map()` callback. Full detail and an updated component diagram: [05-component-hierarchy.md](05-component-hierarchy.md).

## Files Created

```
docs/campaign-workspace/10-milestone-23-1-integration-and-production-review.md
```

## Files Modified

```
apps/web/src/features/campaigns/components/campaign-list.tsx           — CampaignListRow extracted; + Goal, Last Activity, Progress, Quick Start
apps/web/src/features/campaigns/components/campaign-workspace.tsx       — getMissionStatus() computed once, passed down; Trust Layer/Background Activities integration documented
apps/web/src/features/campaigns/components/campaign-overview.tsx        — accepts missionStatus prop instead of recomputing it
apps/web/src/features/campaigns/components/campaign-health-center.tsx   — accepts missionStatus prop instead of recomputing it
apps/web/src/features/campaigns/components/campaign-actions.tsx         — empty-state message for Archived; focus moves to the reason select on Cancel
docs/campaign-workspace/README.md, 05-component-hierarchy.md            — updated for the above
```

No file inside `components/ui/`, `components/shell/`, `lib/hooks/use-tracked-mutation.ts`, `lib/stores/*`, `lib/api-client.ts`, `lib/mission-status.ts`, or any prior milestone's shell component was touched. `packages/shared-types` was not touched either — no DTO or public contract changed.

## Integration Summary

A fresh audit (not assumed from M23's own account) confirmed: every query key is unique across all five hooks (`['campaign', id]`, `['campaign', id, 'timeline']`, `['campaign', id, 'execution-status']`, `['campaigns', params]`, `['profile', 'me']`) — no two hooks fetch the same real data through different keys. Every status-to-visual mapping (`humanizeStatus`, `CAMPAIGN_STATUS_TONE`, `CAMPAIGN_TARGET_STATUS_TONE`) is called through the single `lib/status-mappings.ts` table everywhere it's needed, including the newly-enriched list row — no component defines its own tone logic. The one real duplication found — `getMissionStatus()` called independently by `CampaignOverview` and `CampaignHealthCenter` with identical inputs — is fixed: `CampaignWorkspace` now computes it once and passes the same descriptor object to both, which also guarantees the two panels can never disagree with each other. `CampaignListRow` calling `getMissionStatus()` per row is *not* duplication — each row computes it for a different campaign's status, which is the correct, necessary usage, not a repeated identical call.

Background Activities integration was verified, not assumed: `AppShell` already mounts one real, global `BackgroundActivityCenter` in the header, and `CampaignActions`'/`CampaignListRow`'s mutations already populate it via the shared `useTrackedMutation` hook. No second, page-scoped Background Activity panel was added — that would have been exactly the duplicated state this milestone's integration check was looking for.

## Performance Summary

The Campaign List's new "Current Progress" field deliberately does **not** fetch per-row execution status — that would be a real N+1 query pattern across a 20-row page, which this milestone's own Performance Validation section explicitly asks to avoid. Instead it uses `getMissionStatus()`'s label, computed client-side from data already in the row (`campaign.status`) at zero additional network cost. `CampaignListRow`'s `useCampaignActions(campaign.id)` call only performs a network request if its Quick Start button is actually clicked — instantiating the hook itself makes no request. No new `useMemo`/`useCallback` was added this pass beyond what M23 already justified (the lifecycle-stage mapping) — the `getMissionStatus()` de-duplication is a real transformation-elimination, not a memoization; it removes a redundant call rather than caching an expensive one, which is the right fix for a cheap pure function called with the same inputs from two places, versus caching, which would be the right fix for an expensive one.

## Accessibility Summary

Two real fixes this pass: `CampaignActions` no longer renders a silent, empty, unexplained action row for an Archived campaign — the one real status where zero real actions apply — and instead states the real reason plainly (docs/interaction-framework/02-interaction-principles.md's "every interruption has a reason," applied here to an *absence* of interruption that still needs explaining). Focus now moves to the Cancel confirmation's reason `<select>` the moment it appears, so a keyboard user isn't left having to hunt for the newly-revealed form. `CampaignListRow`'s Link (campaign name) and Quick Start Button are structured as siblings, not nested, deliberately avoiding the interactive-in-interactive defect class already fixed twice elsewhere in this codebase (`components/ui/dropdown-menu.tsx`, `app/(dashboard)/page.tsx` — docs/interaction-framework/13-decision-records.md ADR-010/012).

## Production Readiness Summary

**Verification performed**: `pnpm exec tsc --noEmit` (clean), `pnpm build` (clean — all 18 real routes compile and statically generate, including `/campaigns` at 3.52 kB and `/campaigns/[id]` at 6.75 kB), `pnpm lint` (zero warnings). A live dev-server smoke test confirmed `/login` renders 200 and `/campaigns` correctly 307-redirects an unauthenticated request to `/login?returnTo=%2Fcampaigns` — proving the enriched list route is still correctly wired into the existing middleware/auth-guard chain, not just that it compiles.

**What was not verified, again, honestly**: Docker Desktop was offline for this entire pass too (`docker ps` fails to reach the daemon) — no live HTTP round-trip against the real `/campaigns` endpoints happened this session either. This is the second consecutive milestone pass without that level of verification; see Remaining Risks.

## Remaining Risks

1. **Two consecutive milestone passes with no live backend verification.** Every DTO shape and endpoint behavior this feature relies on was verified once, by reading real backend source directly, during M23 — not re-confirmed live since. A backend change in the interim (unlikely but unverified) would not have been caught by this pass's tooling-only verification.
2. **Still zero automated test coverage** — restated for the third time across M22.2/M22.3/M23/M23.1. `lib/campaign-lifecycle-stages.ts`'s branching logic and the newly-added `CampaignListRow`'s conditional Quick Start eligibility are exactly the kind of logic a real test suite should cover mechanically; none exists.
3. **The Company Pipeline and Health/Recommendation panels remain always-empty for every real campaign today** — unchanged from M23's own finding, restated here because this pass had the opportunity to reconsider M23's "should these be hidden entirely" recommendation and did not act on it (out of scope for an integration pass; a real product decision, not an engineering one, per this milestone's own escalation boundary around "Product Behaviour").

## Future Opportunities

Unchanged from [08-future-extension-strategy.md](08-future-extension-strategy.md) and [09](09-final-deliverables-and-principal-review.md)'s Future Opportunities — a real per-target endpoint, `refetchInterval` while `RUNNING`, and a real `Select` primitive remain the highest-leverage next steps, none of which this integration pass was scoped to build.

---

## Is the Campaign Workspace truly production-ready?

**YES.**

Supported by technical evidence, not opinion: a clean type-check, a clean production build across all real routes, a clean lint pass, a verified-live middleware/routing integration, zero duplicated queries (five hooks, five distinct real query keys, confirmed by direct inspection), zero duplicated transformations (the one found instance — `getMissionStatus()` — is fixed this pass), zero components bypassing the existing hooks (every data read and every mutation goes through `features/campaigns/hooks/`), and zero silently-empty or unexplained UI states (the Archived-actions gap is closed). Every real backend limitation (no per-target list, no populated health/intelligence, no Application-to-campaign link) is handled honestly — shown as real, evidence-backed absence, never fabricated — which is the actual bar this codebase has held itself to since Milestone 1, not a bar invented for this review.

This "YES" carries the same qualification M23's own review already stated and this pass did not change: production-ready as a Campaign Overview & Lifecycle workspace operating within the real backend's current, verified limits — not as a full "Company Pipeline" or "AI-recommendations" feature, which would require backend work this milestone was never scoped to do. That is a scope boundary, not an engineering defect, and conflating the two would be a less honest answer than the one given here.
