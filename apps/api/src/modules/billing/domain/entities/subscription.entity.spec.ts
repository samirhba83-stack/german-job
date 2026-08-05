import { PlanCode, SubscriptionStatus } from '@german-job-engine/shared-types';
import { Subscription } from './subscription.entity';
import { InvalidSubscriptionTransitionException } from '../exceptions/invalid-subscription-transition.exception';

const NOW = new Date('2026-07-30T00:00:00.000Z');
const PERIOD_START = new Date('2026-07-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-08-01T00:00:00.000Z');

function activate(overrides: Partial<Parameters<typeof Subscription.activate>[1]> = {}): Subscription {
  return Subscription.activate('sub_1', {
    userId: 'user_1',
    planCode: PlanCode.PROFESSIONAL,
    paddleSubscriptionId: 'paddle_sub_1',
    paddleCustomerId: 'paddle_cust_1',
    currentPeriodStart: PERIOD_START,
    currentPeriodEnd: PERIOD_END,
    now: NOW,
    ...overrides,
  });
}

describe('Subscription (domain entity, state machine)', () => {
  it('activates as ACTIVE with cancelAtPeriodEnd=false and no terminal timestamps set', () => {
    const sub = activate();
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(sub.cancelAtPeriodEnd).toBe(false);
    expect(sub.canceledAt).toBeNull();
    expect(sub.refundedAt).toBeNull();
    expect(sub.isActive).toBe(true);
    expect(sub.isTerminal).toBe(false);
  });

  describe('markPastDue — regression test for the requireTransition(PAST_DUE) bug', () => {
    it('transitions ACTIVE -> PAST_DUE and records pastDueSince/gracePeriodEndsAt', () => {
      const sub = activate();
      const graceEnd = new Date('2026-08-07T00:00:00.000Z');
      sub.markPastDue(graceEnd, NOW);
      expect(sub.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(sub.gracePeriodEndsAt).toEqual(graceEnd);
      expect(sub.pastDueSince).toEqual(NOW);
      // PAST_DUE is deliberately not "isActive" (execution permission is a separate policy).
      expect(sub.isActive).toBe(false);
    });

    it('rejects PAST_DUE from CANCEL_AT_PERIOD_END (not silently, not for every status)', () => {
      const sub = activate();
      sub.scheduleCancellationAtPeriodEnd(null, NOW);
      expect(() => sub.markPastDue(new Date(), NOW)).toThrow(InvalidSubscriptionTransitionException);
    });

    it('rejects a second markPastDue once already PAST_DUE (not re-enterable)', () => {
      const sub = activate();
      sub.markPastDue(new Date('2026-08-07T00:00:00.000Z'), NOW);
      expect(() => sub.markPastDue(new Date(), NOW)).toThrow(InvalidSubscriptionTransitionException);
    });

    it('rejects markPastDue on a terminal (CANCELED) subscription', () => {
      const sub = activate();
      sub.cancelImmediately('TEST', NOW);
      expect(() => sub.markPastDue(new Date(), NOW)).toThrow(InvalidSubscriptionTransitionException);
    });
  });

  describe('renew', () => {
    it('extends the period and stays ACTIVE from ACTIVE', () => {
      const sub = activate();
      const newEnd = new Date('2026-09-01T00:00:00.000Z');
      sub.renew(PERIOD_END, newEnd, NOW);
      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub.currentPeriodEnd).toEqual(newEnd);
    });

    it('recovers PAST_DUE -> ACTIVE and clears pastDueSince/gracePeriodEndsAt (a successful renewal charge is proof of recovery)', () => {
      const sub = activate();
      sub.markPastDue(new Date('2026-08-07T00:00:00.000Z'), NOW);
      const newEnd = new Date('2026-09-01T00:00:00.000Z');
      sub.renew(PERIOD_END, newEnd, NOW);
      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub.pastDueSince).toBeNull();
      expect(sub.gracePeriodEndsAt).toBeNull();
    });

    it('rejects renewing a terminal subscription', () => {
      const sub = activate();
      sub.refund(NOW);
      expect(() => sub.renew(PERIOD_END, PERIOD_END, NOW)).toThrow(InvalidSubscriptionTransitionException);
    });
  });

  describe('expireFromPastDue — grace period elapsed with no recovery', () => {
    it('transitions PAST_DUE -> CANCELED with the grace-period-expired reason', () => {
      const sub = activate();
      sub.markPastDue(new Date('2026-08-07T00:00:00.000Z'), NOW);
      sub.expireFromPastDue(NOW);
      expect(sub.status).toBe(SubscriptionStatus.CANCELED);
      expect(sub.cancellationReason).toBe('PAYMENT_RECOVERY_GRACE_PERIOD_EXPIRED');
      expect(sub.isTerminal).toBe(true);
    });

    it('rejects expiring from anywhere other than PAST_DUE', () => {
      const sub = activate();
      expect(() => sub.expireFromPastDue(NOW)).toThrow(InvalidSubscriptionTransitionException);
    });
  });

  describe('cancellation — always at period end for a user-initiated request, never immediate', () => {
    it('schedules cancellation from ACTIVE and keeps status queryable via cancelAtPeriodEnd', () => {
      const sub = activate();
      sub.scheduleCancellationAtPeriodEnd('CANDIDATE_REQUEST', NOW);
      expect(sub.status).toBe(SubscriptionStatus.CANCEL_AT_PERIOD_END);
      expect(sub.cancelAtPeriodEnd).toBe(true);
      expect(sub.cancellationReason).toBe('CANDIDATE_REQUEST');
      // Still not terminal — access continues until the real Paddle webhook confirms period end.
      expect(sub.isTerminal).toBe(false);
    });

    it('also allows scheduling cancellation from PAST_DUE', () => {
      const sub = activate();
      sub.markPastDue(new Date('2026-08-07T00:00:00.000Z'), NOW);
      expect(() => sub.scheduleCancellationAtPeriodEnd(null, NOW)).not.toThrow();
      expect(sub.status).toBe(SubscriptionStatus.CANCEL_AT_PERIOD_END);
    });

    it('rejects scheduling cancellation twice', () => {
      const sub = activate();
      sub.scheduleCancellationAtPeriodEnd(null, NOW);
      expect(() => sub.scheduleCancellationAtPeriodEnd(null, NOW)).toThrow(InvalidSubscriptionTransitionException);
    });

    it('resumeFromScheduledCancellation undoes it and clears cancelAtPeriodEnd/reason', () => {
      const sub = activate();
      sub.scheduleCancellationAtPeriodEnd('CANDIDATE_REQUEST', NOW);
      sub.resumeFromScheduledCancellation(NOW);
      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub.cancelAtPeriodEnd).toBe(false);
      expect(sub.cancellationReason).toBeNull();
    });

    it('expireAtPeriodEnd only fires from CANCEL_AT_PERIOD_END, confirmed by a real webhook, never a client-side date check', () => {
      const sub = activate();
      expect(() => sub.expireAtPeriodEnd(NOW)).toThrow(InvalidSubscriptionTransitionException);
      sub.scheduleCancellationAtPeriodEnd(null, NOW);
      sub.expireAtPeriodEnd(NOW);
      expect(sub.status).toBe(SubscriptionStatus.CANCELED);
      expect(sub.isTerminal).toBe(true);
    });
  });

  describe('cancelImmediately', () => {
    it('cancels from any non-terminal status', () => {
      const sub = activate();
      sub.cancelImmediately('PADDLE_WEBHOOK', NOW);
      expect(sub.status).toBe(SubscriptionStatus.CANCELED);
      expect(sub.cancellationReason).toBe('PADDLE_WEBHOOK');
    });

    it('rejects cancelling an already-terminal subscription', () => {
      const sub = activate();
      sub.cancelImmediately('FIRST', NOW);
      expect(() => sub.cancelImmediately('SECOND', NOW)).toThrow(InvalidSubscriptionTransitionException);
    });
  });

  describe('refund — admin-approved, revokes entitlement immediately (distinct from cancellation)', () => {
    it('refunds from ACTIVE', () => {
      const sub = activate();
      sub.refund(NOW);
      expect(sub.status).toBe(SubscriptionStatus.REFUNDED);
      expect(sub.refundedAt).toEqual(NOW);
      expect(sub.isTerminal).toBe(true);
    });

    it('refunds from PAST_DUE', () => {
      const sub = activate();
      sub.markPastDue(new Date('2026-08-07T00:00:00.000Z'), NOW);
      expect(() => sub.refund(NOW)).not.toThrow();
      expect(sub.status).toBe(SubscriptionStatus.REFUNDED);
    });

    it('rejects refunding a CANCEL_AT_PERIOD_END or already-terminal subscription', () => {
      const scheduled = activate();
      scheduled.scheduleCancellationAtPeriodEnd(null, NOW);
      expect(() => scheduled.refund(NOW)).toThrow(InvalidSubscriptionTransitionException);

      const alreadyRefunded = activate();
      alreadyRefunded.refund(NOW);
      expect(() => alreadyRefunded.refund(NOW)).toThrow(InvalidSubscriptionTransitionException);
    });
  });

  describe('markDisputed — chargeback, modeled separately from a voluntary refund', () => {
    it('marks disputedAt and moves a non-terminal subscription to CANCELED with the chargeback reason', () => {
      const sub = activate();
      sub.markDisputed(NOW);
      expect(sub.disputedAt).toEqual(NOW);
      expect(sub.status).toBe(SubscriptionStatus.CANCELED);
      expect(sub.cancellationReason).toBe('CHARGEBACK_DISPUTE');
    });

    it('still records disputedAt on an already-terminal subscription without changing its status', () => {
      const sub = activate();
      sub.refund(NOW);
      sub.markDisputed(NOW);
      expect(sub.disputedAt).toEqual(NOW);
      expect(sub.status).toBe(SubscriptionStatus.REFUNDED);
    });
  });

  describe('changePlan — Paddle-confirmed upgrade/downgrade only', () => {
    it('changes plan and period end while ACTIVE', () => {
      const sub = activate();
      const newEnd = new Date('2026-08-15T00:00:00.000Z');
      sub.changePlan(PlanCode.PREMIUM, newEnd, NOW);
      expect(sub.planCode).toBe(PlanCode.PREMIUM);
      expect(sub.currentPeriodEnd).toEqual(newEnd);
    });

    it('rejects changing plan on a terminal subscription', () => {
      const sub = activate();
      sub.cancelImmediately('TEST', NOW);
      expect(() => sub.changePlan(PlanCode.PREMIUM, PERIOD_END, NOW)).toThrow(InvalidSubscriptionTransitionException);
    });

    // The entity's own guard (`requireTransition(ACTIVE)`) permits PAST_DUE and
    // CANCEL_AT_PERIOD_END too — it's shared with `resumeFromScheduledCancellation`, which
    // legitimately needs both as real sources. The stricter real business rule ("no plan change
    // while not in good standing") is enforced one layer up, in `PlanChangeService`'s own
    // `if (!subscription.isActive) throw ConflictException` check, before this method is ever
    // called — `PlanChangeService` is the only real caller. Documented here so the entity's
    // actual permissiveness is never mistaken for an enforced invariant by a future caller.
    it('the entity itself does NOT block changePlan from PAST_DUE — PlanChangeService is the real enforcement point', () => {
      const sub = activate();
      sub.markPastDue(new Date('2026-08-07T00:00:00.000Z'), NOW);
      expect(() => sub.changePlan(PlanCode.PREMIUM, PERIOD_END, NOW)).not.toThrow();
    });
  });
});
