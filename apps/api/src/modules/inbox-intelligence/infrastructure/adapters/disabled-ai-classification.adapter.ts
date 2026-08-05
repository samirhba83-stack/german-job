import { Injectable } from '@nestjs/common';
import { AiClassificationPort, AiClassificationRequest, AiClassificationResponse } from '../../domain/ports/ai-classification.port';

/**
 * M29 Phase 11 — this milestone's own autonomous decision (confirmed with the user: "rules-only,
 * no AI vendor yet"): the ONLY real implementation of `AiClassificationPort` shipped this
 * milestone. `available` is always `false`, so `ReplyIngestionService` never calls `classify()`
 * — every real classification decision this milestone comes from the deterministic rule engine
 * (Phase 10) alone, and a message the rules cannot confidently classify becomes
 * `NEEDS_MANUAL_REVIEW` rather than a fabricated AI guess. Zero candidate email content leaves
 * this server to any third party. Wiring a real AI vendor later (a separate, explicit future
 * decision — data-processing region, vendor, legal review) means adding one new adapter class
 * bound to this exact same port token; no other code changes.
 */
@Injectable()
export class DisabledAiClassificationAdapter implements AiClassificationPort {
  readonly available = false;

  classify(_request: AiClassificationRequest): Promise<AiClassificationResponse> {
    return Promise.reject(new Error('AI classification is not enabled in this deployment — check `available` before calling classify().'));
  }
}
