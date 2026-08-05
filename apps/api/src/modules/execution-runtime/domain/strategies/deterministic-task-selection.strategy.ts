import { Inject, Injectable } from '@nestjs/common';
import { ExecutionStepType } from '../../../execution-planning/domain/execution-blueprint';
import { ExecutionTask } from '../../../execution-orchestrator/domain/entities/execution-task.entity';
import { ExecutionTaskPipeline } from '../../../execution-orchestrator/domain/entities/execution-task-pipeline.entity';
import { TaskSelectionStrategy } from '../ports/task-selection-strategy.port';
import { TaskCandidate, TaskSelectionDecision } from '../task-selection-decision';
import { TaskSelectionConfig, TASK_SELECTION_CONFIG } from '../task-selection-config';

/**
 * Default TASK_SELECTION_STRATEGY binding. Only ever considers `pipeline.getReadyTasks()` — a
 * task whose dependencies are not yet satisfied can never be a candidate, by construction (M8's
 * ExecutionTaskPipeline never marks a task READY until every dependency is COMPLETED). Ranks
 * READY candidates by configured type weight, then by blueprint position (earlier step first),
 * then by task id — fully deterministic, no clock, no randomness. Respects the pipeline's own
 * status: nothing is selected while PAUSED, CANCELLED, or FINISHED, since nothing could actually
 * be started right now regardless of task-level readiness.
 */
@Injectable()
export class DeterministicTaskSelectionStrategy implements TaskSelectionStrategy {
  constructor(@Inject(TASK_SELECTION_CONFIG) private readonly config: TaskSelectionConfig) {}

  select(pipeline: ExecutionTaskPipeline): TaskSelectionDecision {
    if (pipeline.status !== 'ACTIVE') {
      return {
        campaignId: pipeline.campaignId,
        selectedTaskId: null,
        reasonCode: 'PIPELINE_NOT_ACTIVE',
        explanation: `Pipeline status is ${pipeline.status}, not ACTIVE; no task can be started right now.`,
        candidates: [],
        correlationId: pipeline.correlationId,
        userId: pipeline.userId,
      };
    }

    const ready = pipeline.getReadyTasks();
    if (ready.length === 0) {
      return {
        campaignId: pipeline.campaignId,
        selectedTaskId: null,
        reasonCode: 'NO_READY_TASKS',
        explanation: 'No task is currently READY; every task is either blocked on incomplete dependencies, already running, or terminal.',
        candidates: [],
        correlationId: pipeline.correlationId,
        userId: pipeline.userId,
      };
    }

    const ranked = this.rank(ready, pipeline);
    const candidates: TaskCandidate[] = ranked.map((task, index) => ({
      taskId: task.id,
      rank: index + 1,
      explanation: `Type ${task.type} carries a selection weight of ${this.weight(task.type)}.`,
    }));

    const winner = ranked[0];

    return {
      campaignId: pipeline.campaignId,
      selectedTaskId: winner.id,
      reasonCode: 'SELECTED_BY_PRIORITY',
      explanation:
        `Task "${winner.id}" (${winner.type}) selected from ${ready.length} READY candidate(s) — highest selection ` +
        `weight (${this.weight(winner.type)}) among tasks whose dependencies are satisfied.`,
      candidates,
      correlationId: pipeline.correlationId,
      userId: pipeline.userId,
    };
  }

  private rank(ready: ExecutionTask[], pipeline: ExecutionTaskPipeline): ExecutionTask[] {
    const positionById = new Map(pipeline.tasks.map((task, index) => [task.id, index]));

    return [...ready].sort((a, b) => {
      const weightDiff = this.weight(b.type) - this.weight(a.type);
      if (weightDiff !== 0) {
        return weightDiff;
      }
      const positionDiff = (positionById.get(a.id) ?? 0) - (positionById.get(b.id) ?? 0);
      if (positionDiff !== 0) {
        return positionDiff;
      }
      return a.id.localeCompare(b.id);
    });
  }

  private weight(type: ExecutionStepType): number {
    return this.config.typeWeights[type];
  }
}
