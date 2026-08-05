import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const RATE_LIMIT_POLICY = Symbol('RATE_LIMIT_POLICY');

export class RateLimitSpecification implements PolicySpecification {
  readonly policyId = 'RATE_LIMIT';
  readonly policyName = 'Rate Limiting';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { rateLimit } = context;
    if (rateLimit.sentInCurrentWindow < rateLimit.windowLimit) {
      return { satisfied: true, reasonCode: 'RATE_LIMIT_AVAILABLE', explanation: `${rateLimit.windowLimit - rateLimit.sentInCurrentWindow} of ${rateLimit.windowLimit} sends remain in the current window.` };
    }
    return {
      satisfied: false,
      reasonCode: 'RATE_LIMIT_EXCEEDED',
      explanation: `Rate limit of ${rateLimit.windowLimit} sends per window has been reached (${rateLimit.sentInCurrentWindow} sent).`,
    };
  }
}
