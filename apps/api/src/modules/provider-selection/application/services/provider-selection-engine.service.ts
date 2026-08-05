import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EMAIL_PROVIDERS } from '../../domain/ports/email-provider-registry.token';
import { ProviderSelectionStrategy, PROVIDER_SELECTION_STRATEGY } from '../../domain/ports/provider-selection-strategy.port';
import { ProviderSelectionCriteria } from '../../domain/models/provider-selection-criteria';
import { ProviderSelectionDecision } from '../../domain/models/provider-selection-decision';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';
import { ProviderSelectionEnginePort } from '../../domain/ports/provider-selection-engine.port';

/**
 * The business decision layer (Milestone 13) responsible for choosing the most appropriate
 * registered email provider before any delivery attempt. Sits between the Email Delivery
 * Execution Service and whichever EmailProviderPort ultimately gets called — the Worker never
 * knows this evaluation happens at all. Holds no selection logic itself: it reads the clock once,
 * delegates entirely to the injected ProviderSelectionStrategy, then resolves the decision's
 * winning id back to the live provider instance the caller actually needs to invoke `.send()` on.
 */
@Injectable()
export class ProviderSelectionEngineService implements ProviderSelectionEnginePort {
  constructor(
    @Inject(EMAIL_PROVIDERS) private readonly providers: EmailProviderPort[],
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    @Inject(PROVIDER_SELECTION_STRATEGY) private readonly strategy: ProviderSelectionStrategy,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
  ) {}

  async selectProvider(
    criteria: ProviderSelectionCriteria,
  ): Promise<{ decision: ProviderSelectionDecision; provider: EmailProviderPort | null }> {
    const now = this.clock.now();
    const decision = await this.strategy.select(this.providers, criteria, now);
    const provider = decision.selectedProviderId ? this.resolveProvider(decision.selectedProviderId) : null;

    // M18: correlationId/traceId are threaded through criteria when the caller has a task in
    // scope (EmailDeliveryExecutionService always supplies them); falling back to a fresh id
    // only for a standalone selectProvider() call with no execution context at all.
    const correlationId = criteria.correlationId ?? randomUUID();
    const traceId = criteria.traceId ?? correlationId;

    await this.eventRecorder.record({
      eventType: 'PROVIDER_SELECTED',
      campaignId: null,
      executionId: null,
      correlationId,
      traceId,
      summary: decision.selectedProviderId ? `Provider "${decision.selectedProviderId}" selected` : 'No provider selected',
      explanation: decision.selectionReason,
      status: decision.selectedProviderId ? 'SUCCESS' : 'FAILURE',
      metadata: { rejectedProviderCount: String(decision.rejectedProviders.length) },
      businessContext: { ...EMPTY_BUSINESS_CONTEXT, providerId: decision.selectedProviderId },
    });

    return { decision, provider };
  }

  private resolveProvider(providerId: string): EmailProviderPort | null {
    return this.providers.find((provider) => provider.providerId === providerId) ?? null;
  }
}
