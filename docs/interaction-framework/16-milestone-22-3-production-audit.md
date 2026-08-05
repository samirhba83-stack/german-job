# 16. Milestone 22.3 — Production Readiness Audit & Frontend Architecture Validation

**Date**: 2026-07-25
**Scope**: a complete engineering audit of the `apps/web` frontend built across Milestones 20–22.2, before Milestone 23 (Dashboard, Mission Control, Campaign Workspace, Company Workspace) begins. No new features. The mandate: verify everything, fix what's broken, document every decision, and give an honest, evidence-backed READY / NOT READY verdict.

---

## Executive Summary

This audit re-read the entire `apps/web/src` tree file by file rather than trusting the prior milestones' own self-assessments, and it found real, concrete defects that two prior milestones (including one explicitly billed as a "self-review") had missed. The most severe: **nine real navigation targets in the shipped shell — Sidebar items, Quick Actions, the Profile Menu — pointed at routes with no `page.tsx` at all.** Most 404'd outright; one, `/jobs/new`, was worse — Next.js's static-route-before-dynamic-route precedence meant it silently rendered the wrong page (a job detail view for a job literally named "new") with no visible error, the kind of defect that looks like correct behavior until someone reads the actual content. This is now fixed: every one of those nine routes has a real page rendering an honest, specific "not built yet" message, reusing a new shared `NotYetAvailable` component that (fittingly) gives `ContextHeader` — built in M22.2, never instantiated — its first real caller.

Beyond that, the audit found and fixed: a repeat instance of a defect class M22.2 had already found once (a `Card` with its own `tabIndex` nested inside a real `<Link>`, on the Dashboard root page — the exact same "two focusable elements for one action" bug as the DropdownMenu fix, just missed the first time because the audit that found the DropdownMenu instance never searched for the pattern elsewhere); a real gap between a code comment's claim and the code's actual behavior (`DropdownMenuContent` said Escape "returns focus to the trigger" — it didn't, for any of the shell's six-plus dropdown instances); an invalid-HTML root element shared by every dropdown in the product; a route-level authorization gap (`/admin` was hidden from the Sidebar for non-admins but nothing stopped direct navigation to the URL); the one component in the whole library that broke the documented "zero component-level theme branching" rule; and a cookie missing a standard hardening flag. All were fixed with real code changes, verified by a clean production build (all 17 real routes compile and statically generate), a clean lint pass, and live requests against the running dev server confirming the new routes are correctly protected by the existing middleware.

## Architecture Findings

**Strengths**: the Clean layering established in M20 (`components/ui` primitives → `components/shell` composition → `features/*` product slices, one-directional) held up under scrutiny — no circular dependency, no shell-depends-on-feature inversion was found anywhere in 66 source files read in full. The CSS-custom-property/token architecture (ADR-005) is real and consistently applied, with exactly one exception found and fixed (`Skeleton`, ADR-013). The `NAV_ITEMS`/`visibleNavItems()` single-source-of-truth pattern for permission-based UI filtering is sound in principle; its actual routing-layer enforcement was the gap (ADR-008/009), not its design.

**Weaknesses**: `NavItem.status: 'live' | 'dormant'` conflates two different questions — "does the backend exist" and "does a real frontend page exist" — which is precisely how nine dead links went unnoticed for two milestones: `Campaigns`/`Companies`/`Applications`/`Jobs`/`Billing`/`Settings` are all `status: 'live'` because their *backend* is live, but three of those six had no frontend route at all. This audit did not rename or restructure this field (that would be scope creep into a naming/taxonomy change affecting every nav item), but it is named here as a real, load-bearing ambiguity a future engineer should resolve before adding more nav items — see Future Recommendations.

**Risks**: the four M1-era feature slices (`features/applications`, `features/billing`, `features/jobs`'s two list/detail components) remain literal `throw new Error('Not implemented')` stubs one layer down (their `api.ts` functions) — currently unreachable dead code since their hooks never call them, verified by reading all three hook files, but a landmine if a future engineer wires a hook to the api function without noticing it still throws.

**Technical debt**: none *introduced* by this audit. Debt *found*: the six-plus-instance DropdownMenu defects (now fixed) were a form of debt that had compounded — a bug fixed once (M22.2's asChild pattern) but two more bugs (invalid root element, missing focus restoration) sat in the same file undiscovered because the M22.2 review, by its own account, was reading for *specific* known defect classes rather than the file as a whole.

## Component Audit Findings

Naming and props-API consistency across `components/ui/` is genuinely good — every component follows the same `forwardRef` + `cn()` + variant-map pattern (`Button`, `Input`, `Card`), and none was found using a bespoke, one-off convention. Two real defects found: `Card`'s `interactive` prop had no documentation warning against the exact misuse that then occurred at its one real call site (fixed — see ADR-012); `Skeleton` alone bypassed the token system (fixed — ADR-013). `DropdownMenu`'s three defects are detailed in the Accessibility section below. No duplicated component logic was found beyond the now-extracted `isNavItemActive` (previously inlined only in `PrimarySidebar`, now shared with `AppShell`'s new role guard — ADR-009).

## State Management Findings

No duplicated or conflicting state ownership was found. `useAuthStore` (session), `useThemeStore` (UI preference), `useToastStore`/`useBackgroundActivityStore` (transient UI feedback), and TanStack Query (server state) each own a genuinely distinct concern with no overlap — verified by reading all four stores and `providers.tsx` in full. Re-render minimality was already addressed in M22.2 (atomic selectors in `AppShell`/`use-auth.ts`); this audit found no further instance of whole-store destructuring anywhere else in the codebase (checked every `useAuthStore(`/`useBackgroundActivityStore(`/`useThemeStore(`/`useToastStore(` call site). The three M1-era data-fetching hooks (`useApplications`, `useSubscription`, `useJobListings`) do not use TanStack Query at all — they return hardcoded empty state — a real, but already-labeled (`// TODO`), gap that is Milestone 23's job to close, not this audit's.

## Performance Findings

No memory leaks were found: every `useEffect` that adds an event listener or a timer has a matching cleanup (`DropdownMenuContent`, `MobileNavDrawer`, `ToastItem` all verified). No component in the codebase uses `React.memo`, `useMemo`, or `useCallback` — for a shell of this size (a handful of header controls, no large lists, no expensive computation anywhere in the render path), this is the *correct* absence, not a gap: adding memoization here would be optimizing a cost that doesn't exist yet, contrary to this project's own standing "no abstractions beyond what the task requires" discipline. This should be revisited once Milestone 23 introduces real data lists (a Campaign list, an Application list) where render cost is no longer hypothetical.

## Accessibility Findings

Three real defects found and fixed, all detailed with full rationale in [12-accessibility.md](12-accessibility.md) and [13, ADR-010 through ADR-012](13-decision-records.md): `DropdownMenu`'s invalid `<span>` root wrapping block content; `DropdownMenuContent`/`DropdownMenuItem` claiming (in their own code comments) to restore focus to the trigger on close without actually doing so; and `Card`'s `interactive` prop producing a second focusable element when nested inside a real `<Link>` on the Dashboard root page. No new automated audit tooling (axe, Lighthouse) was run — this remains the single largest, already-named outstanding gap from M22.2's own self-review, restated here because it is exactly the kind of mechanical check that would have caught at least two of this audit's three findings automatically rather than requiring a human to read every file.

## Security Findings

Bearer-token authentication (not cookie-based) means the API surface is inherently CSRF-resistant — the browser never auto-attaches the access token to a cross-site request, since it's only ever sent via an explicit `Authorization` header set in JS. Real gaps found and fixed: no route-level role enforcement beyond UI-hiding (ADR-009); the session marker cookie missing `Secure` (ADR-014). Real gaps found and *not* fixed, because fixing them is out of this audit's scope (backend work or an accepted, already-documented interim tradeoff): the refresh token lives in `localStorage`, a real XSS-exposure surface, accepted since M20 pending the backend adding httpOnly-cookie refresh issuance (unchanged — this audit re-verified the reasoning still holds, it did not re-litigate the decision). No secrets, API keys, or credentials were found hardcoded anywhere in `apps/web/src` (checked via pattern search for `SECRET`/`KEY`/`dangerouslySetInnerHTML`/`eval`/`innerHTML` — the only `dangerouslySetInnerHTML` use is the theme boot script, which injects a static, hardcoded string with zero user input, not a real injection surface).

## Maintainability Findings

The `docs/frontend-architecture/`, `docs/product-experience/`, `docs/career-intelligence/`, `docs/design-system/`, and `docs/interaction-framework/` document sets together give a future engineer an unusually complete picture of *why* each real decision was made, not just what the code does — verified directly useful during this audit, which relied on them to understand intent before judging implementation. The 🟢/🟡/⚪ grounding-tier convention, used consistently since M20, made it fast to distinguish "this looks unfinished because the backend doesn't support it yet" from "this looks unfinished because it's actually broken" — exactly the distinction this audit's navigation-defect finding needed to draw correctly.

## Interaction Findings

Consistency holds: every real mutation in the product (login, register, logout — currently the only three) goes through `useTrackedMutation`, producing the same three-part pattern (Background Activity entry, toast, real error message) with no exceptions found. The newly-added placeholder pages deliberately do *not* introduce a new interaction pattern — they're static content, no loading/saving/retry state applies to them, and they don't pretend otherwise.

## Trust Layer Validation

The navigation-defect finding was, at its core, a Trust Layer failure: a user clicking a real, unmarked (no "Soon" badge) Sidebar item and landing on a blank error page, or worse, a page that looks plausible but shows the wrong content, is the exact "black box" experience [02-interaction-principles.md](02-interaction-principles.md) explicitly exists to prevent. Every fix in this audit either restores a claimed behavior that didn't exist (focus restoration) or replaces a silent failure with an honest, specific explanation (every new placeholder page). Nothing in this audit weakened or removed an existing honest-gap message to make something look more finished than it is.

## Files Created

```
apps/web/src/components/shell/not-yet-available.tsx
apps/web/src/app/(dashboard)/campaigns/page.tsx
apps/web/src/app/(dashboard)/campaigns/new/page.tsx
apps/web/src/app/(dashboard)/companies/page.tsx
apps/web/src/app/(dashboard)/companies/new/page.tsx
apps/web/src/app/(dashboard)/jobs/new/page.tsx
apps/web/src/app/(dashboard)/settings/page.tsx
apps/web/src/app/(dashboard)/profile/page.tsx
apps/web/src/app/(dashboard)/mission-control/page.tsx
apps/web/src/app/(dashboard)/admin/page.tsx
docs/interaction-framework/16-milestone-22-3-production-audit.md
```

## Files Modified / Refactored

```
apps/web/src/components/ui/dropdown-menu.tsx        — span→div root, focus restoration, ref merging (ADR-010, ADR-011)
apps/web/src/lib/navigation.ts                        — isNavItemActive(), findNavItemForPath() extracted (ADR-009)
apps/web/src/components/shell/primary-sidebar.tsx     — reuses isNavItemActive() instead of an inline duplicate
apps/web/src/components/shell/app-shell.tsx            — real route-level role guard (ADR-009)
apps/web/src/components/ui/skeleton.tsx                 — bg-skeleton token, not a raw dark: variant (ADR-013)
apps/web/src/app/globals.css                              — --color-skeleton token (light + dark + system-preference)
apps/web/tailwind.config.ts                                — skeleton color mapped to the new token
apps/web/src/app/(dashboard)/page.tsx                      — Card/Link double-focusable fix (ADR-012)
apps/web/src/components/ui/card.tsx                         — interactive prop doc comment warning against the fixed misuse
apps/web/src/lib/stores/auth-store.ts                       — Secure flag on the session cookie over HTTPS (ADR-014)
apps/web/src/features/applications/components/application-list.tsx   — honest placeholder instead of a bare heading
apps/web/src/features/billing/components/subscription-overview.tsx     — same
apps/web/src/features/jobs/components/job-listing-list.tsx               — same
apps/web/src/features/jobs/components/job-listing-detail.tsx              — same
docs/interaction-framework/README.md, 01, 07, 12, 13   — updated to reflect all of the above
```

## Production Readiness Report

**Verification performed**: `pnpm build` (clean — 17 real routes compile, all statically generate with no errors); `pnpm lint` (zero warnings, zero errors); a live dev-server request to a newly-added route (`/campaigns`) confirming the existing `middleware.ts` correctly redirects an unauthenticated request (307 → `/login`), proving the new route is registered and protected exactly like every pre-existing one, not a special case. No real browser/automated-accessibility/visual-regression tooling was available in this environment — the same standing gap M22.2 already named, unchanged by this audit.

**What's genuinely fixed and load-bearing for Milestone 23**: the navigation-integrity fix matters most for M23 specifically, because M23's job is to *replace* several of these exact placeholder pages (`/campaigns`, `/companies`) with the real Campaign/Company Workspace — M23 now has a real, working route to build into rather than a route that first needs to be created from scratch. The role-guard mechanism (`findNavItemForPath` + `AppShell`) is also directly reusable the moment M23 adds any genuinely sensitive, role-restricted page.

## Future Recommendations

1. **Resolve the `NavItem.status` ambiguity** ("backend live" vs. "frontend page real") before adding more nav items — the exact conflation that let this audit's central finding go unnoticed for two milestones.
2. **Stand up real component/unit test coverage** — restated from M22.2's own self-review, and reinforced by this audit: several of today's findings (the invalid dropdown root, the missing focus restoration, the Card/Link double-focus) are exactly the class of defect `jest-axe` and React Testing Library component tests catch mechanically and permanently, rather than requiring a third manual audit to find a fourth instance later.
3. **Wire the three M1-era data-fetching hooks to real TanStack Query calls** as part of Milestone 23's real Applications/Jobs/Billing screens, retiring the `throw new Error('Not implemented')` stubs they still sit on top of.
4. **Run a real automated accessibility audit** (axe or Lighthouse) the moment browser tooling is available — named three milestones running now.

---

## Conclusion

**READY FOR MILESTONE 23**

This is supported by, not asserted over, the evidence above: a clean production build across all 17 real routes, a clean lint pass, a verified-live middleware/routing integration for every newly-added route, zero remaining broken or silently-wrong navigation targets anywhere in the shell (verified by reading every `href`/`router.push` call site in the codebase against the actual `app/` route tree), and every defect this audit found — nested-interactive-element bugs, a claimed-but-missing focus-restoration behavior, an invalid HTML root, a route-authorization gap, a token-system exception, a missing cookie flag — fixed with a real code change and a real, dated Architecture Decision Record, not deferred or hidden. The foundation was not perfect before this audit and is not being declared perfect now: the outstanding items (no automated accessibility tooling, no component test suite, the `NavItem.status` ambiguity, the M1-era stub hooks) are named plainly above as real, unresolved work — none of them block starting Milestone 23's real feature pages, and several of them (test coverage in particular) are best tackled *alongside* that real page work rather than as a further isolated audit pass.
