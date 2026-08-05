'use client';

import { useSearchParams } from 'next/navigation';
import { ContextHeader } from '@/components/shell/context-header';
import { Skeleton } from '@/components/ui/skeleton';
import { CampaignForm } from '@/features/campaigns/components/campaign-form';
import { useCreateCampaign } from '@/features/campaigns/hooks/use-create-campaign';
import { useCampaign } from '@/features/campaigns/hooks/use-campaign';
import type { CampaignPayload } from '@/features/campaigns/api/campaigns.api';

/**
 * The real creation flow `POST /campaigns` — the flow Milestone 23 explicitly deferred to "its
 * own focused milestone" (docs/campaign-workspace/08-future-extension-strategy.md), now built.
 *
 * Also serves Duplicate: `/campaigns/new?duplicateFrom=<id>` pre-fills every field from a real,
 * already-fetched campaign (`useCampaign`, the same hook the workspace itself uses) via a plain
 * GET — no new backend endpoint. The name field gets a "(copy)" suffix so the duplicate is never
 * silently indistinguishable from its source, and nothing is submitted until the user reviews and
 * confirms — this creates a genuinely new campaign via the same real POST, not a hidden clone
 * operation.
 */
export default function NewCampaignPage() {
  const searchParams = useSearchParams();
  const duplicateFromId = searchParams.get('duplicateFrom');
  const sourceQuery = useCampaign(duplicateFromId ?? '');
  const createCampaign = useCreateCampaign();

  function handleSubmit(payload: CampaignPayload) {
    createCampaign.mutate(payload);
  }

  if (duplicateFromId && sourceQuery.isLoading) {
    return (
      <div className="space-y-4">
        <ContextHeader title="New Campaign" />
        <Skeleton variant="card" className="h-64" />
      </div>
    );
  }

  const initialValues: CampaignPayload | undefined =
    duplicateFromId && sourceQuery.data
      ? {
          name: `${sourceQuery.data.name} (copy)`,
          goal: sourceQuery.data.goal,
          strategy: sourceQuery.data.strategy,
          batchPlan: sourceQuery.data.batchPlan,
          executionWindow: sourceQuery.data.executionWindow,
          rateLimitProfile: sourceQuery.data.rateLimitProfile,
        }
      : undefined;

  return (
    <div className="space-y-6">
      <ContextHeader
        title={duplicateFromId ? 'Duplicate Campaign' : 'New Campaign'}
      />
      <CampaignForm
        initialValues={initialValues}
        submitLabel="Create campaign"
        submitting={createCampaign.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
