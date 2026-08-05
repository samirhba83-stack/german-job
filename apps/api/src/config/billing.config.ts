import { registerAs } from '@nestjs/config';
import { PlanCode } from '@german-job-engine/shared-types';

export type PaddleEnvironment = 'sandbox' | 'production';

function resolvePaddleEnvironment(): PaddleEnvironment {
  return process.env.PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
}

/**
 * M27 — Paddle configuration. `productionPaymentsEnabled` is the master kill switch the
 * milestone's own Production Safety Gates require: real charges never happen unless this is
 * explicitly true AND `environment === 'production'` AND every required credential is present —
 * fails closed (see PaddleConfigGuard) rather than defaulting to permissive. `priceIds` maps
 * internal PlanCodes to Paddle's own price identity — deployment configuration, never domain
 * truth (see plan-catalogue.ts's own doc comment). A missing price id for a paid plan means
 * checkout for that plan is unavailable, not silently broken with a wrong id.
 */
export default registerAs('billing', () => ({
  environment: resolvePaddleEnvironment(),
  productionPaymentsEnabled: (process.env.BILLING_PRODUCTION_PAYMENTS_ENABLED ?? 'false').toLowerCase() === 'true',
  apiKey: process.env.PADDLE_API_KEY ?? '',
  webhookSecret: process.env.PADDLE_WEBHOOK_SECRET ?? '',
  checkoutSuccessUrl: process.env.PADDLE_CHECKOUT_SUCCESS_URL ?? '',
  checkoutCancelUrl: process.env.PADDLE_CHECKOUT_CANCEL_URL ?? '',
  priceIds: {
    [PlanCode.PROFESSIONAL]: process.env.PADDLE_PRICE_ID_PROFESSIONAL ?? '',
    [PlanCode.PREMIUM]: process.env.PADDLE_PRICE_ID_PREMIUM ?? '',
    [PlanCode.ENTERPRISE]: process.env.PADDLE_PRICE_ID_ENTERPRISE ?? '',
  } as Record<string, string>,
  webhookToleranceSeconds: parseInt(process.env.PADDLE_WEBHOOK_TOLERANCE_SECONDS ?? '300', 10),
  checkoutExpiryMinutes: parseInt(process.env.BILLING_CHECKOUT_EXPIRY_MINUTES ?? '30', 10),
  refundWindowDays: parseInt(process.env.BILLING_REFUND_WINDOW_DAYS ?? '7', 10),
}));
