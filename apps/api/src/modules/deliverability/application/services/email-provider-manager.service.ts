import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { EmailDeliveryRequest } from '../../../email-provider/domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../../email-provider/domain/models/email-delivery-response';
import { ResolvedEmailAttachment } from '../../../email-provider/domain/models/resolved-email-attachment';
import { ProviderFailureCategory } from '../../../email-provider/domain/models/provider-failure';
import { EMAIL_PROVIDERS } from '../../../provider-selection/domain/ports/email-provider-registry.token';
import { ProviderSelectionEnginePort, PROVIDER_SELECTION_ENGINE_PORT } from '../../../provider-selection/domain/ports/provider-selection-engine.port';
import { ProviderSelectionCriteria } from '../../../provider-selection/domain/models/provider-selection-criteria';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailProviderHealthRepository, EMAIL_PROVIDER_HEALTH_REPOSITORY } from '../../domain/ports/email-provider-health.repository';
import { EmailProviderAttempt, EmailProviderManagerPort, EmailProviderManagerResult } from '../../domain/ports/email-provider-manager.port';
import { ATTACHMENT_RESOLVER_PORT } from '../../../documents/domain/ports/attachment-resolver.port';
import type { AttachmentResolverPort } from '../../../documents/domain/ports/attachment-resolver.port';
import { AttachmentReferenceContext } from '../../../documents/domain/models/resolved-attachment';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { DomainReadinessService } from './domain-readiness.service';

/** Attachment-resolution/domain-readiness failure reasons that are a property of the request or
 * the current environment configuration, not something retrying later fixes on its own. */
const NON_RETRYABLE_RESOLUTION_REASONS = new Set([
  'DOCUMENT_NOT_FOUND',
  'OWNERSHIP_MISMATCH',
  'SCOPE_MISMATCH',
  'DOCUMENT_INACTIVE',
  'MIME_TYPE_NOT_ALLOWED',
  'FILE_TOO_LARGE',
  'TOTAL_SIZE_EXCEEDED',
  'TOO_MANY_ATTACHMENTS',
  'SCAN_REJECTED',
  'CHECKSUM_MISMATCH',
]);

/** Failure categories where the request itself is the problem, not the provider — retrying a
 * different provider cannot help, so failover stops immediately rather than working through
 * every remaining candidate for no reason. */
const NON_FAILOVER_CATEGORIES: ReadonlySet<ProviderFailureCategory> = new Set(['INVALID_RECIPIENT', 'UNSUPPORTED_CAPABILITY']);

class SendTimeoutError extends Error {}

/**
 * M28 — the real Provider Manager. Reuses the existing `ProviderSelectionEnginePort` for exactly
 * what it already does well (one fully-explainable ranked-eligibility decision); everything this
 * class adds on top — circuit-breaker-aware skipping, per-attempt timeout, and immediate
 * synchronous failover through the ranked list — is genuinely new, not a reimplementation of
 * anything that existed before this milestone.
 */
@Injectable()
export class EmailProviderManagerService implements EmailProviderManagerPort {
  private readonly logger = new Logger(EmailProviderManagerService.name);

  constructor(
    @Inject(EMAIL_PROVIDERS) private readonly providers: EmailProviderPort[],
    @Inject(PROVIDER_SELECTION_ENGINE_PORT) private readonly selectionEngine: ProviderSelectionEnginePort,
    @Inject(EMAIL_PROVIDER_HEALTH_REPOSITORY) private readonly health: EmailProviderHealthRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    @Inject(ATTACHMENT_RESOLVER_PORT) private readonly attachmentResolver: AttachmentResolverPort,
    private readonly domainReadiness: DomainReadinessService,
    private readonly securityAudit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async sendWithFailover(request: EmailDeliveryRequest, criteria: ProviderSelectionCriteria): Promise<EmailProviderManagerResult> {
    const now = this.clock.now();

    let effectiveRequest = request;
    if (request.attachments.length > 0) {
      const gated = await this.resolveAttachmentsOrFail(request, now);
      if ('response' in gated) {
        return { response: gated.response, attempts: [] };
      }
      effectiveRequest = gated.request;
    }

    const { decision } = await this.selectionEngine.selectProvider(criteria);

    const rankedEligible = [...decision.evaluations]
      .filter((evaluation) => evaluation.eligible)
      .sort((a, b) => b.priorityScore - a.priorityScore || a.providerId.localeCompare(b.providerId));

    const attempts: EmailProviderAttempt[] = [];
    const threshold = this.config.get<number>('emailInfrastructure.providerManager.circuitBreakerThreshold', 5);
    const cooldownMs = this.config.get<number>('emailInfrastructure.providerManager.circuitBreakerCooldownMs', 300_000);
    const timeoutMs = this.config.get<number>('emailInfrastructure.providerManager.sendTimeoutMs', 10_000);

    for (const candidate of rankedEligible) {
      const healthSnapshot = await this.health.get(candidate.providerId);
      if (healthSnapshot?.circuitOpenUntil && healthSnapshot.circuitOpenUntil > now) {
        attempts.push({
          providerId: candidate.providerId,
          skippedCircuitOpen: true,
          response: this.circuitOpenResponse(candidate.providerId, now, healthSnapshot.circuitOpenUntil),
        });
        continue;
      }

      const provider = this.providers.find((p) => p.providerId === candidate.providerId);
      if (!provider) {
        continue; // defensive — the registry and the decision's evaluations are built from the same array
      }

      const response = await this.attemptWithTimeout(provider, effectiveRequest, timeoutMs, now);
      attempts.push({ providerId: candidate.providerId, response, skippedCircuitOpen: false });

      if (response.accepted) {
        await this.health.recordSuccess(candidate.providerId, now);
        if (effectiveRequest.resolvedAttachments && effectiveRequest.resolvedAttachments.length > 0) {
          await this.securityAudit.record({
            eventType: 'EMAIL_WITH_ATTACHMENTS_SENT',
            userId: request.requestingUserId ?? null,
            applicationId: request.applicationContextId ?? null,
            detail: `Sent via "${response.providerId}" with ${effectiveRequest.resolvedAttachments.length} attachment(s).`,
          });
        }
        return { response, attempts };
      }

      await this.health.recordFailure(candidate.providerId, now, threshold, cooldownMs);

      if (response.failure && NON_FAILOVER_CATEGORIES.has(response.failure.category)) {
        this.logger.debug(`Not failing over for request "${request.requestId}" — ${response.failure.category} is a property of the request, not the provider.`);
        return { response, attempts };
      }
      // Any other failure category: fall through to the next ranked candidate (the real failover).
    }

    if (attempts.length === 0) {
      return { response: this.noProviderResponse(decision.selectionReason, now), attempts };
    }
    return { response: attempts[attempts.length - 1].response, attempts };
  }

  /** M28.5 — the single point every real send with attachments passes through: the domain
   * readiness gate, then the one authoritative `AttachmentResolverPort`, run exactly once per
   * `sendWithFailover()` call (never once per provider attempt — Phase 8 "no duplicate loading of
   * the same attachment"). Returns either the augmented request (bytes resolved, ready for every
   * provider attempt to share) or a synthesized failure response — in the failure case, no
   * provider is ever contacted (Non-Negotiable Principles #5/#6: never send with a silently
   * omitted or substituted attachment). */
  private async resolveAttachmentsOrFail(
    request: EmailDeliveryRequest,
    now: Date,
  ): Promise<{ request: EmailDeliveryRequest } | { response: EmailDeliveryResponse }> {
    const readiness = await this.domainReadiness.checkReadiness();
    if (!readiness.ready) {
      return { response: this.attachmentGateFailureResponse(`Domain readiness gate failed: ${readiness.blockingReasons.join(' ')}`, false, now) };
    }

    const references: AttachmentReferenceContext[] = request.attachments.map((attachment) => ({
      documentId: attachment.contentReference,
      requestingUserId: request.requestingUserId ?? '',
      applicationContextId: request.applicationContextId ?? null,
    }));

    const resolution = await this.attachmentResolver.resolve(references);
    if (resolution.failure) {
      const retryable = !NON_RETRYABLE_RESOLUTION_REASONS.has(resolution.failure.reason);
      return { response: this.attachmentGateFailureResponse(`Attachment resolution failed: ${resolution.failure.detail}`, retryable, now) };
    }

    const resolvedAttachments: ResolvedEmailAttachment[] = resolution.resolved.map((r) => ({ fileName: r.fileName, mimeType: r.mimeType, sizeBytes: r.sizeBytes, content: r.content }));
    await this.securityAudit.record({
      eventType: 'EMAIL_WITH_ATTACHMENTS_QUEUED',
      userId: request.requestingUserId ?? null,
      applicationId: request.applicationContextId ?? null,
      detail: `${resolvedAttachments.length} attachment(s) resolved for request "${request.requestId}".`,
    });

    return { request: { ...request, resolvedAttachments } };
  }

  private attachmentGateFailureResponse(message: string, retryable: boolean, now: Date): EmailDeliveryResponse {
    return {
      providerId: 'attachment-gate',
      status: 'UNSUPPORTED',
      accepted: false,
      executedAt: now,
      providerMessage: message,
      providerMetadata: {},
      failure: { category: 'UNSUPPORTED_CAPABILITY', message, retryable },
    };
  }

  private async attemptWithTimeout(provider: EmailProviderPort, request: EmailDeliveryRequest, timeoutMs: number, now: Date): Promise<EmailDeliveryResponse> {
    try {
      return await Promise.race([
        provider.send(request),
        new Promise<never>((_, reject) => setTimeout(() => reject(new SendTimeoutError(`Timed out after ${timeoutMs}ms`)), timeoutMs)),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Provider "${provider.providerId}" threw for request "${request.requestId}": ${message}`);
      return {
        providerId: provider.providerId,
        status: 'FAILED',
        accepted: false,
        executedAt: now,
        providerMessage: `Provider "${provider.providerId}" did not complete in time or threw: ${message}`,
        providerMetadata: {},
        failure: { category: 'PROVIDER_UNAVAILABLE', message, retryable: true },
      };
    }
  }

  private circuitOpenResponse(providerId: string, now: Date, openUntil: Date): EmailDeliveryResponse {
    return {
      providerId,
      status: 'DEFERRED',
      accepted: false,
      executedAt: now,
      providerMessage: `Provider "${providerId}" circuit breaker is open until ${openUntil.toISOString()} — skipped without attempting delivery.`,
      providerMetadata: {},
      failure: { category: 'PROVIDER_UNAVAILABLE', message: 'Circuit breaker open.', retryable: true },
    };
  }

  private noProviderResponse(selectionReason: string, now: Date): EmailDeliveryResponse {
    return {
      providerId: 'none',
      status: 'UNSUPPORTED',
      accepted: false,
      executedAt: now,
      providerMessage: selectionReason,
      providerMetadata: {},
      failure: { category: 'PROVIDER_UNAVAILABLE', message: selectionReason, retryable: false },
    };
  }
}
