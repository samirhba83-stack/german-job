import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const COMPLIANCE_POLICY = Symbol('COMPLIANCE_POLICY');

export class ComplianceSpecification implements PolicySpecification {
  readonly policyId = 'COMPLIANCE';
  readonly policyName = 'Compliance Requirements';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { compliance } = context;
    if (!compliance.candidateHasOptedOut && compliance.recipientDomainIsAllowed) {
      return { satisfied: true, reasonCode: 'COMPLIANT', explanation: 'Candidate has not opted out and the recipient domain is allowed.' };
    }
    const reason = compliance.candidateHasOptedOut ? 'the candidate has opted out of outbound communication' : 'the recipient domain is not allowed';
    return {
      satisfied: false,
      reasonCode: 'COMPLIANCE_VIOLATION',
      explanation: `Compliance requirement violated: ${reason}.`,
    };
  }
}
