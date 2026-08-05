# 7. Performance

## Pagination, not virtualization

The milestone's own text lists "Virtualization where appropriate" — the qualifier matters. `GET /campaigns` is server-paginated (`limit` capped at 100 by the real `ListCampaignsQueryDto`), and `useCampaigns` defaults to a 20-per-page window. With a bounded, small DOM list per page, a virtualized viewport (react-window or similar) would add a real dependency and real complexity to solve a rendering-cost problem that doesn't exist at this scale — exactly the premature optimization this codebase's standing discipline (`CLAUDE.md`'s "no abstractions beyond what the task requires") warns against. The real, load-bearing tool here is pagination, not virtualization, and it's real: `keepPreviousData` (TanStack Query's own pagination primitive) keeps the previous page's rows visible while the next page loads, so paging never flashes a blank loading state.

The Campaign Progress log (`CampaignProgressLog`) renders every real timeline entry with no pagination or virtualization at all. This is a deliberate read of "where appropriate": a single campaign's real transition ledger — status changes only, not per-target events — is realistically a handful to a few dozen entries, not thousands. If a future campaign's timeline grows large enough to matter, this is a real, scoped follow-up (see [08-future-extension-strategy.md](08-future-extension-strategy.md)), not something to solve speculatively today.

## Memoization — where it's real, not blanket

`CampaignWorkspace` wraps `toCampaignLifecycleStages(campaign, timeline)` in a single `useMemo`, keyed on `[campaignQuery.data, timelineQuery.data]`. This is the one place in the workspace where memoization is genuinely justified: it's a real array-mapping computation (up to a handful of `.find()` scans per stage) that would otherwise re-run on every render — including renders triggered by unrelated state changes elsewhere in the tree (a toast appearing, a Background Activity Center update) — for output that's identical unless the underlying campaign or timeline data actually changed.

No other component in this milestone uses `useMemo`, `useCallback`, or `React.memo`. Every other computation here (deriving a Mission Status descriptor, computing two real ratios in `OperationalAnalytics`, filtering an array of ≤10 status-breakdown entries) is cheap enough that memoizing it would add indirection without a measurable benefit — consistent with M22.3's own audit finding that this codebase correctly avoids memoizing costs that don't exist yet, and should be revisited once real data volumes (not this milestone's) justify it.

## Server-state synchronization

Four independent `useQuery` calls, each with the platform's own default `staleTime` (30s, from `app/providers.tsx`) except `useCampaignExecutionStatus`, which uses a shorter 10s `staleTime` — a deliberate, real choice, since execution status (target counts, goal progress) is the one query most likely to change while a campaign is actively `RUNNING`, and a slightly fresher read there matters more than for the campaign's own largely-static configuration fields. Every lifecycle action invalidates the relevant query keys on success (`use-campaign-actions.ts`), so the workspace's state is always resynchronized to the real server state after a real mutation — never left stale, and never faked with an optimistic update (M20's pessimistic-mutation ADR, exercised here for the first time with real code).

## Lazy loading

No route-level code-splitting beyond what Next.js's App Router already does automatically per route (`/campaigns` and `/campaigns/[id]` are already separate JS chunks, visible in the production build's per-route size output). No component within the workspace was large or rarely-used enough to justify a manual `next/dynamic` import — introducing one would be optimizing a bundle-size problem this page doesn't actually have yet (its whole real bundle is a few kilobytes per route, per the verified production build).
