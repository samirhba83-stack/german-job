import { Module } from '@nestjs/common';
import { ExecutionOrchestratorModule } from '../execution-orchestrator/execution-orchestrator.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { ExecutionRuntimeService } from './application/services/execution-runtime.service';
import { TASK_SELECTION_CONFIG, DEFAULT_TASK_SELECTION_CONFIG } from './domain/task-selection-config';
import { TASK_SELECTION_STRATEGY } from './domain/ports/task-selection-strategy.port';
import { DeterministicTaskSelectionStrategy } from './domain/strategies/deterministic-task-selection.strategy';

/**
 * Execution Runtime scaffold (M9). Deliberately NOT imported into AppModule — same rule as every
 * Phase 4 module before it: it only decides which READY task should run next, it never sends
 * anything, and no Worker exists yet to act on that decision.
 *
 * TASK_SELECTION_STRATEGY is bound to DeterministicTaskSelectionStrategy by default; swap this
 * binding for a future AI model or a different business rule without touching
 * ExecutionRuntimeService.
 */
@Module({
  imports: [ExecutionOrchestratorModule, ExecutionTrackingModule],
  providers: [
    ExecutionRuntimeService,
    { provide: TASK_SELECTION_CONFIG, useValue: DEFAULT_TASK_SELECTION_CONFIG },
    { provide: TASK_SELECTION_STRATEGY, useClass: DeterministicTaskSelectionStrategy },
  ],
  exports: [ExecutionRuntimeService, TASK_SELECTION_STRATEGY],
})
export class ExecutionRuntimeModule {}
