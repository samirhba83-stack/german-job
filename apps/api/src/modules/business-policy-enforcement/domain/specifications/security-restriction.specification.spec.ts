import { SecurityRestrictionSpecification } from './security-restriction.specification';
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

describe('SecurityRestrictionSpecification', () => {
  const spec = new SecurityRestrictionSpecification();

  it('is satisfied when the request is authenticated and the origin is trusted', () => {
    const result = spec.isSatisfiedBy(buildContext());

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('SECURITY_CLEARED');
  });

  it('is violated when the request is not authenticated', () => {
    const result = spec.isSatisfiedBy(buildContext({ security: { requestIsAuthenticated: false, originIsTrusted: true } }));

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('SECURITY_RESTRICTION_VIOLATED');
    expect(result.explanation).toContain('not authenticated');
  });

  it('is violated when the origin is not trusted', () => {
    const result = spec.isSatisfiedBy(buildContext({ security: { requestIsAuthenticated: true, originIsTrusted: false } }));

    expect(result.satisfied).toBe(false);
    expect(result.explanation).toContain('not trusted');
  });
});
