'use client';

import { useQuery } from '@tanstack/react-query';
import * as campaignsApi from '../api/campaigns.api';

/** Real `GET /campaigns/:id/execution-status` — the real target-status-breakdown and
 * goal-progress aggregates backing the Company Pipeline and Operational Analytics sections.
 * A shorter `staleTime` than the platform default (`app/providers.tsx`'s 30s) because this is the
 * one query on the page most likely to change while a campaign is actively running — the
 * Background Activity Center's own "every request has progress" spirit applies here too. */
export function useCampaignExecutionStatus(id: string) {
  return useQuery({
    queryKey: ['campaign', id, 'execution-status'],
    queryFn: () => campaignsApi.getCampaignExecutionStatus(id),
    staleTime: 10_000,
  });
}
