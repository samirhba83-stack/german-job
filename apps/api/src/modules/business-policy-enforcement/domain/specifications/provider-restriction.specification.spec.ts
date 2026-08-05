import { ProviderRestrictionSpecification } from './provider-restriction.specification';
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

describe('ProviderRestrictionSpecification', () => {
  const spec = new ProviderRestrictionSpecification();

  it('is satisfied when a provider is available and supports the required capabilities', () => {
    const result = spec.isSatisfiedBy(buildContext());

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('PROVIDER_ELIGIBLE');
  });

  it('is violated when no provider is available', () => {
    const result = spec.isSatisfiedBy(buildContext({ provider: { providerAvailable: false, providerSupportsRequiredCapabilities: true } }));

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('PROVIDER_RESTRICTED');
    expect(result.explanation).toContain('no eligible provider is available');
  });

  it('is violated when no available provider supports the required capabilities', () => {
    const result = spec.isSatisfiedBy(buildContext({ provider: { providerAvailable: true, providerSupportsRequiredCapabilities: false } }));

    expect(result.satisfied).toBe(false);
    expect(result.explanation).toContain('required capabilities');
  });
});
