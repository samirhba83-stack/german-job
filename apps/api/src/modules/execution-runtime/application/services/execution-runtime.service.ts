import { Inject, Injectable } from '@nestjs/common';
import { ExecutionOrchestratorPort, EXECUTION_ORCHESTRATOR_PORT } from '../../../execution-orchestrator/domain/ports/execution-orchestrator.port';
import { TaskSelectionStrategy, TASK_SELECTION_STRATEGY } from '../../domain/ports/task-selection-strategy.port';
import { TaskSelectionDecision } from '../../domain/task-selection-decision';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';

/**
 * The Execution Runtime (Milestone 9): decides WHICH READY task should execute next within each
 * campaign's ExecutionTaskPipeline — the Orchestrator (M8) defines what tasks exist, this
 * decides what happens next. Consumes ExecutionTaskPipeline only; has no dependency on the
 * Dispatcher, Scheduler, or any Campaign/Company/Profile data, and no knowledge of SMTP, Gmail,
 * Microsoft Graph, queues, or infrastructure — it never sends anything and never starts a task
 * itself (it only decides; a future Worker would act on the decision). All selection logic lives
 * in the injected TaskSelectionStrategy, not here, so replacing it never requires a change here.
 */
@Injectable()
export class ExecutionRuntimeService {
  constructor(
    @Inject(EXECUTION_ORCHESTRATOR_PORT) private readonly orchestratorService: ExecutionOrchestratorPort,
    @Inject(TASK_SELECTION_STRATEGY) private readonly selectionStrategy: TaskSelectionStrategy,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
  ) {}

  /** One TaskSelectionDecision per campaign the Execution Orchestrator currently has a pipeline
   * for. */
  async selectNextTasks(): Promise<TaskSelectionDecision[]> {
    const pipelines = await this.orchestratorService.generatePipelines();

    return Promise.all(
      pipelines.map(async (pipeline) => {
        const decision = this.selectionStrategy.select(pipeline);

        await this.eventRecorder.record({
          eventType: 'TASK_SELECTED',
          campaignId: decision.campaignId,
          executionId: decision.selectedTaskId,
          correlationId: decision.correlationId,
          traceId: decision.selectedTaskId ?? decision.correlationId,
          summary: decision.selectedTaskId ? `Task "${decision.selectedTaskId}" selected` : 'No task selected',
          explanation: decision.explanation,
          status: decision.selectedTaskId ? 'SUCCESS' : 'FAILURE',
          metadata: { reasonCode: decision.reasonCode },
          businessContext: { ...EMPTY_BUSINESS_CONTEXT, userId: decision.userId },
        });

        return decision;
      }),
    );
  }
}
