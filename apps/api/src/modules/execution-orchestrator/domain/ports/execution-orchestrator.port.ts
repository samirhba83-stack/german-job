import { ExecutionTaskPipeline } from '../entities/execution-task-pipeline.entity';

export const EXECUTION_ORCHESTRATOR_PORT = Symbol('EXECUTION_ORCHESTRATOR_PORT');

/** The stable port downstream Phase 4 modules (Execution Runtime) depend on, rather than the
 * concrete ExecutionOrchestratorService — mirrors ExecutionEventRecorder's port/token pattern. */
export interface ExecutionOrchestratorPort {
  generatePipelines(): Promise<ExecutionTaskPipeline[]>;
}
