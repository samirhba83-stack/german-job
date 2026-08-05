import { ComplianceSpecification } from './compliance.specification';
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

describe('ComplianceSpecification', () => {
  const spec = new ComplianceSpecification();

  it('is satisfied when the candidate has not opted out and the recipient domain is allowed', () => {
    const result = spec.isSatisfiedBy(buildContext());

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('COMPLIANT');
  });

  it('is violated when the candidate has opted out', () => {
    const result = spec.isSatisfiedBy(buildContext({ compliance: { candidateHasOptedOut: true, recipientDomainIsAllowed: true } }));

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('COMPLIANCE_VIOLATION');
    expect(result.explanation).toContain('opted out');
  });

  it('is violated when the recipient domain is not allowed', () => {
    const result = spec.isSatisfiedBy(buildContext({ compliance: { candidateHasOptedOut: false, recipientDomainIsAllowed: false } }));

    expect(result.satisfied).toBe(false);
    expect(result.explanation).toContain('domain is not allowed');
  });
});
