import { ProviderEvaluation } from './provider-evaluation';
import { ProviderRejection } from './provider-rejection';

/**
 * The Provider Selection Engine's fully explainable verdict — pure data, deliberately without a
 * live provider reference (ProviderSelectionEngineService.selectProvider() pairs this with the
 * actual selected EmailProviderPort instance separately, matching how the Scheduler (M3) keeps
 * SchedulingDecision pure data and pairs it with the live Campaign entity only where a caller
 * needs both).
 */
export interface ProviderSelectionDecision {
  readonly selectedProviderId: string | null;
  readonly selectionReason: string;
  readonly evaluatedAt: Date;
  /** Every registered provider considered, eligible or not. */
  readonly evaluations: ReadonlyArray<ProviderEvaluation>;
  /** The subset of `evaluations` that were ineligible, with their rejection reasons. */
  readonly rejectedProviders: ReadonlyArray<ProviderRejection>;
}
