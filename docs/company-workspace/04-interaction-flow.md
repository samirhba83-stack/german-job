# 4. Interaction Flow

## The real user path

```mermaid
sequenceDiagram
    participant U as User
    participant List as /companies (CompanyList)
    participant WS as /companies/:id (CompanyWorkspace)
    participant Q as TanStack Query
    participant API as Real backend

    U->>List: Navigates to Companies
    List->>Q: useCompanies({keyword, industry, size, city, page, limit})
    Q->>API: GET /companies/search?...
    API-->>Q: PaginatedCompaniesDto (real, ACTIVE only)
    Q-->>List: real rows; client-side sort reorders the current real page

    U->>List: Clicks a real company
    List->>WS: router navigation to /companies/:id
    par Two real queries
        WS->>API: GET /companies/:id
        WS->>API: GET /applications/search?companyId=&limit=100
    end
    API-->>WS: CompanyDto, PaginatedApplicationsDto (shared by Health/Analytics/History)
    WS-->>U: Overview, Health, Opportunity Intelligence, Analytics, History<br/>each render the moment its own query resolves

    U->>WS: Expands one application row in History
    WS->>Q: useApplicationTimeline(applicationId, {enabled: true})
    Q->>API: GET /applications/:id/timeline (only now, lazily)
    API-->>Q: ApplicationTimelineEntryDto[]
    Q-->>WS: real Communication Timeline for that one application

    U->>WS: Clicks Archive (only rendered if canManageCompany() is true)
    WS->>Q: useCompanyActions().archive.mutate()
    Q->>API: POST /companies/:id/archive
    API-->>Q: updated CompanyDto
    Q->>Q: invalidateQueries(['company', id]); invalidateQueries(['companies'])
    Q-->>WS: Background Activity Center entry + toast + re-fetched company
```

## Why the application fetch is shared, not repeated per section

`CompanyWorkspace` calls `useApplicationsSearch({companyId, limit: 100})` exactly once and passes the resolved `PaginatedApplicationsDto` down as a prop to `CompanyHealthCenter`, `CompanyAnalytics`, and `CompanyHistory`. This is the same "one real query, several real consumers" pattern the Campaign Workspace already used for its timeline data (M23, `CampaignProgressLog`/lifecycle stages sharing one `useCampaignTimeline` call) — applied here because three genuinely different sections (an evidence-based health signal, a stage-distribution analytic, and a history list) all need the identical underlying real data, just presented three different ways.

## Why Communication Timeline is lazy, and History is not

`CompanyHistory`'s own data (the application list itself) is already in hand the moment the shared fetch above resolves — no additional request needed to show job titles, statuses, and dates. Each application's own *Communication Timeline*, however, requires a separate real request per application (`GET /applications/:id/timeline`), and a company can realistically have anywhere from zero to dozens of real applications. Fetching all of their timelines eagerly the instant the page loads would be a real N+1 pattern; fetching none until the user actually asks is real, deliberate lazy loading — `expandedIds` in `CompanyHistory` tracks which rows have been opened at least once, and `ApplicationCommunicationTimeline`'s own `useApplicationTimeline(id, {enabled})` only starts its query once that row has genuinely been expanded. See [07-performance.md](07-performance.md) for the full reasoning, including why the `Accordion` component's own internal open/close state couldn't drive this directly.
