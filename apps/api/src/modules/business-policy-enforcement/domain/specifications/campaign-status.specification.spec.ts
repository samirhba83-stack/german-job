import { CampaignStatusSpecification } from './campaign-status.specification';
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

describe('CampaignStatusSpecification', () => {
  const spec = new CampaignStatusSpecification();

  it('is satisfied when the campaign is ACTIVE', () => {
    const result = spec.isSatisfiedBy(buildContext());

    expect(result.satisfied).toBe(true);
    expect(result.reasonCode).toBe('CAMPAIGN_ACTIVE');
  });

  it.each(['DRAFT', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const)('is violated when the campaign status is %s', (status) => {
    const result = spec.isSatisfiedBy(buildContext({ campaign: { status } }));

    expect(result.satisfied).toBe(false);
    expect(result.reasonCode).toBe('CAMPAIGN_NOT_ACTIVE');
    expect(result.explanation).toContain(status);
  });
});
