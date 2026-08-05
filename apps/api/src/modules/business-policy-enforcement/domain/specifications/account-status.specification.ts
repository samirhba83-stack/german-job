import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const ACCOUNT_STATUS_POLICY = Symbol('ACCOUNT_STATUS_POLICY');

export class AccountStatusSpecification implements PolicySpecification {
  readonly policyId = 'ACCOUNT_STATUS';
  readonly policyName = 'Account Status';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { account } = context;
    if (account.status === 'ACTIVE') {
      return { satisfied: true, reasonCode: 'ACCOUNT_ACTIVE', explanation: 'Account is ACTIVE.' };
    }
    return {
      satisfied: false,
      reasonCode: 'ACCOUNT_NOT_ACTIVE',
      explanation: `Account status is "${account.status}"; execution requires an ACTIVE account.`,
    };
  }
}
