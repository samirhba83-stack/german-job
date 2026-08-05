import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const EXECUTION_QUOTA_POLICY = Symbol('EXECUTION_QUOTA_POLICY');

export class ExecutionQuotaSpecification implements PolicySpecification {
  readonly policyId = 'EXECUTION_QUOTA';
  readonly policyName = 'Execution Quota';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { quota } = context;
    if (quota.used < quota.limit) {
      return { satisfied: true, reasonCode: 'QUOTA_AVAILABLE', explanation: `Execution quota has ${quota.limit - quota.used} of ${quota.limit} remaining.` };
    }
    return {
      satisfied: false,
      reasonCode: 'EXECUTION_QUOTA_EXCEEDED',
      explanation: `Execution quota of ${quota.limit} has been reached (${quota.used} used).`,
    };
  }
}
