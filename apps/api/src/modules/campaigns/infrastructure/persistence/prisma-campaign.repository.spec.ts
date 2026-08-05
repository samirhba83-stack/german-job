import { PrismaCampaignRepository } from './prisma-campaign.repository';
import { Campaign } from '../../domain/entities/campaign.entity';
import { CampaignName } from '../../domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../domain/value-objects/actor.vo';
import { CorrelationId } from '../../domain/value-objects/correlation-id.vo';
import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { ConcurrentModificationException } from '../../domain/exceptions/concurrent-modification.exception';

const CAMPAIGN_ID = '123e4567-e89b-12d3-a456-426614174000';

function buildCampaign(): Campaign {
  return Campaign.create(
    CAMPAIGN_ID,
    'candidate-1',
    CampaignName.create('Rate limited campaign'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    ExecutionWindow.create({ allowedWeekdays: [Weekday.MONDAY], dailyStartHour: 0, dailyEndHour: 24, timezone: 'UTC' }),
    RateLimitProfile.default(),
    Actor.candidate('candidate-1'),
    CorrelationId.create('corr-0'),
  );
}

/** A minimal fake of the interactive-transaction `tx` client save() drives. */
function createFakeTx(existingRow: { id: string } | null, updateManyCount: number) {
  return {
    campaign: {
      findUnique: jest.fn().mockResolvedValue(existingRow),
      create: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: updateManyCount }),
    },
    campaignTarget: { upsert: jest.fn().mockResolvedValue(undefined) },
    batch: { upsert: jest.fn().mockResolvedValue(undefined) },
    companyMemoryEntry: { upsert: jest.fn().mockResolvedValue(undefined) },
    dispatchAttempt: { createMany: jest.fn().mockResolvedValue(undefined) },
    campaignTimelineEntry: { createMany: jest.fn().mockResolvedValue(undefined) },
  };
}

describe('PrismaCampaignRepository.save', () => {
  it('creates a new row with version 0 when the campaign does not exist yet', async () => {
    const fakeTx = createFakeTx(null, 0);
    const prisma = { $transaction: jest.fn((callback: (tx: unknown) => Promise<void>) => callback(fakeTx)) };
    const repository = new PrismaCampaignRepository(prisma as any);

    await repository.save(buildCampaign());

    expect(fakeTx.campaign.create).toHaveBeenCalledTimes(1);
    expect(fakeTx.campaign.create.mock.calls[0][0].data).toMatchObject({ id: CAMPAIGN_ID, version: 0 });
    expect(fakeTx.campaign.updateMany).not.toHaveBeenCalled();
  });

  it('updates with a version-matched WHERE clause and increments version when the row exists', async () => {
    const fakeTx = createFakeTx({ id: CAMPAIGN_ID }, 1);
    const prisma = { $transaction: jest.fn((callback: (tx: unknown) => Promise<void>) => callback(fakeTx)) };
    const repository = new PrismaCampaignRepository(prisma as any);
    const campaign = buildCampaign();

    await repository.save(campaign);

    expect(fakeTx.campaign.updateMany).toHaveBeenCalledTimes(1);
    const call = fakeTx.campaign.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ id: CAMPAIGN_ID, version: campaign.version });
    expect(call.data.version).toEqual({ increment: 1 });
    expect(fakeTx.campaign.create).not.toHaveBeenCalled();
  });

  it('throws ConcurrentModificationException when the version-matched update affects zero rows', async () => {
    const fakeTx = createFakeTx({ id: CAMPAIGN_ID }, 0);
    const prisma = { $transaction: jest.fn((callback: (tx: unknown) => Promise<void>) => callback(fakeTx)) };
    const repository = new PrismaCampaignRepository(prisma as any);

    await expect(repository.save(buildCampaign())).rejects.toThrow(ConcurrentModificationException);
    // Confirms the throw happens before any further work in the callback — in a real Postgres
    // transaction this is exactly what makes Prisma roll back everything else queued in the
    // same save() call, not just skip the campaign row.
    expect(fakeTx.campaignTarget.upsert).not.toHaveBeenCalled();
  });
});
