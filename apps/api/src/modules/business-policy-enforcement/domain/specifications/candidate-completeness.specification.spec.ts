import { CandidateCompletenessSpecification } from './candidate-completeness.specification';
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

describe('CandidateCompletenessSpecification', () => {
  const spec = new CandidateCompletenessSpecification();

  it('is satisfied when the candidate has a CV and a recipient email', () => {
    const result = spec.isSatisfiedBy(buildContext());

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('CANDIDATE_PROFILE_COMPLETE');
  });

  it('is violated when the candidate has no CV', () => {
    const result = spec.isSatisfiedBy(buildContext({ candidate: { hasCv: false, hasRecipientEmail: true } }));

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('CANDIDATE_PROFILE_INCOMPLETE');
    expect(result.explanation).toContain('a CV');
  });

  it('is violated when there is no recipient email', () => {
    const result = spec.isSatisfiedBy(buildContext({ candidate: { hasCv: true, hasRecipientEmail: false } }));

    expect(result.satisfied).toBe(false);
    expect(result.explanation).toContain('a recipient email address');
  });

  it('lists both missing items when neither is available', () => {
    const result = spec.isSatisfiedBy(buildContext({ candidate: { hasCv: false, hasRecipientEmail: false } }));

    expect(result.explanation).toContain('a CV and a recipient email address');
  });
});
