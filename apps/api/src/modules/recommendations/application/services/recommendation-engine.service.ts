import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { ExecutionPlan } from '../../../dispatcher/domain/execution-plan';
import { CampaignDispatcherPort, CAMPAIGN_DISPATCHER_PORT } from '../../../dispatcher/domain/ports/campaign-dispatcher.port';
import { CompanyRepository, COMPANY_REPOSITORY } from '../../../companies/domain/repositories/company.repository.interface';
import {
  UserProfileRepository,
  USER_PROFILE_REPOSITORY,
} from '../../../profiles/domain/repositories/user-profile.repository.interface';
import { Recommendation } from '../../domain/recommendation';
import {
  CandidateProfileSnapshot,
  CompanyProfileSnapshot,
  HistoricalOutcomeSnapshot,
  RecommendationContext,
} from '../../domain/recommendation-context';
import { RecommendationStrategy, RECOMMENDATION_STRATEGIES } from '../../domain/ports/recommendation-strategy.port';
import { RecommendationConfig, RECOMMENDATION_CONFIG } from '../../domain/recommendation-config';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';
import { RecommendationEnginePort } from '../../domain/ports/recommendation-engine.port';

/**
 * First-class architectural component sitting downstream of the Dispatcher (Phase 4 M4) and
 * upstream of any future Worker: analyzes each campaign's ExecutionPlan together with campaign
 * state, candidate profile, company profile, and historical outcomes to produce ranked,
 * explainable Recommendations. It advises the user before execution begins — it never executes
 * anything itself, and has no knowledge of ExecutionQueue, DistributedLock, or any delivery
 * provider (SMTP/Gmail/Microsoft Graph). Every strategy it runs is DI-injected
 * (RECOMMENDATION_STRATEGIES); this service composes their output but implements no recommendation
 * logic itself, so adding, removing, or replacing a strategy (including with a future AI model)
 * never requires a change here.
 */
@Injectable()
export class RecommendationEngineService implements RecommendationEnginePort {
  constructor(
    @Inject(CAMPAIGN_DISPATCHER_PORT) private readonly dispatcherService: CampaignDispatcherPort,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    @Inject(USER_PROFILE_REPOSITORY) private readonly userProfileRepository: UserProfileRepository,
    @Inject(RECOMMENDATION_STRATEGIES) private readonly strategies: RecommendationStrategy[],
    @Inject(RECOMMENDATION_CONFIG) private readonly config: RecommendationConfig,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
  ) {}

  /** Ranked (highest expected impact first) recommendations across every campaign the Dispatcher
   * currently has a plan for. */
  async generateRecommendations(): Promise<Recommendation[]> {
    const perCampaign = await this.generateRecommendationsByCampaign();
    const capped = perCampaign.map((entry) => this.capToTopImpact(entry.recommendations));
    return this.sortByImpact(capped.flat());
  }

  /**
   * Same underlying evaluation as generateRecommendations(), but keeps every campaign's full,
   * uncapped recommendation set separate rather than flattening and capping them into one
   * cross-campaign list. The Decision Intelligence Engine (M6) needs every candidate — including
   * ones generateRecommendations() would cap away — to detect conflicts and resolve priority
   * correctly per campaign; added here rather than having that consumer re-run strategy
   * evaluation independently, which would duplicate this exact context-assembly logic.
   */
  async generateRecommendationsByCampaign(): Promise<
    Array<{ campaign: Campaign; executionPlan: ExecutionPlan; recommendations: Recommendation[]; correlationId: string }>
  > {
    const plans = await this.dispatcherService.buildExecutionPlansWithEntities();

    return Promise.all(
      plans.map(async ({ plan, campaign }) => {
        // Generated here, once per campaign per pipeline run — the parent id every downstream
        // event for this run (Decision, Planning, Orchestration, Runtime, Worker, Delivery,
        // Provider Selection) is threaded forward from (M18).
        const correlationId = randomUUID();
        const context = await this.buildContext(plan, campaign);
        const candidates = this.strategies.flatMap((strategy) => strategy.evaluate(context));
        const recommendations: Recommendation[] = candidates.map((candidate) => ({ ...candidate, id: randomUUID() }));

        await this.eventRecorder.record({
          eventType: 'RECOMMENDATION_GENERATED',
          campaignId: campaign.id,
          executionId: null,
          correlationId,
          traceId: correlationId,
          summary: `${recommendations.length} recommendation(s) generated`,
          explanation: `${this.strategies.length} strategy(ies) evaluated the campaign and produced ${recommendations.length} recommendation(s).`,
          status: 'SUCCESS',
          metadata: { recommendationCount: String(recommendations.length) },
          businessContext: { ...EMPTY_BUSINESS_CONTEXT, userId: campaign.ownerId },
        });

        return { campaign, executionPlan: plan, recommendations, correlationId };
      }),
    );
  }

  private async buildContext(plan: ExecutionPlan, campaign: Campaign): Promise<RecommendationContext> {
    const companyIds = [...new Set(campaign.targets.map((target) => target.companyId))];

    const [candidateProfile, companyProfiles] = await Promise.all([
      this.loadCandidateProfile(campaign.ownerId),
      this.loadCompanyProfiles(companyIds),
    ]);

    return {
      executionPlan: plan,
      campaign,
      candidateProfile,
      companyProfiles,
      historicalOutcomes: this.buildHistoricalOutcomes(campaign),
    };
  }

  private async loadCandidateProfile(userId: string): Promise<CandidateProfileSnapshot | null> {
    const profile = await this.userProfileRepository.findByUserId(userId);
    if (!profile) {
      return null;
    }
    return {
      userId,
      germanLevel: profile.germanLevel,
      skillsCount: profile.skills.items.length,
      hasCv: profile.cv !== null,
      availabilityStatus: profile.availability?.status ?? null,
    };
  }

  private async loadCompanyProfiles(companyIds: string[]): Promise<ReadonlyMap<string, CompanyProfileSnapshot>> {
    const companies = await Promise.all(companyIds.map((id) => this.companyRepository.findById(id)));
    const snapshots = new Map<string, CompanyProfileSnapshot>();

    for (const company of companies) {
      if (!company) {
        continue;
      }
      snapshots.set(company.id, {
        companyId: company.id,
        industry: company.industry,
        trustScoreValue: company.trustScore?.score ?? null,
        hiringQualityScoreValue: company.hiringQuality?.score ?? null,
      });
    }

    return snapshots;
  }

  private buildHistoricalOutcomes(campaign: Campaign): ReadonlyMap<string, HistoricalOutcomeSnapshot> {
    const snapshots = new Map<string, HistoricalOutcomeSnapshot>();

    for (const entry of campaign.companyMemory) {
      snapshots.set(entry.companyId, {
        companyId: entry.companyId,
        alreadyApplied: entry.alreadyApplied,
        historicalSuccessScoreValue: entry.historicalSuccessScore?.value ?? null,
        interviewCount: entry.interviewCount,
        offerCount: entry.offerCount,
      });
    }

    return snapshots;
  }

  private capToTopImpact(recommendations: Recommendation[]): Recommendation[] {
    return this.sortByImpact(recommendations).slice(0, this.config.maxRecommendationsPerCampaign);
  }

  private sortByImpact(recommendations: Recommendation[]): Recommendation[] {
    return [...recommendations].sort((a, b) => {
      if (a.expectedImpactScore !== b.expectedImpactScore) {
        return b.expectedImpactScore - a.expectedImpactScore;
      }
      return a.campaignId.localeCompare(b.campaignId) || a.reasonCode.localeCompare(b.reasonCode);
    });
  }
}
