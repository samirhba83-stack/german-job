'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as campaignsApi from '../api/campaigns.api';
import type { CampaignReasonPayload, RequiredCampaignReasonPayload } from '../api/campaigns.api';

/**
 * Every real lifecycle transition `POST /campaigns/:id/{start,pause,resume,cancel,complete,
 * archive}` supports, each wired through `useTrackedMutation` — the same hook every other real
 * mutation in the product uses, so a campaign action gets a Background Activity Center entry and
 * a toast, with zero new feedback code (docs/interaction-framework/04-interaction-
 * feedback-system.md). `retry`/`replay` are deliberately not included: both require real
 * target-level scoping (a list of target ids) that the backend has no endpoint to enumerate today
 * (docs/campaign-workspace/03-integration-points.md) — building a control for them would mean
 * either faking a target list or shipping a button with no real way to fill its own request body.
 *
 * `successMessage` (Milestone 24 live-validation fix, applied identically to
 * `useCompanyActions`): none of these six actions previously passed `successMessage`, so despite
 * this doc comment's own claim, no success toast ever actually fired — only the Background
 * Activity Center entry was real. Found via live browser testing of the Company Workspace's
 * identical pattern, then confirmed present here too and fixed at the same time.
 */
export function useCampaignActions(campaignId: string) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['campaigns'] });
  }

  const start = useTrackedMutation({
    activityLabel: 'Starting campaign',
    successMessage: 'Campaign started',
    activityContext: { relatedCampaignId: campaignId },
    mutationFn: () => campaignsApi.startCampaign(campaignId),
    onSuccess: invalidate,
  });

  const pause = useTrackedMutation({
    activityLabel: 'Pausing campaign',
    successMessage: 'Campaign paused',
    activityContext: { relatedCampaignId: campaignId },
    mutationFn: (payload: CampaignReasonPayload) => campaignsApi.pauseCampaign(campaignId, payload),
    onSuccess: invalidate,
  });

  const resume = useTrackedMutation({
    activityLabel: 'Resuming campaign',
    successMessage: 'Campaign resumed',
    activityContext: { relatedCampaignId: campaignId },
    mutationFn: (payload: CampaignReasonPayload) => campaignsApi.resumeCampaign(campaignId, payload),
    onSuccess: invalidate,
  });

  const cancel = useTrackedMutation({
    activityLabel: 'Cancelling campaign',
    successMessage: 'Campaign cancelled',
    activityContext: { relatedCampaignId: campaignId },
    mutationFn: (payload: RequiredCampaignReasonPayload) => campaignsApi.cancelCampaign(campaignId, payload),
    onSuccess: invalidate,
  });

  const complete = useTrackedMutation({
    activityLabel: 'Completing campaign',
    successMessage: 'Campaign marked completed',
    activityContext: { relatedCampaignId: campaignId },
    mutationFn: () => campaignsApi.completeCampaign(campaignId),
    onSuccess: invalidate,
  });

  const archive = useTrackedMutation({
    activityLabel: 'Archiving campaign',
    successMessage: 'Campaign archived',
    activityContext: { relatedCampaignId: campaignId },
    mutationFn: (payload: CampaignReasonPayload) => campaignsApi.archiveCampaign(campaignId, payload),
    onSuccess: invalidate,
  });

  return { start, pause, resume, cancel, complete, archive };
}
