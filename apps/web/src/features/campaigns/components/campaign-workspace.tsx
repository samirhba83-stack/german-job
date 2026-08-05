'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExecutionStageList } from '@/components/shell/execution-stage-list';
import { ContextHeader } from '@/components/shell/context-header';
import { ErrorState } from '@/components/shell/error-state';
import { ApiError } from '@/lib/api-client';
import { CAMPAIGN_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { toCampaignLifecycleStages } from '@/lib/campaign-lifecycle-stages';
import { getMissionStatus } from '@/lib/mission-status';
import { useMyProfile } from '@/features/profiles/hooks/use-my-profile';
import { useCampaign } from '../hooks/use-campaign';
import { useCampaignTimeline } from '../hooks/use-campaign-timeline';
import { useCampaignExecutionStatus } from '../hooks/use-campaign-execution-status';
import { CampaignStatus } from '../types';
import { CampaignOverview } from './campaign-overview';
import { CampaignActions } from './campaign-actions';
import { CampaignHealthCenter } from './campaign-health-center';
import { CampaignProgressLog } from './campaign-progress-log';
import { TargetStatusBreakdown } from './target-status-breakdown';
import { OperationalAnalytics } from './operational-analytics';
import { SmartRecommendationPanel } from './smart-recommendation-panel';
import { ExecutionMonitor } from './execution-monitor';

function WorkspaceSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-heading-md font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

/**
 * docs/campaign-workspace/. The Campaign Workspace — composes every section this milestone asked
 * for from four real queries (`GET /campaigns/:id`, `.../timeline`, `.../execution-status`,
 * `GET /profiles/me`), each independently loading/erroring rather than one monolithic fetch, so a
 * slow or failed `execution-status` call never blocks the Overview from rendering the moment the
 * campaign itself resolves.
 *
 * Trust Layer / Mission Status / Background Activities (Milestone 23.1 integration check): Trust
 * Layer is `CampaignHealthCenter`'s `TrustFeedbackCard`; Mission Status is `missionStatus` below,
 * computed once and shared. Background Activities is deliberately *not* re-instantiated on this
 * page — `AppShell`'s header already renders one real, global `BackgroundActivityCenter`
 * (`components/shell/background-activity-center.tsx`), and `CampaignActions`' mutations already
 * populate it via `useTrackedMutation`. Mounting a second, page-scoped copy here would be exactly
 * the duplicated state this milestone's integration pass was asked to check for.
 */
export function CampaignWorkspace({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const campaignQuery = useCampaign(campaignId);
  const timelineQuery = useCampaignTimeline(campaignId);
  const executionStatusQuery = useCampaignExecutionStatus(campaignId);
  const profileQuery = useMyProfile();

  const lifecycleStages = useMemo(() => {
    if (!campaignQuery.data || !timelineQuery.data) return null;
    return toCampaignLifecycleStages(campaignQuery.data, timelineQuery.data);
  }, [campaignQuery.data, timelineQuery.data]);

  if (campaignQuery.isLoading) {
    return (
      <SkeletonRegion loading label="Loading campaign">
        <div className="space-y-4">
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-48" />
        </div>
      </SkeletonRegion>
    );
  }

  if (campaignQuery.isError || !campaignQuery.data) {
    return (
      <ErrorState message={campaignQuery.error instanceof ApiError ? campaignQuery.error.message : 'This campaign could not be loaded.'} />
    );
  }

  const campaign = campaignQuery.data;

  // Computed once, passed to both CampaignOverview and CampaignHealthCenter (Milestone 23.1's
  // "no duplicated transformations" pass — each previously called getMissionStatus() itself with
  // identical inputs).
  const missionStatus = getMissionStatus(campaign.status, {
    health: campaign.health ? { healthScore: campaign.health.healthScore, computedAt: campaign.health.computedAt } : null,
    updatedAt: campaign.updatedAt,
  });

  return (
    <div className="space-y-8">
      {/* The page's real <h1> (Milestone 23 audit fix) — the workspace previously had none at
          all, since CampaignOverview's own heading was only an <h2> with no <h1> above it
          anywhere on the route. ContextHeader (built in M22.2, uninstantiated until now) is
          exactly the primitive built for this: title + real status + real page-level actions in
          one place, directly below the shell's Breadcrumbs. */}
      <ContextHeader
        title={campaign.name}
        status={<Badge tone={CAMPAIGN_STATUS_TONE[campaign.status]}>{humanizeStatus(campaign.status)}</Badge>}
        actions={
          <>
            {(campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.READY) && (
              <Button size="sm" variant="secondary" onClick={() => router.push(`/campaigns/${campaign.id}/edit`)}>
                Edit
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => router.push(`/campaigns/new?duplicateFrom=${campaign.id}`)}>
              Duplicate
            </Button>
            <CampaignActions campaign={campaign} />
          </>
        }
      />

      <CampaignOverview
        campaign={campaign}
        missionStatus={missionStatus}
        profileCompleteness={profileQuery.data?.completionPercentage ?? null}
      />

      <WorkspaceSection title="Lifecycle">
        <SkeletonRegion loading={!lifecycleStages} label="Loading lifecycle">
          {lifecycleStages ? <ExecutionStageList stages={lifecycleStages} /> : <Skeleton variant="card" className="h-24" />}
        </SkeletonRegion>
      </WorkspaceSection>

      <WorkspaceSection title="Health">
        <CampaignHealthCenter campaign={campaign} missionStatus={missionStatus} />
      </WorkspaceSection>

      <WorkspaceSection title="Recommendations">
        <SmartRecommendationPanel campaign={campaign} />
      </WorkspaceSection>

      <WorkspaceSection title="Company Pipeline">
        <SkeletonRegion loading={!executionStatusQuery.data && !executionStatusQuery.isError} label="Loading pipeline status">
          {executionStatusQuery.data ? (
            <TargetStatusBreakdown breakdown={executionStatusQuery.data.targetBreakdown} />
          ) : executionStatusQuery.isError ? (
            <p className="text-body-sm text-secondary">Pipeline status is unavailable right now.</p>
          ) : (
            <Skeleton variant="card" className="h-20" />
          )}
        </SkeletonRegion>
      </WorkspaceSection>

      <WorkspaceSection title="Execution Monitoring">
        <SkeletonRegion loading={!executionStatusQuery.data && !executionStatusQuery.isError} label="Loading execution status">
          {executionStatusQuery.data ? (
            <ExecutionMonitor executionStatus={executionStatusQuery.data} executionWindow={campaign.executionWindow} />
          ) : executionStatusQuery.isError ? (
            <p className="text-body-sm text-secondary">Execution status is unavailable right now.</p>
          ) : (
            <Skeleton variant="card" className="h-20" />
          )}
        </SkeletonRegion>
      </WorkspaceSection>

      <WorkspaceSection title="Operational analytics">
        <SkeletonRegion loading={!executionStatusQuery.data && !executionStatusQuery.isError} label="Loading analytics">
          {executionStatusQuery.data ? (
            <OperationalAnalytics campaign={campaign} executionStatus={executionStatusQuery.data} />
          ) : executionStatusQuery.isError ? (
            <p className="text-body-sm text-secondary">Analytics are unavailable right now.</p>
          ) : (
            <Skeleton variant="card" className="h-20" />
          )}
        </SkeletonRegion>
      </WorkspaceSection>

      <WorkspaceSection title="Progress">
        <SkeletonRegion loading={!timelineQuery.data} label="Loading progress">
          {timelineQuery.data ? <CampaignProgressLog timeline={timelineQuery.data} /> : <Skeleton variant="card" className="h-32" />}
        </SkeletonRegion>
      </WorkspaceSection>
    </div>
  );
}
