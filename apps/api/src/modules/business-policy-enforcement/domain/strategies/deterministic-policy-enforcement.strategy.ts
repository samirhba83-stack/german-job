import { PolicyEnforcementStrategy } from '../ports/policy-enforcement-strategy.port';
import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { EvaluatedPolicy, FailedPolicy, PolicyDecision } from '../models/policy-decision';

/**
 * Default, deterministic Policy Enforcement Strategy (M15). Evaluates every
 * registered policy — never fail-fast — so a denied decision always carries
 * the full picture of every violation, not just the first one encountered.
 * Policies are sorted by policyId before evaluation so the decision is
 * identical regardless of DI registration order.
 */
export class DeterministicPolicyEnforcementStrategy implements PolicyEnforcementStrategy {
  evaluate(policies: ReadonlyArray<PolicySpecification>, context: PolicyEvaluationContext, now: Date): PolicyDecision {
    const sortedPolicies = [...policies].sort((a, b) => a.policyId.localeCompare(b.policyId));

    const evaluatedPolicies: EvaluatedPolicy[] = sortedPolicies.map((policy) => {
      const result = policy.isSatisfiedBy(context);
      return {
        policyId: policy.policyId,
        policyName: policy.policyName,
        satisfied: result.satisfied,
        reasonCode: result.reasonCode,
        explanation: result.explanation,
      };
    });

    const failedPolicies: FailedPolicy[] = evaluatedPolicies
      .filter((policy) => !policy.satisfied)
      .map(({ policyId, policyName, reasonCode, explanation }) => ({ policyId, policyName, reasonCode, explanation }));

    const allowed = failedPolicies.length === 0;
    const explanations = failedPolicies.map((policy) => policy.explanation);

    const decisionReasoning =
      evaluatedPolicies.length === 0
        ? 'No policies are registered; execution is allowed by default.'
        : allowed
          ? `All ${evaluatedPolicies.length} policies were satisfied; execution is allowed to proceed.`
          : `${failedPolicies.length} of ${evaluatedPolicies.length} policies were violated: ${failedPolicies.map((policy) => policy.policyName).join(', ')}.`;

    return {
      executionId: context.executionId,
      allowed,
      denied: !allowed,
      decisionTimestamp: now,
      evaluatedPolicies,
      failedPolicies,
      explanations,
      decisionReasoning,
    };
  }
}
