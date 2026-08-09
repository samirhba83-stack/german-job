import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ValidationRule {
  /** Human-readable name of the check, shown in the error report. */
  readonly name: string;
  /** Returns a non-empty error string if this rule fails, or `null` if it passes. */
  readonly check: (config: ConfigService) => string | null;
}

/**
 * M31 Phase 7 — real, fail-closed startup validation (Phase 1 audit finding: no env-var
 * validation existed anywhere; every secret was read via `process.env.X` with `undefined` as the
 * silent fallback, so the app booted successfully either way and only failed later, at first real
 * use, often with a confusing downstream error). Called once, synchronously, in `main.ts`'s
 * `bootstrap()` — BEFORE `app.listen()` — so a misconfigured deployment never starts accepting
 * traffic at all (Non-Negotiable Principle #19: "fail closed").
 *
 * Two tiers of rules:
 * 1. Unconditional — required in every environment, including local development (the database
 *    connection string and the JWT signing secrets are not optional in any environment this
 *    application can meaningfully run in).
 * 2. Conditional-on-a-production-flag — checked only when the corresponding real-external-side-
 *    effect flag is `true` (matching this codebase's own established "one flag per real
 *    capability" discipline). An operator flipping `EMAIL_PRODUCTION_SENDING_ENABLED=true` without
 *    a real provider credential configured is exactly the class of misconfiguration this exists to
 *    catch at boot, not at the first real send attempt.
 *
 * Deliberately does NOT attempt to validate every optional/feature-specific config value in this
 * codebase — most of them already have their own real "fails closed at point of use" discipline
 * (e.g. `DomainReadinessService` reporting `UNCONFIGURED`, the token vault refusing to
 * encrypt/decrypt without a key) which this service does not need to duplicate. This covers the
 * secrets whose absence would otherwise only surface as a confusing runtime error deep inside a
 * request, not the ones a feature's own domain logic already handles gracefully.
 */
@Injectable()
export class EnvironmentValidationService {
  private readonly logger = new Logger(EnvironmentValidationService.name);

  private readonly rules: ValidationRule[] = [
    {
      name: 'APP_ENVIRONMENT is a recognized value',
      check: (config) => {
        const env = config.get<string>('app.environment');
        return ['development', 'staging', 'production'].includes(env ?? '') ? null : `APP_ENVIRONMENT must be one of development|staging|production (got "${env}").`;
      },
    },
    {
      name: 'DATABASE_URL is set',
      check: (config) => (config.get<string>('database.url') ? null : 'DATABASE_URL is required in every environment.'),
    },
    {
      name: 'JWT_ACCESS_SECRET is set',
      check: (config) => (config.get<string>('jwt.accessSecret') ? null : 'JWT_ACCESS_SECRET is required in every environment.'),
    },
    {
      name: 'JWT_REFRESH_SECRET is set',
      check: (config) => (config.get<string>('jwt.refreshSecret') ? null : 'JWT_REFRESH_SECRET is required in every environment.'),
    },
    {
      name: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are not the same value',
      check: (config) => {
        const access = config.get<string>('jwt.accessSecret');
        const refresh = config.get<string>('jwt.refreshSecret');
        return access && refresh && access === refresh ? 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values — a compromised access token must never also be usable to mint a refresh token.' : null;
      },
    },
    {
      name: 'MAILBOX_TOKEN_ENCRYPTION_KEY is set if connected-mailbox production sending is enabled',
      check: (config) => (config.get<boolean>('connectedMailbox.productionSendingEnabled') && !config.get<string>('connectedMailbox.tokenEncryption.key') ? 'CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED=true requires MAILBOX_TOKEN_ENCRYPTION_KEY to be set — OAuth tokens can never be stored unencrypted.' : null),
    },
    {
      name: 'A real email provider is configured if production email sending is enabled',
      check: (config) => {
        if (!config.get<boolean>('emailInfrastructure.productionSendingEnabled')) return null;
        const primary = config.get<string>('emailInfrastructure.primaryProvider');
        const hasCredential: Record<string, boolean> = {
          resend: Boolean(config.get<string>('emailInfrastructure.resend.apiKey')),
          ses: Boolean(config.get<string>('emailInfrastructure.ses.accessKeyId')),
          sendgrid: Boolean(config.get<string>('emailInfrastructure.sendgrid.apiKey')),
          smtp: Boolean(config.get<string>('emailInfrastructure.smtp.host')),
        };
        if (primary === 'null' || primary === undefined) return 'EMAIL_PRODUCTION_SENDING_ENABLED=true but EMAIL_PRIMARY_PROVIDER is unset/"null" — no real provider would ever be used.';
        return hasCredential[primary] ? null : `EMAIL_PRODUCTION_SENDING_ENABLED=true and EMAIL_PRIMARY_PROVIDER=${primary}, but that provider's required credential is not configured.`;
      },
    },
    {
      name: 'Paddle credentials are set if production payments are enabled',
      check: (config) => {
        if (!config.get<boolean>('billing.productionPaymentsEnabled')) return null;
        if (!config.get<string>('billing.apiKey')) return 'BILLING_PRODUCTION_PAYMENTS_ENABLED=true requires PADDLE_API_KEY to be set.';
        if (!config.get<string>('billing.webhookSecret')) return 'BILLING_PRODUCTION_PAYMENTS_ENABLED=true requires PADDLE_WEBHOOK_SECRET to be set.';
        if (config.get<string>('billing.environment') !== 'production') return 'BILLING_PRODUCTION_PAYMENTS_ENABLED=true requires PADDLE_ENVIRONMENT=production — real payments must never run against Paddle sandbox.';
        return null;
      },
    },
  ];

  /** Returns every failing rule's message — empty array means the environment is valid. Exposed
   * separately from `validateOrThrow()` so `/ready` (Phase 16) can reuse this same real check
   * cheaply (no I/O — everything here reads already-loaded, in-memory config) without needing to
   * crash the process on a post-boot config regression. */
  validate(config: ConfigService): string[] {
    return this.rules.map((rule) => rule.check(config)).filter((result): result is string => result !== null);
  }

  /** Called once, synchronously, before `app.listen()`. Logs every failure clearly, then exits the
   * process with a non-zero code — a real boot refusal, not a warning a real deployment could miss
   * in a scrolling log. */
  validateOrThrow(config: ConfigService): void {
    const failures = this.validate(config);
    if (failures.length === 0) {
      this.logger.log(`Environment validation passed (${this.rules.length} checks).`);
      return;
    }

    this.logger.error(`Environment validation FAILED — refusing to start. ${failures.length} problem(s):`);
    for (const failure of failures) {
      this.logger.error(`  - ${failure}`);
    }
    process.exit(1);
  }
}
