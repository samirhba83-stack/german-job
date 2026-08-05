import { Inject, Injectable } from '@nestjs/common';
import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { ProviderCapabilities } from '../../../email-provider/domain/models/provider-capabilities';
import { ProviderSelectionStrategy } from '../ports/provider-selection-strategy.port';
import { ProviderSelectionCriteria } from '../models/provider-selection-criteria';
import { ProviderSelectionDecision } from '../models/provider-selection-decision';
import { ProviderEvaluation } from '../models/provider-evaluation';
import { ProviderRejection } from '../models/provider-rejection';
import { ProviderSelectionConfig, PROVIDER_SELECTION_CONFIG } from '../provider-selection-config';

interface ProviderEvaluationOutcome {
  readonly evaluation: ProviderEvaluation;
  readonly rejection: ProviderRejection | null;
}

/**
 * Default PROVIDER_SELECTION_STRATEGY binding. Rejects a provider on the first failed check —
 * unavailable, then each missing capability in turn, then the recipient limit — so every
 * rejection carries exactly one clear reason rather than a vague aggregate. Eligible providers
 * are ranked by a configured priority weight (never hardcoded), tied broken deterministically by
 * providerId. "Authentication readiness" and "provider health" are reflected through
 * `isAvailable()` — EmailProviderPort has no separate signal for either yet; a real adapter is
 * expected to fold both into its own availability check until a richer capability model exists.
 */
@Injectable()
export class DeterministicProviderSelectionStrategy implements ProviderSelectionStrategy {
  constructor(@Inject(PROVIDER_SELECTION_CONFIG) private readonly config: ProviderSelectionConfig) {}

  async select(
    providers: ReadonlyArray<EmailProviderPort>,
    criteria: ProviderSelectionCriteria,
    now: Date,
  ): Promise<ProviderSelectionDecision> {
    const outcomes = await Promise.all(providers.map((provider) => this.evaluate(provider, criteria)));
    const evaluations = outcomes.map((outcome) => outcome.evaluation);
    const rejectedProviders = outcomes
      .map((outcome) => outcome.rejection)
      .filter((rejection): rejection is ProviderRejection => rejection !== null);

    const eligible = evaluations.filter((evaluation) => evaluation.eligible);
    if (eligible.length === 0) {
      return {
        selectedProviderId: null,
        selectionReason:
          providers.length === 0
            ? 'No providers are registered.'
            : `No registered provider is eligible for this request; ${rejectedProviders.length} rejected.`,
        evaluatedAt: now,
        evaluations,
        rejectedProviders,
      };
    }

    const ranked = [...eligible].sort(
      (a, b) => b.priorityScore - a.priorityScore || a.providerId.localeCompare(b.providerId),
    );
    const winner = ranked[0];

    return {
      selectedProviderId: winner.providerId,
      selectionReason: `Selected "${winner.providerId}" — highest priority (${winner.priorityScore}) among ${eligible.length} eligible provider(s).`,
      evaluatedAt: now,
      evaluations,
      rejectedProviders,
    };
  }

  private async evaluate(provider: EmailProviderPort, criteria: ProviderSelectionCriteria): Promise<ProviderEvaluationOutcome> {
    const capabilities = provider.getCapabilities();
    const available = await provider.isAvailable();

    if (!available) {
      return this.reject(provider.providerId, capabilities, 'PROVIDER_UNAVAILABLE', `Provider "${provider.providerId}" reported itself unavailable.`);
    }
    if (criteria.requiresAttachments && !capabilities.supportsAttachments) {
      return this.reject(provider.providerId, capabilities, 'UNSUPPORTED_ATTACHMENTS', `Provider "${provider.providerId}" does not support attachments.`);
    }
    if (criteria.requiresHtml && !capabilities.supportsHtml) {
      return this.reject(provider.providerId, capabilities, 'UNSUPPORTED_HTML', `Provider "${provider.providerId}" does not support HTML bodies.`);
    }
    if (criteria.requiresPlainText && !capabilities.supportsPlainText) {
      return this.reject(provider.providerId, capabilities, 'UNSUPPORTED_PLAIN_TEXT', `Provider "${provider.providerId}" does not support plain-text bodies.`);
    }
    if (criteria.recipientCount > capabilities.maxRecipientsPerRequest) {
      return this.reject(
        provider.providerId,
        capabilities,
        'RECIPIENT_LIMIT_EXCEEDED',
        `Provider "${provider.providerId}" supports at most ${capabilities.maxRecipientsPerRequest} recipient(s) per request; ${criteria.recipientCount} requested.`,
      );
    }

    const priorityScore = this.config.providerPriority[provider.providerId] ?? this.config.defaultPriority;
    return {
      evaluation: {
        providerId: provider.providerId,
        eligible: true,
        capabilities,
        priorityScore,
        explanation: `Provider "${provider.providerId}" meets every requirement (priority ${priorityScore}).`,
      },
      rejection: null,
    };
  }

  private reject(providerId: string, capabilities: ProviderCapabilities, reasonCode: string, explanation: string): ProviderEvaluationOutcome {
    return {
      evaluation: { providerId, eligible: false, capabilities, priorityScore: 0, explanation },
      rejection: { providerId, reasonCode, explanation },
    };
  }
}
