import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const CANDIDATE_COMPLETENESS_POLICY = Symbol('CANDIDATE_COMPLETENESS_POLICY');

export class CandidateCompletenessSpecification implements PolicySpecification {
  readonly policyId = 'CANDIDATE_COMPLETENESS';
  readonly policyName = 'Candidate Completeness';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { candidate } = context;
    if (candidate.hasCv && candidate.hasRecipientEmail) {
      return { satisfied: true, reasonCode: 'CANDIDATE_PROFILE_COMPLETE', explanation: 'Candidate has a CV and a resolvable recipient email address.' };
    }
    const missing = [!candidate.hasCv ? 'a CV' : null, !candidate.hasRecipientEmail ? 'a recipient email address' : null].filter(Boolean).join(' and ');
    return {
      satisfied: false,
      reasonCode: 'CANDIDATE_PROFILE_INCOMPLETE',
      explanation: `Candidate profile is missing ${missing}.`,
    };
  }
}
