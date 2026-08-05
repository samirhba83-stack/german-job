import { CompanyEligibilitySpecification } from './company-eligibility.specification';
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

describe('CompanyEligibilitySpecification', () => {
  const spec = new CompanyEligibilitySpecification();

  it('is satisfied when the company is active and not blocklisted', () => {
    const result = spec.isSatisfiedBy(buildContext());

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('COMPANY_ELIGIBLE');
  });

  it('is violated when the company is blocklisted', () => {
    const result = spec.isSatisfiedBy(buildContext({ company: { isActive: true, isBlocklisted: true } }));

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('COMPANY_NOT_ELIGIBLE');
    expect(result.explanation).toContain('blocklisted');
  });

  it('is violated when the company is not active', () => {
    const result = spec.isSatisfiedBy(buildContext({ company: { isActive: false, isBlocklisted: false } }));

    expect(result.satisfied).toBe(false);
    expect(result.explanation).toContain('not active');
  });
});
