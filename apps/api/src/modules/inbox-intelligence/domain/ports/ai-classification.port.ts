import { ReplyPrimaryCategory, ReplySecondaryLabel } from '../models/reply-taxonomy';
import { ExtractedRecruitmentFacts } from '../models/extracted-facts';

export const AI_CLASSIFICATION_PORT = Symbol('AI_CLASSIFICATION_PORT');

export interface AiClassificationRequest {
  /** The already-normalized, quote-stripped candidate-relevant body — never the raw message, and
   * bounded in size before this is ever called (Phase 11: "do not send full private threads when
   * a relevant excerpt is sufficient... input size is bounded"). */
  readonly candidateRelevantBody: string;
  readonly subject: string;
  readonly detectedLanguage: 'DE' | 'EN' | 'UNKNOWN';
  /** What the deterministic rule engine already concluded — passed in so an AI adapter can use it
   * as a prior/hint rather than reasoning from nothing (Phase 10/11: rules run first, AI only when
   * rules are insufficient). */
  readonly ruleEngineHint: { readonly category: ReplyPrimaryCategory; readonly confidence: number } | null;
}

/** M29 Phase 11 — the strict structured schema every AI adapter must return. Every field
 * corresponds 1:1 to a brief-mandated output; `AiClassificationResponseValidator` (application
 * layer) rejects any response missing a required field or carrying a category/label outside the
 * real taxonomy — malformed output is never passed through to the rest of the pipeline. */
export interface AiClassificationResponse {
  readonly primaryCategory: ReplyPrimaryCategory;
  readonly secondaryLabels: ReadonlyArray<ReplySecondaryLabel>;
  readonly confidence: number; // 0..1
  readonly evidenceSpans: ReadonlyArray<string>;
  readonly detectedLanguage: 'DE' | 'EN' | 'UNKNOWN';
  readonly summary: string;
  readonly extractedFacts: ExtractedRecruitmentFacts;
  readonly recommendedNextStep: string;
  readonly humanReviewRequired: boolean;
}

/**
 * M29 Phase 11 — the one AI abstraction every classification caller depends on; never a specific
 * vendor SDK imported directly into inbox-intelligence logic (Phase 11: "do not hard-code one AI
 * provider directly into inbox logic"). This milestone ships exactly one real implementation,
 * `DisabledAiClassificationAdapter` — the deliberate, autonomously-chosen decision (per this
 * milestone's own AUTONOMY clause: "rules-only, no AI vendor yet") to keep zero candidate email
 * content leaving this server to any third party until a real AI vendor and data-processing
 * region are explicitly chosen in a later milestone. Wiring a real vendor later means adding one
 * new adapter class bound to this same token — no caller changes.
 */
export interface AiClassificationPort {
  readonly available: boolean;
  classify(request: AiClassificationRequest): Promise<AiClassificationResponse>;
}
