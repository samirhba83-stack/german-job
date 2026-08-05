import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const CAMPAIGN_STATUS_POLICY = Symbol('CAMPAIGN_STATUS_POLICY');

export class CampaignStatusSpecification implements PolicySpecification {
  readonly policyId = 'CAMPAIGN_STATUS';
  readonly policyName = 'Campaign Status';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { campaign } = context;
    if (campaign.status === 'ACTIVE') {
      return { satisfied: true, reasonCode: 'CAMPAIGN_ACTIVE', explanation: 'Campaign is ACTIVE.' };
    }
    return {
      satisfied: false,
      reasonCode: 'CAMPAIGN_NOT_ACTIVE',
      explanation: `Campaign status is "${campaign.status}"; execution requires an ACTIVE campaign.`,
    };
  }
}
