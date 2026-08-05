import { Injectable } from '@nestjs/common';
import type { InboxMessage as PrismaInboxMessage, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { InboxMessageRepository, InboxMessageListFilter } from '../../domain/ports/inbox-message.repository';
import {
  InboxMessageRecord,
  CreateInboxMessageInput,
  InboxMessageClassificationPatch,
  InboxMessageReviewPatch,
  InboxMessageReviewStatus,
} from '../../domain/models/inbox-message';
import { CorrelationStatus, CorrelationSignalEvidence } from '../../domain/models/correlation';
import { ReplyPrimaryCategory, ReplySecondaryLabel, ClassificationSource } from '../../domain/models/reply-taxonomy';
import { ExtractedRecruitmentFacts } from '../../domain/models/extracted-facts';

@Injectable()
export class PrismaInboxMessageRepository implements InboxMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<InboxMessageRecord | null> {
    const row = await this.prisma.inboxMessage.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async create(input: CreateInboxMessageInput, now: Date): Promise<InboxMessageRecord> {
    const row = await this.prisma.inboxMessage.create({
      data: {
        connectedMailboxId: input.connectedMailboxId,
        providerMessageId: input.providerMessageId,
        providerThreadId: input.providerThreadId,
        rfcMessageId: input.rfcMessageId,
        inReplyTo: input.inReplyTo,
        referencesHeaders: [...input.referencesHeaders],
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        subject: input.subject,
        receivedAt: input.receivedAt,
        correlationStatus: input.correlationStatus as unknown as Prisma.InboxMessageCreateInput['correlationStatus'],
        correlationConfidence: input.correlationConfidence,
        correlationEvidence: input.correlationEvidence as unknown as Prisma.InputJsonValue,
        correlatedApplicationId: input.correlatedApplicationId,
        correlatedCampaignId: input.correlatedCampaignId,
        contentHashSha256: input.contentHashSha256,
        sanitizedExcerpt: input.sanitizedExcerpt,
        detectedLanguage: input.detectedLanguage,
        reviewStatus: 'PENDING_REVIEW',
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toRecord(row);
  }

  async findByConnectedMailboxIdAndProviderMessageId(connectedMailboxId: string, providerMessageId: string): Promise<InboxMessageRecord | null> {
    const row = await this.prisma.inboxMessage.findUnique({ where: { connectedMailboxId_providerMessageId: { connectedMailboxId, providerMessageId } } });
    return row ? this.toRecord(row) : null;
  }

  async applyClassification(id: string, patch: InboxMessageClassificationPatch, now: Date): Promise<InboxMessageRecord> {
    const row = await this.prisma.inboxMessage.update({
      where: { id },
      data: {
        primaryCategory: patch.primaryCategory as unknown as Prisma.InboxMessageUpdateInput['primaryCategory'],
        secondaryLabels: patch.secondaryLabels as unknown as Prisma.InboxMessageUpdateInput['secondaryLabels'],
        classificationConfidence: patch.classificationConfidence,
        classificationEvidence: patch.classificationEvidence as unknown as Prisma.InputJsonValue,
        classificationSource: patch.classificationSource as unknown as Prisma.InboxMessageUpdateInput['classificationSource'],
        classificationRuleIds: [...patch.classificationRuleIds],
        extractedFacts: patch.extractedFacts as unknown as Prisma.InputJsonValue,
        reviewStatus: patch.reviewStatus as unknown as Prisma.InboxMessageUpdateInput['reviewStatus'],
        processedAt: patch.processedAt,
        updatedAt: now,
      },
    });
    return this.toRecord(row);
  }

  async updateReviewStatus(id: string, patch: InboxMessageReviewPatch, now: Date): Promise<InboxMessageRecord> {
    const row = await this.prisma.inboxMessage.update({
      where: { id },
      data: { reviewStatus: patch.reviewStatus as unknown as Prisma.InboxMessageUpdateInput['reviewStatus'], updatedAt: now },
    });
    return this.toRecord(row);
  }

  async list(filter: InboxMessageListFilter, limit: number, offset: number): Promise<InboxMessageRecord[]> {
    const rows = await this.prisma.inboxMessage.findMany({
      where: {
        connectedMailboxId: filter.connectedMailboxId,
        ...(filter.userId ? { connectedMailbox: { userId: filter.userId } } : {}),
        reviewStatus: filter.reviewStatus as unknown as Prisma.InboxMessageWhereInput['reviewStatus'],
        correlationStatus: filter.correlationStatus as unknown as Prisma.InboxMessageWhereInput['correlationStatus'],
        correlatedApplicationId: filter.correlatedApplicationId,
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async listOlderThan(cutoff: Date, limit: number): Promise<InboxMessageRecord[]> {
    const rows = await this.prisma.inboxMessage.findMany({ where: { createdAt: { lt: cutoff }, sanitizedExcerpt: { not: null } }, take: limit });
    return rows.map((row) => this.toRecord(row));
  }

  async pruneToMinimalRecord(id: string, now: Date): Promise<void> {
    await this.prisma.inboxMessage.update({ where: { id }, data: { sanitizedExcerpt: null, updatedAt: now } });
  }

  private toRecord(row: PrismaInboxMessage): InboxMessageRecord {
    return {
      id: row.id,
      connectedMailboxId: row.connectedMailboxId,
      providerMessageId: row.providerMessageId,
      providerThreadId: row.providerThreadId,
      rfcMessageId: row.rfcMessageId,
      inReplyTo: row.inReplyTo,
      referencesHeaders: row.referencesHeaders,
      fromAddress: row.fromAddress,
      toAddress: row.toAddress,
      subject: row.subject,
      receivedAt: row.receivedAt,
      correlationStatus: row.correlationStatus as unknown as CorrelationStatus,
      correlationConfidence: row.correlationConfidence,
      correlationEvidence: (row.correlationEvidence as unknown as CorrelationSignalEvidence[]) ?? [],
      correlatedApplicationId: row.correlatedApplicationId,
      correlatedCampaignId: row.correlatedCampaignId,
      contentHashSha256: row.contentHashSha256,
      sanitizedExcerpt: row.sanitizedExcerpt,
      detectedLanguage: row.detectedLanguage,
      primaryCategory: row.primaryCategory as unknown as ReplyPrimaryCategory | null,
      secondaryLabels: row.secondaryLabels as unknown as ReplySecondaryLabel[],
      classificationConfidence: row.classificationConfidence,
      classificationEvidence: row.classificationEvidence as unknown as Record<string, unknown> | null,
      classificationSource: row.classificationSource as unknown as ClassificationSource | null,
      classificationRuleIds: row.classificationRuleIds,
      extractedFacts: row.extractedFacts as unknown as ExtractedRecruitmentFacts | null,
      reviewStatus: row.reviewStatus as unknown as InboxMessageReviewStatus,
      processedAt: row.processedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
