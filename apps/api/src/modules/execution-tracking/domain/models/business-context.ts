import { GeographicContext } from './geographic-context';

/**
 * Everything about an event beyond correlationId/traceId (which live as
 * their own top-level, indexed ExecutionEvent fields — see
 * ExecutionEvent's doc comment for why they aren't duplicated in here).
 * Every field is honestly null unless the recording call site genuinely
 * has that piece of context in scope — no field is ever guessed or
 * synthesized to fill a gap.
 */
export interface BusinessContext {
  readonly companyId: string | null;
  readonly jobId: string | null;
  readonly workerId: string | null;
  readonly providerId: string | null;
  readonly userId: string | null;
  readonly recommendationId: string | null;
  readonly decisionId: string | null;
  readonly policyEvaluationId: string | null;
  readonly geography: GeographicContext | null;
}

export const EMPTY_BUSINESS_CONTEXT: BusinessContext = {
  companyId: null,
  jobId: null,
  workerId: null,
  providerId: null,
  userId: null,
  recommendationId: null,
  decisionId: null,
  policyEvaluationId: null,
  geography: null,
};
