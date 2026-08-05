import { Module } from '@nestjs/common';
import { DecisionIntelligenceModule } from '../decision-intelligence/decision-intelligence.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { ExecutionPlanningService } from './application/services/execution-planning.service';
import { EXECUTION_PLANNING_CONFIG, DEFAULT_EXECUTION_PLANNING_CONFIG } from './domain/execution-planning-config';
import { EXECUTION_PLANNING_STRATEGY } from './domain/ports/execution-planning-strategy.port';
import { DeterministicExecutionPlanningStrategy } from './domain/strategies/deterministic-execution-planning.strategy';
import { EXECUTION_PLANNING_PORT } from './domain/ports/execution-planning.port';

/**
 * Execution Planning Engine scaffold (M7). Deliberately NOT imported into AppModule — same rule
 * as every Phase 4 module before it: it produces execution blueprints, it never sends anything,
 * creates any job, or touches any queue/worker/provider, and no Worker exists yet to act on its
 * output.
 *
 * EXECUTION_PLANNING_STRATEGY is bound to DeterministicExecutionPlanningStrategy by default;
 * swap this binding for a future AI model without touching ExecutionPlanningService.
 */
@Module({
  imports: [DecisionIntelligenceModule, ExecutionTrackingModule],
  providers: [
    ExecutionPlanningService,
    { provide: EXECUTION_PLANNING_CONFIG, useValue: DEFAULT_EXECUTION_PLANNING_CONFIG },
    { provide: EXECUTION_PLANNING_STRATEGY, useClass: DeterministicExecutionPlanningStrategy },
    { provide: EXECUTION_PLANNING_PORT, useExisting: ExecutionPlanningService },
  ],
  exports: [ExecutionPlanningService, EXECUTION_PLANNING_PORT],
})
export class ExecutionPlanningModule {}
