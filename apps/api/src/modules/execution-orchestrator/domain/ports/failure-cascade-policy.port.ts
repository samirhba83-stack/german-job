import { ExecutionTask } from '../entities/execution-task.entity';

export const FAILURE_CASCADE_POLICY = Symbol('FAILURE_CASCADE_POLICY');

/**
 * Decides which non-terminal tasks should be skipped as a consequence of another task failing.
 * A DI port (application-layer swappable) rather than a fixed aggregate rule, because this is a
 * genuine business-policy choice — a future strategy might cascade differently (e.g. only skip
 * direct dependents, or not cascade at all and instead retry the failed step) — unlike readiness
 * resolution (dependency-graph reachability), which has exactly one correct answer and stays a
 * plain method on ExecutionTaskPipeline.
 */
export interface FailureCascadePolicy {
  cascade(failedTask: ExecutionTask, allTasks: ReadonlyArray<ExecutionTask>): ExecutionTask[];
}
