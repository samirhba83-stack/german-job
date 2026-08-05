import { Module } from '@nestjs/common';
import { DeliverabilityModule } from '../deliverability/deliverability.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { EmailDeliveryExecutionService } from './application/services/email-delivery-execution.service';
import { EMAIL_DELIVERY_EXECUTION_PORT } from './domain/ports/email-delivery-execution.port';

/**
 * Email Delivery Execution (M12, rewired M13, DI seam owned by this module as of M24.5, upgraded
 * to the real Provider Manager M28). Not imported into AppModule directly — same rule as every
 * Phase 4 module before it. WorkerModule imports this module and binds its own
 * TASK_EXECUTION_PORT to EMAIL_DELIVERY_EXECUTION_PORT (not the concrete class), closing the
 * chain:
 *
 *   Worker -> EmailDeliveryExecutionService -> EmailProviderManager -> ProviderSelectionEngine -> EmailProviderPort
 *
 * Real external delivery is possible as of M28 (Resend/SES/SendGrid/SMTP adapters exist) but
 * still requires real credentials to be configured for at least one provider — every adapter's
 * own `isAvailable()` reports `false` otherwise, so an unconfigured environment behaves exactly
 * as safely as it always has (falls through to `NullEmailProvider`).
 */
@Module({
  imports: [DeliverabilityModule, ExecutionTrackingModule],
  providers: [
    EmailDeliveryExecutionService,
    { provide: EMAIL_DELIVERY_EXECUTION_PORT, useExisting: EmailDeliveryExecutionService },
  ],
  exports: [EmailDeliveryExecutionService, EMAIL_DELIVERY_EXECUTION_PORT],
})
export class EmailDeliveryModule {}
