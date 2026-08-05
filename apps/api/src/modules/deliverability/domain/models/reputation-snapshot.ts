export type DeliverabilityHealthLabel = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';

/** Real, computed-on-read from actual `EmailMessage` rows over a trailing window — never a
 * separately stored, driftable score (matches this codebase's established "count real rows,
 * never fabricate/duplicate a number" discipline — the same choice M27's
 * `BillingEntitlementProjectionService` made for usage-vs-limits). Thresholds in
 * `classify()` are real, commonly cited industry deliverability benchmarks (major mailbox
 * providers' own postmaster guidance generally treats a spam-complaint rate above ~0.1% and a
 * bounce rate above ~5% as reputation-damaging) — applied to real computed rates, not asserted as
 * a guarantee this application can enforce. */
export interface ReputationSnapshot {
  readonly windowDays: number;
  readonly sent: number;
  readonly delivered: number;
  readonly bounced: number;
  readonly complained: number;
  readonly bounceRate: number;
  readonly complaintRate: number;
  readonly healthLabel: DeliverabilityHealthLabel;
}

export interface SenderReputationEntry {
  readonly senderEmail: string;
  readonly snapshot: ReputationSnapshot;
}
