import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExecutionModule } from '../execution/execution.module';
import { EmailProviderGatewayService } from './application/services/email-provider-gateway.service';
import { EmailProviderPort, EMAIL_PROVIDER } from './domain/ports/email-provider.port';
import { NullEmailProvider } from './infrastructure/adapters/null-email-provider.adapter';
import { ResendEmailProviderAdapter } from './infrastructure/adapters/resend-email-provider.adapter';
import { SesEmailProviderAdapter } from './infrastructure/adapters/ses-email-provider.adapter';
import { SendGridEmailProviderAdapter } from './infrastructure/adapters/sendgrid-email-provider.adapter';
import { SmtpEmailProviderAdapter } from './infrastructure/adapters/smtp-email-provider.adapter';

/**
 * Email Provider Abstraction — real as of M28. `NullEmailProvider` (M11) remains the honest
 * "nothing configured" fallback; four real adapters (Resend/SES/SendGrid/SMTP, M28) now exist
 * alongside it. Each adapter's own `isAvailable()` reports `false` until its required credentials
 * are actually configured, so simply registering all five here — always, unconditionally — is
 * itself safe: an adapter with no API key never becomes eligible for anything.
 *
 * `EMAIL_PROVIDER` (singular) now resolves to whichever real adapter `EMAIL_PRIMARY_PROVIDER`
 * names (default: `null`, i.e. `NullEmailProvider`) — this is the simple, single-provider facade
 * `EmailProviderGatewayService` (and, through it, Billing's notification service) has always used,
 * unchanged in shape; it does not gain automatic multi-provider failover, by design (M28 Provider
 * Manager, `EmailProviderManagerService` in the new `deliverability` module, is the real
 * failover-aware path — used by the Worker's real production execution flow via
 * `EmailDeliveryExecutionService`, not by this simpler facade). Deliberately no dependency on
 * `provider-selection` or `deliverability` here, to keep this module's own dependency direction
 * one-way (`provider-selection`/`deliverability` depend on `email-provider`, never the reverse).
 *
 * M30 fix — every adapter here injects `ConfigService` directly (real API keys/credentials), but
 * this module never imported `ConfigModule` itself, silently relying on `AppModule`'s
 * `ConfigModule.forRoot({ isGlobal: true })`. That's invisible in the real app (global modules are
 * available everywhere) but breaks the moment this module is compiled inside a narrower,
 * hand-assembled testing module that doesn't register `ConfigModule` at all — exactly what
 * `test/execution-pipeline.e2e-spec.ts`'s partial `[PrismaModule, ExecutionOrchestratorModule,
 * ExecutionRuntimeModule, WorkerModule, ExecutionTrackingModule]` graph does. Found while running
 * the full e2e suite as part of M30's own verification (pre-existing since M28, not introduced by
 * M30) — fixed the same way as the identical gap in `DocumentsModule`: import `ConfigModule`
 * explicitly so this module is self-contained regardless of what else is compiled alongside it.
 */
@Module({
  imports: [ExecutionModule, ConfigModule],
  providers: [
    EmailProviderGatewayService,
    NullEmailProvider,
    ResendEmailProviderAdapter,
    SesEmailProviderAdapter,
    SendGridEmailProviderAdapter,
    SmtpEmailProviderAdapter,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (
        config: ConfigService,
        nullProvider: NullEmailProvider,
        resend: ResendEmailProviderAdapter,
        ses: SesEmailProviderAdapter,
        sendgrid: SendGridEmailProviderAdapter,
        smtp: SmtpEmailProviderAdapter,
      ): EmailProviderPort => {
        const primary = config.get<string>('emailInfrastructure.primaryProvider', 'null');
        const byId: Record<string, EmailProviderPort> = { resend, ses, sendgrid, smtp, null: nullProvider };
        return byId[primary] ?? nullProvider;
      },
      inject: [ConfigService, NullEmailProvider, ResendEmailProviderAdapter, SesEmailProviderAdapter, SendGridEmailProviderAdapter, SmtpEmailProviderAdapter],
    },
  ],
  exports: [
    EmailProviderGatewayService,
    EMAIL_PROVIDER,
    NullEmailProvider,
    ResendEmailProviderAdapter,
    SesEmailProviderAdapter,
    SendGridEmailProviderAdapter,
    SmtpEmailProviderAdapter,
  ],
})
export class EmailProviderModule {}
