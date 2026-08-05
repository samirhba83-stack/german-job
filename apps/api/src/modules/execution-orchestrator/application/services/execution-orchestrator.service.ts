import { Inject, Injectable } from '@nestjs/common';
import { ExecutionPlanningPort, EXECUTION_PLANNING_PORT } from '../../../execution-planning/domain/ports/execution-planning.port';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { TaskGenerationStrategy, TASK_GENERATION_STRATEGY } from '../../domain/ports/task-generation-strategy.port';
import { FailureCascadePolicy, FAILURE_CASCADE_POLICY } from '../../domain/ports/failure-cascade-policy.port';
import { ExecutionTaskPipeline } from '../../domain/entities/execution-task-pipeline.entity';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';
import { ExecutionOrchestratorPort } from '../../domain/ports/execution-orchestrator.port';

/**
 * The orchestration layer above the Execution Planning Engine (Milestone 8): transforms each
 * campaign's ExecutionBlueprint into an ExecutionTaskPipeline — a stateful, guarded aggregate
 * tracking task readiness, lifecycle, pause/resume, and cancellation. Consumes ExecutionBlueprints
 * only; has no dependency on the Dispatcher, Scheduler, or any Campaign/Company/Profile data, and
 * no knowledge of SMTP, queues, workers, providers, APIs, or infrastructure — it never sends
 * anything and never creates an SMTP connection. Task generation and failure-cascade behavior are
 * both DI-injected ports, so either can be replaced without changing this service.
 */
@Injectable()
export class ExecutionOrchestratorService implements ExecutionOrchestratorPort {
  constructor(
    @Inject(EXECUTION_PLANNING_PORT) private readonly executionPlanningService: ExecutionPlanningPort,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    @Inject(TASK_GENERATION_STRATEGY) private readonly taskGenerationStrategy: TaskGenerationStrategy,
    @Inject(FAILURE_CASCADE_POLICY) private readonly failureCascadePolicy: FailureCascadePolicy,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
  ) {}

  /** One ExecutionTaskPipeline per campaign the Execution Planning Engine currently has a
   * blueprint for. */
  async generatePipelines(): Promise<ExecutionTaskPipeline[]> {
    const blueprints = await this.executionPlanningService.generateExecutionBlueprints();
    const now = this.clock.now();

    return Promise.all(
      blueprints.map(async (blueprint) => {
        const tasks = this.taskGenerationStrategy.generate(blueprint, now);
        const pipeline = ExecutionTaskPipeline.create(blueprint.campaignId, tasks, blueprint, this.failureCascadePolicy, now);

        await this.eventRecorder.record({
          eventType: 'PIPELINE_ORCHESTRATED',
          campaignId: blueprint.campaignId,
          // pipeline.id IS blueprint.campaignId (the aggregate's id) — not a distinct execution,
          // so this stays null like every other campaign-level-only event (M18 cleanup).
          executionId: null,
          correlationId: pipeline.correlationId,
          traceId: pipeline.correlationId,
          summary: `Pipeline orchestrated with ${pipeline.tasks.length} task(s)`,
          explanation: `${pipeline.tasks.length} execution task(s) were generated from the execution blueprint.`,
          status: 'SUCCESS',
          metadata: { taskCount: String(pipeline.tasks.length) },
          businessContext: { ...EMPTY_BUSINESS_CONTEXT, userId: pipeline.userId },
        });

        return pipeline;
      }),
    );
  }
}
