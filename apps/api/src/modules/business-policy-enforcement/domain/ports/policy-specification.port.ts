import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

/** Aggregate DI token collecting every registered policy into a single injectable array. */
export const POLICY_SPECIFICATIONS = Symbol('POLICY_SPECIFICATIONS');

/**
 * Specification Pattern: one business rule, independently DI-replaceable.
 * Also the Strategy Pattern's strategy interface — each concrete policy is
 * a swappable strategy for its own concern.
 */
export interface PolicySpecification {
  readonly policyId: string;
  readonly policyName: string;
  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult;
}
