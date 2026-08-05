import { Inject, Injectable } from '@nestjs/common';
import { ExecutionTask } from '../../../execution-orchestrator/domain/entities/execution-task.entity';
import { TaskExecutionOutcome, TaskExecutionPort } from '../../../worker/domain/ports/task-execution.port';
import { EmailProviderManagerPort, EMAIL_PROVIDER_MANAGER_PORT } from '../../../deliverability/domain/ports/email-provider-manager.port';
import { EmailDeliveryRequest } from '../../../email-provider/domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../../email-provider/domain/models/email-delivery-response';
import { SenderIdentity } from '../../../email-provider/domain/models/sender-identity';
import { EmailDeliveryExecutionResult } from '../../domain/email-delivery-execution-result';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';

/**
 * ExecutionTask carries no real recipient/sender content — target/company/candidate data
 * resolution is a future milestone's responsibility, once that context flows through the
 * pipeline. These placeholders keep request construction deterministic and honest about what
 * this layer does and does not know, rather than inventing content it has no business producing.
 */
const PLACEHOLDER_SENDER: SenderIdentity = { displayName: 'German Job Engine', emailAddress: 'no-reply@pending.internal' };
const PLACEHOLDER_RECIPIENT_EMAIL_ADDRESS = 'unresolved-recipient@pending.internal';

/**
 * The execution boundary connecting the Worker to email delivery (Milestone 12, updated M13,
 * upgraded M28):
 *
 *   Worker -> EmailDeliveryExecutionService -> EmailProviderManager -> ProviderSelectionEngine -> EmailProviderPort
 *
 * Implements Worker's own TaskExecutionPort (Milestone 10) so it can be bound as
 * TASK_EXECUTION_PORT without any change to WorkerService — the Worker never knows this
 * implementation exists, let alone that a provider was chosen (or failed over) from several real
 * candidates. This service performs no SMTP/Gmail/OAuth/HTTP work, chooses no provider itself,
 * retries nothing, and applies no rate limiting itself (all real Provider Manager concerns, M28)
 * — it only constructs a request, derives selection criteria from it, delegates to the Provider
 * Manager, and translates whatever comes back. Its own public contract (`TaskExecutionPort.
 * execute()`) is byte-identical to before M28 — the Campaign Engine/Worker are unaffected by this
 * internal upgrade.
 *
 * As of Milestone 13 this no longer depends on EmailProviderGatewayService directly (M11's
 * single-fixed-provider facade, which remains intact and independently useful/tested for Billing's
 * notification path) — a dynamically selected, failover-capable provider doesn't fit a gateway
 * bound to one fixed instance at construction time.
 */
@Injectable()
export class EmailDeliveryExecutionService implements TaskExecutionPort {
  constructor(
    @Inject(EMAIL_PROVIDER_MANAGER_PORT) private readonly providerManager: EmailProviderManagerPort,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
  ) {}

  /** Worker-facing entry point — matches TaskExecutionPort exactly. */
  async execute(task: ExecutionTask): Promise<TaskExecutionOutcome> {
    const result = await this.translate(task);
    return {
      success: result.accepted,
      reason: result.providerMessage,
      failureReason: result.failure?.message ?? null,
    };
  }

  /** The full, explainable translation — richer than TaskExecutionOutcome, for callers that
   * need the complete provider-independent picture (tests, future observability). */
  async translate(task: ExecutionTask): Promise<EmailDeliveryExecutionResult> {
    const request = this.buildRequest(task);
    const managerResult = await this.providerManager.sendWithFailover(request, {
      requiresAttachments: request.attachments.length > 0,
      requiresHtml: request.htmlBody !== null,
      requiresPlainText: request.plainTextBody !== null,
      recipientCount: 1,
      correlationId: task.correlationId,
      traceId: task.id,
    });

    const result = this.buildResult(task.id, managerResult.response);

    await this.eventRecorder.record({
      eventType: result.accepted ? 'EMAIL_DELIVERY_CONFIRMED' : 'EMAIL_DELIVERY_FAILED',
      campaignId: null,
      executionId: task.id,
      correlationId: task.correlationId,
      traceId: task.id,
      summary: result.accepted ? `Delivery accepted by provider "${result.providerId}"` : 'Delivery not accepted',
      explanation: result.providerMessage,
      status: result.accepted ? 'SUCCESS' : 'FAILURE',
      metadata: { providerId: result.providerId, deliveryStatus: result.status, providersAttempted: String(managerResult.attempts.length) },
      businessContext: { ...EMPTY_BUSINESS_CONTEXT, providerId: result.providerId },
    });

    return result;
  }

  private buildRequest(task: ExecutionTask): EmailDeliveryRequest {
    return {
      requestId: task.id,
      sender: PLACEHOLDER_SENDER,
      recipientEmailAddress: PLACEHOLDER_RECIPIENT_EMAIL_ADDRESS,
      subject: task.title,
      plainTextBody: task.explanation,
      htmlBody: null,
      attachments: [],
    };
  }

  private buildResult(executionId: string, response: EmailDeliveryResponse): EmailDeliveryExecutionResult {
    return {
      executionId,
      providerId: response.providerId,
      status: response.status,
      accepted: response.accepted,
      executedAt: response.executedAt,
      providerMessage: response.providerMessage,
      providerMetadata: response.providerMetadata,
      failure: response.failure,
    };
  }
}
