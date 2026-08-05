import { CorrelationStatus } from '../models/correlation';

export interface PrivacyFilterInput {
  readonly inboxCapabilityActive: boolean;
  readonly correlationStatus: CorrelationStatus;
  readonly alreadyProcessed: boolean;
  /** True when the message's From address is the connected mailbox's own address — a message the
   * candidate sent themselves (Phase 7: "the message is not a personal outgoing message"). */
  readonly isOutgoingFromOwnMailbox: boolean;
  readonly sizeBytes: number;
  readonly maxAllowedSizeBytes: number;
}

export interface PrivacyFilterResult {
  readonly allowed: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * M29 Phase 7 — the one gate every message crosses before its content (not just metadata) is ever
 * normalized or classified. Accumulates every blocking reason rather than stopping at the first,
 * matching this codebase's own `ConnectedMailboxReadinessService`/`DomainReadinessService`
 * precedent for "a caller that fails several checks should see all of them." A pure function — no
 * I/O, fully unit-testable; the caller resolves every input via real repository/mailbox lookups
 * first.
 */
export function checkPrivacyGate(input: PrivacyFilterInput): PrivacyFilterResult {
  const reasons: string[] = [];

  if (!input.inboxCapabilityActive) {
    reasons.push('Inbox-reading consent is not active for this mailbox.');
  }
  if (input.correlationStatus === 'UNRELATED') {
    reasons.push('Message does not correlate to any known application — never entered the recruitment-intelligence pipeline.');
  }
  if (input.correlationStatus === 'UNSAFE_TO_PROCESS') {
    reasons.push('Correlation signals conflict — processing this message could attach it to the wrong application.');
  }
  if (input.alreadyProcessed) {
    reasons.push('This message was already processed (idempotent no-op).');
  }
  if (input.isOutgoingFromOwnMailbox) {
    reasons.push('Message was sent BY the candidate\'s own mailbox, not received — never a reply to process.');
  }
  if (input.sizeBytes > input.maxAllowedSizeBytes) {
    reasons.push(`Message size ${input.sizeBytes} bytes exceeds the ${input.maxAllowedSizeBytes}-byte processing bound.`);
  }

  return { allowed: reasons.length === 0, blockingReasons: reasons };
}
