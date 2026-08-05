import { ProviderCapabilities } from '../../../email-provider/domain/models/provider-capabilities';

/** One provider's full evaluation record — present for every registered provider considered,
 * eligible or not, so a selection decision stays fully traceable. */
export interface ProviderEvaluation {
  readonly providerId: string;
  readonly eligible: boolean;
  readonly capabilities: ProviderCapabilities;
  /** 0 when not eligible; otherwise the score used to rank eligible candidates. */
  readonly priorityScore: number;
  readonly explanation: string;
}
