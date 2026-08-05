# 2. Integration Points

Every real endpoint this milestone consumes, and — the more important half — every real backend limit found while researching this milestone, before any UI code was written. Companies and Applications controllers were read in full, along with the relevant domain entities and command handlers, not assumed from `docs/frontend-architecture/03-screen-inventory.md`, which turned out to contain at least one stale claim (see below).

## Real, live endpoints consumed

| Endpoint | Used by | Real data returned |
|---|---|---|
| `GET /companies/search` | `useCompanies` (list, with real filters) | `PaginatedCompaniesDto` |
| `GET /companies/:id` | `useCompany` (Workspace) | `CompanyDto` |
| `POST /companies/:id/archive` | `useCompanyActions().archive` | `CompanyDto` |
| `POST /companies/:id/restore` | `useCompanyActions().restore` | `CompanyDto` |
| `GET /applications/search?companyId=` | `useApplicationsSearch` (History, Health evidence, Analytics) | `PaginatedApplicationsDto` |
| `GET /applications/:id/timeline` | `useApplicationTimeline` (Communication Timeline, lazy) | `ApplicationTimelineEntryDto[]` |

`GET /companies` (the parameterless list endpoint) is deliberately not called separately — `ListCompaniesHandler`'s own source comment states it is "search with nothing," so `useCompanies` always calls `/companies/search`, with or without real filters, rather than maintaining two API functions for the same result.

## What the milestone asked for that has no real backend support — and what was built instead

### "Region" (spec §1, Companies List)
**Real, but not reachable.** The domain value object `CompanyLocation` and the Prisma persistence layer both carry a real `federalState` column (comment: *"real, verified geographic data only — never inferred"*) — but `CompanyResponseMapper.toDto()` drops it before it ever reaches an HTTP response. **What was built**: City and Country only, shown honestly as "location," with `federalState` never referenced anywhere in the frontend.

### "Current Campaign" (spec §1 List, §2 Workspace)
**Does not exist, confirmed decisively.** `Company` has no campaign reference field. `CampaignResponseDto` never exposes `companyId` anywhere — not on the campaign itself, not on `targetBreakdown` (aggregate counts only), not on `CampaignBatchSummaryResponseDto` (opaque target ids, no company). Campaign search has no `companyId` filter either. **What was built**: nothing — no "Active Campaigns" widget anywhere in the Company Workspace, rather than a fabricated or unreliable one.

### Opportunity Score / Confidence Score / Compatibility Score / Priority (spec §3, Opportunity Intelligence)
**Zero backend support of any kind** — not even a reserved-but-null DTO field the way Campaign's `intelligence` object at least is. `CompanyDto` has no intelligence shape at all. An exhaustive repo-wide search for `compatibility`/`matchScore`/`opportunityScore` found no real backend computation anywhere. **What was built**: `OpportunityIntelligencePanel`, a fully honest "not available" statement — see [05-opportunity-intelligence.md](05-opportunity-intelligence.md).

### `hiringQuality` / `trustScore` (spec §3, implicitly — the closest real fields to "scores")
**More definitively dormant than Campaign's reserved hooks.** `Company` has no `recordHiringQuality()`/`recordTrustScore()` method at all — Campaign at least has an unused `recordHealthAssessment()`; Company doesn't even have that. The only non-test code that ever constructs a `HiringQuality`/`TrustScore` value object is the *read-side* mapper converting a Prisma row back into the domain — meaning the only way either field is ever non-null is a direct, out-of-band database write, never application code. **Treated as permanently null.**

### Company History (spec §4)
**No company-level timeline/history endpoint exists at all** — confirmed by an exhaustive grep of the entire `companies` module for "timeline"/"history." What's real: `Application.companyId` is a real, validated field, and `GET /applications/search?companyId=` is real and live. **What was built**: `CompanyHistory` — the real, paginated list of this company's actual applications (job title, current status, submitted/last-activity dates), not the granular pipeline-style events (Email Prepared, Delivery Confirmed as distinct lines) the spec's examples describe — those require per-application timeline detail, provided separately and lazily via Communication Timeline rather than eagerly for every application up front.

### Communication Timeline (spec §5)
**Real**, via `GET /applications/:id/timeline`, per application. "Manual Notes" and "Future Follow-up" (both in the spec's own example list) have no backend support — no note-taking or follow-up-scheduling capability exists anywhere — and are not shown.

### Company Health's 6-state model (spec §6)
**The real `CompanyStatus` enum has exactly two values**: `ACTIVE`, `ARCHIVED` (`packages/shared-types/src/enums/company-status.enum.ts`, verified directly). No `PENDING`, `SUSPENDED`, or richer lifecycle exists. There is no company-level health-assessment concept or endpoint anywhere. **What was built**: the real 2-value status, with real supporting evidence (application count, most recent real activity date) rather than an invented 6-state classification requiring an arbitrary staleness threshold this frontend has no authority to define. Full reasoning: [06-trust-and-communication-timeline.md](06-trust-and-communication-timeline.md).

### AI Opportunity Panel (spec §7)
Same backend reality as Opportunity Intelligence above — the `recommendations`/`decision-intelligence` modules that would compute any of this have zero HTTP surface (re-confirmed fresh this milestone via an exhaustive `@Controller` grep across the entire backend — 9 real controllers exist platform-wide, and neither of those two is among them).

### Company Analytics (spec §8)
**Applications Sent and Current Stage Distribution are real** — computed from the same real, bounded application fetch every other section uses. **Response Time, Delivery Success rate, and Campaign Participation are not shown.** `ApplicationLifecycleStatus` is a forward-only DAG (`TRANSITION_GRAPH`, verified directly) — an application's *current* status alone cannot say whether it passed through `DELIVERED` or `COMPANY_REPLIED` earlier before being rejected/withdrawn/archived later. Computing a true historical rate would require fetching every application's own timeline (a real N+1 pattern at scale); approximating it from current status alone would silently undercount — exactly the "fabricated analytics" this milestone forbids. "Campaign Participation" is omitted because the only real signal, `channel.campaignRef`, is an unvalidated free-text field never checked against a real campaign id server-side.

## A stale claim in existing documentation, found and flagged

`docs/frontend-architecture/03-screen-inventory.md` claims a `GET /companies?ownerId=` filter exists. **It does not** — neither `ListCompaniesQueryDto` nor `SearchCompaniesQueryDto` has an `ownerId` parameter, confirmed by reading both DTOs in full. `CompanyRepository.findByOwnerId()` exists but is called only internally by `CreateCompanyHandler` to enforce the real one-company-per-owner rule — never from any query handler reachable by HTTP. There is also no `GET /companies/me` endpoint. This means an employer has no real, dedicated way to fetch "their own company" — `company.ownerId` is present in the response DTO (used here for the real `canManageCompany()` check once a specific company is already loaded), but there's no efficient way to *find* an employer's own company from a cold start. Flagged as a real backend gap worth raising, not worked around with an unbounded client-side page-scan.
