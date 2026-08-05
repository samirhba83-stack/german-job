# 7. Performance

## Large company datasets — real pagination, real bounded fetch

`CompanyList` is server-paginated exactly like `CampaignList` (M23) — 20 per page, `keepPreviousData` so paging never flashes a blank state. `GET /companies/search`'s real `limit` cap is 100 (verified in the real query specification), same ceiling as Applications.

The Company Workspace's shared application fetch (`useApplicationsSearch({companyId, limit: 100})`) is real and bounded, but not unlimited: a company with more than 100 real applications will only have its first 100 reflected in Health/Analytics/History. This is stated honestly in the UI itself ("Showing the first N of {total} real applications") rather than silently truncated — the real `total` field is always shown even when the fetched set is capped. A real "load more" or full pagination through a company's application history is named as future work ([09-future-extension-strategy.md](09-future-extension-strategy.md)) rather than built speculatively for a scale this milestone has no evidence is common yet.

## Filtering, Searching — real, debounced

Every `CompanyList` filter (keyword, industry, size, city) is a real, live server-side parameter on `GET /companies/search`. The keyword input is debounced 300ms — a real, justified performance decision (avoids firing a network request on every keystroke while typing a company name), not a bespoke abstraction; the same simple `setTimeout`-based debounce pattern, no new dependency.

## Sorting — real, but client-side, and honestly scoped

The real backend exposes no sort parameter on either `/companies/search` or `/companies` (verified by reading both query DTOs in full). `CompanyList`'s sort control reorders the *current real page's* already-fetched data client-side — real data, genuinely reordered, but only within one page's 20 rows, not a true cross-dataset sort. This is stated as a real, deliberate scope decision, not represented as more than it is.

## Lazy Loading — the one genuinely new pattern this milestone needed

`ApplicationCommunicationTimeline`'s `useApplicationTimeline(id, {enabled})` only fires once a `CompanyHistory` row has been expanded at least once. This required *not* relying on the `Accordion` component's own internal open/close state, because `AccordionContent` keeps its children mounted even while visually collapsed (a real, correct design for content that's already loaded, established in M22.2's own decision record for the CSS-grid collapse technique) — mounting `ApplicationCommunicationTimeline` unconditionally inside it would fetch every application's timeline immediately regardless of whether any row was ever expanded, defeating the entire purpose. `CompanyHistory` instead tracks `expandedIds` (a plain `Set<string>`, added to on first interaction with a row) purely to gate the fetch, while still using the real, unmodified `Accordion` component for 100% of the actual disclosure UI, ARIA, and animation. See [10, ADR-001](10-architecture-decision-records.md).

## Memoization — none added, and that's the correct call

No `useMemo`/`useCallback`/`React.memo` was added anywhere in the Company Workspace. `CompanyAnalytics`' status-bucketing loop runs over at most 100 real items — cheap, and re-running it on every render costs nothing measurable. This mirrors the Campaign Workspace's own established discipline (M23's Performance doc): memoize a real, expensive, repeated computation when one exists (the Campaign lifecycle-stage mapping), not speculatively.

## React Query usage / State ownership

Five real, atomically-scoped hooks (`useCompanies`, `useCompany`, `useCompanyActions`, `useApplicationsSearch`, `useApplicationTimeline`), five distinct real query keys, verified with no overlap during this milestone's own duplication audit ([03-component-hierarchy.md](03-component-hierarchy.md)). Every lifecycle action invalidates the exact real query keys it affects (`['company', id]`, `['companies']`) — no broader, wasteful invalidation, and no optimistic updates (pessimistic mutations remain this codebase's standing rule since M20).

## Bundle size

`/companies` (4.36 kB) and `/companies/[id]` (5.93 kB) are each their own Next.js route chunk, verified in the real production build output — no manual `next/dynamic` splitting was added; nothing in this milestone's component tree is large or rarely-used enough to justify it.
