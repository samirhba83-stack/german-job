import { CampaignOutcomeGoal, CampaignStrategyType, CompanyIndustry, GermanLevel, Weekday } from '@german-job-engine/shared-types';
import { RecommendationEngineService } from './recommendation-engine.service';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { CampaignName } from '../../../campaigns/domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../campaigns/domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../campaigns/domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../campaigns/domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../campaigns/domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../campaigns/domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';
import { CampaignHealth } from '../../../campaigns/domain/value-objects/campaign-health.vo';
import { Probability } from '../../../campaigns/domain/value-objects/probability.vo';
import { ExecutionPlan } from '../../../dispatcher/domain/execution-plan';
import { CampaignDispatcherPort } from '../../../dispatcher/domain/ports/campaign-dispatcher.port';
import { CompanyRepository } from '../../../companies/domain/repositories/company.repository.interface';
import { UserProfileRepository } from '../../../profiles/domain/repositories/user-profile.repository.interface';
import { RiskMitigationRecommendationStrategy } from '../../domain/strategies/risk-mitigation.strategy';
import { CompanyHistoricalSuccessRecommendationStrategy } from '../../domain/strategies/company-historical-success.strategy';
import { CampaignHealthRecommendationStrategy } from '../../domain/strategies/campaign-health.strategy';
import { DEFAULT_RECOMMENDATION_CONFIG, RecommendationConfig } from '../../domain/recommendation-config';
import { ExecutionEventRecorder } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';

const OWNER_ID = 'candidate-1';

function correlationId(): CorrelationId {
  return CorrelationId.create('corr-1');
}

function alwaysOpenWindow(): ExecutionWindow {
  return ExecutionWindow.create({
    allowedWeekdays: [
      Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY,
      Weekday.FRIDAY, Weekday.SATURDAY, Weekday.SUNDAY,
    ],
    dailyStartHour: 0,
    dailyEndHour: 24,
    timezone: 'UTC',
    respectHolidays: false,
  });
}

function buildCampaign(options: {
  companyIds: string[];
  successfulCompanyIds?: string[];
  healthScore?: number | null;
}): Campaign {
  const campaign = Campaign.create(
    '123e4567-e89b-12d3-a456-426614174000',
    OWNER_ID,
    CampaignName.create('Recommendation fixture'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    alwaysOpenWindow(),
    RateLimitProfile.default(),
    Actor.candidate(OWNER_ID),
    correlationId(),
  );

  options.companyIds.forEach((companyId, index) => {
    campaign.addTarget(`job-${index}`, companyId, Actor.candidate(OWNER_ID), correlationId());
  });

  for (const companyId of options.successfulCompanyIds ?? []) {
    campaign.recordCompanyInteraction(
      companyId,
      { alreadyApplied: false, historicalSuccessScore: Probability.create(0.9), interviewCount: 2, offerCount: 1 },
      Actor.system('test'),
      correlationId(),
    );
  }

  if (options.healthScore !== undefined && options.healthScore !== null) {
    campaign.recordHealthAssessment(
      CampaignHealth.create({ healthScore: Probability.create(options.healthScore), computedBy: 'test-engine' }),
      Actor.system('test-engine'),
      correlationId(),
    );
  }

  return campaign;
}

function buildPlan(campaign: Campaign, riskScore: number): ExecutionPlan {
  const now = new Date('2026-01-05T10:00:00.000Z');
  return {
    campaignId: campaign.id,
    recommendedAction: 'DISPATCH_NOW',
    executionPriority: 3,
    recommendedBatchSize: 5,
    delayBetweenEmailsMs: 1000,
    cooldownAfterBatchMs: 1000,
    recommendedExecutionWindow: campaign.executionWindow,
    earliestExecutionAt: now,
    recommendedExecutionAt: now,
    riskScore,
    deliveryConfidenceScore: 1 - riskScore,
    decisionLog: [],
  };
}

function fakeDispatcher(pairs: Array<{ plan: ExecutionPlan; campaign: Campaign }>): CampaignDispatcherPort {
  return { buildExecutionPlansWithEntities: jest.fn().mockResolvedValue(pairs) };
}

function fakeCompanyRepository(companies: Record<string, unknown>): CompanyRepository {
  return { findById: jest.fn((id: string) => Promise.resolve(companies[id] ?? null)) } as unknown as CompanyRepository;
}

function fakeUserProfileRepository(profile: unknown | null): UserProfileRepository {
  return { findByUserId: jest.fn().mockResolvedValue(profile) } as unknown as UserProfileRepository;
}

function fakeCompany(id: string): { id: string; industry: CompanyIndustry; trustScore: { score: number } | null; hiringQuality: { score: number } | null } {
  return { id, industry: CompanyIndustry.IT_SOFTWARE, trustScore: { score: 0.8 }, hiringQuality: { score: 0.7 } };
}

function fakeProfile(): { germanLevel: GermanLevel; skills: { items: string[] }; cv: { fileName: string } | null; availability: { status: string } | null } {
  return { germanLevel: GermanLevel.B2, skills: { items: ['TypeScript', 'NestJS'] }, cv: { fileName: 'cv.pdf' }, availability: null };
}

function fakeEventRecorder(): ExecutionEventRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function buildStrategies(config: RecommendationConfig = DEFAULT_RECOMMENDATION_CONFIG) {
  return [
    new RiskMitigationRecommendationStrategy(config),
    new CompanyHistoricalSuccessRecommendationStrategy(config),
    new CampaignHealthRecommendationStrategy(config),
  ];
}

describe('RecommendationEngineService', () => {
  it('assembles context and aggregates recommendations from every strategy, sorted by impact', async () => {
    const campaign = buildCampaign({ companyIds: ['company-1', 'company-2'], successfulCompanyIds: ['company-1'], healthScore: 0.1 });
    const plan = buildPlan(campaign, 0.6); // elevated risk
    const dispatcher = fakeDispatcher([{ plan, campaign }]);
    const companyRepository = fakeCompanyRepository({ 'company-1': fakeCompany('company-1'), 'company-2': fakeCompany('company-2') });
    const userProfileRepository = fakeUserProfileRepository(fakeProfile());
    const service = new RecommendationEngineService(
      dispatcher,
      companyRepository,
      userProfileRepository,
      buildStrategies(),
      DEFAULT_RECOMMENDATION_CONFIG,
      fakeEventRecorder(),
    );

    const recommendations = await service.generateRecommendations();

    expect(recommendations).toHaveLength(3); // risk + historical-success + health
    expect(recommendations.map((r) => r.reasonCode)).toEqual(
      expect.arrayContaining(['ELEVATED_RISK_SCORE', 'HIGH_HISTORICAL_SUCCESS', 'LOW_CAMPAIGN_HEALTH']),
    );
    for (let i = 1; i < recommendations.length; i += 1) {
      expect(recommendations[i - 1].expectedImpactScore).toBeGreaterThanOrEqual(recommendations[i].expectedImpactScore);
    }
    expect(userProfileRepository.findByUserId).toHaveBeenCalledWith(OWNER_ID);
    expect(companyRepository.findById).toHaveBeenCalledWith('company-1');
    expect(companyRepository.findById).toHaveBeenCalledWith('company-2');
  });

  it('caps recommendations per campaign at maxRecommendationsPerCampaign', async () => {
    const campaign = buildCampaign({ companyIds: ['company-1', 'company-2', 'company-3'], successfulCompanyIds: ['company-1', 'company-2', 'company-3'] });
    const plan = buildPlan(campaign, 0); // no risk recommendation, isolates the historical-success strategy
    const dispatcher = fakeDispatcher([{ plan, campaign }]);
    const companyRepository = fakeCompanyRepository({});
    const userProfileRepository = fakeUserProfileRepository(null);
    const config: RecommendationConfig = { ...DEFAULT_RECOMMENDATION_CONFIG, maxRecommendationsPerCampaign: 1 };
    const service = new RecommendationEngineService(dispatcher, companyRepository, userProfileRepository, buildStrategies(config), config, fakeEventRecorder());

    const recommendations = await service.generateRecommendations();

    expect(recommendations).toHaveLength(1);
  });

  it('handles a missing candidate profile and missing company records without failing', async () => {
    const campaign = buildCampaign({ companyIds: ['company-1'] });
    const plan = buildPlan(campaign, 0);
    const dispatcher = fakeDispatcher([{ plan, campaign }]);
    const companyRepository = fakeCompanyRepository({}); // company-1 not found
    const userProfileRepository = fakeUserProfileRepository(null);
    const service = new RecommendationEngineService(
      dispatcher,
      companyRepository,
      userProfileRepository,
      buildStrategies(),
      DEFAULT_RECOMMENDATION_CONFIG,
      fakeEventRecorder(),
    );

    const recommendations = await service.generateRecommendations();

    expect(recommendations).toEqual([]);
  });

  it('generateRecommendationsByCampaign returns the full, uncapped set per campaign', async () => {
    const campaign = buildCampaign({
      companyIds: ['company-1', 'company-2', 'company-3'],
      successfulCompanyIds: ['company-1', 'company-2', 'company-3'],
    });
    const plan = buildPlan(campaign, 0);
    const dispatcher = fakeDispatcher([{ plan, campaign }]);
    const companyRepository = fakeCompanyRepository({});
    const userProfileRepository = fakeUserProfileRepository(null);
    const config: RecommendationConfig = { ...DEFAULT_RECOMMENDATION_CONFIG, maxRecommendationsPerCampaign: 1 };
    const service = new RecommendationEngineService(dispatcher, companyRepository, userProfileRepository, buildStrategies(config), config, fakeEventRecorder());

    const [entry] = await service.generateRecommendationsByCampaign();

    expect(entry.campaign).toBe(campaign);
    expect(entry.executionPlan).toBe(plan);
    // Uncapped: all 3 historical-success recommendations present, unlike generateRecommendations()'s cap of 1.
    expect(entry.recommendations).toHaveLength(3);
  });
});
