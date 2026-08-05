import { Module } from '@nestjs/common';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { DecisionIntelligenceService } from './application/services/decision-intelligence.service';
import { DECISION_CONFIG, DEFAULT_DECISION_CONFIG } from './domain/decision-config';
import { DECISION_AGGREGATION_STRATEGY } from './domain/ports/decision-aggregation-strategy.port';
import { WeightedPriorityDecisionStrategy } from './domain/strategies/weighted-priority-decision.strategy';
import { DECISION_INTELLIGENCE_PORT } from './domain/ports/decision-intelligence.port';

/**
 * Decision Intelligence Engine scaffold (M6). Deliberately NOT imported into AppModule — same
 * rule as every Phase 4 module before it: it produces decision reports, it never executes
 * anything, and no Worker exists yet to act on its output.
 *
 * DECISION_AGGREGATION_STRATEGY is bound to WeightedPriorityDecisionStrategy by default; swap
 * this binding for a future AI model without touching DecisionIntelligenceService.
 */
@Module({
  imports: [RecommendationsModule, ExecutionTrackingModule],
  providers: [
    DecisionIntelligenceService,
    { provide: DECISION_CONFIG, useValue: DEFAULT_DECISION_CONFIG },
    { provide: DECISION_AGGREGATION_STRATEGY, useClass: WeightedPriorityDecisionStrategy },
    { provide: DECISION_INTELLIGENCE_PORT, useExisting: DecisionIntelligenceService },
  ],
  exports: [DecisionIntelligenceService, DECISION_INTELLIGENCE_PORT],
})
export class DecisionIntelligenceModule {}
