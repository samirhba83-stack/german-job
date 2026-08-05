'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as campaignsApi from '../api/campaigns.api';
import type { CampaignPayload } from '../api/campaigns.api';

/** `POST /campaigns` — real, live, the flow Milestone 23 explicitly deferred ("real campaign
 * creation... better suited to its own focused milestone," docs/campaign-workspace/
 * 08-future-extension-strategy.md). On success, navigates straight to the new campaign's real
 * workspace — there is nothing more to confirm on a dedicated "created" screen that the workspace
 * itself doesn't already show. */
export function useCreateCampaign() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useTrackedMutation({
    activityLabel: 'Creating campaign',
    successMessage: 'Campaign created',
    mutationFn: (payload: CampaignPayload) => campaignsApi.createCampaign(payload),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      router.push(`/campaigns/${campaign.id}`);
    },
  });
}
