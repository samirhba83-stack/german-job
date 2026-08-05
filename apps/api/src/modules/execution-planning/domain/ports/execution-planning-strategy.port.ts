import { DecisionReport } from '../../../decision-intelligence/domain/decision-report';
import { ExecutionBlueprint } from '../execution-blueprint';

export const EXECUTION_PLANNING_STRATEGY = Symbol('EXECUTION_PLANNING_STRATEGY');

/**
 * The Execution Planning Engine's core extension point. Transforms one DecisionReport into one
 * ExecutionBlueprint — pure, synchronous, deterministic, side-effect-free (no clock, no
 * randomness, no I/O: identical input always produces an identical output). A future AI model
 * becomes a new ExecutionPlanningStrategy implementation bound to EXECUTION_PLANNING_STRATEGY
 * via DI; ExecutionPlanningService delegates to whatever is registered and never needs to change.
 */
export interface ExecutionPlanningStrategy {
  plan(decisionReport: DecisionReport): ExecutionBlueprint;
}
