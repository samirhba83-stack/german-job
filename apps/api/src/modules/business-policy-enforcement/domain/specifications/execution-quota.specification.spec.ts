import { ExecutionQuotaSpecification } from './execution-quota.specification';
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

describe('ExecutionQuotaSpecification', () => {
  const spec = new ExecutionQuotaSpecification();

  it('is satisfied when usage is below the limit', () => {
    const result = spec.isSatisfiedBy(buildContext({ quota: { used: 5, limit: 100 } }));

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('QUOTA_AVAILABLE');
  });

  it('is violated when usage has reached the limit', () => {
    const result = spec.isSatisfiedBy(buildContext({ quota: { used: 100, limit: 100 } }));

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('EXECUTION_QUOTA_EXCEEDED');
    expect(result.explanation).toContain('100');
  });

  it('is violated when usage has exceeded the limit', () => {
    const result = spec.isSatisfiedBy(buildContext({ quota: { used: 150, limit: 100 } }));

    expect(result.satisfied).toBe(false);
  });
});
