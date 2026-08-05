import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RefundStatus } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

export const REFUND_REPOSITORY = Symbol('REFUND_REPOSITORY');

export interface RefundRecord {
  readonly id: string;
  readonly subscriptionId: string;
  readonly userId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly reason: string;
  readonly status: RefundStatus;
  readonly createdAt: Date;
  readonly processedAt: Date | null;
}

export interface RefundRepository {
  create(params: {
    subscriptionId: string;
    userId: string;
    amountCents: number;
    currency: string;
    reason: string;
    requestedBy: string;
  }): Promise<RefundRecord>;
  markIssued(id: string, paddleRefundId: string, now: Date): Promise<void>;
  markRejected(id: string, now: Date): Promise<void>;
  findByUserId(userId: string): Promise<RefundRecord[]>;
  hasAnyForSubscription(subscriptionId: string): Promise<boolean>;
}

@Injectable()
export class PrismaRefundRepository implements RefundRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    subscriptionId: string;
    userId: string;
    amountCents: number;
    currency: string;
    reason: string;
    requestedBy: string;
  }): Promise<RefundRecord> {
    return this.prisma.refund.create({
      data: {
        id: randomUUID(),
        subscriptionId: params.subscriptionId,
        userId: params.userId,
        amountCents: params.amountCents,
        currency: params.currency,
        reason: params.reason,
        requestedBy: params.requestedBy,
        status: RefundStatus.REQUESTED,
      },
    });
  }

  async markIssued(id: string, paddleRefundId: string, now: Date): Promise<void> {
    await this.prisma.refund.update({
      where: { id },
      data: { status: RefundStatus.ISSUED, paddleRefundId, processedAt: now },
    });
  }

  async markRejected(id: string, now: Date): Promise<void> {
    await this.prisma.refund.update({ where: { id }, data: { status: RefundStatus.REJECTED, processedAt: now } });
  }

  async findByUserId(userId: string): Promise<RefundRecord[]> {
    return this.prisma.refund.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async hasAnyForSubscription(subscriptionId: string): Promise<boolean> {
    const count = await this.prisma.refund.count({ where: { subscriptionId, status: RefundStatus.ISSUED } });
    return count > 0;
  }
}
