export type EmailWebhookProcessingStatus = 'RECEIVED' | 'PROCESSED' | 'REJECTED';

export interface EmailProviderWebhookEventRecord {
  readonly id: string;
  readonly status: EmailWebhookProcessingStatus;
}

export const EMAIL_PROVIDER_WEBHOOK_EVENT_REPOSITORY = Symbol('EMAIL_PROVIDER_WEBHOOK_EVENT_REPOSITORY');

/** Real replay/duplicate protection for inbound provider webhooks — `providerEventId` is unique
 * at the DB level (M28), mirroring the M27 billing `WebhookEvent` table's identical doctrine. */
export interface EmailProviderWebhookEventRepository {
  findByProviderEventId(provider: string, providerEventId: string): Promise<EmailProviderWebhookEventRecord | null>;
  recordReceived(params: {
    provider: string;
    providerEventId: string;
    eventType: string;
    signatureValid: boolean;
    rawPayloadHash: string;
  }): Promise<string>;
  markProcessed(id: string, now: Date): Promise<void>;
  markRejected(id: string, reason: string, now: Date): Promise<void>;
}
