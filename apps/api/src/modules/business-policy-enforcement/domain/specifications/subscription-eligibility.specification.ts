import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const SUBSCRIPTION_ELIGIBILITY_POLICY = Symbol('SUBSCRIPTION_ELIGIBILITY_POLICY');

export class SubscriptionEligibilitySpecification implements PolicySpecification {
  readonly policyId = 'SUBSCRIPTION_ELIGIBILITY';
  readonly policyName = 'Subscription Eligibility';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { subscription } = context;
    if (subscription.status === 'ACTIVE' && subscription.planAllowsAutomatedSending) {
      return { satisfied: true, reasonCode: 'SUBSCRIPTION_ELIGIBLE', explanation: 'Subscription is active and the plan allows automated sending.' };
    }
    return {
      satisfied: false,
      reasonCode: 'SUBSCRIPTION_NOT_ELIGIBLE',
      explanation: `Subscription status "${subscription.status}" or the current plan does not permit automated sending.`,
    };
  }
}
