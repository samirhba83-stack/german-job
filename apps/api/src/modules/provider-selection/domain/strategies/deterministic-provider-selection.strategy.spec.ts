import { DeterministicProviderSelectionStrategy } from './deterministic-provider-selection.strategy';
import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { ProviderCapabilities } from '../../../email-provider/domain/models/provider-capabilities';
import { ProviderSelectionCriteria } from '../models/provider-selection-criteria';
import { DEFAULT_PROVIDER_SELECTION_CONFIG, ProviderSelectionConfig } from '../provider-selection-config';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildCapabilities(overrides: Partial<ProviderCapabilities> = {}): ProviderCapabilities {
  return {
    providerId: 'provider-a',
    supportsAttachments: true,
    supportsHtml: true,
    supportsPlainText: true,
    maxAttachmentSizeBytes: 1_000_000,
    maxRecipientsPerRequest: 5,
    dailyDeliveryLimit: 100,
    requiresAuthentication: false,
    supportedAuthenticationMethods: [],
    ...overrides,
  };
}

function buildProvider(id: string, options: { available?: boolean; capabilities?: Partial<ProviderCapabilities> } = {}): EmailProviderPort {
  return {
    providerId: id,
    getCapabilities: jest.fn().mockReturnValue(buildCapabilities({ providerId: id, ...options.capabilities })),
    isAvailable: jest.fn().mockResolvedValue(options.available ?? true),
    send: jest.fn(),
  };
}

function buildCriteria(overrides: Partial<ProviderSelectionCriteria> = {}): ProviderSelectionCriteria {
  return {
    requiresAttachments: false,
    requiresHtml: false,
    requiresPlainText: true,
    recipientCount: 1,
    correlationId: 'correlation-1',
    traceId: 'trace-1',
    ...overrides,
  };
}

describe('DeterministicProviderSelectionStrategy', () => {
  const strategy = new DeterministicProviderSelectionStrategy(DEFAULT_PROVIDER_SELECTION_CONFIG);

  describe('single provider selection', () => {
    it('selects the only eligible provider', async () => {
      const provider = buildProvider('provider-a');

      const decision = await strategy.select([provider], buildCriteria(), NOW);

      expect(decision.selectedProviderId).toBe('provider-a');
      expect(decision.evaluations).toHaveLength(1);
      expect(decision.rejectedProviders).toEqual([]);
    });
  });

  describe('multiple provider evaluation', () => {
    it('evaluates every registered provider and picks the highest-priority eligible one', async () => {
      const providerA = buildProvider('provider-a');
      const providerB = buildProvider('provider-b');
      const config: ProviderSelectionConfig = { providerPriority: { 'provider-b': 10 }, defaultPriority: 1 };
      const prioritizedStrategy = new DeterministicProviderSelectionStrategy(config);

      const decision = await prioritizedStrategy.select([providerA, providerB], buildCriteria(), NOW);

      expect(decision.selectedProviderId).toBe('provider-b');
      expect(decision.evaluations).toHaveLength(2);
      expect(decision.evaluations.every((evaluation) => evaluation.eligible)).toBe(true);
    });

    it('breaks an exact priority tie deterministically by providerId', async () => {
      const providerB = buildProvider('provider-b');
      const providerA = buildProvider('provider-a');

      // Inserted with the alphabetically-later id first to prove the tiebreak, not array order, decides.
      const decision = await strategy.select([providerB, providerA], buildCriteria(), NOW);

      expect(decision.selectedProviderId).toBe('provider-a');
    });
  });

  describe('unavailable providers', () => {
    it('rejects a provider that reports itself unavailable', async () => {
      const provider = buildProvider('provider-a', { available: false });

      const decision = await strategy.select([provider], buildCriteria(), NOW);

      expect(decision.selectedProviderId).toBeNull();
      expect(decision.rejectedProviders).toEqual([
        { providerId: 'provider-a', reasonCode: 'PROVIDER_UNAVAILABLE', explanation: expect.any(String) },
      ]);
    });

    it('falls back to an available provider when another is unavailable', async () => {
      const unavailable = buildProvider('provider-a', { available: false });
      const available = buildProvider('provider-b');

      const decision = await strategy.select([unavailable, available], buildCriteria(), NOW);

      expect(decision.selectedProviderId).toBe('provider-b');
    });
  });

  describe('unsupported capabilities', () => {
    it('rejects a provider missing attachment support when attachments are required', async () => {
      const provider = buildProvider('provider-a', { capabilities: { supportsAttachments: false } });

      const decision = await strategy.select([provider], buildCriteria({ requiresAttachments: true }), NOW);

      expect(decision.selectedProviderId).toBeNull();
      expect(decision.rejectedProviders[0].reasonCode).toBe('UNSUPPORTED_ATTACHMENTS');
    });

    it('rejects a provider missing HTML support when HTML is required', async () => {
      const provider = buildProvider('provider-a', { capabilities: { supportsHtml: false } });

      const decision = await strategy.select([provider], buildCriteria({ requiresHtml: true }), NOW);

      expect(decision.rejectedProviders[0].reasonCode).toBe('UNSUPPORTED_HTML');
    });

    it('rejects a provider missing plain-text support when plain text is required', async () => {
      const provider = buildProvider('provider-a', { capabilities: { supportsPlainText: false } });

      const decision = await strategy.select([provider], buildCriteria({ requiresPlainText: true }), NOW);

      expect(decision.rejectedProviders[0].reasonCode).toBe('UNSUPPORTED_PLAIN_TEXT');
    });

    it('rejects a provider whose recipient limit is below the requested count', async () => {
      const provider = buildProvider('provider-a', { capabilities: { maxRecipientsPerRequest: 1 } });

      const decision = await strategy.select([provider], buildCriteria({ recipientCount: 5 }), NOW);

      expect(decision.rejectedProviders[0].reasonCode).toBe('RECIPIENT_LIMIT_EXCEEDED');
    });
  });

  describe('deterministic decisions', () => {
    it('produces an identical decision for the same providers, criteria, and instant', async () => {
      const providers = [buildProvider('provider-a'), buildProvider('provider-b')];

      const first = await strategy.select(providers, buildCriteria(), NOW);
      const second = await strategy.select(providers, buildCriteria(), NOW);

      expect(first).toEqual(second);
    });
  });

  describe('explainability', () => {
    it('exposes selected provider, rejections, evaluations, timestamp, and a selection reason', async () => {
      const eligible = buildProvider('provider-a');
      const rejected = buildProvider('provider-b', { available: false });

      const decision = await strategy.select([eligible, rejected], buildCriteria(), NOW);

      expect(decision.selectedProviderId).toBe('provider-a');
      expect(decision.evaluatedAt).toEqual(NOW);
      expect(decision.selectionReason).toContain('provider-a');
      expect(decision.evaluations).toHaveLength(2);
      expect(decision.rejectedProviders).toHaveLength(1);
      expect(decision.rejectedProviders[0].explanation).toContain('provider-b');
    });
  });

  describe('dependency injection / configuration-driven behavior', () => {
    it('changes the winner purely via injected priority config', async () => {
      const providerA = buildProvider('provider-a');
      const providerB = buildProvider('provider-b');

      const defaultDecision = await strategy.select([providerA, providerB], buildCriteria(), NOW);
      expect(defaultDecision.selectedProviderId).toBe('provider-a'); // equal priority -> alphabetical tiebreak

      const customConfig: ProviderSelectionConfig = { providerPriority: { 'provider-b': 99 }, defaultPriority: 1 };
      const customStrategy = new DeterministicProviderSelectionStrategy(customConfig);
      const customDecision = await customStrategy.select([providerA, providerB], buildCriteria(), NOW);

      expect(customDecision.selectedProviderId).toBe('provider-b');
    });
  });

  describe('edge cases', () => {
    it('returns a null selection with an explanatory reason when no providers are registered', async () => {
      const decision = await strategy.select([], buildCriteria(), NOW);

      expect(decision.selectedProviderId).toBeNull();
      expect(decision.selectionReason).toBe('No providers are registered.');
      expect(decision.evaluations).toEqual([]);
      expect(decision.rejectedProviders).toEqual([]);
    });

    it('returns a null selection with an aggregate reason when every provider is rejected', async () => {
      const a = buildProvider('provider-a', { available: false });
      const b = buildProvider('provider-b', { available: false });

      const decision = await strategy.select([a, b], buildCriteria(), NOW);

      expect(decision.selectedProviderId).toBeNull();
      expect(decision.selectionReason).toContain('2 rejected');
      expect(decision.rejectedProviders).toHaveLength(2);
    });

    it('stops at the first failed check per provider rather than accumulating every reason', async () => {
      const provider = buildProvider('provider-a', { available: false, capabilities: { supportsAttachments: false } });

      const decision = await strategy.select([provider], buildCriteria({ requiresAttachments: true }), NOW);

      expect(decision.rejectedProviders).toHaveLength(1);
      expect(decision.rejectedProviders[0].reasonCode).toBe('PROVIDER_UNAVAILABLE'); // availability checked first
    });
  });
});
