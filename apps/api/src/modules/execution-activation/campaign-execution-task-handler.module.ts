import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { CompaniesModule } from '../companies/companies.module';
import { JobsModule } from '../jobs/jobs.module';
import { ApplicationsModule } from '../applications/applications.module';
import { ApplicationAssemblyModule } from '../application-assembly/application-assembly.module';
import { BusinessPolicyEnforcementModule } from '../business-policy-enforcement/business-policy-enforcement.module';
import { EmailProviderModule } from '../email-provider/email-provider.module';
import { ConnectedMailboxModule } from '../connected-mailbox/connected-mailbox.module';
import { BillingModule } from '../billing/billing.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { DocumentsModule } from '../documents/documents.module';
import { RecruitmentOperationsModule } from '../recruitment-operations/recruitment-operations.module';
import { TASK_EXECUTION_PORT } from '../worker/domain/ports/task-execution.port';
import { CampaignBatchDispatchService } from './application/services/campaign-batch-dispatch.service';
import { CampaignPolicyContextBuilder } from './application/services/campaign-policy-context.builder';
import { CampaignExecutionTaskHandlerService } from './application/services/campaign-execution-task-handler.service';
import { CampaignExecutionCallContextHolder } from './application/services/campaign-execution-call-context';

/**
 * The real TASK_EXECUTION_PORT binding for M26/M27, kept as its own small module so WorkerModule
 * can import it directly without a circular dependency back onto ExecutionActivationModule
 * (which itself imports WorkerModule for WorkerService — see that module's own doc comment).
 *
 * M27: now imports the real BillingModule directly (mounted in AppModule as of this milestone —
 * see billing.module.ts's own doc comment for why the M26-era local SUBSCRIPTION_REPOSITORY
 * rebind is no longer needed) for BillingEntitlementProjectionService, the one centralized
 * entitlement authority CampaignPolicyContextBuilder now depends on.
 *
 * M28/M28.5: `CampaignBatchDispatchService` (the real, live per-target delivery path — found
 * during the M28 audit to be the actual production email-sending code, not
 * `EmailDeliveryExecutionService`) depended on `DeliverabilityModule` for real automatic
 * failover/attachment resolution across the platform's own providers.
 *
 * M28.6: candidate application emails now send from the candidate's own connected Gmail/Outlook
 * mailbox instead (`ConnectedMailboxSendService` — see the M28.6 report's "Non-Negotiable Product
 * Decision"), so this module now imports `ConnectedMailboxModule` in `DeliverabilityModule`'s
 * place — `ConnectedMailboxModule` depends on `DeliverabilityModule` itself internally (for
 * suppression checking) and on `DocumentsModule` (for attachment resolution), so nothing here
 * needs either lower-level module directly anymore. `EmailProviderModule` stays imported for
 * `EmailProviderGatewayService`, still used by `CampaignPolicyContextBuilder`.
 *
 * M30: `RecruitmentOperationsModule` provides `FollowUpEligibilityService` — `
 * CampaignBatchDispatchService.dispatchOneTarget()` now checks it immediately before the real
 * provider send, behind `REPLY_DRIVEN_EXECUTION_ENABLED` (default false — while off, dispatch
 * behaves exactly as it did before this milestone). `CampaignBatchDispatchService` also now
 * injects `ConfigService` directly (to read that same flag) — this module imports `ConfigModule`
 * for the same reason `DocumentsModule`/`EmailProviderModule`/`BillingModule`/
 * `ConnectedMailboxModule`/`DeliverabilityModule` now do (see their doc comments): a provider
 * using `ConfigService` should not silently depend on some OTHER module having registered it
 * globally elsewhere.
 */
@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    CompaniesModule,
    JobsModule,
    ApplicationsModule,
    ApplicationAssemblyModule,
    BusinessPolicyEnforcementModule,
    EmailProviderModule,
    ConnectedMailboxModule,
    BillingModule,
    ExecutionTrackingModule,
    DocumentsModule,
    RecruitmentOperationsModule,
  ],
  providers: [
    CampaignBatchDispatchService,
    CampaignPolicyContextBuilder,
    CampaignExecutionCallContextHolder,
    CampaignExecutionTaskHandlerService,
    { provide: TASK_EXECUTION_PORT, useExisting: CampaignExecutionTaskHandlerService },
  ],
  exports: [CampaignExecutionCallContextHolder, TASK_EXECUTION_PORT],
})
export class CampaignExecutionTaskHandlerModule {}
