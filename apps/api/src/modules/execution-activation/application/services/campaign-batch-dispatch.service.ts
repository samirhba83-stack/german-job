import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { ActorRole, ApplicationChannelType, CampaignReasonCode } from '@german-job-engine/shared-types';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { Company } from '../../../companies/domain/entities/company.entity';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';
import { CampaignReason } from '../../../campaigns/domain/value-objects/campaign-reason.vo';
import { EvidenceReference } from '../../../campaigns/domain/value-objects/evidence-reference.vo';
import { COMPANY_REPOSITORY, CompanyRepository } from '../../../companies/domain/repositories/company.repository.interface';
import { JOB_REPOSITORY, JobRepository } from '../../../jobs/domain/repositories/job.repository.interface';
import { APPLICATION_REPOSITORY, ApplicationRepository } from '../../../applications/domain/repositories/application.repository.interface';
import { CreateApplicationCommand } from '../../../applications/application/commands/create-application/create-application.command';
import { CandidateApplicationAssemblyService } from '../../../application-assembly/application/services/candidate-application-assembly.service';
import { BusinessPolicyEnforcementService } from '../../../business-policy-enforcement/application/services/business-policy-enforcement.service';
import { ConnectedMailboxSendService } from '../../../connected-mailbox/application/services/connected-mailbox-send.service';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';
import { FollowUpEligibilityService } from '../../../recruitment-operations/application/services/follow-up-eligibility.service';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { CampaignPolicyContextBuilder } from './campaign-policy-context.builder';

export interface BatchDispatchSummary {
  readonly batchId: string;
  readonly attempted: number;
  readonly dispatched: number;
  readonly failed: number;
  readonly excluded: number;
}

type DispatchOutcome = 'DISPATCHED' | 'FAILED' | 'EXCLUDED';

/**
 * The real per-target pipeline the M26 execution-orchestrator scaffold's BATCH_EXECUTION step
 * type never had (its `ExecutionTask` carries no target/company/candidate reference — see the
 * M26 architecture audit). One call = one real Campaign.planNextBatch() slice, real Application
 * Assembly, real Business Policy Enforcement, and a real delivery attempt per target — each
 * outcome written back onto the Campaign aggregate via its own existing, guarded
 * dispatchTarget()/recordTargetFailure() methods so Campaign Workspace's read models (already
 * real since M23/M25) reflect genuine progress.
 *
 * M28.6 — candidate application emails now send from the candidate's OWN connected Gmail/Outlook
 * mailbox via `ConnectedMailboxSendService`, never the platform sender (see the M28.6 report's
 * "Non-Negotiable Product Decision"). This replaces the M28/M28.5-era `EmailProviderManagerPort`/
 * `PlatformSenderResolutionService` call here — those remain real, tested, and still the correct
 * path for Billing/platform notifications (`EmailProviderGatewayService`, entirely untouched by
 * this change), just no longer the candidate-application path. If the candidate has no ready
 * connected mailbox, `ConnectedMailboxSendService` returns a blocked/failed response — it never
 * silently falls back to the platform sender (Phase 8/11's own non-negotiable instruction); the
 * existing failure-handling branch below (`recordTargetFailure`) already does the right thing
 * with zero further change, since only *which service produces the response* changed, not the
 * response shape or the surrounding campaign business rules (state transitions, policy
 * enforcement, event recording all untouched — the same "do not modify the Campaign Engine"
 * boundary this file has respected since M28).
 */
@Injectable()
export class CampaignBatchDispatchService {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    @Inject(JOB_REPOSITORY) private readonly jobRepository: JobRepository,
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    private readonly commandBus: CommandBus,
    private readonly applicationAssembly: CandidateApplicationAssemblyService,
    private readonly policyEnforcement: BusinessPolicyEnforcementService,
    private readonly policyContextBuilder: CampaignPolicyContextBuilder,
    private readonly connectedMailboxSend: ConnectedMailboxSendService,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
    private readonly followUpEligibility: FollowUpEligibilityService,
    private readonly emailSecurityAudit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Runs one real batch: campaign.planNextBatch() selects up to the campaign's own configured
   * batch size, bounded by rate limits and execution window (both re-checked here, not
   * reimplemented — planNextBatch enforces them itself and throws a real domain exception if
   * violated, which the caller lets propagate as a task failure rather than swallowing).
   */
  async runNextBatch(campaign: Campaign, actor: Actor, correlationId: CorrelationId, now: Date): Promise<BatchDispatchSummary> {
    const batch = campaign.planNextBatch(actor, correlationId, now);
    const targets = campaign.targets.filter((target) => batch.targetIds.includes(target.id));

    let dispatched = 0;
    let failed = 0;
    let excluded = 0;

    for (const target of targets) {
      const outcome = await this.dispatchOneTarget(campaign, target.id, target.jobId, target.companyId, actor, correlationId, now);
      if (outcome === 'DISPATCHED') dispatched += 1;
      else if (outcome === 'EXCLUDED') excluded += 1;
      else failed += 1;
    }

    return { batchId: batch.id, attempted: targets.length, dispatched, failed, excluded };
  }

  /** `DISPATCHED` on a confirmed successful send; `FAILED` on any handled delivery failure;
   * `EXCLUDED` (M30) when `FollowUpEligibilityService` blocks the send — never throws for a
   * business-level rejection, only an unexpected infrastructure exception propagates. */
  private async dispatchOneTarget(
    campaign: Campaign,
    targetId: string,
    jobId: string,
    companyId: string,
    actor: Actor,
    correlationId: CorrelationId,
    now: Date,
  ): Promise<DispatchOutcome> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      campaign.recordTargetFailure(targetId, `Target company ${companyId} no longer exists.`, actor, correlationId);
      return 'FAILED';
    }

    const applicationId = await this.findOrCreateApplication(campaign, jobId, companyId, company, correlationId.value);

    // M30 Phase 4 — the one real, always-executed eligibility gate. In this codebase's real
    // architecture there is no separately-persisted "queue insertion"/"reservation" stage for a
    // campaign target the way an EmailMessage queue has — planNextBatch() selects and marks a
    // target QUEUED, then this method resolves/creates the real Application and sends, all inside
    // one synchronous call. This check is therefore honestly BOTH "queue insertion" and "final
    // pre-send recheck" collapsed into a single checkpoint every real target passes through
    // unconditionally (documented in docs/recruitment-operations/known-limitations.md).
    if (this.config.get<boolean>('recruitmentOperations.replyDrivenExecutionEnabled', false)) {
      const eligibility = await this.followUpEligibility.checkEligibility(applicationId, campaign.ownerId);
      if (eligibility.status === 'PERMANENTLY_BLOCKED' || eligibility.status === 'TEMPORARILY_BLOCKED' || eligibility.status === 'MANUAL_REVIEW_REQUIRED') {
        campaign.excludeTarget(targetId, CampaignReason.create(CampaignReasonCode.SYSTEM_SIGNAL, eligibility.explanation), actor, correlationId);
        await this.emailSecurityAudit.record({
          eventType: 'FOLLOW_UP_SEND_BLOCKED',
          userId: campaign.ownerId,
          applicationId,
          campaignId: campaign.id,
          detail: `Target ${targetId} excluded before send: ${eligibility.status} — ${eligibility.explanation}`,
        });
        return 'EXCLUDED';
      }
    }

    let pkg;
    try {
      pkg = await this.applicationAssembly.assemble({
        applicationId,
        candidateUserId: campaign.ownerId,
        jobId,
        correlationId: correlationId.value,
      });
    } catch (error) {
      campaign.recordTargetFailure(targetId, error instanceof Error ? error.message : 'Application assembly failed.', actor, correlationId);
      return 'FAILED';
    }

    if (pkg.selectedCv === null) {
      campaign.recordTargetFailure(targetId, 'No CV is available for this candidate — delivery blocked rather than sent incomplete.', actor, correlationId);
      return 'FAILED';
    }

    const policyContext = await this.policyContextBuilder.build({
      executionId: applicationId,
      correlationId: correlationId.value,
      campaign,
      company,
      hasCv: true,
      pkg,
      now,
    });
    const policyDecision = await this.policyEnforcement.evaluate(policyContext);
    if (!policyDecision.allowed) {
      campaign.recordTargetFailure(targetId, policyDecision.decisionReasoning, actor, correlationId);
      return 'FAILED';
    }

    await this.eventRecorder.record({
      eventType: 'EMAIL_DELIVERY_ATTEMPTED',
      campaignId: campaign.id,
      executionId: applicationId,
      correlationId: correlationId.value,
      traceId: targetId,
      summary: `Delivery attempted to ${company.name}`,
      explanation: `Sending application for job ${jobId} to ${company.name}.`,
      status: 'SUCCESS',
      metadata: {},
      businessContext: { ...EMPTY_BUSINESS_CONTEXT, companyId, jobId, userId: campaign.ownerId },
    });

    try {
      const { response } = await this.connectedMailboxSend.sendCandidateApplication({
        requestId: applicationId,
        userId: campaign.ownerId,
        applicationId,
        campaignId: campaign.id,
        recipientEmailAddress: company.contact.contactEmail,
        subject: `Application: ${pkg.candidateIdentity.displayName} — ${pkg.recipientIdentity.companyName}`,
        plainTextBody: pkg.assemblyReasoning,
        htmlBody: null,
        attachments: pkg.attachments.map((attachment) => ({
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          contentReference: attachment.contentReference,
        })),
        correlationId: correlationId.value,
        traceId: targetId,
      });

      if (response.status === 'ACCEPTED') {
        await this.eventRecorder.record({
          eventType: 'EMAIL_DELIVERY_CONFIRMED',
          campaignId: campaign.id,
          executionId: applicationId,
          correlationId: correlationId.value,
          traceId: targetId,
          summary: `Delivery accepted by provider "${response.providerId}"`,
          explanation: response.providerMessage,
          status: 'SUCCESS',
          metadata: { providerId: response.providerId, deliveryStatus: response.status },
          businessContext: { ...EMPTY_BUSINESS_CONTEXT, companyId, jobId, userId: campaign.ownerId, providerId: response.providerId },
        });
        campaign.dispatchTarget(
          targetId,
          actor,
          correlationId,
          EvidenceReference.create({ type: 'EMAIL_PROVIDER', externalId: response.providerMetadata.providerMessageId ?? applicationId, url: null }),
        );
        return 'DISPATCHED';
      }

      // DEFERRED/UNSUPPORTED are provider-reported, non-ambiguous outcomes — record and fail the
      // target now; campaign.retryFailedTargets() (existing, real) is the reuse path for
      // reattempting a DEFERRED (retryable) one later, rather than a second parallel scheduler.
      await this.eventRecorder.record({
        eventType: 'EMAIL_DELIVERY_FAILED',
        campaignId: campaign.id,
        executionId: applicationId,
        correlationId: correlationId.value,
        traceId: targetId,
        summary: `Delivery not accepted (${response.status})`,
        explanation: response.providerMessage,
        status: 'FAILURE',
        metadata: { providerId: response.providerId, deliveryStatus: response.status, retryable: String(response.failure?.retryable ?? false) },
        businessContext: { ...EMPTY_BUSINESS_CONTEXT, companyId, jobId, userId: campaign.ownerId, providerId: response.providerId },
      });
      campaign.recordTargetFailure(targetId, response.providerMessage, actor, correlationId);
      return 'FAILED';
    } catch (error) {
      // An exception from provider.send() (network/timeout/infrastructure) is genuinely
      // indeterminate — the provider may or may not have received the request. Recorded
      // distinctly (DELIVERY_RESULT_UNKNOWN) and treated as a failed attempt, never as silent
      // success and never immediately retried within this same tick.
      const message = error instanceof Error ? error.message : 'Unknown delivery error.';
      await this.eventRecorder.record({
        eventType: 'DELIVERY_RESULT_UNKNOWN',
        campaignId: campaign.id,
        executionId: applicationId,
        correlationId: correlationId.value,
        traceId: targetId,
        summary: 'Delivery outcome could not be determined',
        explanation: message,
        status: 'FAILURE',
        metadata: {},
        businessContext: { ...EMPTY_BUSINESS_CONTEXT, companyId, jobId, userId: campaign.ownerId },
      });
      campaign.recordTargetFailure(targetId, `Delivery outcome unknown: ${message}`, actor, correlationId);
      return 'FAILED';
    }
  }

  /** Find-or-create, never a bare create — a retried batch execution (this task re-selected
   * after a crash, or a target retried via campaign.retryFailedTargets()) must reuse the same
   * real Application row rather than accumulating duplicates for the same candidate+job. The
   * snapshot fields are real Job/Company data (never placeholders) — ApplicationSnapshot exists
   * precisely to freeze this real state at submission time (see its own doc comment). */
  private async findOrCreateApplication(campaign: Campaign, jobId: string, companyId: string, company: Company, correlationId: string): Promise<string> {
    const existing = await this.applicationRepository.findByCandidateId(campaign.ownerId);
    const match = existing.find((application) => application.jobId === jobId);
    if (match) {
      return match.id;
    }

    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} referenced by campaign target no longer exists.`);
    }

    try {
      const created = await this.commandBus.execute(
        new CreateApplicationCommand(
          campaign.ownerId,
          jobId,
          companyId,
          { jobTitle: job.title.value, companyName: company.name, jobLocation: `${job.workLocation.city}, ${job.workLocation.country}` },
          ActorRole.AUTOMATION,
          null,
          ApplicationChannelType.CAMPAIGN,
          campaign.id,
          correlationId,
        ),
      );
      return created.id;
    } catch (error) {
      if (error instanceof ConflictException) {
        // Lost a race with another concurrent attempt for the same candidate+job — look it up
        // rather than fail the whole target.
        const afterConflict = await this.applicationRepository.findByCandidateId(campaign.ownerId);
        const found = afterConflict.find((application) => application.jobId === jobId);
        if (found) {
          return found.id;
        }
      }
      throw error;
    }
  }
}
