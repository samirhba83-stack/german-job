# 1. Architecture

## Where this fits in the existing layering

No existing architectural decision from M20–M23.1 was redesigned. The Company Workspace follows the exact feature-slice pattern `features/campaigns/` already established in M23: `types/` re-exporting shared DTOs, `api/` wrapping `apiClient`, `hooks/` wrapping TanStack Query, `components/` composing the UI, with a new `lib/` sub-folder for one small, company-specific piece of shared logic (`can-manage-company.ts`).

```
apps/web/src/
├── features/companies/               — new
│   ├── types/index.ts
│   ├── api/companies.api.ts
│   ├── hooks/{use-companies,use-company,use-company-actions}.ts
│   ├── lib/can-manage-company.ts
│   └── components/                   — CompanyList(+Row), Overview, Actions, HealthCenter,
│                                        OpportunityIntelligencePanel, History,
│                                        ApplicationCommunicationTimeline, Analytics, Workspace
├── features/applications/            — real API layer implemented for the first time
│   ├── types/index.ts                — corrected to match the real ApplicationResponseDto
│   ├── api/applications.api.ts       — searchApplications(), getApplicationTimeline() now real
│   └── hooks/{use-applications-search,use-application-timeline}.ts   — new
├── components/ui/stat-tile.tsx       — new shared primitive (extracted from two duplicates)
└── app/(dashboard)/companies/
    ├── page.tsx                      — real list (replaces the M22.3 honest placeholder)
    ├── [id]/page.tsx                 — real workspace (new)
    └── new/page.tsx                  — unchanged M22.3 placeholder (creation flow out of scope)
```

## A real prerequisite fix, not scope creep: `ApplicationDto`

`packages/shared-types/src/dto/application.dto.ts` predated the real Applications module entirely — it was a 5-field guess (`{id, jobListingId, candidateId, status, createdAt}`) that didn't match the real, live `ApplicationResponseDto` at all (no `companyId`, no `snapshot`, no `channel`, no `intelligence`, wrong field set throughout). The Company Workspace's History, Communication Timeline, and Analytics sections all genuinely need the real shape — this was corrected first, verified field-for-field against the real backend DTO during this milestone's research pass, before any company-specific code was written. `features/applications/hooks/use-applications.ts` — an orphaned M1-era stub with zero real callers anywhere in the codebase — was deleted as part of the same cleanup rather than left alongside the new, real hooks.

## What was reused, not rebuilt

- **The entire M22/M22.2/M22.3 shell and interaction layer** — `ContextHeader`, `TrustFeedbackCard`, `Accordion`, `Badge`, `Card`, `Button`, `Input`, `Skeleton`/`SkeletonRegion`, `useTrackedMutation` — zero new primitives were added to `components/ui/` beyond `stat-tile.tsx` (itself extracted from existing duplicated code, not new functionality).
- **`lib/status-mappings.ts`'s single-source-of-truth pattern** — extended with one new table (`COMPANY_STATUS_TONE`), following the exact convention `CAMPAIGN_STATUS_TONE`/`CAMPAIGN_TARGET_STATUS_TONE`/`APPLICATION_STATUS_TONE` already established.
- **The Campaign Workspace's own established idioms** — debounced search input, `keepPreviousData` pagination, `ContextHeader`-owns-the-real-`<h1>` split between header and overview card (learned the hard way in M23, applied correctly from the start here), atomic query keys per hook.

## What's genuinely new

- `features/companies/` in full (no company frontend consumer existed before this milestone).
- `features/applications/`'s real API/hook layer (existed only as an unused stub before).
- `components/ui/stat-tile.tsx` (extraction, not new functionality — see [10, ADR-002](10-architecture-decision-records.md)).
- The lazy-fetch-on-first-expand pattern in `CompanyHistory`/`ApplicationCommunicationTimeline` — a real, new interaction pattern this codebase didn't need before (Campaign Workspace's timeline is fetched eagerly, once, because a single campaign's transition ledger is small and bounded; a company's *set of applications, each with its own timeline* is a different, larger shape of problem — see [07-performance.md](07-performance.md)).

## Dependency direction, verified

`features/companies` depends on `features/applications` (for company-scoped application data) — a real, new cross-feature dependency. This is a peer-to-peer relationship between two feature slices, not a layering violation: neither depends on the other's internals, both consume the same `lib/api-client.ts`/`components/ui`/`components/shell` foundation, and `features/applications` has no reciprocal dependency on `features/companies`. `components/ui/stat-tile.tsx` depends on nothing feature-specific, consumed by both `features/campaigns` and `features/companies` — the correct direction (shared primitive, consumed downward by features, never the reverse).
