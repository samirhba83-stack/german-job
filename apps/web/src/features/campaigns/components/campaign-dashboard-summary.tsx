'use client';

import Link from 'next/link';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/shell/error-state';
import { CAMPAIGN_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import { ApiError } from '@/lib/api-client';
import { useCampaignDashboardData } from '../hooks/use-campaign-dashboard-data';
import { useMyProfile } from '@/features/profiles/hooks/use-my-profile';
import { BUCKET_LABEL, countByBucket, type CampaignStatusBucket } from '../lib/campaign-status-buckets';

const BUCKET_ORDER: CampaignStatusBucket[] = ['running', 'scheduled', 'paused', 'completed', 'failed', 'archived'];
const RECENT_ACTIVITY_COUNT = 5;

/**
 * Milestone 25's "Campaign Workspace Dashboard" — the summary the spec asks the list page to open
 * with. Every tile is computed from real campaigns (`useCampaignDashboardData`), never a fabricated
 * count. "Campaign Readiness" is real profile completeness (`GET /profiles/me`, the same field
 * `CampaignOverview` already surfaces) — the one real, campaign-adjacent "readiness" signal that
 * exists today; there is no per-campaign readiness score. "Campaign Health" / "Execution
 * Confidence" tiles are deliberately not duplicated here: every real campaign's `health` is `null`
 * (docs/campaign-workspace/03-integration-points.md), and `CampaignHealthCenter` already states
 * that honestly once inside a campaign's own workspace — repeating an always-empty tile at the
 * dashboard level would be the exact "permanently-empty feature" risk the M23 Principal Review
 * warned against, at even higher visibility. "Recent Activity" is the real N most-recently-updated
 * campaigns (there is no cross-campaign event feed endpoint) — real names, real statuses, real
 * timestamps, sorted by real `updatedAt`.
 */
export function CampaignDashboardSummary() {
  const dashboardQuery = useCampaignDashboardData();
  const profileQuery = useMyProfile();

  if (dashboardQuery.isLoading) {
    return (
      <SkeletonRegion loading label="Loading campaign summary">
        <Skeleton variant="card" className="h-28" />
      </SkeletonRegion>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <ErrorState message={dashboardQuery.error instanceof ApiError ? dashboardQuery.error.message : 'The campaign summary is unavailable right now.'} />
    );
  }

  const campaigns = dashboardQuery.data.items;
  const counts = countByBucket(campaigns.map((campaign) => campaign.status));
  const recentActivity = [...campaigns]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, RECENT_ACTIVITY_COUNT);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-secondary">Total</p>
          <p className="mt-1 text-heading-lg font-semibold text-primary tabular-nums">{dashboardQuery.data.total}</p>
        </div>
        {BUCKET_ORDER.map((bucket) => (
          <div key={bucket} className="rounded-md border border-border bg-surface p-3">
            <p className="text-caption font-semibold uppercase tracking-wide text-secondary">{BUCKET_LABEL[bucket]}</p>
            <p className="mt-1 text-heading-lg font-semibold text-primary tabular-nums">{counts[bucket]}</p>
          </div>
        ))}
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-secondary">Profile readiness</p>
          <p className="mt-1 text-heading-lg font-semibold text-primary tabular-nums">
            {profileQuery.data ? `${profileQuery.data.completionPercentage}%` : '—'}
          </p>
        </div>
      </div>

      {dashboardQuery.data.total > campaigns.length && (
        <p className="text-caption text-secondary">
          Showing counts across your {campaigns.length} most recent campaigns of {dashboardQuery.data.total} total.
        </p>
      )}

      <div>
        {/* M25 sign-off audit fix (axe-core heading-order): this is the first heading below the
            page's real <h1> ("Campaigns", rendered by ContextHeader) — h2 is the correct next
            level, not h3, which skipped a level with nothing in between. */}
        <h2 className="text-heading-sm font-semibold text-primary">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="mt-2 text-body-sm text-secondary">You don&apos;t have any campaigns yet.</p>
        ) : (
          <ul className="mt-2 space-y-2" aria-label="Recent activity">
            {recentActivity.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3 hover:bg-background-subtle"
                >
                  <span className="min-w-0 truncate text-body-sm font-medium text-primary">{campaign.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status]}>{humanizeStatus(campaign.status)}</Badge>
                    <span className="text-caption text-secondary">{formatDateTime(campaign.updatedAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
