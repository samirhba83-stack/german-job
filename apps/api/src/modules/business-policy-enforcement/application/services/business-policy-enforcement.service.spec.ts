import { BusinessPolicyEnforcementService } from './business-policy-enforcement.service';
import { PolicySpecification } from '../../domain/ports/policy-specification.port';
import { PolicyEnforcementStrategy } from '../../domain/ports/policy-enforcement-strategy.port';
import { PolicyEvaluationContext } from '../../domain/models/policy-evaluation-context';
import { PolicyDecision } from '../../domain/models/policy-decision';
import { FixedClock } from '../../../execution/infrastructure/clock/fixed-clock';
import { ExecutionEventRecorder } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';

const NOW = new Date('2026-01-05T10:00:00.000Z');

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

function buildDecision(overrides: Partial<PolicyDecision> = {}): PolicyDecision {
  return {
    executionId: 'execution-1',
    allowed: true,
    denied: false,
    decisionTimestamp: NOW,
    evaluatedPolicies: [],
    failedPolicies: [],
    explanations: [],
    decisionReasoning: 'stub',
    ...overrides,
  };
}

function fakeStrategy(decision: PolicyDecision): { strategy: PolicyEnforcementStrategy; capture: { policies?: PolicySpecification[]; context?: PolicyEvaluationContext; now?: Date } } {
  const capture: { policies?: PolicySpecification[]; context?: PolicyEvaluationContext; now?: Date } = {};
  const strategy: PolicyEnforcementStrategy = {
    evaluate: jest.fn((policies, context, now) => {
      capture.policies = policies as PolicySpecification[];
      capture.context = context;
      capture.now = now;
      return decision;
    }),
  };
  return { strategy, capture };
}

function fakeEventRecorder(): ExecutionEventRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

describe('BusinessPolicyEnforcementService', () => {
  it('delegates to the injected strategy with the registered policies, the context, and the current time', async () => {
    const policyA: PolicySpecification = { policyId: 'A', policyName: 'A', isSatisfiedBy: jest.fn() };
    const { strategy, capture } = fakeStrategy(buildDecision());
    const service = new BusinessPolicyEnforcementService([policyA], new FixedClock(NOW), strategy, fakeEventRecorder());
    const context = buildContext();

    await service.evaluate(context);

    expect(capture.policies).toEqual([policyA]);
    expect(capture.context).toBe(context);
    expect(capture.now).toEqual(NOW);
  });

  it('returns whatever the injected strategy produces, unmodified', async () => {
    const decision = buildDecision({ allowed: false, decisionReasoning: 'custom reasoning' });
    const { strategy } = fakeStrategy(decision);
    const service = new BusinessPolicyEnforcementService([], new FixedClock(NOW), strategy, fakeEventRecorder());

    const result = await service.evaluate(buildContext());

    expect(result).toBe(decision);
  });

  it('records a POLICY_EVALUATED event reflecting the decision', async () => {
    const decision = buildDecision({ allowed: false, decisionReasoning: 'two policies failed' });
    const { strategy } = fakeStrategy(decision);
    const eventRecorder = fakeEventRecorder();
    const service = new BusinessPolicyEnforcementService([], new FixedClock(NOW), strategy, eventRecorder);

    await service.evaluate(buildContext());

    expect(eventRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'POLICY_EVALUATED', status: 'FAILURE', explanation: 'two policies failed' }),
    );
  });

  describe('event recording (M18)', () => {
    it('records a fresh, unique policyEvaluationId in businessContext', async () => {
      const { strategy } = fakeStrategy(buildDecision());
      const eventRecorder = fakeEventRecorder();
      const service = new BusinessPolicyEnforcementService([], new FixedClock(NOW), strategy, eventRecorder);

      await service.evaluate(buildContext());

      const call = (eventRecorder.record as jest.Mock).mock.calls[0][0];
      expect(call.businessContext.policyEvaluationId).toEqual(expect.any(String));
      expect(call.businessContext.policyEvaluationId.length).toBeGreaterThan(0);
    });

    it('generates a fresh correlationId when the context supplies none', async () => {
      const { strategy } = fakeStrategy(buildDecision());
      const eventRecorder = fakeEventRecorder();
      const service = new BusinessPolicyEnforcementService([], new FixedClock(NOW), strategy, eventRecorder);

      await service.evaluate(buildContext());

      const call = (eventRecorder.record as jest.Mock).mock.calls[0][0];
      expect(call.correlationId).toEqual(expect.any(String));
      expect(call.correlationId.length).toBeGreaterThan(0);
    });

    it('uses the context-supplied correlationId when present', async () => {
      const { strategy } = fakeStrategy(buildDecision());
      const eventRecorder = fakeEventRecorder();
      const service = new BusinessPolicyEnforcementService([], new FixedClock(NOW), strategy, eventRecorder);

      await service.evaluate(buildContext({ correlationId: 'correlation-from-caller' }));

      expect(eventRecorder.record).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'correlation-from-caller' }));
    });
  });

  describe('dependency injection', () => {
    it('honors a differently-behaving injected strategy without any service change', async () => {
      const alwaysAllow = fakeStrategy(buildDecision({ allowed: true }));
      const alwaysDeny = fakeStrategy(buildDecision({ allowed: false }));

      const serviceA = new BusinessPolicyEnforcementService([], new FixedClock(NOW), alwaysAllow.strategy, fakeEventRecorder());
      const serviceB = new BusinessPolicyEnforcementService([], new FixedClock(NOW), alwaysDeny.strategy, fakeEventRecorder());

      expect((await serviceA.evaluate(buildContext())).allowed).toBe(true);
      expect((await serviceB.evaluate(buildContext())).allowed).toBe(false);
    });

    it('honors a differently-configured clock without any service change', async () => {
      const later = new Date('2026-06-01T00:00:00.000Z');
      const { strategy, capture } = fakeStrategy(buildDecision());
      const service = new BusinessPolicyEnforcementService([], new FixedClock(later), strategy, fakeEventRecorder());

      await service.evaluate(buildContext());

      expect(capture.now).toEqual(later);
    });
  });

  describe('edge cases', () => {
    it('works with an empty policy registry', async () => {
      const { strategy, capture } = fakeStrategy(buildDecision());
      const service = new BusinessPolicyEnforcementService([], new FixedClock(NOW), strategy, fakeEventRecorder());

      await service.evaluate(buildContext());

      expect(capture.policies).toEqual([]);
    });
  });
});
