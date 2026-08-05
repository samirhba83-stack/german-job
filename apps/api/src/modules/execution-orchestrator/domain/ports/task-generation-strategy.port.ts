import { ExecutionBlueprint } from '../../../execution-planning/domain/execution-blueprint';
import { ExecutionTask } from '../entities/execution-task.entity';

export const TASK_GENERATION_STRATEGY = Symbol('TASK_GENERATION_STRATEGY');

/**
 * Converts an ExecutionBlueprint's steps into the initial set of executable tasks. A DI port so
 * a future strategy can generate tasks differently (e.g. splitting one blueprint step into
 * several finer-grained tasks, or adding company-specific tasks) without changing
 * ExecutionOrchestratorService.
 */
export interface TaskGenerationStrategy {
  generate(blueprint: ExecutionBlueprint, now: Date): ExecutionTask[];
}
