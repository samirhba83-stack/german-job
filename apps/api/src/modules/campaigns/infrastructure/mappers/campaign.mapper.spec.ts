import { CampaignOutcomeGoal, CampaignStrategyType, CampaignReasonCode, Weekday } from '@german-job-engine/shared-types';
import { CampaignMapper, PrismaCampaignWithRelations } from './campaign.mapper';
import { Campaign } from '../../domain/entities/campaign.entity';
import { CampaignName } from '../../domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../domain/value-objects/actor.vo';
import { CorrelationId } from '../../domain/value-objects/correlation-id.vo';
import { CampaignReason } from '../../domain/value-objects/campaign-reason.vo';
import { CampaignHealth } from '../../domain/value-objects/campaign-health.vo';

const CAMPAIGN_ID = '123e4567-e89b-12d3-a456-426614174000';
const OWNER_ID = 'candidate-1';

function buildCampaign(): Campaign {
  const campaign = Campaign.create(
    CAMPAIGN_ID,
    OWNER_ID,
    CampaignName.create('Berlin Backend Roles'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    ExecutionWindow.create({
      allowedWeekdays: [Weekday.MONDAY, Weekday.TUESDAY],
      dailyStartHour: 8,
      dailyEndHour: 18,
      timezone: 'Europe/Berlin',
    }),
    RateLimitProfile.default(),
    Actor.candidate(OWNER_ID),
    CorrelationId.create('corr-0'),
  );
  campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), CorrelationId.create('corr-0'));
  campaign.markReady(Actor.candidate(OWNER_ID), CorrelationId.create('corr-0'));
  campaign.start(Actor.candidate(OWNER_ID), CorrelationId.create('corr-0'));
  campaign.stop(Actor.candidate(OWNER_ID), CorrelationId.create('corr-0'), CampaignReason.create(CampaignReasonCode.MANUAL_OVERRIDE, 'pausing for review'));
  campaign.recordHealthAssessment(CampaignHealth.create({ computedBy: 'health-engine' }), Actor.automation('health-engine'), CorrelationId.create('corr-0'));
  return campaign;
}

/** Simulates what Prisma would return by round-tripping through the mapper's own persistence builders. */
function toRawShape(campaign: Campaign): PrismaCampaignWithRelations {
  const data = CampaignMapper.toPersistence(campaign);

  return {
    id: campaign.id,
    version: campaign.version,
    ...data,
    targets: CampaignMapper.toPersistenceTargets(campaign).map((t) => ({ ...t, dispatchAttempts: [] })),
    batches: CampaignMapper.toPersistenceBatches(campaign),
    companyMemory: CampaignMapper.toPersistenceCompanyMemory(campaign),
    timeline: CampaignMapper.toPersistenceTimelineEntries(campaign),
  } as unknown as PrismaCampaignWithRelations;
}

describe('CampaignMapper', () => {
  it('round-trips a campaign with targets, timeline, and a health assessment', () => {
    const original = buildCampaign();
    const raw = toRawShape(original);

    const restored = CampaignMapper.toDomain(raw);

    expect(restored.id).toBe(original.id);
    expect(restored.ownerId).toBe(original.ownerId);
    expect(restored.name.value).toBe('Berlin Backend Roles');
    expect(restored.status).toBe(original.status);
    expect(restored.goal.targetApplicationCount).toBe(5);
    expect(restored.executionWindow.allowedWeekdays).toEqual([Weekday.MONDAY, Weekday.TUESDAY]);
    expect(restored.targets).toHaveLength(1);
    expect(restored.targets[0].jobId).toBe('job-1');
    expect(restored.health?.computedBy).toBe('health-engine');
    expect(restored.timeline.entries()).toHaveLength(original.timeline.entries().length);
    expect(restored.version).toBe(original.version);
  });
});
