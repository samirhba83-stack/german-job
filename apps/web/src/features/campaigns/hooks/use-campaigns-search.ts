'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import * as campaignsApi from '../api/campaigns.api';
import type { SearchCampaignsParams } from '../api/campaigns.api';

/**
 * The real, live `GET /campaigns/search` endpoint — status/strategyType/date range are all real,
 * server-side, backend-validated filters (`search-campaigns.query.dto.ts`). Ownership scoping is
 * never sent from the client — enforced server-side regardless of what a caller passes (Milestone
 * 24.5). There is no real name/keyword filter on this endpoint — see `CampaignList` for how name
 * search is layered on top client-side, over a bounded fetch, without triggering a network
 * request per keystroke (the query key here deliberately never includes free-text search input).
 *
 * `enabled` (M25 sign-off audit fix): defaults to true; `CampaignList` passes `false` when no
 * filter is active. Without this, both this hook and the plain `useCampaigns` fired on every
 * render regardless of which one's result was actually displayed — a real, avoidable doubled
 * network request, caught during this milestone's own sign-off audit.
 */
export function useCampaignsSearch(params: SearchCampaignsParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['campaigns', 'search', params],
    queryFn: () => campaignsApi.searchCampaigns(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}
