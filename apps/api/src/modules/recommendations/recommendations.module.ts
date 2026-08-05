import { Module } from '@nestjs/common';
import { DispatcherModule } from '../dispatcher/dispatcher.module';
import { CompaniesModule } from '../companies/companies.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { RecommendationEngineService } from './application/services/recommendation-engine.service';
import { RECOMMENDATION_CONFIG, DEFAULT_RECOMMENDATION_CONFIG } from './domain/recommendation-config';
import { RECOMMENDATION_STRATEGIES, RecommendationStrategy } from './domain/ports/recommendation-strategy.port';
import { RiskMitigationRecommendationStrategy } from './domain/strategies/risk-mitigation.strategy';
import { CompanyHistoricalSuccessRecommendationStrategy } from './domain/strategies/company-historical-success.strategy';
import { CampaignHealthRecommendationStrategy } from './domain/strategies/campaign-health.strategy';
import { BaselineDispatchRecommendationStrategy } from './domain/strategies/baseline-dispatch.strategy';
import { RECOMMENDATION_ENGINE_PORT } from './domain/ports/recommendation-engine.port';

/**
 * Recommendation Engine scaffold. Deliberately NOT imported into AppModule — same rule as
 * Execution (M2), Scheduler (M3), and Dispatcher (M4): it advises, it never executes, and no
 * consumer of its output exists yet.
 *
 * RECOMMENDATION_STRATEGIES is a multi-provider (NestJS has no native `multi: true`, so
 * aggregation happens via `useFactory`): every registered strategy is discovered here and
 * nowhere else. Adding a fourth default strategy, or replacing one with a future AI model, means
 * changing this list — RecommendationEngineService itself never changes.
 */
@Module({
  imports: [DispatcherModule, CompaniesModule, ProfilesModule, ExecutionTrackingModule],
  providers: [
    RecommendationEngineService,
    { provide: RECOMMENDATION_CONFIG, useValue: DEFAULT_RECOMMENDATION_CONFIG },
    RiskMitigationRecommendationStrategy,
    CompanyHistoricalSuccessRecommendationStrategy,
    CampaignHealthRecommendationStrategy,
    BaselineDispatchRecommendationStrategy,
    {
      provide: RECOMMENDATION_STRATEGIES,
      useFactory: (
        riskMitigation: RiskMitigationRecommendationStrategy,
        companyHistoricalSuccess: CompanyHistoricalSuccessRecommendationStrategy,
        campaignHealth: CampaignHealthRecommendationStrategy,
        baselineDispatch: BaselineDispatchRecommendationStrategy,
      ): RecommendationStrategy[] => [riskMitigation, companyHistoricalSuccess, campaignHealth, baselineDispatch],
      inject: [
        RiskMitigationRecommendationStrategy,
        CompanyHistoricalSuccessRecommendationStrategy,
        CampaignHealthRecommendationStrategy,
        BaselineDispatchRecommendationStrategy,
      ],
    },
    { provide: RECOMMENDATION_ENGINE_PORT, useExisting: RecommendationEngineService },
  ],
  exports: [RecommendationEngineService, RECOMMENDATION_ENGINE_PORT],
})
export class RecommendationsModule {}
