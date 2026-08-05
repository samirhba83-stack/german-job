'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as campaignsApi from '../api/campaigns.api';
import type { UpdateCampaignPayload } from '../api/campaigns.api';

/** `PATCH /campaigns/:id` — real, live, only reachable while the campaign is DRAFT or READY. */
export function useUpdateCampaign(campaignId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useTrackedMutation({
    activityLabel: 'Saving campaign',
    successMessage: 'Campaign updated',
    activityContext: { relatedCampaignId: campaignId },
    mutationFn: (payload: UpdateCampaignPayload) => campaignsApi.updateCampaign(campaignId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      router.push(`/campaigns/${campaignId}`);
    },
  });
}
