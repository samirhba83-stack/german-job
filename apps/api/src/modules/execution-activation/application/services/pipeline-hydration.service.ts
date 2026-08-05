import { Injectable } from '@nestjs/common';
import { ExecutionTaskPipeline } from '../../../execution-orchestrator/domain/entities/execution-task-pipeline.entity';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { ExecutionEvent } from '../../../execution-tracking/domain/entities/execution-event.entity';

/**
 * M26 Phase 4 — the persistence gap the architecture audit found: ExecutionOrchestratorService
 * regenerates a brand-new, all-PENDING ExecutionTaskPipeline object on every call (it has no
 * repository — see the audit). Without this, no pipeline could ever progress past its first
 * step across ticks: WorkerService's own idempotency guard would keep refusing to re-run a task
 * that history shows already succeeded, but the freshly-generated pipeline object would keep
 * re-selecting that same already-done task forever, since it has no memory of what happened.
 *
 * Rather than add new task/pipeline tables (a schema change this milestone's own "don't alter
 * the schema casually" principle weighs against when an existing durable source suffices), this
 * replays the campaign's own real, already-durable ExecutionEvent log — the project's established
 * append-only source of truth (see its own Prisma schema doc comment) — through the pipeline's
 * existing, guarded public mutators (startTask/completeTask/failTask). No new mutation path is
 * added to ExecutionTaskPipeline; hydration only calls what a real multi-tick execution would
 * have called anyway, just compressed into one synchronous replay.
 *
 * Relies on one real, current structural fact: DeterministicExecutionPlanningStrategy always
 * builds a single linear chain (preparation -> batch -> checkpoint -> [cooldown] -> ... ->
 * completion), so a task with no execution history implies nothing after it does either. If a
 * future milestone introduces branching blueprints, this assumption — documented here, not
 * hidden — would need revisiting alongside it.
 */
@Injectable()
export class PipelineHydrationService {
  constructor(private readonly eventQuery: ExecutionEventQueryService) {}

  async hydrate(pipeline: ExecutionTaskPipeline): Promise<void> {
    const events = await this.eventQuery.findByCampaignId(pipeline.campaignId);
    const latestByTraceId = this.indexLatestTaskExecutedByTraceId(events);

    for (const task of pipeline.tasks) {
      if (task.isTerminal()) {
        continue;
      }

      const event = latestByTraceId.get(task.id);
      if (!event) {
        break;
      }

      if (event.status === 'SUCCESS') {
        pipeline.startTask(task.id);
        pipeline.completeTask(task.id);
      } else {
        pipeline.startTask(task.id);
        pipeline.failTask(task.id, event.explanation);
      }
    }
  }

  private indexLatestTaskExecutedByTraceId(events: ExecutionEvent[]): Map<string, ExecutionEvent> {
    const latest = new Map<string, ExecutionEvent>();
    for (const event of events) {
      if (event.eventType !== 'TASK_EXECUTED') {
        continue;
      }
      const existing = latest.get(event.traceId);
      if (!existing || event.occurredAt.getTime() > existing.occurredAt.getTime()) {
        latest.set(event.traceId, event);
      }
    }
    return latest;
  }
}
