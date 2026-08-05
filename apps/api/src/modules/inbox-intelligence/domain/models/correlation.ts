/** M29 Phase 6 — every outcome `ReplyCorrelationService` can reach. `UNSAFE_TO_PROCESS` is
 * distinct from `AMBIGUOUS`: it means a real signal *conflict* was detected (e.g. a strong
 * thread-id match pointing at one application while an explicit application-reference in the
 * subject points at a different one) — a situation worse than "not enough evidence," since acting
 * on it could attach a reply to the wrong application entirely. */
export type CorrelationStatus = 'MATCHED' | 'AMBIGUOUS' | 'UNRELATED' | 'DUPLICATE' | 'UNSAFE_TO_PROCESS';

/** M29 Phase 6 — every signal actually checked, and whether it fired, recorded verbatim as
 * evidence (Phase 6: "matching must remain deterministic and auditable"). Never just a final
 * boolean — a human reviewing an AMBIGUOUS case needs to see exactly which signals agreed and
 * which didn't. */
export interface CorrelationSignalEvidence {
  readonly signal: CorrelationSignalName;
  readonly matched: boolean;
  readonly detail: string;
}

export type CorrelationSignalName =
  // Strong signals
  | 'PROVIDER_THREAD_ID'
  | 'IN_REPLY_TO_HEADER'
  | 'REFERENCES_HEADER'
  // Supporting signals
  | 'RECIPIENT_MAILBOX'
  | 'SENDER_DOMAIN'
  | 'SUBJECT_NORMALIZED'
  | 'TIME_WINDOW';

export interface CorrelationResult {
  readonly status: CorrelationStatus;
  readonly confidence: number; // 0..1 — 0 for UNRELATED/UNSAFE_TO_PROCESS
  readonly evidence: ReadonlyArray<CorrelationSignalEvidence>;
  readonly correlatedApplicationId: string | null;
  readonly correlatedCampaignId: string | null;
  readonly correlatedConnectedMailboxSendAttemptId: string | null;
}
