import { describe, expect, it } from 'vitest';
import { CampaignStatus } from '@german-job-engine/shared-types';
import { bucketForStatus, countByBucket } from '@/features/campaigns/lib/campaign-status-buckets';

describe('bucketForStatus', () => {
  it('maps every real CampaignStatus value to exactly one bucket (no status silently uncovered)', () => {
    for (const status of Object.values(CampaignStatus)) {
      expect(() => bucketForStatus(status)).not.toThrow();
    }
  });

  it('folds RUNNING/COOLING_DOWN/RESUMING into "running"', () => {
    expect(bucketForStatus(CampaignStatus.RUNNING)).toBe('running');
    expect(bucketForStatus(CampaignStatus.COOLING_DOWN)).toBe('running');
    expect(bucketForStatus(CampaignStatus.RESUMING)).toBe('running');
  });

  it('folds DRAFT/READY into "scheduled"', () => {
    expect(bucketForStatus(CampaignStatus.DRAFT)).toBe('scheduled');
    expect(bucketForStatus(CampaignStatus.READY)).toBe('scheduled');
  });

  it('folds STOPPED/CANCELLED into "failed"', () => {
    expect(bucketForStatus(CampaignStatus.STOPPED)).toBe('failed');
    expect(bucketForStatus(CampaignStatus.CANCELLED)).toBe('failed');
  });

  it('keeps PAUSED, COMPLETED, and ARCHIVED as their own distinct buckets', () => {
    expect(bucketForStatus(CampaignStatus.PAUSED)).toBe('paused');
    expect(bucketForStatus(CampaignStatus.COMPLETED)).toBe('completed');
    expect(bucketForStatus(CampaignStatus.ARCHIVED)).toBe('archived');
  });
});

describe('countByBucket', () => {
  it('counts an empty list as all zeros', () => {
    expect(countByBucket([])).toEqual({ running: 0, scheduled: 0, paused: 0, completed: 0, failed: 0, archived: 0 });
  });

  it('counts a real mixed set of statuses correctly', () => {
    const statuses = [
      CampaignStatus.RUNNING,
      CampaignStatus.RUNNING,
      CampaignStatus.DRAFT,
      CampaignStatus.PAUSED,
      CampaignStatus.COMPLETED,
      CampaignStatus.CANCELLED,
      CampaignStatus.ARCHIVED,
    ];

    expect(countByBucket(statuses)).toEqual({
      running: 2,
      scheduled: 1,
      paused: 1,
      completed: 1,
      failed: 1,
      archived: 1,
    });
  });
});
