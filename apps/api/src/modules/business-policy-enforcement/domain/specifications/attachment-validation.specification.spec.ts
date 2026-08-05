import { AttachmentValidationSpecification } from './attachment-validation.specification';
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

describe('AttachmentValidationSpecification', () => {
  const spec = new AttachmentValidationSpecification();

  it('is satisfied when total attachment size is within the limit', () => {
    const result = spec.isSatisfiedBy(buildContext());

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('ATTACHMENTS_VALID');
  });

  it('is satisfied at exactly the limit (inclusive boundary)', () => {
    const result = spec.isSatisfiedBy(buildContext({ attachments: { totalSizeBytes: 10000, maxAllowedSizeBytes: 10000 } }));

    expect(result.satisfied).toBe(true);
  });

  it('is violated when total attachment size exceeds the limit', () => {
    const result = spec.isSatisfiedBy(buildContext({ attachments: { totalSizeBytes: 10001, maxAllowedSizeBytes: 10000 } }));

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('ATTACHMENT_SIZE_EXCEEDED');
  });
});
