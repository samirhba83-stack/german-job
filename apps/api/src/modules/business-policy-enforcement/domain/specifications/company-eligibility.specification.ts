import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const COMPANY_ELIGIBILITY_POLICY = Symbol('COMPANY_ELIGIBILITY_POLICY');

export class CompanyEligibilitySpecification implements PolicySpecification {
  readonly policyId = 'COMPANY_ELIGIBILITY';
  readonly policyName = 'Company Eligibility';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { company } = context;
    if (company.isActive && !company.isBlocklisted) {
      return { satisfied: true, reasonCode: 'COMPANY_ELIGIBLE', explanation: 'Target company is active and not blocklisted.' };
    }
    const reason = company.isBlocklisted ? 'is blocklisted' : 'is not active';
    return {
      satisfied: false,
      reasonCode: 'COMPANY_NOT_ELIGIBLE',
      explanation: `Target company ${reason}.`,
    };
  }
}
