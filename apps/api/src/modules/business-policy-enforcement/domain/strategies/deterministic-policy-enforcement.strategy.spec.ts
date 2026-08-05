import { DeterministicPolicyEnforcementStrategy } from './deterministic-policy-enforcement.strategy';
import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

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

function fakePolicy(id: string, result: PolicyCheckResult): PolicySpecification {
  return {
    policyId: id,
    policyName: `Policy ${id}`,
    isSatisfiedBy: jest.fn().mockReturnValue(result),
  };
}

const SATISFIED: PolicyCheckResult = { satisfied: true, reasonCode: 'OK', explanation: 'ok' };
const VIOLATED = (explanation: string): PolicyCheckResult => ({ satisfied: false, reasonCode: 'FAIL', explanation });

describe('DeterministicPolicyEnforcementStrategy', () => {
  const strategy = new DeterministicPolicyEnforcementStrategy();

  describe('single policy approval', () => {
    it('allows execution when the only registered policy is satisfied', () => {
      const decision = strategy.evaluate([fakePolicy('A', SATISFIED)], buildContext(), NOW);

      expect(decision.allowed).toBe(true);
      expect(decision.denied).toBe(false);
      expect(decision.failedPolicies).toEqual([]);
    });
  });

  describe('single policy rejection', () => {
    it('denies execution when the only registered policy is violated', () => {
      const decision = strategy.evaluate([fakePolicy('A', VIOLATED('nope'))], buildContext(), NOW);

      expect(decision.allowed).toBe(false);
      expect(decision.denied).toBe(true);
      expect(decision.failedPolicies).toHaveLength(1);
      expect(decision.failedPolicies[0].policyId).toBe('A');
    });
  });

  describe('multiple policy evaluation', () => {
    it('evaluates every registered policy, not just the first', () => {
      const policies = [fakePolicy('A', SATISFIED), fakePolicy('B', SATISFIED), fakePolicy('C', SATISFIED)];

      const decision = strategy.evaluate(policies, buildContext(), NOW);

      expect(decision.evaluatedPolicies).toHaveLength(3);
      expect(policies.every((p) => (p.isSatisfiedBy as jest.Mock).mock.calls.length === 1)).toBe(true);
    });
  });

  describe('conflicting policies', () => {
    it('denies overall when some policies are satisfied and others are violated, reporting only the violations as failed', () => {
      const policies = [fakePolicy('A', SATISFIED), fakePolicy('B', VIOLATED('B failed')), fakePolicy('C', SATISFIED), fakePolicy('D', VIOLATED('D failed'))];

      const decision = strategy.evaluate(policies, buildContext(), NOW);

      expect(decision.allowed).toBe(false);
      expect(decision.evaluatedPolicies).toHaveLength(4);
      expect(decision.failedPolicies.map((p) => p.policyId)).toEqual(['B', 'D']);
      expect(decision.evaluatedPolicies.find((p) => p.policyId === 'A')?.satisfied).toBe(true);
      expect(decision.evaluatedPolicies.find((p) => p.policyId === 'C')?.satisfied).toBe(true);
    });

    it('does not stop evaluating after the first violation (evaluate-all, not fail-fast)', () => {
      const policies = [fakePolicy('A', VIOLATED('first failure')), fakePolicy('B', SATISFIED)];

      strategy.evaluate(policies, buildContext(), NOW);

      expect(policies[1].isSatisfiedBy).toHaveBeenCalled();
    });
  });

  describe('deterministic decisions', () => {
    it('produces an identical decision for the same policies, context, and instant', () => {
      const policies = [fakePolicy('B', SATISFIED), fakePolicy('A', VIOLATED('a failed'))];
      const context = buildContext();

      const first = strategy.evaluate(policies, context, NOW);
      const second = strategy.evaluate(policies, context, NOW);

      expect(first).toEqual(second);
    });

    it('orders evaluatedPolicies and failedPolicies by policyId regardless of injection order', () => {
      const policies = [fakePolicy('Z', VIOLATED('z')), fakePolicy('A', VIOLATED('a')), fakePolicy('M', SATISFIED)];

      const decision = strategy.evaluate(policies, buildContext(), NOW);

      expect(decision.evaluatedPolicies.map((p) => p.policyId)).toEqual(['A', 'M', 'Z']);
      expect(decision.failedPolicies.map((p) => p.policyId)).toEqual(['A', 'Z']);
    });
  });

  describe('explainability', () => {
    it('exposes executionId, timestamp, and structured detail for every failed policy', () => {
      const decision = strategy.evaluate(
        [fakePolicy('A', { satisfied: false, reasonCode: 'RATE_LIMIT_EXCEEDED', explanation: 'too many sends' })],
        buildContext({ executionId: 'execution-42' }),
        NOW,
      );

      expect(decision.executionId).toBe('execution-42');
      expect(decision.decisionTimestamp).toBe(NOW);
      expect(decision.failedPolicies[0]).toEqual({
        policyId: 'A',
        policyName: 'Policy A',
        reasonCode: 'RATE_LIMIT_EXCEEDED',
        explanation: 'too many sends',
      });
      expect(decision.explanations).toEqual(['too many sends']);
      expect(decision.decisionReasoning).toContain('1 of 1 policies were violated');
    });

    it('describes an allowed decision in decisionReasoning', () => {
      const decision = strategy.evaluate([fakePolicy('A', SATISFIED), fakePolicy('B', SATISFIED)], buildContext(), NOW);

      expect(decision.decisionReasoning).toContain('All 2 policies were satisfied');
    });
  });

  describe('edge cases', () => {
    it('allows by default when no policies are registered', () => {
      const decision = strategy.evaluate([], buildContext(), NOW);

      expect(decision.allowed).toBe(true);
      expect(decision.evaluatedPolicies).toEqual([]);
      expect(decision.decisionReasoning).toContain('No policies are registered');
    });

    it('denies when every registered policy is violated', () => {
      const decision = strategy.evaluate([fakePolicy('A', VIOLATED('a')), fakePolicy('B', VIOLATED('b'))], buildContext(), NOW);

      expect(decision.allowed).toBe(false);
      expect(decision.failedPolicies).toHaveLength(2);
    });

    it('does not mutate the input policies array while sorting', () => {
      const policies = [fakePolicy('Z', SATISFIED), fakePolicy('A', SATISFIED)];
      const originalOrder = policies.map((p) => p.policyId);

      strategy.evaluate(policies, buildContext(), NOW);

      expect(policies.map((p) => p.policyId)).toEqual(originalOrder);
    });
  });
});
