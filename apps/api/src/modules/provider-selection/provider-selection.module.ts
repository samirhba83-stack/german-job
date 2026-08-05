import { Module } from '@nestjs/common';
import { EmailProviderModule } from '../email-provider/email-provider.module';
import { ExecutionModule } from '../execution/execution.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { EmailProviderPort } from '../email-provider/domain/ports/email-provider.port';
import { NullEmailProvider } from '../email-provider/infrastructure/adapters/null-email-provider.adapter';
import { ResendEmailProviderAdapter } from '../email-provider/infrastructure/adapters/resend-email-provider.adapter';
import { SesEmailProviderAdapter } from '../email-provider/infrastructure/adapters/ses-email-provider.adapter';
import { SendGridEmailProviderAdapter } from '../email-provider/infrastructure/adapters/sendgrid-email-provider.adapter';
import { SmtpEmailProviderAdapter } from '../email-provider/infrastructure/adapters/smtp-email-provider.adapter';
import { ProviderSelectionEngineService } from './application/services/provider-selection-engine.service';
import { EMAIL_PROVIDERS } from './domain/ports/email-provider-registry.token';
import { PROVIDER_SELECTION_STRATEGY } from './domain/ports/provider-selection-strategy.port';
import { PROVIDER_SELECTION_CONFIG, DEFAULT_PROVIDER_SELECTION_CONFIG } from './domain/provider-selection-config';
import { DeterministicProviderSelectionStrategy } from './domain/strategies/deterministic-provider-selection.strategy';
import { PROVIDER_SELECTION_ENGINE_PORT } from './domain/ports/provider-selection-engine.port';

/**
 * Provider Selection Engine (M13, activated for real M28). Not imported into AppModule directly
 * — `DeliverabilityModule` (M28) and `EmailDeliveryModule` (M12/M13) both import this module and
 * consult it, closing the real chain: Email Delivery Execution Service -> Provider Manager ->
 * Provider Selection Engine -> selected `EmailProviderPort`.
 *
 * `EMAIL_PROVIDERS` is the registry the engine evaluates — as of M28, all 5 real adapters
 * (`NullEmailProvider` plus Resend/SES/SendGrid/SMTP) are always registered, unconditionally; each
 * adapter's own `isAvailable()` is what actually determines eligibility (an unconfigured adapter
 * reports itself unavailable and is never selected), so registering all five here regardless of
 * configuration is itself safe — exactly the self-reporting mechanism `ProviderCapabilities`/
 * `isAvailable()` were designed for.
 */
@Module({
  imports: [EmailProviderModule, ExecutionModule, ExecutionTrackingModule],
  providers: [
    ProviderSelectionEngineService,
    { provide: PROVIDER_SELECTION_CONFIG, useValue: DEFAULT_PROVIDER_SELECTION_CONFIG },
    { provide: PROVIDER_SELECTION_STRATEGY, useClass: DeterministicProviderSelectionStrategy },
    {
      provide: EMAIL_PROVIDERS,
      useFactory: (
        nullProvider: NullEmailProvider,
        resend: ResendEmailProviderAdapter,
        ses: SesEmailProviderAdapter,
        sendgrid: SendGridEmailProviderAdapter,
        smtp: SmtpEmailProviderAdapter,
      ): EmailProviderPort[] => [resend, ses, sendgrid, smtp, nullProvider],
      inject: [NullEmailProvider, ResendEmailProviderAdapter, SesEmailProviderAdapter, SendGridEmailProviderAdapter, SmtpEmailProviderAdapter],
    },
    { provide: PROVIDER_SELECTION_ENGINE_PORT, useExisting: ProviderSelectionEngineService },
  ],
  exports: [ProviderSelectionEngineService, PROVIDER_SELECTION_ENGINE_PORT, EMAIL_PROVIDERS],
})
export class ProviderSelectionModule {}
