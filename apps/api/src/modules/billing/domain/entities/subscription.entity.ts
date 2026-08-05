import { PlanCode, SubscriptionStatus } from '@german-job-engine/shared-types';
import { AggregateRoot } from '../../../../shared/domain';
import { InvalidSubscriptionTransitionException } from '../exceptions/invalid-subscription-transition.exception';

export interface SubscriptionProps {
  userId: string;
  planCode: PlanCode;
  status: SubscriptionStatus;
  paddleSubscriptionId: string;
  paddleCustomerId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  cancellationReason: string | null;
  pastDueSince: Date | null;
  gracePeriodEndsAt: Date | null;
  refundedAt: Date | null;
  disputedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// A state a Subscription has already left, never re-entered — reactivation creates a brand new
// row with a new real paddleSubscriptionId (see the Prisma schema's own doc comment); this
// matches never resurrecting completed Campaign/Application history elsewhere in this project.
const TERMINAL_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([SubscriptionStatus.CANCELED, SubscriptionStatus.REFUNDED]);

/**
 * One real Paddle subscription lifecycle. Every transition is only ever driven by a verified
 * Paddle webhook or an audited admin action (see application/commands) — nothing here ever
 * grants itself from a frontend signal. Guards enforce exactly the transition table documented
 * in the M27 engineering report; anything else throws InvalidSubscriptionTransitionException,
 * which the caller records as a rejected/audited event rather than silently applying.
 */
export class Subscription extends AggregateRoot<string> {
  private props: SubscriptionProps;

  private constructor(id: string, props: SubscriptionProps) {
    super(id);
    this.props = props;
  }

  get userId(): string {
    return this.props.userId;
  }

  get planCode(): PlanCode {
    return this.props.planCode;
  }

  get status(): SubscriptionStatus {
    return this.props.status;
  }

  get paddleSubscriptionId(): string {
    return this.props.paddleSubscriptionId;
  }

  get paddleCustomerId(): string {
    return this.props.paddleCustomerId;
  }

  get currentPeriodStart(): Date {
    return this.props.currentPeriodStart;
  }

  get currentPeriodEnd(): Date {
    return this.props.currentPeriodEnd;
  }

  get cancelAtPeriodEnd(): boolean {
    return this.props.cancelAtPeriodEnd;
  }

  get canceledAt(): Date | null {
    return this.props.canceledAt;
  }

  get cancellationReason(): string | null {
    return this.props.cancellationReason;
  }

  get pastDueSince(): Date | null {
    return this.props.pastDueSince;
  }

  get gracePeriodEndsAt(): Date | null {
    return this.props.gracePeriodEndsAt;
  }

  get refundedAt(): Date | null {
    return this.props.refundedAt;
  }

  get disputedAt(): Date | null {
    return this.props.disputedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** True only while genuinely in good standing — PAST_DUE (even within grace) is deliberately
   * NOT "in good standing": execution permission is a separate policy decision
   * (BillingEntitlementProjectionService), this is purely a status-shape convenience. */
  get isActive(): boolean {
    return this.props.status === SubscriptionStatus.ACTIVE;
  }

  get isTerminal(): boolean {
    return TERMINAL_STATUSES.has(this.props.status);
  }

  /** The only construction path — called once a Paddle webhook has verified a real, paid
   * transaction. Never call this from a frontend redirect or unverified signal. */
  static activate(
    id: string,
    params: {
      userId: string;
      planCode: PlanCode;
      paddleSubscriptionId: string;
      paddleCustomerId: string;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      now?: Date;
    },
  ): Subscription {
    const now = params.now ?? new Date();
    return new Subscription(id, {
      userId: params.userId,
      planCode: params.planCode,
      status: SubscriptionStatus.ACTIVE,
      paddleSubscriptionId: params.paddleSubscriptionId,
      paddleCustomerId: params.paddleCustomerId,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      cancellationReason: null,
      pastDueSince: null,
      gracePeriodEndsAt: null,
      refundedAt: null,
      disputedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: SubscriptionProps): Subscription {
    return new Subscription(id, props);
  }

  /** A real Paddle renewal webhook confirmed the next period was paid — extends the window,
   * status stays ACTIVE (or recovers from PAST_DUE, since a successful renewal charge is itself
   * proof of recovery). */
  renew(newPeriodStart: Date, newPeriodEnd: Date, now: Date = new Date()): void {
    if (this.isTerminal) {
      throw new InvalidSubscriptionTransitionException(this.id, this.props.status, SubscriptionStatus.ACTIVE);
    }
    this.props.status = SubscriptionStatus.ACTIVE;
    this.props.currentPeriodStart = newPeriodStart;
    this.props.currentPeriodEnd = newPeriodEnd;
    this.props.pastDueSince = null;
    this.props.gracePeriodEndsAt = null;
    this.touch(now);
  }

  /** Paddle-confirmed plan change (upgrade/downgrade) — Paddle computes proration server-side;
   * this only records the resulting internal state after a verified webhook. */
  changePlan(newPlanCode: PlanCode, newPeriodEnd: Date, now: Date = new Date()): void {
    this.requireTransition(SubscriptionStatus.ACTIVE);
    this.props.planCode = newPlanCode;
    this.props.currentPeriodEnd = newPeriodEnd;
    this.touch(now);
  }

  markPastDue(gracePeriodEndsAt: Date, now: Date = new Date()): void {
    // Standalone guard, not `requireTransition()` — that helper's allow-list is only ever
    // populated for `target === ACTIVE` (see its own body below), so calling it for any other
    // target is always a no-match/always-throw. Real bug found via M27 test-writing: this meant
    // every genuine Paddle `subscription.past_due` webhook threw here and the entire
    // dunning/grace-period recovery flow never actually ran.
    if (this.props.status !== SubscriptionStatus.ACTIVE) {
      throw new InvalidSubscriptionTransitionException(this.id, this.props.status, SubscriptionStatus.PAST_DUE);
    }
    this.props.status = SubscriptionStatus.PAST_DUE;
    this.props.pastDueSince = now;
    this.props.gracePeriodEndsAt = gracePeriodEndsAt;
    this.touch(now);
  }

  /** Grace period elapsed with no successful recovery charge — the only path from PAST_DUE to
   * CANCELED that isn't a direct Paddle cancellation webhook. */
  expireFromPastDue(now: Date = new Date()): void {
    if (this.props.status !== SubscriptionStatus.PAST_DUE) {
      throw new InvalidSubscriptionTransitionException(this.id, this.props.status, SubscriptionStatus.CANCELED);
    }
    this.props.status = SubscriptionStatus.CANCELED;
    this.props.canceledAt = now;
    this.props.cancellationReason = 'PAYMENT_RECOVERY_GRACE_PERIOD_EXPIRED';
    this.touch(now);
  }

  /** User-initiated cancellation — access continues until currentPeriodEnd (the approved
   * policy: "Cancellation: Effective at period end."). Never immediate. */
  scheduleCancellationAtPeriodEnd(reason: string | null, now: Date = new Date()): void {
    if (this.props.status !== SubscriptionStatus.ACTIVE && this.props.status !== SubscriptionStatus.PAST_DUE) {
      throw new InvalidSubscriptionTransitionException(this.id, this.props.status, SubscriptionStatus.CANCEL_AT_PERIOD_END);
    }
    this.props.status = SubscriptionStatus.CANCEL_AT_PERIOD_END;
    this.props.cancelAtPeriodEnd = true;
    this.props.cancellationReason = reason;
    this.touch(now);
  }

  /** User changes their mind before the period actually ends — real reactivation without a new
   * Paddle subscription, since the underlying Paddle subscription was only scheduled to cancel,
   * never actually canceled yet. */
  resumeFromScheduledCancellation(now: Date = new Date()): void {
    this.requireTransition(SubscriptionStatus.ACTIVE);
    this.props.status = SubscriptionStatus.ACTIVE;
    this.props.cancelAtPeriodEnd = false;
    this.props.cancellationReason = null;
    this.touch(now);
  }

  /** The scheduled period end was actually reached — a real Paddle webhook (subscription.
   * canceled, fired by Paddle once the already-scheduled cancellation takes effect) confirms
   * this rather than a client-side date comparison. */
  expireAtPeriodEnd(now: Date = new Date()): void {
    if (this.props.status !== SubscriptionStatus.CANCEL_AT_PERIOD_END) {
      throw new InvalidSubscriptionTransitionException(this.id, this.props.status, SubscriptionStatus.CANCELED);
    }
    this.props.status = SubscriptionStatus.CANCELED;
    this.props.canceledAt = now;
    this.touch(now);
  }

  /** A direct Paddle-side cancellation (e.g. admin action inside Paddle, or a failed-recovery
   * path Paddle itself resolves) — immediate, not period-end. */
  cancelImmediately(reason: string, now: Date = new Date()): void {
    if (this.isTerminal) {
      throw new InvalidSubscriptionTransitionException(this.id, this.props.status, SubscriptionStatus.CANCELED);
    }
    this.props.status = SubscriptionStatus.CANCELED;
    this.props.canceledAt = now;
    this.props.cancellationReason = reason;
    this.touch(now);
  }

  /** Admin-approved refund within the policy window — revokes entitlement immediately (distinct
   * from cancellation, which preserves access until period end). */
  refund(now: Date = new Date()): void {
    if (this.props.status !== SubscriptionStatus.ACTIVE && this.props.status !== SubscriptionStatus.PAST_DUE) {
      throw new InvalidSubscriptionTransitionException(this.id, this.props.status, SubscriptionStatus.REFUNDED);
    }
    this.props.status = SubscriptionStatus.REFUNDED;
    this.props.refundedAt = now;
    this.touch(now);
  }

  /** A chargeback/dispute — modeled as a marker distinct from a voluntary refund (Phase 11:
   * "Chargebacks and disputes must be modeled separately from voluntary refunds"), with the
   * same immediate access consequence. */
  markDisputed(now: Date = new Date()): void {
    this.props.disputedAt = now;
    if (!this.isTerminal) {
      this.props.status = SubscriptionStatus.CANCELED;
      this.props.canceledAt = now;
      this.props.cancellationReason = 'CHARGEBACK_DISPUTE';
    }
    this.touch(now);
  }

  private requireTransition(target: SubscriptionStatus): void {
    const allowedFrom: ReadonlyArray<SubscriptionStatus> =
      target === SubscriptionStatus.ACTIVE
        ? [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCEL_AT_PERIOD_END]
        : [];
    if (!allowedFrom.includes(this.props.status)) {
      throw new InvalidSubscriptionTransitionException(this.id, this.props.status, target);
    }
  }

  private touch(now: Date): void {
    this.props.updatedAt = now;
  }
}
