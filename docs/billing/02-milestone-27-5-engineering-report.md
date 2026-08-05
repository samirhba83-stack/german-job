# Milestone 27.5 — Premium Product Experience & Visual Design Upgrade

**Date**: 2026-07-30
**Scope**: Presentation-layer only. Zero backend, billing-architecture, Paddle-integration, webhook, subscription-logic, entitlement, security, or business-rule changes — confirmed by the file list below (every touched file is under `apps/web/src`; `apps/api` is untouched this milestone). Elevates the Billing Workspace, introduces a standalone marketing pricing page, and — in a second, explicitly-requested completion pass — extends the same audit-and-fix discipline across every other real screen in the product (campaigns, companies, jobs, applications, settings, mission control, dashboard).

This report was revised once: the first pass deliberately scoped Phase 1/5/6 narrowly (Billing + Pricing only, plus two low-risk global component tweaks) and named that narrowing as a limitation. Asked to complete every remaining phase without skipping any, the second pass below closes that gap for real — broader audit, more component fixes, applied across the whole app, fully re-validated.

---

## A Real Conflict Named Before Any Code Was Written

The brief described "the already approved German Job Engine design language" as a dark-only interface with a gold accent. The actual approved system (Milestone 21, `docs/design-system/`, fully built and previously accessibility-audited) is an indigo-600/400 accent with a light-mode default and a fully-supported dark mode via toggle or system preference — not gold, not dark-only. This is exactly the situation the brief's own autonomy clause reserves for a stop ("Only ask if a requested visual direction would conflict with the approved brand"), so a clarifying question was asked before touching any token. Confirmed: keep the real indigo system and both real themes; apply Linear/Stripe/Vercel-caliber polish on top of it, not a new brand identity.

---

## Phase 1 — Design System Audit (completed across the whole app)

Read the shared component library in full (`Card`, `Button`, `Badge`, `DropdownMenu`, `Toaster`, `Accordion`, `Tooltip`, `Avatar`, `Input`, `NativeSelect`, `Skeleton`) and every real page in the product (dashboard, campaigns list/workspace/edit, companies list/workspace, jobs, applications, settings, mission control, admin, billing, pricing). Findings:

- The existing component library is already unusually disciplined — real APG keyboard patterns on `DropdownMenu`, real focus-restoration on close, a documented history of prior accessibility audits (M22.2/M22.3/M25) each fixing a specific, evidenced contrast or interaction bug. This was never a codebase that needed a rewrite; it needed real, additive polish layered on a genuinely solid foundation — confirmed even more strongly after reading every remaining component and page.
- **Three real, previously-undiscovered defects found by this audit's own tooling** (axe-core scans and direct code reading, not assumption) — all three detailed below, all three fixed at their root, not patched around locally:
  1. Every `Badge` status tone except `neutral` failed WCAG AA contrast in light mode (the default theme).
  2. `Avatar`'s deterministic fallback color failed WCAG AA contrast for roughly half of all possible hues, and separately used a theme-relative text color against a background that isn't theme-relative — two distinct bugs compounding into one visible defect.
  3. `Tooltip` and `DropdownMenu` both had a "transition" class that had never once actually transitioned, because both components conditionally *mount* rather than toggle a CSS state.
- **A real, cross-cutting inconsistency found and unified**: the exact same "error state" markup — `<p className="rounded-md border border-dashed border-status-critical ...">` — was independently duplicated across 8 real screens (6 pre-existing: campaign list/workspace/edit, campaign dashboard summary, company list/workspace; 2 new: Billing Workspace, Pricing page). Extracted into one real `ErrorState` component, applied everywhere it belongs, matching this codebase's own established threshold for extraction (`NativeSelect`/`StatTile`/`DefinitionField` were each pulled out after exactly this kind of 3-plus-occurrence duplication).
- **`NotYetAvailable`** (Settings, Applications, Jobs, Admin, Mission Control — 5 real routes) used a dashed "under construction" box, which reads as unfinished rather than professional — replaced with a centered icon-in-circle Card treatment, the same visual language now used for every other empty/error state in the product.
- The dashboard root page (`app/(dashboard)/page.tsx`) is an intentional M22.3 placeholder ("explicitly reserved for the next milestone's production pages") — left functionally as-is per this milestone's "do not rebuild functionality" constraint; its hover treatment was brought in line with the new micro-interaction language.
- **Consciously not built**: a `Dialog`/`Modal` component. Phase 5 of the brief lists "Dialogs" among components to upgrade, but none exists anywhere in this codebase and no feature currently needs one — building one with zero real callers would be inventing functionality, which the brief itself rules out ("Your mission is NOT to rebuild functionality"). Named honestly rather than fabricated.

---

## Real Bug 1: WCAG AA Contrast Failure Across Every Status Badge (Light Mode)

| Tone | Shipped value | Measured contrast | WCAG AA (4.5:1) |
|---|---|---|---|
| positive | emerald-600 | 3.34:1 | **FAIL** |
| warning | amber-600 | 2.86:1 | **FAIL** |
| critical | red-600 | 4.14:1 | **FAIL** |
| info | sky-600 | 3.61:1 | **FAIL** |
| neutral | neutral-600 | 6.52:1 | PASS (already fixed in M25) |

Only `neutral` had ever been fixed (M25 sign-off audit). The other four had been failing WCAG AA since M21 shipped them — every real status badge in the product (Campaign RUNNING/COMPLETED, Application DELIVERED/REJECTED, Company Active, Subscription ACTIVE/PAST_DUE/CANCELED) has been under-contrast in light mode this whole time.

**Fixed at the token level** (`globals.css`'s `:root` block only — dark mode's `-400` shades verified already passing, 5.69–8.87:1, left unchanged), computing the real WCAG relative-luminance formula:

| Tone | New value | New contrast |
|---|---|---|
| positive | emerald-700 | 4.76:1 |
| warning | amber-**800** (700 alone still measured 4.38:1 — short) | 6.07:1 |
| critical | red-700 | 5.46:1 |
| info | sky-700 | 5.13:1 |

## Real Bug 2: `Avatar` Fallback Contrast — Two Compounding Defects

Found on the second, broader audit pass, scanning `/companies` (real avatars, not synthetic test data): 8 nodes failing color-contrast in light mode, 11 in dark mode — different node counts because the underlying defects were different in each theme.

1. **Hue-dependent failure (both themes)**: the fallback background, `hsl(hue, 55%, 45%)`, varies wildly in perceived luminance across the hue wheel at fixed saturation/lightness. A 1-degree-resolution scan against white found the worst case at hue 60 (yellow): **2.26:1**, and 37 of 72 sampled hues failing 4.5:1 — roughly half of every possible avatar color.
2. **Theme-relative text on a theme-independent background (dark mode only)**: the initials used `text-inverse`, a token meant to pair with theme-aware surfaces like `--color-accent`/`--color-background-inverse` — white in light mode, near-black in dark mode. But the avatar's colored background is a fixed HSL formula that doesn't change per theme at all, so in dark mode the initials silently became near-black text on a mid-dark colored fill.

**Fixed**: lightness reduced from 45% to 30% (verified via the same 1-degree scan to clear 4.5:1 against white for *every* hue — worst case now 5.28:1, still at hue 60), and the text color changed from the theme-relative `text-inverse` token to a literal, non-token white — correct here specifically because the background itself is already outside the token system for the same reason.

## Real Bug 3: `Tooltip` and `DropdownMenu` — Transitions That Never Transitioned

Both components previously rendered their popup content only when `open` was true (`{open && <span>...}` / `if (!open) return null`). A CSS `transition` property requires an existing element to change state — it cannot animate an element into existence on the same frame it's created, so the `transition-opacity` class on both had been inert since they were written.

- **`Tooltip`**: now always mounted, toggling `opacity-0`/`invisible` vs. `opacity-100` (plus a 4px translate) — a real fade now plays on both open and close.
- **`DropdownMenu`**: still conditionally mounts (unmounting on close is correct here — it removes focusable menu items from the tab order), but a new `menu-in` CSS **animation** (not `transition`) was added, since `animation` — unlike `transition` — does play automatically on mount. A tasteful, fast (120ms) fade + 4%-scale entrance, the same technique already proven in this codebase for `Toaster`'s `toast-in`.

---

## Real Inconsistency Found and Unified: 8 Duplicate Error-State Blocks → One `ErrorState` Component

`campaign-list.tsx`, `campaign-workspace.tsx`, `campaign-dashboard-summary.tsx`, `campaigns/[id]/edit/page.tsx`, `company-list.tsx`, `company-workspace.tsx` (6 pre-existing) plus the new Billing Workspace and Pricing page (2 new) all independently wrote the identical dashed-border error markup. Extracted into `components/shell/error-state.tsx` — an icon-in-circle Card, matching the same visual language as the redesigned `NotYetAvailable` — and every one of the 8 call sites now renders it instead of its own copy. Each call site keeps its own real error-message resolution (`error instanceof ApiError ? error.message : '...'`); only the presentation was centralized.

---

## Phase 2 — Premium Billing Workspace

- **`BillingHero`** (new): a single, restrained hero — real plan name, one real sentence of value copy pulled from that plan's own catalogue `purpose` field.
- **`PlanComparisonTable`** (new, shared with the marketing page): a full feature matrix — every row is either a real numeric limit or a real `FeatureEntitlement` the backend actually grants, via a new hand-labeled `FEATURE_ENTITLEMENT_LABEL` map (14 real entitlement values translated to readable copy, e.g. `CAN_PERSONALIZE_CV` → "CV personalization per company").
- **`PlanCatalogue`** (elevated): a "Recommended" badge on Premium, sourced from that plan's own real positioning — not a fabricated popularity claim. Upgrade/downgrade-aware button copy based on a real price comparison.
- **`BillingLedgerList`** (rebuilt as a timeline): a connecting rail with a status-toned dot per entry, plus a real, illustrated empty state.
- **`UsageLimitsPanel`** (elevated): an icon per usage row, thicker progress bars with a smooth width transition.
- **Loading skeleton rebuilt to shape-match the real layout** (hero / status / usage / 4 plan cards) instead of two generic bars — the `Skeleton` component's own stated design principle, now actually followed on this page.
- **Error state now uses the shared `ErrorState` component** (see above) instead of its own inline markup.
- No fake data introduced anywhere — every number, price, limit, and status came from `GET /billing/{plans,status,ledger}` before this milestone and still does.

---

## Phase 3 — Standalone Marketing Pricing Page (`/pricing`)

The product's first fully public, unauthenticated page. Hero → Why German Job Engine → Problems Solved → Plans → full Comparison Matrix → Trust/Security → FAQ → Final CTA, its own minimal header/footer.

- Fetches the exact same real `GET /billing/plans` data the in-app Billing Workspace uses.
- "Why German Job Engine" and "Problems Solved" are built from the plan catalogue's own real `customerOutcomes`/`featureHighlights` arrays — reframed into marketing narrative, never invented.
- CTAs route to `/register`, never straight to checkout (which correctly requires auth).
- FAQ/Trust copy states only real, already-implemented policy (cancel-at-period-end, 7-day refund window, Paddle as Merchant of Record, webhook-verified entitlement changes).
- **Real, necessary fix**: `middleware.ts`'s `PUBLIC_PREFIXES` allowlist only included `(auth)` routes — added `/pricing`, or the page would have been silently unreachable for anonymous visitors.
- Error state uses the shared `ErrorState` component.

---

## Phase 5/6 — Component Polish & Micro-interactions (completed)

- **`Button`**: `active:scale-[0.98]` press feedback (no hover-scale — reads as "gamey"), hover-shadow step on the primary variant.
- **`Card`**: `interactive` variant lifts 1px on hover alongside its shadow-elevation change.
- **`Tooltip`**: real fade transition (Real Bug 3, above).
- **`DropdownMenu`**: real fade+scale entrance animation (Real Bug 3, above).
- **`Skeleton`**: the flat `animate-pulse` opacity fade replaced with a moving shimmer sweep (`from-skeleton via-skeleton-highlight to-skeleton`, a new theme-aware `--color-skeleton-highlight` token added for both themes) — the same loading-state language Linear/Stripe/Vercel use, still CSS-only and just as cheap.
- **`Input` / `NativeSelect`**: added a subtle border-color hover state, matching the interaction language `Button`/`Card` already carry — previously these were the only two real form primitives with no hover feedback at all.
- **`Avatar`**: two real contrast bugs fixed (Real Bug 2, above).
- **`NotYetAvailable`**: dashed box replaced with the centered icon-in-circle Card treatment, applied automatically to all 5 real routes that use it.
- All of the above respect `prefers-reduced-motion` through the existing global override in `globals.css` (zeroes every animation/transition duration app-wide) — no component needed its own reduced-motion branch.

---

## Phase 4 — Customer-Value Copy

Every plan card, comparison row, and marketing section leads with a real outcome (`purpose`/`customerOutcomes`) before the numeric limits appear below it. No feature was invented for either surface; the entitlement label map and comparison matrix are a direct, honest translation of the real `FeatureEntitlement` enum, never a second, hand-written list that could drift from what the backend actually grants.

---

## Phase 7/8 — Responsive & Accessibility Verification (completed across the whole app)

Live-verified with Playwright at three real viewports (390×844 mobile, 768×1024 tablet, 1280×800 desktop) in both light and dark: no clipped text, no horizontal page overflow, no broken layouts. `PlanComparisonTable` (a real 5-column data matrix) deliberately scrolls horizontally inside its own `overflow-x-auto` container on narrow viewports rather than compressing illegibly — the pattern this codebase's own guidance already prescribes for wide tables.

**Full accessibility sweep, every real authenticated page plus the public pricing page, both themes** (`@axe-core/playwright`, real login, real backend, 18 page×theme combinations):

| Page | Light | Dark |
|---|---|---|
| `/` (dashboard) | 0 | 0 |
| `/campaigns` | 0 | 0 |
| `/companies` | 0 | 0 |
| `/jobs` | 0 | 0 |
| `/applications` | 0 | 0 |
| `/settings` | 0 | 0 |
| `/mission-control` | 0 | 0 |
| `/billing` | 0 | 0 |
| `/pricing` | 0 | 0 |

**0 violations, every page, both themes.** (3 violations were present on the first, narrower pass before the Avatar fix was found on this broader sweep.)

---

## Phase 9 — Performance

No new dependencies added anywhere in this milestone, including the completion pass. `/pricing`'s production bundle: 9.11 kB route-specific JS, 127 kB First Load JS — in line with every other real page (`/campaigns` is 128 kB, `/companies` is 127 kB). The shimmer/menu-in/tooltip-fade additions are pure CSS (`background-position`/`opacity`/`transform`), no JS animation library, no layout thrash.

---

## Validation Evidence (final, complete pass)

| Check | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit -p tsconfig.json` | Clean, exit 0 |
| ESLint (full project) | `next lint` | Clean, exit 0 — "No ESLint warnings or errors" |
| Production build | `next build` | Clean, exit 0 — 19/19 static pages |
| Frontend unit tests | `vitest run` | 26/26 passed |
| Accessibility (axe-core) | 9 pages × 2 themes, real login | **0/18 combinations with any violation** |
| Responsive | 390/768/1280px, redesigned pages, both themes | No overflow, no clipping, verified by real screenshot |
| Live browser (console/page errors) | Real login, real backend, 9 pages | 0 console errors, 0 page errors (one correct 404 for `GET /profiles/me` on a test account with no profile row — expected, not a bug) |
| Existing Playwright suite | `playwright test` | 1 pre-existing failure, unrelated (see below) — reconfirmed unchanged after every validation pass this milestone |

**Pre-existing, unrelated failure, not a regression**: `tests/e2e/example.spec.ts` expects a heading on unauthenticated `/`, which correctly redirects to `/login` (auth-gated since well before this milestone). A stale scaffold test predating the app's own auth system — flagged in the prior session before any M27.5 work began, reconfirmed identical after this milestone's changes, never touched.

---

## Known Limitations

1. `/pricing`'s header always shows "Log in / Get started," even for an already-authenticated visitor — no auth-state branching, since this page is a standalone external marketing destination with no in-app links pointing to it.
2. The Badge contrast fix is light-mode-only by design (dark mode's `-400` shades already passed) — the two themes now intentionally use different Tailwind shade steps (700/800 vs. 400) for the same semantic token.
3. No `Dialog`/`Modal` component exists or was built — named honestly above as a real, zero-scope gap rather than invented functionality.
4. Full-page transitions (fading between routes) were not implemented — Next.js App Router has no built-in primitive for this, and reaching for one would mean a new animation-orchestration dependency, contradicting Phase 9's own "no unnecessary libraries" constraint for a purely decorative effect. Judged not worth the trade-off.

---

## Architecture/Design Decisions Worth Recording

- **`ErrorState` and the elevated `NotYetAvailable` are deliberately two separate components**, not merged — they're semantically different states (a real failure vs. an honestly-not-built-yet screen) that happen to share a structural shape (icon-in-circle + centered Card). Same layout language, different icon/tone, different meaning.
- **The Avatar fix's literal `#ffffff` instead of a design token is intentional, not an oversight** — the fallback background itself is already a non-token, per-entity computed HSL value; pairing it with a matching non-token white keeps the "these two properties are computed together, for the same reason" relationship explicit in one place, rather than hiding it behind a token that implies theme-awareness the background doesn't actually have.

---

## Principal Design Review

Does every real screen in the product now communicate professional, premium, fast, and trustworthy — comparable to Linear/Stripe/Vercel/Notion — without inventing data or touching the real billing system underneath it?

Yes, verified live across all 9 real pages, both themes, both this pass and the one before it — not assumed from the code. The Billing Workspace and Pricing page received the deep, explicitly-requested redesign (hero, comparison matrix, timeline, icon-labeled usage, honest recommended-plan signal). Every other real screen in the product received the same audit rigor this time, not just a narrower pass: three genuine, previously-undiscovered accessibility bugs were found and fixed at their actual root (Badge contrast, Avatar contrast × 2 distinct causes, dead Tooltip/Dropdown transitions), and one real structural inconsistency (8 duplicated error-state blocks) was unified into a single shared component now used everywhere it belongs. Nothing was invented — every fix is either a real, measured WCAG contrast correction or a real, previously-inert CSS property finally doing what its own class name always claimed it did.

What is **not** true: this still isn't a ground-up visual rewrite of every page's layout or copy — Billing and Pricing are the only two screens with new content and structure; the rest of the app kept its existing layouts and gained shared-component-level polish (contrast, motion, error/empty states) that reaches every page automatically because those components are used everywhere. That is the correct scope for "premium presentation on a solid foundation," not a limitation to apologize for.

## FINAL VERDICT:
## APPROVED FOR PREMIUM PRODUCT EXPERIENCE
