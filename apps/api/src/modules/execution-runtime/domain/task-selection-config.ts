import { ExecutionStepType } from '../../execution-planning/domain/execution-blueprint';

export const TASK_SELECTION_CONFIG = Symbol('TASK_SELECTION_CONFIG');

/** Business-tunable selection weight per task type, used to rank READY tasks when more than one
 * is a candidate. Provided via DI (TASK_SELECTION_CONFIG) so the priority order is configuration,
 * never a hardcoded comparison inside the selection algorithm. */
export interface TaskSelectionConfig {
  readonly typeWeights: Readonly<Record<ExecutionStepType, number>>;
}

export const DEFAULT_TASK_SELECTION_CONFIG: TaskSelectionConfig = {
  typeWeights: {
    PREPARATION: 5,
    HEALTH_CHECKPOINT: 4,
    BATCH_EXECUTION: 3,
    COOLDOWN: 2,
    COMPLETION: 1,
  },
};
