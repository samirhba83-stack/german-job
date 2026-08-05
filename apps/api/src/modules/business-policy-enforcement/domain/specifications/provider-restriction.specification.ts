import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const PROVIDER_RESTRICTION_POLICY = Symbol('PROVIDER_RESTRICTION_POLICY');

export class ProviderRestrictionSpecification implements PolicySpecification {
  readonly policyId = 'PROVIDER_RESTRICTION';
  readonly policyName = 'Provider Restriction';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { provider } = context;
    if (provider.providerAvailable && provider.providerSupportsRequiredCapabilities) {
      return { satisfied: true, reasonCode: 'PROVIDER_ELIGIBLE', explanation: 'A provider is available and supports the required capabilities.' };
    }
    const reason = !provider.providerAvailable ? 'no eligible provider is available' : 'no available provider supports the required capabilities';
    return {
      satisfied: false,
      reasonCode: 'PROVIDER_RESTRICTED',
      explanation: `Provider restriction violated: ${reason}.`,
    };
  }
}
