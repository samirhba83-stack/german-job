import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { WebhookProcessingStatus } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

export const WEBHOOK_EVENT_REPOSITORY = Symbol('WEBHOOK_EVENT_REPOSITORY');

export interface WebhookEventRepository {
  findByProviderEventId(providerEventId: string): Promise<{ id: string; status: WebhookProcessingStatus } | null>;
  recordReceived(params: { providerEventId: string; eventType: string; signatureValid: boolean; rawPayloadHash: string }): Promise<string>;
  markProcessed(id: string, now: Date): Promise<void>;
  markRejected(id: string, reason: string, now: Date): Promise<void>;
  markDeadLetter(id: string, reason: string, now: Date): Promise<void>;
}

@Injectable()
export class PrismaWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderEventId(providerEventId: string): Promise<{ id: string; status: WebhookProcessingStatus } | null> {
    return this.prisma.webhookEvent.findUnique({
      where: { providerEventId },
      select: { id: true, status: true },
    });
  }

  async recordReceived(params: { providerEventId: string; eventType: string; signatureValid: boolean; rawPayloadHash: string }): Promise<string> {
    const created = await this.prisma.webhookEvent.create({
      data: {
        id: randomUUID(),
        providerEventId: params.providerEventId,
        eventType: params.eventType,
        signatureValid: params.signatureValid,
        rawPayloadHash: params.rawPayloadHash,
        status: WebhookProcessingStatus.RECEIVED,
      },
    });
    return created.id;
  }

  async markProcessed(id: string, now: Date): Promise<void> {
    await this.prisma.webhookEvent.update({ where: { id }, data: { status: WebhookProcessingStatus.PROCESSED, processedAt: now } });
  }

  async markRejected(id: string, reason: string, now: Date): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: { status: WebhookProcessingStatus.REJECTED, failureReason: reason, processedAt: now },
    });
  }

  async markDeadLetter(id: string, reason: string, now: Date): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: { status: WebhookProcessingStatus.DEAD_LETTER, failureReason: reason, processedAt: now },
    });
  }
}
