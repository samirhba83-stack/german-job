# 9. Future Extension Strategy

Every gap named in [02-integration-points.md](02-integration-points.md) has a real, specific, additive extension path.

## When a real `GET /companies/:id/timeline` (or similar) exists

`CompanyHistory` currently derives "history" from the application list. A real company-level timeline (Company Imported, Eligibility Evaluated, Campaign Assignment — the milestone's own original examples) would be a genuinely new, additive section alongside it, not a replacement — the application-derived history remains real and useful regardless.

## When Company gains a real intelligence/opportunity-scoring shape

`OpportunityIntelligencePanel` becomes a one-file change the moment `CompanyDto` gains a real, populated intelligence field — swap the panel's permanently-empty body for a real render, following `SmartRecommendationPanel`'s existing pattern exactly (Campaign Workspace, M23). No other section of the Company Workspace needs to change.

## When a real per-(candidate,company) compatibility computation exists

This is the one gap in this milestone's research that has no existing reserved DTO shape anywhere to extend — it would need a genuinely new domain concept (unlike Campaign/Application's `intelligence` fields, which already exist, just unpopulated). Building `CompanyOverview`'s or `OpportunityIntelligencePanel`'s real "Compatibility Score" display is straightforward once that exists; the backend work to produce it is the real, larger prerequisite.

## When a real `GET /companies?ownerId=` or `/companies/me` endpoint exists

Closes the gap named in [02-integration-points.md](02-integration-points.md) — an employer could then land on their own company's workspace directly from a real, dedicated query instead of `canManageCompany()`'s current role is only checkable once a specific company is already loaded by id.

## When applications can be paginated beyond the first 100 for a single company

`CompanyHistory`/`CompanyAnalytics`/`CompanyHealthCenter` all share one `useApplicationsSearch({companyId, limit: 100})` call. If real usage shows companies regularly exceeding 100 real applications, a real "load more" affordance (a second page fetch, merged client-side) is a contained, additive change to that one hook's caller — the honest "showing first N of total" messaging already in place today makes the cutoff visible now, and would simply become less often true.

## When per-application timeline fetches become cheap enough to aggregate (a real backend aggregate endpoint)

If the backend ever adds a real aggregate endpoint (e.g., "reply rate for company X, computed server-side from real historical transitions"), `CompanyAnalytics` gains real Response Time/Delivery Success tiles as an additive change — the current, deliberately-omitted metrics were never a design decision to avoid building them forever, only a decision not to fabricate them client-side today.
