import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const SECURITY_RESTRICTION_POLICY = Symbol('SECURITY_RESTRICTION_POLICY');

export class SecurityRestrictionSpecification implements PolicySpecification {
  readonly policyId = 'SECURITY_RESTRICTION';
  readonly policyName = 'Security Restriction';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { security } = context;
    if (security.requestIsAuthenticated && security.originIsTrusted) {
      return { satisfied: true, reasonCode: 'SECURITY_CLEARED', explanation: 'Request is authenticated and originates from a trusted source.' };
    }
    const reason = !security.requestIsAuthenticated ? 'the request is not authenticated' : 'the request origin is not trusted';
    return {
      satisfied: false,
      reasonCode: 'SECURITY_RESTRICTION_VIOLATED',
      explanation: `Security restriction violated: ${reason}.`,
    };
  }
}
