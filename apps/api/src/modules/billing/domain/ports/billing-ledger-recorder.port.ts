import { BillingEventType, BillingLedgerStatus, PlanCode } from '@german-job-engine/database';

export const BILLING_LEDGER_RECORDER = Symbol('BILLING_LEDGER_RECORDER');

export interface RecordBillingLedgerEntryInput {
  readonly eventType: BillingEventType;
  readonly userId: string | null;
  readonly customerId: string | null;
  readonly subscriptionId: string | null;
  readonly checkoutId: string | null;
  readonly paymentId: string | null;
  readonly planCode: PlanCode | null;
  readonly amountCents: number | null;
  readonly currency: string | null;
  readonly status: BillingLedgerStatus;
  readonly reason: string | null;
  readonly actorType: 'SYSTEM' | 'USER' | 'ADMIN' | 'WEBHOOK';
  readonly actorId: string | null;
  readonly correlationId: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * M27 Phase 6 — the append-only billing ledger's write port, mirroring
 * execution-tracking's ExecutionEventRecorder port/token pattern for the billing bounded
 * context. Every material financial operation writes here; nothing ever updates or deletes a
 * row through this port.
 */
export interface BillingLedgerRecorder {
  record(input: RecordBillingLedgerEntryInput): Promise<void>;
}
