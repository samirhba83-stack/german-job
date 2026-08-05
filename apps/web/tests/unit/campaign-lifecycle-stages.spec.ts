import { describe, expect, it } from 'vitest';
import { CampaignActorRole, CampaignOutcomeGoal, CampaignStatus, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { toCampaignLifecycleStages } from '@/lib/campaign-lifecycle-stages';
import type { CampaignDto, CampaignTimelineEntryDto } from '@/features/campaigns/types';

/**
 * Real regression coverage for `resolveEffectiveIndex()`/`isFailurePath()` — flagged as a real,
 * untested-but-non-trivial risk in the Campaign Workspace's own review, repeated across Milestones
 * 23 and 23.1 without ever being closed ("this should stop being a future recommendation,"
 * docs/campaign-workspace/09-final-deliverables-and-principal-review.md). Milestone 25 closes it.
 */

function buildCampaign(overrides: Partial<CampaignDto> = {}): CampaignDto {
  return {
    id: 'campaign-1',
    ownerId: 'candidate-1',
    name: 'Test Campaign',
    status: CampaignStatus.DRAFT,
    strategy: { type: CampaignStrategyType.BALANCED, parameters: {} },
    goal: { targetApplicationCount: 20, desiredOutcome: CampaignOutcomeGoal.REPLIES, deadline: null },
    batchPlan: { baseBatchSize: 10, minBatchSize: 1, maxBatchSize: 20, adaptive: false, expansionIncrement: null },
    executionWindow: {
      allowedWeekdays: [Weekday.MONDAY],
      dailyStartHour: 8,
      dailyEndHour: 18,
      timezone: 'Europe/Berlin',
      respectHolidays: true,
    },
    rateLimitProfile: { maxPerDay: 50, maxPerHour: 10, maxPerCompanyPerWindow: 1 },
    checkpoint: null,
    cooldown: null,
    health: null,
    intelligence: null,
    targetsCount: 0,
    batchesCount: 0,
    isTerminal: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function buildEntry(
  currentState: CampaignStatus,
  previousState: CampaignStatus | null,
  timestamp = '2026-01-02T00:00:00.000Z',
): CampaignTimelineEntryDto {
  return {
    id: `entry-${currentState}`,
    timestamp,
    actor: { role: CampaignActorRole.CANDIDATE, actorId: 'candidate-1' },
    source: 'candidate',
    reason: null,
    previousState,
    currentState,
    metadata: {},
    correlationId: 'corr-1',
    evidenceReference: null,
    aiExplanation: null,
  };
}

describe('toCampaignLifecycleStages', () => {
  it('marks every happy-path stage before RUNNING as complete, RUNNING as active', () => {
    const campaign = buildCampaign({ status: CampaignStatus.RUNNING });
    const timeline = [
      buildEntry(CampaignStatus.DRAFT, null),
      buildEntry(CampaignStatus.READY, CampaignStatus.DRAFT),
      buildEntry(CampaignStatus.RUNNING, CampaignStatus.READY),
    ];

    const stages = toCampaignLifecycleStages(campaign, timeline);

    expect(stages.map((s) => s.status)).toEqual(['complete', 'complete', 'active', 'pending']);
  });

  it('resolves a CANCELLED campaign that diverged from DRAFT (never started) as failed at the Draft stage, not Running', () => {
    const campaign = buildCampaign({ status: CampaignStatus.CANCELLED, isTerminal: true });
    const timeline = [buildEntry(CampaignStatus.DRAFT, null), buildEntry(CampaignStatus.CANCELLED, CampaignStatus.DRAFT)];

    const stages = toCampaignLifecycleStages(campaign, timeline);

    // Cancelled-from-Draft diverged at index 0 (Draft) — Draft itself is the failed stage.
    expect(stages[0].status).toBe('failed');
    expect(stages[1].status).toBe('pending');
    expect(stages[2].status).toBe('pending');
  });

  it('resolves a CANCELLED campaign that diverged from RUNNING as failed at the Running stage', () => {
    const campaign = buildCampaign({ status: CampaignStatus.CANCELLED, isTerminal: true });
    const timeline = [
      buildEntry(CampaignStatus.DRAFT, null),
      buildEntry(CampaignStatus.READY, CampaignStatus.DRAFT),
      buildEntry(CampaignStatus.RUNNING, CampaignStatus.READY),
      buildEntry(CampaignStatus.CANCELLED, CampaignStatus.RUNNING),
    ];

    const stages = toCampaignLifecycleStages(campaign, timeline);

    expect(stages[0].status).toBe('complete');
    expect(stages[1].status).toBe('complete');
    expect(stages[2].status).toBe('failed');
  });

  it('treats PAUSED as a sub-state of Running (active, not a separate/failed stage)', () => {
    const campaign = buildCampaign({ status: CampaignStatus.PAUSED });
    const timeline = [
      buildEntry(CampaignStatus.DRAFT, null),
      buildEntry(CampaignStatus.READY, CampaignStatus.DRAFT),
      buildEntry(CampaignStatus.RUNNING, CampaignStatus.READY),
      buildEntry(CampaignStatus.PAUSED, CampaignStatus.RUNNING),
    ];

    const stages = toCampaignLifecycleStages(campaign, timeline);

    expect(stages[2].status).toBe('active');
  });

  it('treats ARCHIVED-from-COMPLETED as a success path, not a failure', () => {
    const campaign = buildCampaign({ status: CampaignStatus.ARCHIVED, isTerminal: true });
    const timeline = [
      buildEntry(CampaignStatus.DRAFT, null),
      buildEntry(CampaignStatus.READY, CampaignStatus.DRAFT),
      buildEntry(CampaignStatus.RUNNING, CampaignStatus.READY),
      buildEntry(CampaignStatus.COMPLETED, CampaignStatus.RUNNING),
      buildEntry(CampaignStatus.ARCHIVED, CampaignStatus.COMPLETED),
    ];

    const stages = toCampaignLifecycleStages(campaign, timeline);

    // Archived-from-Completed resolves to the Completed index, and is not a failure path.
    expect(stages[3].status).toBe('complete');
  });

  it('treats ARCHIVED-from-CANCELLED as a failure path', () => {
    const campaign = buildCampaign({ status: CampaignStatus.ARCHIVED, isTerminal: true });
    const timeline = [
      buildEntry(CampaignStatus.DRAFT, null),
      buildEntry(CampaignStatus.CANCELLED, CampaignStatus.DRAFT),
      buildEntry(CampaignStatus.ARCHIVED, CampaignStatus.CANCELLED),
    ];

    const stages = toCampaignLifecycleStages(campaign, timeline);

    // No previousState recorded for the CANCELLED->ARCHIVED entry resolving back through DRAFT
    // isn't happy-path, so the effective index falls back to RUNNING (index 2) per
    // resolveEffectiveIndex's own documented fallback — asserting the real, current behavior.
    expect(stages[2].status).toBe('failed');
  });

  it('falls back to the Draft stage using the campaign createdAt when no explicit Draft transition entry exists', () => {
    const campaign = buildCampaign({ status: CampaignStatus.DRAFT, createdAt: '2026-03-01T00:00:00.000Z' });

    const stages = toCampaignLifecycleStages(campaign, []);

    expect(stages[0].occurredAt).toBe('2026-03-01T00:00:00.000Z');
  });
});
