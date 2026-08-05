import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyDecision } from '../models/policy-decision';
import { PolicySpecification } from './policy-specification.port';

export const POLICY_ENFORCEMENT_STRATEGY = Symbol('POLICY_ENFORCEMENT_STRATEGY');

/** DI-replaceable business judgment: how N policy verdicts combine into one PolicyDecision. */
export interface PolicyEnforcementStrategy {
  evaluate(policies: ReadonlyArray<PolicySpecification>, context: PolicyEvaluationContext, now: Date): PolicyDecision;
}
