import { SubscriptionEligibilitySpecification } from './subscription-eligibility.specification';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';

function buildContext(overrides: Partial<PolicyEvaluationContext> = {}): PolicyEvaluationContext {
  return {
    executionId: 'execution-1',
    subscription: { status: 'ACTIVE', planAllowsAutomatedSending: true },
    quota: { used: 0, limit: 100 },
    campaign: { status: 'ACTIVE' },
    account: { status: 'ACTIVE' },
    candidate: { hasCv: true, hasRecipientEmail: true },
    company: { isActive: true, isBlocklisted: false },
    attachments: { totalSizeBytes: 1000, maxAllowedSizeBytes: 10000 },
    provider: { providerAvailable: true, providerSupportsRequiredCapabilities: true },
    compliance: { candidateHasOptedOut: false, recipientDomainIsAllowed: true },
    rateLimit: { sentInCurrentWindow: 0, windowLimit: 10 },
    security: { requestIsAuthenticated: true, originIsTrusted: true },
    ...overrides,
  };
}

describe('SubscriptionEligibilitySpecification', () => {
  const spec = new SubscriptionEligibilitySpecification();

  it('exposes a stable policyId and policyName', () => {
    expect(spec.policyId).toBe('SUBSCRIPTION_ELIGIBILITY');
    expect(spec.policyName).toBe('Subscription Eligibility');
  });

  it('is satisfied when the subscription is active and the plan allows automated sending', () => {
    const result = spec.isSatisfiedBy(buildContext());

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('SUBSCRIPTION_ELIGIBLE');
  });

  it('is violated when the subscription is not active', () => {
    const context = buildContext({ subscription: { status: 'CANCELLED', planAllowsAutomatedSending: true } });

    const result = spec.isSatisfiedBy(context);

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('SUBSCRIPTION_NOT_ELIGIBLE');
    expect(result.explanation).toContain('CANCELLED');
  });

  it('is violated when the plan does not allow automated sending', () => {
    const context = buildContext({ subscription: { status: 'ACTIVE', planAllowsAutomatedSending: false } });

    const result = spec.isSatisfiedBy(context);

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('SUBSCRIPTION_NOT_ELIGIBLE');
  });
});
