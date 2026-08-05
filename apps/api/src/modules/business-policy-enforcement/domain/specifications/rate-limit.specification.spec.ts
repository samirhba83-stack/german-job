import { RateLimitSpecification } from './rate-limit.specification';
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

describe('RateLimitSpecification', () => {
  const spec = new RateLimitSpecification();

  it('is satisfied when sends in the current window are below the limit', () => {
    const result = spec.isSatisfiedBy(buildContext());

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('RATE_LIMIT_AVAILABLE');
  });

  it('is violated when the window limit has been reached', () => {
    const result = spec.isSatisfiedBy(buildContext({ rateLimit: { sentInCurrentWindow: 10, windowLimit: 10 } }));

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('is violated when the window limit has been exceeded', () => {
    const result = spec.isSatisfiedBy(buildContext({ rateLimit: { sentInCurrentWindow: 15, windowLimit: 10 } }));

    expect(result.satisfied).toBe(false);
  });
});
