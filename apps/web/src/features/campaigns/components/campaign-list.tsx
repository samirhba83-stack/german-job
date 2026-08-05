'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { ContextHeader } from '@/components/shell/context-header';
import { ErrorState } from '@/components/shell/error-state';
import { CAMPAIGN_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { getMissionStatus } from '@/lib/mission-status';
import { formatDate } from '@/lib/format-date';
import { ApiError } from '@/lib/api-client';
import { useCampaigns } from '../hooks/use-campaigns';
import { useCampaignsSearch } from '../hooks/use-campaigns-search';
import { useCampaignActions } from '../hooks/use-campaign-actions';
import { CampaignStatus } from '../types';
import type { CampaignDto } from '../types';
import { CampaignDashboardSummary } from './campaign-dashboard-summary';
import { CampaignFilters, EMPTY_CAMPAIGN_FILTERS, hasActiveCampaignFilters, type CampaignFilterState } from './campaign-filters';

const PAGE_SIZE = 20;
const NAME_SEARCH_FETCH_LIMIT = 100;

/**
 * One row per real campaign. A dedicated component, not inlined in the `.map()` above it, because
 * a real per-row Quick Action needs `useCampaignActions(campaign.id)` — a hook, which can only be
 * called at a component's own top level, never inside a loop callback (Milestone 23.1).
 *
 * The row's real "Current Progress" is `getMissionStatus()`'s label — computed client-side from
 * `campaign.status` alone, zero extra cost. The alternative, real dispatched/target counts, only
 * exists via `GET /campaigns/:id/execution-status` — fetching that per row would be a real N+1
 * query pattern across a 20-row page, exactly what this milestone's Performance Validation section
 * asks to avoid. See docs/campaign-workspace/07-performance.md.
 */
function CampaignListRow({ campaign }: { campaign: CampaignDto }) {
  const missionStatus = getMissionStatus(campaign.status);
  const { start } = useCampaignActions(campaign.id);
  const canQuickStart = campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.READY;

  return (
    <li>
      <Card padding="md" className="flex flex-wrap items-center justify-between gap-3">
        {/* The Link and the Quick Action Button below are siblings, not nested — Card itself is
            never wrapped in a Link (the whole-row-is-a-link pattern this workspace used to use)
            specifically so a real interactive Button can sit in the same row without reproducing
            the nested-interactive-element bug class fixed in components/ui/dropdown-menu.tsx and
            app/(dashboard)/page.tsx (docs/interaction-framework/13-decision-records.md ADR-012). */}
        <Link href={`/campaigns/${campaign.id}`} className="min-w-0 flex-1 hover:underline">
          <p className="truncate text-body font-medium text-primary">{campaign.name}</p>
          <p className="text-caption text-secondary">
            {humanizeStatus(campaign.goal.desiredOutcome)} · {campaign.targetsCount} targets · {campaign.batchesCount} batches
          </p>
          <p className="text-caption text-secondary">
            Created {formatDate(campaign.createdAt)} · Last activity{' '}
            {formatDate(campaign.updatedAt)}
          </p>
        </Link>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status]}>{humanizeStatus(campaign.status)}</Badge>
          <span className="text-caption text-secondary">{missionStatus.label}</span>
          {canQuickStart && (
            <Button size="sm" loading={start.isPending} onClick={() => start.mutate(undefined)}>
              Start
            </Button>
          )}
        </div>
      </Card>
    </li>
  );
}

/**
 * docs/campaign-workspace/, extended in Milestone 25 with a real dashboard summary and real
 * search/filtering. Two data-fetching paths, chosen to keep the common case (no filters) exactly
 * as fast and simple as before: with no filters active, this is still the plain `GET /campaigns`
 * real-pagination query unchanged since Milestone 23. The moment any filter is active, it switches
 * to `GET /campaigns/search` (real, server-side status/strategy/date filtering); a name filter
 * additionally widens that fetch to a bounded 100 and paginates the matched set client-side, since
 * the backend has no keyword field to delegate that to (see `use-campaigns-search.ts`).
 */
export function CampaignList() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<CampaignFilterState>(EMPTY_CAMPAIGN_FILTERS);

  const hasFilters = hasActiveCampaignFilters(filters);
  const hasNameFilter = Boolean(filters.name.trim());

  // Only one of these two is ever actually displayed (`activeQuery` below) — `enabled` (M25
  // sign-off audit fix) ensures only one is ever actually in flight too, not both on every
  // render regardless of which is shown.
  const plainQuery = useCampaigns({ page, limit: PAGE_SIZE }, { enabled: !hasFilters });
  const searchQuery = useCampaignsSearch({
    status: filters.status || undefined,
    strategyType: filters.strategyType || undefined,
    createdFrom: filters.createdFrom || undefined,
    createdTo: filters.createdTo || undefined,
    page: hasNameFilter ? 1 : page,
    limit: hasNameFilter ? NAME_SEARCH_FETCH_LIMIT : PAGE_SIZE,
  }, { enabled: hasFilters });

  const activeQuery = hasFilters ? searchQuery : plainQuery;

  const displayed = useMemo(() => {
    if (!activeQuery.data) return null;
    if (!hasNameFilter) return activeQuery.data;

    const needle = filters.name.trim().toLowerCase();
    const matched = activeQuery.data.items.filter((campaign) => campaign.name.toLowerCase().includes(needle));
    const start = (page - 1) * PAGE_SIZE;
    return { items: matched.slice(start, start + PAGE_SIZE), total: matched.length, page, limit: PAGE_SIZE };
  }, [activeQuery.data, hasNameFilter, filters.name, page]);

  const totalPages = displayed ? Math.max(1, Math.ceil(displayed.total / displayed.limit)) : 1;

  function handleFiltersChange(next: CampaignFilterState) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* No page-level "New campaign" action here — the shell header's real, already-wired
          QuickActions button (components/shell/quick-actions.tsx) already does exactly this for
          every CANDIDATE; a second identical button on this page would be the redundant duplicate
          control the milestone's own "avoid dashboard clutter" instruction rules out. */}
      <ContextHeader title="Campaigns" />

      <CampaignDashboardSummary />

      <CampaignFilters filters={filters} onChange={handleFiltersChange} />

      {activeQuery.isLoading && (
        <SkeletonRegion loading label="Loading campaigns">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} variant="card" />
            ))}
          </div>
        </SkeletonRegion>
      )}

      {activeQuery.isError && (
        <ErrorState message={activeQuery.error instanceof ApiError ? activeQuery.error.message : 'Something went wrong loading your campaigns.'} />
      )}

      {displayed && displayed.items.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-background-subtle p-6 text-body-sm text-secondary">
          {hasFilters ? 'No campaigns match these filters.' : "You don't have any campaigns yet."}
        </p>
      )}

      {displayed && displayed.items.length > 0 && (
        <ul className="space-y-2" aria-label="Campaigns">
          {displayed.items.map((campaign) => (
            <CampaignListRow key={campaign.id} campaign={campaign} />
          ))}
        </ul>
      )}

      {displayed && displayed.total > displayed.limit && (
        <div className="mt-4 flex items-center justify-between">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </Button>
          <span className="text-caption text-secondary">
            Page {displayed.page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
