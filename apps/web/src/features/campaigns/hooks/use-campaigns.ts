'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import * as campaignsApi from '../api/campaigns.api';
import type { ListCampaignsParams } from '../api/campaigns.api';

/** Real `GET /campaigns`, paginated — backs the Campaign list page. `placeholderData:
 * keepPreviousData` keeps the previous page's rows on screen while the next page loads instead of
 * flashing a full-page loading state on every page change — a real, justified use of TanStack
 * Query's own pagination primitive, not a bespoke one. `enabled` (M25 sign-off audit fix) defaults
 * to true; `CampaignList` passes `false` while a filter is active, so this and
 * `useCampaignsSearch` are never both actually in flight at once even though React's rules of
 * hooks require both to be called unconditionally. */
export function useCampaigns(params: ListCampaignsParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => campaignsApi.listCampaigns(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}
