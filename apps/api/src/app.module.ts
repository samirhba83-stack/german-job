import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { configurations } from './config/configuration';
import { AppThrottlerGuard } from './common/guards/throttler.guard';
import { PrismaModule } from './shared/infrastructure/database/prisma.module';
import { ObservabilityModule } from './shared/infrastructure/observability/observability.module';
import { EnvironmentModule } from './shared/infrastructure/environment/environment.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { ExecutionActivationModule } from './modules/execution-activation/execution-activation.module';
import { BillingModule } from './modules/billing/billing.module';
import { RecruitmentOperationsModule } from './modules/recruitment-operations/recruitment-operations.module';
import { InboxIntelligenceModule } from './modules/inbox-intelligence/inbox-intelligence.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';

/**
 * BillingModule (M27) is mounted here for the first time — the M26-era Stripe stub is gone
 * entirely, replaced by a real, Paddle-backed billing platform (checkout, webhooks, ledger,
 * entitlements, refunds, cancellation). Real charges still require explicit production
 * activation regardless of this import — see billing.config.ts's own doc comment and the M27
 * engineering report's Production Safety Gates: PADDLE_ENVIRONMENT defaults to "sandbox" and
 * BILLING_PRODUCTION_PAYMENTS_ENABLED defaults to false, so mounting this module does not, by
 * itself, make any real payment possible.
 *
 * ExecutionActivationModule (M26) is the first import from the scheduler/dispatcher/
 * recommendations/decision-intelligence/execution-planning/execution-orchestrator/
 * execution-runtime/worker/application-assembly/business-policy-enforcement/provider-selection/
 * email-provider/email-delivery/execution-tracking family — see that module's own doc comment.
 */

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    ObservabilityModule,
    EnvironmentModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ProfilesModule,
    CompaniesModule,
    JobsModule,
    ApplicationsModule,
    CampaignsModule,
    ExecutionActivationModule,
    BillingModule,
    RecruitmentOperationsModule,
    InboxIntelligenceModule,
    OnboardingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
