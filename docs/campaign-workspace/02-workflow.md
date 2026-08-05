# 2. Workflow

## The real user path

```mermaid
sequenceDiagram
    participant U as User
    participant List as /campaigns (CampaignList)
    participant WS as /campaigns/:id (CampaignWorkspace)
    participant Q as TanStack Query
    participant API as Real backend

    U->>List: Navigates to Campaigns
    List->>Q: useCampaigns({page, limit})
    Q->>API: GET /campaigns?page=&limit=
    API-->>Q: PaginatedCampaignsDto (real)
    Q-->>List: real rows, real status badges

    U->>List: Clicks a real campaign
    List->>WS: router navigation to /campaigns/:id
    par Four independent real queries
        WS->>API: GET /campaigns/:id
        WS->>API: GET /campaigns/:id/timeline
        WS->>API: GET /campaigns/:id/execution-status
        WS->>API: GET /profiles/me
    end
    API-->>WS: CampaignDto, timeline[], execution-status, profile
    WS-->>U: Overview, Lifecycle, Health, Recommendations,<br/>Pipeline, Analytics, Progress — each section<br/>renders the moment its own query resolves

    U->>WS: Clicks a real lifecycle action (e.g. Pause)
    WS->>Q: useCampaignActions().pause.mutate({...})
    Q->>API: POST /campaigns/:id/pause
    API-->>Q: updated CampaignDto
    Q->>Q: invalidateQueries(['campaign', id])
    Q-->>WS: Background Activity Center entry + toast +<br/>re-fetched campaign, all sections re-render with real new state
```

## Why four independent queries, not one aggregate fetch

Each of `useCampaign`, `useCampaignTimeline`, `useCampaignExecutionStatus`, and `useMyProfile` is its own `useQuery` with its own loading/error state, rather than one combined fetch gating the whole page. This means a slow or failing `execution-status` call (the aggregate-counts endpoint, arguably the least critical of the four) never blocks the Overview or Lifecycle sections — which only need `campaign` and `timeline` — from rendering the instant their own data is ready. This is a direct, deliberate application of the platform's standing "every request has progress, independently" principle (`docs/interaction-framework/02-interaction-principles.md`), not a a default TanStack Query behavior that happened by accident.

## The action → refetch loop

Every lifecycle action's `onSuccess` calls `queryClient.invalidateQueries({queryKey: ['campaign', campaignId]})` and `invalidateQueries({queryKey: ['campaigns']})` (`features/campaigns/hooks/use-campaign-actions.ts`). This means the workspace and the list page always reflect the campaign's real, current server state after an action — never an optimistic guess about what the new state will be, consistent with `docs/frontend-architecture/07-state-management-strategy.md`'s "pessimistic mutations for lifecycle transitions" ADR, which this milestone is the first to actually exercise with real code.
