import { AccountStatusSpecification } from './account-status.specification';
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

describe('AccountStatusSpecification', () => {
  const spec = new AccountStatusSpecification();

  it('is satisfied when the account is ACTIVE', () => {
    const result = spec.isSatisfiedBy(buildContext());

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('ACCOUNT_ACTIVE');
  });

  it.each(['SUSPENDED', 'LOCKED'] as const)('is violated when the account status is %s', (status) => {
    const result = spec.isSatisfiedBy(buildContext({ account: { status } }));

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('ACCOUNT_NOT_ACTIVE');
  });
});
