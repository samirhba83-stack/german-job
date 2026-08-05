import { Badge } from '@/components/ui/badge';
import { CAMPAIGN_TARGET_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import type { CampaignTargetStatusBreakdownDto } from '../types';

/**
 * docs/campaign-workspace/. Section 4, Company Pipeline. The milestone asks for a per-company
 * list (name, location, industry, eligibility, stage, delivery/reply/interview status, confidence,
 * priority) — no endpoint returns that today: `CampaignTarget` is a real domain entity, but there
 * is no DTO or query exposing individual targets, only aggregate counts per status
 * (docs/campaign-workspace/03-integration-points.md). This renders that real aggregate — how many
 * targets are in each real `CampaignTargetStatus` — honestly, as the truthful version of "where
 * do things stand" available today, rather than fabricating a company-by-company table with
 * invented names or statuses.
 */
export function TargetStatusBreakdown({ breakdown }: { breakdown: CampaignTargetStatusBreakdownDto[] }) {
  const total = breakdown.reduce((sum, entry) => sum + entry.count, 0);

  if (total === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background-subtle p-4 text-body-sm text-secondary">
        No companies have been added to this campaign yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {breakdown
        .filter((entry) => entry.count > 0)
        .map((entry) => (
          <div key={entry.status} className="rounded-md border border-border bg-surface p-3">
            <p className="text-heading-lg font-semibold text-primary">{entry.count}</p>
            <Badge tone={CAMPAIGN_TARGET_STATUS_TONE[entry.status]} className="mt-1">
              {humanizeStatus(entry.status)}
            </Badge>
          </div>
        ))}
    </div>
  );
}
