import { ConnectedMailboxSendAttemptRecord, CreateConnectedMailboxSendAttemptInput, ConnectedMailboxSendStatus } from '../models/connected-mailbox-send-attempt';

export const CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY = Symbol('CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY');

export interface ConnectedMailboxSendAttemptRepository {
  /** Idempotent by `idempotencyKey` — a repeat call for the same logical send returns the
   * existing row (the frozen snapshot), never a duplicate (Phase 12/14: "duplicate send remains
   * idempotent"). */
  reserve(input: CreateConnectedMailboxSendAttemptInput, now: Date): Promise<ConnectedMailboxSendAttemptRecord>;
  findByIdempotencyKey(key: string): Promise<ConnectedMailboxSendAttemptRecord | null>;
  markOutcome(
    id: string,
    status: ConnectedMailboxSendStatus,
    fields: { providerMessageId?: string | null; providerThreadId?: string | null; rfcMessageId?: string | null; lastFailureCategory?: string | null; lastFailureReason?: string | null },
    now: Date,
  ): Promise<void>;
  incrementAttempts(id: string, now: Date): Promise<void>;
  listByConnectedMailboxId(connectedMailboxId: string, limit: number, offset: number): Promise<ConnectedMailboxSendAttemptRecord[]>;
  /** M29 Phase 6 — `ReplyCorrelationService`'s strongest signal: does this incoming message's
   * provider thread id match one this application actually sent within? Scoped to one mailbox —
   * never searches across users. */
  findByProviderThreadId(connectedMailboxId: string, providerThreadId: string): Promise<ConnectedMailboxSendAttemptRecord | null>;
  /** M29 Phase 6 — the In-Reply-To/References strong signal: does a stored sent message's real
   * RFC Message-ID match what an incoming reply's headers claim to be replying to? */
  findByRfcMessageId(connectedMailboxId: string, rfcMessageId: string): Promise<ConnectedMailboxSendAttemptRecord | null>;
}
