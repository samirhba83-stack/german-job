'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ContextHeader } from '@/components/shell/context-header';
import { ErrorState } from '@/components/shell/error-state';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { CampaignForm } from '@/features/campaigns/components/campaign-form';
import { useCampaign } from '@/features/campaigns/hooks/use-campaign';
import { useUpdateCampaign } from '@/features/campaigns/hooks/use-update-campaign';
import type { CampaignPayload } from '@/features/campaigns/api/campaigns.api';

/** `PATCH /campaigns/:id` — real, live. Only reachable while the campaign is DRAFT or READY; the
 * backend rejects anything else (`EDITABLE_STATES`), surfaced here as a plain, honest message
 * rather than a silently-disabled form, since a user who navigates here directly by URL deserves
 * to know why, not just find the form missing. */
// Next.js 15 — `params` is now a Promise on both Server and Client Component pages. A Client
// Component can't be `async`, so the real, documented way to unwrap it is React's `use()` hook
// (not `await`) — a real API difference from the 4 Server Component pages in this same PR.
export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const campaignQuery = useCampaign(id);
  const updateCampaign = useUpdateCampaign(id);

  if (campaignQuery.isLoading) {
    return (
      <SkeletonRegion loading label="Loading campaign">
        <Skeleton variant="card" className="h-64" />
      </SkeletonRegion>
    );
  }

  if (campaignQuery.isError || !campaignQuery.data) {
    return (
      <ErrorState message={campaignQuery.error instanceof ApiError ? campaignQuery.error.message : 'This campaign could not be loaded.'} />
    );
  }

  const campaign = campaignQuery.data;
  const isEditable = campaign.status === 'DRAFT' || campaign.status === 'READY';

  if (!isEditable) {
    return (
      <div className="space-y-4">
        <ContextHeader title={`Edit ${campaign.name}`} />
        <p className="rounded-md border border-dashed border-border bg-background-subtle p-4 text-body-sm text-secondary">
          This campaign can no longer be edited — only a Draft or Ready campaign can be changed, and this one is currently{' '}
          {campaign.status.toLowerCase().replace(/_/g, ' ')}.
        </p>
      </div>
    );
  }

  const initialValues: CampaignPayload = {
    name: campaign.name,
    goal: campaign.goal,
    strategy: campaign.strategy,
    batchPlan: campaign.batchPlan,
    executionWindow: campaign.executionWindow,
    rateLimitProfile: campaign.rateLimitProfile,
  };

  return (
    <div className="space-y-6">
      <ContextHeader title={`Edit ${campaign.name}`} />
      <CampaignForm
        initialValues={initialValues}
        submitLabel="Save changes"
        submitting={updateCampaign.isPending}
        onSubmit={(payload) => updateCampaign.mutate(payload)}
        onCancel={() => router.push(`/campaigns/${id}`)}
      />
    </div>
  );
}
