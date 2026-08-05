import { ExecutionTaskPipeline } from '../../../execution-orchestrator/domain/entities/execution-task-pipeline.entity';
import { TaskSelectionDecision } from '../task-selection-decision';

export const TASK_SELECTION_STRATEGY = Symbol('TASK_SELECTION_STRATEGY');

/**
 * The Execution Runtime's core extension point. Given one campaign's ExecutionTaskPipeline,
 * decides which READY task (if any) should execute next — pure, synchronous, deterministic,
 * side-effect-free (never calls pipeline.startTask() or mutates anything). A future AI model
 * becomes a new TaskSelectionStrategy implementation bound to TASK_SELECTION_STRATEGY via DI;
 * ExecutionRuntimeService delegates to whatever is registered and never needs to change.
 */
export interface TaskSelectionStrategy {
  select(pipeline: ExecutionTaskPipeline): TaskSelectionDecision;
}
