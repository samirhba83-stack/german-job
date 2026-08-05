import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { ProviderSelectionCriteria } from '../models/provider-selection-criteria';
import { ProviderSelectionDecision } from '../models/provider-selection-decision';

export const PROVIDER_SELECTION_ENGINE_PORT = Symbol('PROVIDER_SELECTION_ENGINE_PORT');

/** The stable port downstream Phase 4 modules (Email Delivery) depend on, rather than the
 * concrete ProviderSelectionEngineService — mirrors ExecutionEventRecorder's port/token pattern. */
export interface ProviderSelectionEnginePort {
  selectProvider(
    criteria: ProviderSelectionCriteria,
  ): Promise<{ decision: ProviderSelectionDecision; provider: EmailProviderPort | null }>;
}
