import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EmailWebhookProcessingStatus as PrismaEmailWebhookProcessingStatus } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  EmailProviderWebhookEventRecord,
  EmailProviderWebhookEventRepository,
} from '../../domain/ports/email-provider-webhook-event.repository';

/**
 * Reuses the Prisma-generated `WebhookProcessingStatus` enum (RECEIVED/PROCESSED/REJECTED/
 * DEAD_LETTER) — the same three-and-a-bit status shape as the billing WebhookEvent model, though
 * this repository's own table (`email_provider_webhook_events`) is entirely separate, per this
 * milestone's "do not modify Billing" boundary (see schema.prisma's own doc comment).
 */
@Injectable()
export class PrismaEmailProviderWebhookEventRepository implements EmailProviderWebhookEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderEventId(provider: string, providerEventId: string): Promise<EmailProviderWebhookEventRecord | null> {
    const row = await this.prisma.emailProviderWebhookEvent.findUnique({
      where: { providerEventId },
      select: { id: true, status: true, provider: true },
    });
    if (!row || row.provider !== provider) return null;
    return { id: row.id, status: row.status as unknown as EmailProviderWebhookEventRecord['status'] };
  }

  async recordReceived(params: { provider: string; providerEventId: string; eventType: string; signatureValid: boolean; rawPayloadHash: string }): Promise<string> {
    const created = await this.prisma.emailProviderWebhookEvent.create({
      data: {
        id: randomUUID(),
        provider: params.provider,
        providerEventId: params.providerEventId,
        eventType: params.eventType,
        signatureValid: params.signatureValid,
        rawPayloadHash: params.rawPayloadHash,
        status: PrismaEmailWebhookProcessingStatus.RECEIVED,
      },
    });
    return created.id;
  }

  async markProcessed(id: string, now: Date): Promise<void> {
    await this.prisma.emailProviderWebhookEvent.update({
      where: { id },
      data: { status: PrismaEmailWebhookProcessingStatus.PROCESSED, processedAt: now },
    });
  }

  async markRejected(id: string, reason: string, now: Date): Promise<void> {
    await this.prisma.emailProviderWebhookEvent.update({
      where: { id },
      data: { status: PrismaEmailWebhookProcessingStatus.REJECTED, failureReason: reason, processedAt: now },
    });
  }
}
