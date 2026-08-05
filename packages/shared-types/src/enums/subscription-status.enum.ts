/** M27 — only states with a real, justified product/Paddle-signal behind them. See
 * packages/database/prisma/schema.prisma's SubscriptionStatus doc comment for the full
 * rationale (no trial in this commercial model, checkout-in-progress lives on
 * CheckoutSessionStatus, grace-period/dispute are timestamps not separate statuses). */
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCEL_AT_PERIOD_END = 'CANCEL_AT_PERIOD_END',
  CANCELED = 'CANCELED',
  REFUNDED = 'REFUNDED',
}
