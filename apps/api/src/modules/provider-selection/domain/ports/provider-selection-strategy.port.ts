import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { ProviderSelectionCriteria } from '../models/provider-selection-criteria';
import { ProviderSelectionDecision } from '../models/provider-selection-decision';

export const PROVIDER_SELECTION_STRATEGY = Symbol('PROVIDER_SELECTION_STRATEGY');

/**
 * The Provider Selection Engine's core extension point. Evaluates every registered provider
 * against the given criteria and produces one explainable decision — async because checking
 * availability is inherently async (EmailProviderPort.isAvailable() returns a Promise), unlike
 * the fully synchronous strategies earlier in this pipeline. A future AI model becomes a new
 * ProviderSelectionStrategy implementation bound to PROVIDER_SELECTION_STRATEGY via DI;
 * ProviderSelectionEngineService delegates to whatever is registered and never needs to change.
 */
export interface ProviderSelectionStrategy {
  select(
    providers: ReadonlyArray<EmailProviderPort>,
    criteria: ProviderSelectionCriteria,
    now: Date,
  ): Promise<ProviderSelectionDecision>;
}
