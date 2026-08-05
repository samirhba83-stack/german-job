import { CampaignStatus } from '../types';

export type CampaignStatusBucket = 'running' | 'scheduled' | 'paused' | 'completed' | 'failed' | 'archived';

export const BUCKET_LABEL: Record<CampaignStatusBucket, string> = {
  running: 'Running',
  scheduled: 'Scheduled',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  archived: 'Archived',
};

/**
 * Maps the real 10-value `CampaignStatus` enum onto the 5 dashboard buckets Milestone 25 asks
 * for, plus a 6th (`archived`) that none of the 5 named buckets honestly fit — cramming archived
 * campaigns into "Failed" would misrepresent a candidate who archived a *successful* campaign, and
 * silently dropping the count would hide real data. `COOLING_DOWN`/`RESUMING` fold into `running`
 * (both are real sub-states of an actively-executing campaign, the same grouping
 * `campaign-lifecycle-stages.ts` already uses); `DRAFT`/`READY` fold into `scheduled` (not yet
 * running); `STOPPED`/`CANCELLED` fold into `failed` (terminal, not successful).
 */
export function bucketForStatus(status: CampaignStatus): CampaignStatusBucket {
  switch (status) {
    case CampaignStatus.RUNNING:
    case CampaignStatus.COOLING_DOWN:
    case CampaignStatus.RESUMING:
      return 'running';
    case CampaignStatus.DRAFT:
    case CampaignStatus.READY:
      return 'scheduled';
    case CampaignStatus.PAUSED:
      return 'paused';
    case CampaignStatus.COMPLETED:
      return 'completed';
    case CampaignStatus.STOPPED:
    case CampaignStatus.CANCELLED:
      return 'failed';
    case CampaignStatus.ARCHIVED:
      return 'archived';
  }
}

export function countByBucket(statuses: CampaignStatus[]): Record<CampaignStatusBucket, number> {
  const counts: Record<CampaignStatusBucket, number> = {
    running: 0,
    scheduled: 0,
    paused: 0,
    completed: 0,
    failed: 0,
    archived: 0,
  };
  for (const status of statuses) {
    counts[bucketForStatus(status)] += 1;
  }
  return counts;
}
