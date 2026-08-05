import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * M27 Production Safety Gate — the one real guard behind "real charges must stay disabled absent
 * full operator configuration + explicit human approval." Real charges never happen unless
 * `environment` is explicitly "production" AND the operator has explicitly flipped
 * `BILLING_PRODUCTION_PAYMENTS_ENABLED`; sandbox (the default, and the only mode this milestone
 * activates) is never blocked.
 *
 * Shared by every application service that can cause Paddle to move real money immediately:
 * `CheckoutService.startCheckout` (a new transaction) and `PlanChangeService.changePlan` (Paddle
 * bills the proration immediately — `proration_billing_mode: 'prorated_immediately'`). Originally
 * lived as a private method on `CheckoutService` alone; extracted after finding `changePlan` had
 * no equivalent check at all — a genuine gap in the same production-safety property the milestone
 * treats as non-negotiable, even though it has zero effect on the current deployment (no `.env`
 * here sets `PADDLE_ENVIRONMENT=production`). `CancellationService` and `RefundService`
 * deliberately do NOT call this: cancellation stops future charges rather than creating one, and a
 * refund returns money rather than taking it — neither is the kind of "real charge" this gate
 * exists to block.
 */
@Injectable()
export class BillingProductionSafetyService {
  constructor(private readonly config: ConfigService) {}

  assertRealChargesAllowed(): void {
    const environment = this.config.get<string>('billing.environment');
    const productionEnabled = this.config.get<boolean>('billing.productionPaymentsEnabled');
    if (environment === 'production' && !productionEnabled) {
      throw new ServiceUnavailableException(
        'Production payments are not enabled. Set BILLING_PRODUCTION_PAYMENTS_ENABLED=true only after completing the production activation checklist.',
      );
    }
  }
}
