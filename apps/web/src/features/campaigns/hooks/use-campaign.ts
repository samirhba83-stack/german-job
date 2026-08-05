'use client';

import { useQuery } from '@tanstack/react-query';
import * as campaignsApi from '../api/campaigns.api';

/** Real `GET /campaigns/:id` — the single source of truth for the Campaign Workspace's Overview
 * section. Relies on `app/providers.tsx`'s global QueryClient defaults (30s staleTime, no retry
 * on a 4xx) rather than overriding them, since a single-campaign fetch has no special caching
 * need beyond the platform default. `enabled` defaults to true; pass `false` for a conditional
 * fetch (e.g. the Duplicate flow, which only has an id when `?duplicateFrom=` is present). */
export function useCampaign(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignsApi.getCampaign(id),
    enabled: (options.enabled ?? true) && id.length > 0,
  });
}
