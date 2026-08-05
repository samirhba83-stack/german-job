# 8. Accessibility

## Applied directly, not re-discovered

M23 shipped its Campaign Workspace with no real `<h1>` on the detail page, found and fixed mid-build via self-review; M23.1 then further refined the heading hierarchy and loading-state announcements. The Company Workspace applies both lessons from the start: `ContextHeader` (a real `<h1>`, real status badge, real actions) is the page's top-level element from the first draft, every `WorkspaceSection` uses `<h2>`, and every multi-skeleton loading state is wrapped in the existing `SkeletonRegion` component (`aria-busy`/`aria-live`) rather than bare, unannounced `Skeleton` elements.

## Real, checkable in the code

**Keyboard navigation**: every interactive element is a real `<button>`, `<a>`, `<select>` with an implicit label, or the existing `Input`/`Button` components — no `<div onClick>` pattern anywhere. `CompanyListRow`'s Link (company name) and Quick Action buttons are structured as siblings, never nested — the same fix already applied to `CampaignListRow` (M23.1) and documented as the standing rule for `Card`'s `interactive` prop (M22.3, ADR-012) — no repeat of that defect class here.

**Semantic HTML**: `CompanyOverview`'s fields use a real `<dl>`/`<dt>`/`<dd>` structure, matching every other overview-style card in this codebase (`CampaignOverview`). `CompanyHistory` reuses the real `Accordion` component unmodified — its own `aria-expanded`/`aria-controls` wiring (M22.2) applies here with zero new accessibility code needed.

**Screen readers**: `ApplicationCommunicationTimeline`'s loading/error/empty states are all real text content, not icon-only. `CompanyAnalytics`' stat tiles use `tabular-nums` for legible, aligned digits — a design-system convention (`components/ui/stat-tile.tsx`), not a one-off style.

**Focus management**: no new modal, drawer, or focus trap was introduced this milestone — `CompanyActions`' Archive/Restore are single, direct, non-confirming actions (unlike Campaign's mandatory-reason Cancel flow), so there is no new inline-form focus-management case to get wrong the way M23.1 had to fix for `CampaignActions`.

**Reduced motion / high contrast**: inherited automatically from the global `globals.css` rules (M22.2/M22.3) — nothing in this milestone's components defines its own animation or contrast-sensitive styling outside the existing token system.

**Responsive design**: every layout in this milestone uses the same real Tailwind breakpoint tokens (`sm:`, grid columns) already established platform-wide — no new breakpoint or ad hoc responsive pattern was introduced.

## What was not verified

No automated accessibility audit (axe, Lighthouse) or screen-reader testing session — the same standing gap named in M22.2, M22.3, M23, and M23.1, still real, still not closed. This is now the fifth consecutive milestone pass to name this gap rather than close it; see [11-final-deliverables-and-principal-review.md](11-final-deliverables-and-principal-review.md)'s Technical Debt Review.
