import { ProviderSelectionEngineService } from './provider-selection-engine.service';
import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { ProviderSelectionStrategy } from '../../domain/ports/provider-selection-strategy.port';
import { ProviderSelectionDecision } from '../../domain/models/provider-selection-decision';
import { ProviderSelectionCriteria } from '../../domain/models/provider-selection-criteria';
import { FixedClock } from '../../../execution/infrastructure/clock/fixed-clock';
import { ExecutionEventRecorder } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';

function fakeEventRecorder(): ExecutionEventRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildProvider(id: string): EmailProviderPort {
  return { providerId: id, getCapabilities: jest.fn(), isAvailable: jest.fn(), send: jest.fn() };
}

function buildDecision(overrides: Partial<ProviderSelectionDecision> = {}): ProviderSelectionDecision {
  return {
    selectedProviderId: null,
    selectionReason: 'test reason',
    evaluatedAt: NOW,
    evaluations: [],
    rejectedProviders: [],
    ...overrides,
  };
}

function fakeStrategy(decision: ProviderSelectionDecision): ProviderSelectionStrategy {
  return { select: jest.fn().mockResolvedValue(decision) };
}

const CRITERIA: ProviderSelectionCriteria = {
  requiresAttachments: false,
  requiresHtml: false,
  requiresPlainText: true,
  recipientCount: 1,
  correlationId: 'correlation-1',
  traceId: 'trace-1',
};

describe('ProviderSelectionEngineService', () => {
  it('delegates to the injected strategy with the registered providers, criteria, and current time', async () => {
    const providerA = buildProvider('provider-a');
    const strategy = fakeStrategy(buildDecision({ selectedProviderId: 'provider-a' }));
    const engine = new ProviderSelectionEngineService([providerA], new FixedClock(NOW), strategy, fakeEventRecorder());

    await engine.selectProvider(CRITERIA);

    expect(strategy.select).toHaveBeenCalledWith([providerA], CRITERIA, NOW);
  });

  it('resolves the decision winning id back to the live provider instance', async () => {
    const providerA = buildProvider('provider-a');
    const providerB = buildProvider('provider-b');
    const strategy = fakeStrategy(buildDecision({ selectedProviderId: 'provider-b' }));
    const engine = new ProviderSelectionEngineService([providerA, providerB], new FixedClock(NOW), strategy, fakeEventRecorder());

    const { provider } = await engine.selectProvider(CRITERIA);

    expect(provider).toBe(providerB);
  });

  it('returns a null provider when the decision selected nothing', async () => {
    const strategy = fakeStrategy(buildDecision({ selectedProviderId: null }));
    const engine = new ProviderSelectionEngineService([buildProvider('provider-a')], new FixedClock(NOW), strategy, fakeEventRecorder());

    const { provider, decision } = await engine.selectProvider(CRITERIA);

    expect(provider).toBeNull();
    expect(decision.selectedProviderId).toBeNull();
  });

  it('passes the decision through unmodified for explainability', async () => {
    const expectedDecision = buildDecision({
      selectedProviderId: 'provider-a',
      selectionReason: 'custom reason',
      rejectedProviders: [{ providerId: 'provider-b', reasonCode: 'PROVIDER_UNAVAILABLE', explanation: 'x' }],
    });
    const strategy = fakeStrategy(expectedDecision);
    const engine = new ProviderSelectionEngineService([buildProvider('provider-a')], new FixedClock(NOW), strategy, fakeEventRecorder());

    const { decision } = await engine.selectProvider(CRITERIA);

    expect(decision).toBe(expectedDecision);
  });

  describe('dependency injection', () => {
    it('honors a differently-behaving injected strategy without any engine change', async () => {
      const providerA = buildProvider('provider-a');
      const alwaysNullStrategy = fakeStrategy(buildDecision({ selectedProviderId: null }));
      const alwaysSelectStrategy = fakeStrategy(buildDecision({ selectedProviderId: 'provider-a' }));

      const engineA = new ProviderSelectionEngineService([providerA], new FixedClock(NOW), alwaysNullStrategy, fakeEventRecorder());
      const engineB = new ProviderSelectionEngineService([providerA], new FixedClock(NOW), alwaysSelectStrategy, fakeEventRecorder());

      expect((await engineA.selectProvider(CRITERIA)).provider).toBeNull();
      expect((await engineB.selectProvider(CRITERIA)).provider).toBe(providerA);
    });
  });

  describe('event recording', () => {
    it('records with the correlationId/traceId supplied on criteria', async () => {
      const strategy = fakeStrategy(buildDecision({ selectedProviderId: 'provider-a' }));
      const eventRecorder = fakeEventRecorder();
      const engine = new ProviderSelectionEngineService([buildProvider('provider-a')], new FixedClock(NOW), strategy, eventRecorder);

      await engine.selectProvider(CRITERIA);

      expect(eventRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'correlation-1', traceId: 'trace-1', businessContext: expect.objectContaining({ providerId: 'provider-a' }) }),
      );
    });

    it('falls back to a fresh correlationId/traceId when criteria supplies none', async () => {
      const strategy = fakeStrategy(buildDecision({ selectedProviderId: null }));
      const eventRecorder = fakeEventRecorder();
      const engine = new ProviderSelectionEngineService([], new FixedClock(NOW), strategy, eventRecorder);
      const criteriaWithoutCorrelation: ProviderSelectionCriteria = { ...CRITERIA, correlationId: null, traceId: null };

      await engine.selectProvider(criteriaWithoutCorrelation);

      const call = (eventRecorder.record as jest.Mock).mock.calls[0][0];
      expect(call.correlationId).toEqual(expect.any(String));
      expect(call.correlationId.length).toBeGreaterThan(0);
      expect(call.traceId).toBe(call.correlationId);
    });
  });

  describe('edge cases', () => {
    it('returns a null provider when the decision references an id absent from the registry', async () => {
      const strategy = fakeStrategy(buildDecision({ selectedProviderId: 'ghost-provider' }));
      const engine = new ProviderSelectionEngineService([buildProvider('provider-a')], new FixedClock(NOW), strategy, fakeEventRecorder());

      const { provider } = await engine.selectProvider(CRITERIA);

      expect(provider).toBeNull();
    });

    it('works with an empty provider registry', async () => {
      const strategy = fakeStrategy(buildDecision({ selectedProviderId: null, selectionReason: 'No providers are registered.' }));
      const engine = new ProviderSelectionEngineService([], new FixedClock(NOW), strategy, fakeEventRecorder());

      const { provider, decision } = await engine.selectProvider(CRITERIA);

      expect(provider).toBeNull();
      expect(decision.selectionReason).toBe('No providers are registered.');
    });
  });
});
