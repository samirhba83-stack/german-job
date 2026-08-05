import { Inject, Injectable } from '@nestjs/common';
import { ExecutionTask } from '../../../execution-orchestrator/domain/entities/execution-task.entity';
import { ExecutionTaskPipeline } from '../../../execution-orchestrator/domain/entities/execution-task-pipeline.entity';
import { TaskNotFoundException } from '../../../execution-orchestrator/domain/exceptions/task-not-found.exception';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { TaskSelectionDecision } from '../../../execution-runtime/domain/task-selection-decision';
import { TaskExecutionPort, TaskExecutionOutcome, TASK_EXECUTION_PORT } from '../../domain/ports/task-execution.port';
import { ExecutionResult } from '../../domain/execution-result';
import { NoTaskSelectedException } from '../../domain/exceptions/no-task-selected.exception';
import { PipelineDecisionMismatchException } from '../../domain/exceptions/pipeline-decision-mismatch.exception';
import { TaskNotExecutableException } from '../../domain/exceptions/task-not-executable.exception';
import { TaskAlreadyExecutedException } from '../../domain/exceptions/task-already-executed.exception';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';
import { DEFAULT_WORKER_ID } from '../../domain/worker-identity';

/**
 * The Worker (Milestone 10) — the first component in this pipeline that performs an action.
 * Executes exactly the one task named by a TaskSelectionDecision: retrieves it from the given
 * pipeline, validates it is still READY, transitions it RUNNING, delegates the actual work to
 * the injected TaskExecutionPort, then transitions it COMPLETED or FAILED based on the outcome.
 *
 * The Worker makes no scheduling, prioritization, or planning decision of its own — it consumes
 * a TaskSelectionDecision (Milestone 9) exactly as given and never iterates the pipeline or picks
 * a different task. After one execute() call, responsibility returns to the caller (a future
 * loop/controller) to ask the Runtime for the next decision. The pipeline itself is passed in
 * rather than fetched, matching "consume the decision, not the upstream services that produced
 * it" — WorkerModule has no dependency on ExecutionOrchestratorModule or ExecutionRuntimeModule.
 *
 * M19 additions (hardening findings from the resilience validation suite, not new features):
 * an exception thrown by the TaskExecutionPort — as opposed to a normal { success: false }
 * outcome — is now caught and translated into the same FAILED-with-recorded-event path as any
 * other execution failure, rather than propagating out and leaving the task stuck RUNNING with
 * no audit trail. And before starting a task, an idempotency guard checks whether it has already
 * completed successfully (by campaignId + traceId, via ExecutionEventQueryService) and refuses
 * to run it again if so — closing the gap where an independently regenerated pipeline (see
 * ExecutionOrchestratorService's own doc comment) could otherwise re-send a real business action
 * that already succeeded. A retry of a previously FAILED task is still allowed; only repeating an
 * already-successful one is blocked.
 */
@Injectable()
export class WorkerService {
  constructor(
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    @Inject(TASK_EXECUTION_PORT) private readonly taskExecutionPort: TaskExecutionPort,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
    private readonly eventQuery: ExecutionEventQueryService,
  ) {}

  async execute(pipeline: ExecutionTaskPipeline, decision: TaskSelectionDecision): Promise<ExecutionResult> {
    const task = this.resolveExecutableTask(pipeline, decision);
    await this.guardAgainstDuplicateExecution(pipeline.campaignId, task.id);

    const startedAt = this.clock.now();
    pipeline.startTask(task.id, startedAt);

    let outcome: TaskExecutionOutcome;
    try {
      outcome = await this.taskExecutionPort.execute(task);
    } catch (error) {
      return this.recordInfrastructureFailure(pipeline, task, startedAt, error);
    }

    const executedAt = this.clock.now();
    const durationMs = executedAt.getTime() - startedAt.getTime();

    if (outcome.success) {
      pipeline.completeTask(task.id, executedAt);
      const result: ExecutionResult = { campaignId: pipeline.campaignId, taskId: task.id, status: 'COMPLETED', durationMs, executedAt, reason: outcome.reason, failureReason: null, correlationId: task.correlationId };
      await this.recordExecution(result);
      return result;
    }

    const failureReason = outcome.failureReason ?? 'Task execution reported failure with no specific reason.';
    pipeline.failTask(task.id, failureReason, executedAt);
    const result: ExecutionResult = { campaignId: pipeline.campaignId, taskId: task.id, status: 'FAILED', durationMs, executedAt, reason: outcome.reason, failureReason, correlationId: task.correlationId };
    await this.recordExecution(result);
    return result;
  }

  private async recordInfrastructureFailure(
    pipeline: ExecutionTaskPipeline,
    task: ExecutionTask,
    startedAt: Date,
    error: unknown,
  ): Promise<ExecutionResult> {
    const executedAt = this.clock.now();
    const durationMs = executedAt.getTime() - startedAt.getTime();
    const failureReason = `Infrastructure exception during task execution: ${error instanceof Error ? error.message : String(error)}`;
    pipeline.failTask(task.id, failureReason, executedAt);
    const result: ExecutionResult = {
      campaignId: pipeline.campaignId,
      taskId: task.id,
      status: 'FAILED',
      durationMs,
      executedAt,
      reason: 'Task execution threw an unhandled exception rather than reporting a normal outcome.',
      failureReason,
      correlationId: task.correlationId,
    };
    await this.recordExecution(result);
    return result;
  }

  /** Refuses to re-execute a task that has already completed successfully, scoped by
   * (campaignId, traceId) together — not traceId alone, which can recur across unrelated
   * campaigns sharing a blueprint shape (see the M19 report). Does not block retrying a
   * previously FAILED task; only repeating an already-successful one is the actual risk. */
  private async guardAgainstDuplicateExecution(campaignId: string, taskId: string): Promise<void> {
    const priorEvents = await this.eventQuery.findByCampaignIdAndTraceId(campaignId, taskId);
    const alreadySucceeded = priorEvents.some((event) => event.eventType === 'TASK_EXECUTED' && event.status === 'SUCCESS');
    if (alreadySucceeded) {
      throw new TaskAlreadyExecutedException(taskId);
    }
  }

  private async recordExecution(result: ExecutionResult): Promise<void> {
    await this.eventRecorder.record({
      eventType: 'TASK_EXECUTED',
      campaignId: result.campaignId,
      executionId: result.taskId,
      correlationId: result.correlationId,
      traceId: result.taskId,
      summary: `Task "${result.taskId}" ${result.status.toLowerCase()}`,
      explanation: result.status === 'COMPLETED' ? result.reason : (result.failureReason ?? result.reason),
      status: result.status === 'COMPLETED' ? 'SUCCESS' : 'FAILURE',
      metadata: { durationMs: String(result.durationMs) },
      businessContext: { ...EMPTY_BUSINESS_CONTEXT, workerId: DEFAULT_WORKER_ID },
    });
  }

  private resolveExecutableTask(pipeline: ExecutionTaskPipeline, decision: TaskSelectionDecision): ExecutionTask {
    if (pipeline.campaignId !== decision.campaignId) {
      throw new PipelineDecisionMismatchException(pipeline.campaignId, decision.campaignId);
    }
    if (!decision.selectedTaskId) {
      throw new NoTaskSelectedException(decision.campaignId, decision.reasonCode);
    }

    const task = pipeline.findTask(decision.selectedTaskId);
    if (!task) {
      throw new TaskNotFoundException(decision.selectedTaskId);
    }
    if (task.status !== 'READY') {
      throw new TaskNotExecutableException(task.id, task.status);
    }

    return task;
  }
}
