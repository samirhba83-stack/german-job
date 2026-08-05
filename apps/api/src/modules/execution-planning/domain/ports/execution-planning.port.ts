import { ExecutionBlueprint } from '../execution-blueprint';

export const EXECUTION_PLANNING_PORT = Symbol('EXECUTION_PLANNING_PORT');

/** The stable port downstream Phase 4 modules (Execution Orchestrator) depend on, rather than
 * the concrete ExecutionPlanningService — mirrors ExecutionEventRecorder's port/token pattern. */
export interface ExecutionPlanningPort {
  generateExecutionBlueprints(): Promise<ExecutionBlueprint[]>;
}
