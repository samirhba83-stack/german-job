import { Module } from '@nestjs/common';
import { ExecutionPlanningModule } from '../execution-planning/execution-planning.module';
import { ExecutionModule } from '../execution/execution.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { ExecutionOrchestratorService } from './application/services/execution-orchestrator.service';
import { TASK_GENERATION_STRATEGY } from './domain/ports/task-generation-strategy.port';
import { FAILURE_CASCADE_POLICY } from './domain/ports/failure-cascade-policy.port';
import { BlueprintStepTaskGenerationStrategy } from './domain/strategies/blueprint-step-task-generation.strategy';
import { TransitiveDependentSkipPolicy } from './domain/strategies/transitive-dependent-skip.policy';
import { EXECUTION_ORCHESTRATOR_PORT } from './domain/ports/execution-orchestrator.port';

/**
 * Execution Orchestrator scaffold (M8). Deliberately NOT imported into AppModule — same rule as
 * every Phase 4 module before it: it tracks task lifecycle state, it never sends anything,
 * creates any SMTP connection, or calls Microsoft Graph/Gmail/any queue, and no Worker exists
 * yet to actually execute a ready task.
 *
 * TASK_GENERATION_STRATEGY and FAILURE_CASCADE_POLICY are bound to their defaults here; swap
 * either for a future AI model or a different business rule without touching
 * ExecutionOrchestratorService or ExecutionTaskPipeline.
 */
@Module({
  imports: [ExecutionPlanningModule, ExecutionModule, ExecutionTrackingModule],
  providers: [
    ExecutionOrchestratorService,
    { provide: TASK_GENERATION_STRATEGY, useClass: BlueprintStepTaskGenerationStrategy },
    { provide: FAILURE_CASCADE_POLICY, useClass: TransitiveDependentSkipPolicy },
    { provide: EXECUTION_ORCHESTRATOR_PORT, useExisting: ExecutionOrchestratorService },
  ],
  exports: [ExecutionOrchestratorService, EXECUTION_ORCHESTRATOR_PORT],
})
export class ExecutionOrchestratorModule {}
