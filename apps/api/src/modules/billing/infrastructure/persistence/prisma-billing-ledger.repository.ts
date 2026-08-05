import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { BillingLedgerRecorder, RecordBillingLedgerEntryInput } from '../../domain/ports/billing-ledger-recorder.port';

@Injectable()
export class PrismaBillingLedgerRepository implements BillingLedgerRecorder {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordBillingLedgerEntryInput): Promise<void> {
    await this.prisma.billingLedgerEntry.create({
      data: {
        id: randomUUID(),
        eventType: input.eventType,
        userId: input.userId,
        customerId: input.customerId,
        subscriptionId: input.subscriptionId,
        checkoutId: input.checkoutId,
        paymentId: input.paymentId,
        planCode: input.planCode,
        amountCents: input.amountCents,
        currency: input.currency,
        status: input.status,
        reason: input.reason,
        actorType: input.actorType,
        actorId: input.actorId,
        correlationId: input.correlationId,
        provider: 'PADDLE',
        metadata: input.metadata ?? {},
        occurredAt: new Date(),
      },
    });
  }

  async findByUserId(userId: string, limit = 50): Promise<
    Array<{
      id: string;
      eventType: string;
      planCode: string | null;
      amountCents: number | null;
      currency: string | null;
      status: string;
      reason: string | null;
      occurredAt: Date;
    }>
  > {
    return this.prisma.billingLedgerEntry.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }
}
