'use client';

import { useQuery } from '@tanstack/react-query';
import * as campaignsApi from '../api/campaigns.api';

/** Real `GET /campaigns/:id/timeline` — backs both the Lifecycle stage tracker and the Progress
 * event log, so both sections of the workspace read from one real query result instead of
 * fetching the same data twice. */
export function useCampaignTimeline(id: string) {
  return useQuery({
    queryKey: ['campaign', id, 'timeline'],
    queryFn: () => campaignsApi.getCampaignTimeline(id),
  });
}
