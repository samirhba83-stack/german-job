import { CorrelationResult, CorrelationSignalEvidence } from '../models/correlation';

export interface SentMessageRef {
  readonly connectedMailboxSendAttemptId: string;
  readonly applicationId: string | null;
  readonly campaignId: string | null;
}

export interface CorrelationScoringInput {
  /** `ConnectedMailboxSendAttemptRepository.findByProviderThreadId()` result — the single
   * strongest signal (Phase 6): if the incoming message's real Gmail threadId/Graph conversationId
   * matches a message this application actually sent, there is essentially no ambiguity left. */
  readonly matchByThreadId: SentMessageRef | null;
  /** `findByRfcMessageId()` keyed on the incoming message's `In-Reply-To` header value. */
  readonly matchByInReplyTo: SentMessageRef | null;
  /** One lookup per value in the incoming message's `References` header — may legitimately
   * resolve to more than one distinct application if the candidate reused an email thread, or
   * (rarely) if two different sent messages happen to chain together. */
  readonly matchesByReferences: ReadonlyArray<SentMessageRef>;
}

/**
 * M29 Phase 6 — the pure scoring core of `ReplyCorrelationService`. Never touches the database
 * itself (the caller resolves `SentMessageRef`s via real repository lookups first) — fully
 * unit-testable in isolation. `DUPLICATE` is deliberately not a possible output here: idempotency
 * on `(connectedMailboxId, providerMessageId)` is enforced by a real DB unique constraint at the
 * `InboxMessageRepository.create()` layer, checked by the caller before this function ever runs.
 */
export function scoreCorrelation(input: CorrelationScoringInput): CorrelationResult {
  const evidence: CorrelationSignalEvidence[] = [
    { signal: 'PROVIDER_THREAD_ID', matched: input.matchByThreadId !== null, detail: input.matchByThreadId ? `matched send attempt ${input.matchByThreadId.connectedMailboxSendAttemptId}` : 'no sent message shares this thread id' },
    { signal: 'IN_REPLY_TO_HEADER', matched: input.matchByInReplyTo !== null, detail: input.matchByInReplyTo ? `matched send attempt ${input.matchByInReplyTo.connectedMailboxSendAttemptId}` : 'In-Reply-To did not match any sent Message-ID' },
    {
      signal: 'REFERENCES_HEADER',
      matched: input.matchesByReferences.length > 0,
      detail: input.matchesByReferences.length > 0 ? `matched ${input.matchesByReferences.length} sent message(s) via References` : 'no References value matched a sent Message-ID',
    },
  ];

  // Strong-vs-strong conflict: threadId and In-Reply-To both resolved, but to different
  // applications — never guess which one is right (Phase 6: "AI must not override a strong
  // contradictory threading signal" — the same discipline applies to this deterministic layer
  // itself, before AI is ever involved).
  if (input.matchByThreadId && input.matchByInReplyTo && applicationIdOf(input.matchByThreadId) !== applicationIdOf(input.matchByInReplyTo)) {
    return unsafe(evidence, 'Thread id and In-Reply-To resolve to different applications — a genuine signal conflict, never auto-resolved.');
  }

  if (input.matchByThreadId) {
    return matched(input.matchByThreadId, 0.97, evidence);
  }
  if (input.matchByInReplyTo) {
    return matched(input.matchByInReplyTo, 0.92, evidence);
  }

  if (input.matchesByReferences.length > 0) {
    const distinctApplicationIds = new Set(input.matchesByReferences.map(applicationIdOf));
    if (distinctApplicationIds.size === 1) {
      return matched(input.matchesByReferences[0], 0.85, evidence);
    }
    // Real evidence exists (this message IS part of a thread this application sent into) but it
    // doesn't decisively pick one application — Phase 6: "never auto-assign AMBIGUOUS messages."
    return ambiguous(evidence, `References header matched ${distinctApplicationIds.size} different applications — cannot auto-resolve.`);
  }

  return unrelated(evidence);
}

function applicationIdOf(ref: SentMessageRef): string {
  return ref.applicationId ?? `campaign:${ref.campaignId ?? 'none'}`;
}

function matched(ref: SentMessageRef, confidence: number, evidence: ReadonlyArray<CorrelationSignalEvidence>): CorrelationResult {
  return { status: 'MATCHED', confidence, evidence, correlatedApplicationId: ref.applicationId, correlatedCampaignId: ref.campaignId, correlatedConnectedMailboxSendAttemptId: ref.connectedMailboxSendAttemptId };
}

function ambiguous(evidence: ReadonlyArray<CorrelationSignalEvidence>, reason: string): CorrelationResult {
  return {
    status: 'AMBIGUOUS',
    confidence: 0.4,
    evidence: [...evidence, { signal: 'REFERENCES_HEADER', matched: false, detail: reason }],
    correlatedApplicationId: null,
    correlatedCampaignId: null,
    correlatedConnectedMailboxSendAttemptId: null,
  };
}

function unsafe(evidence: ReadonlyArray<CorrelationSignalEvidence>, reason: string): CorrelationResult {
  return {
    status: 'UNSAFE_TO_PROCESS',
    confidence: 0,
    evidence: [...evidence, { signal: 'PROVIDER_THREAD_ID', matched: false, detail: reason }],
    correlatedApplicationId: null,
    correlatedCampaignId: null,
    correlatedConnectedMailboxSendAttemptId: null,
  };
}

function unrelated(evidence: ReadonlyArray<CorrelationSignalEvidence>): CorrelationResult {
  return { status: 'UNRELATED', confidence: 0, evidence, correlatedApplicationId: null, correlatedCampaignId: null, correlatedConnectedMailboxSendAttemptId: null };
}
