import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CheckoutSessionStatus, PlanCode } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

export const CHECKOUT_SESSION_REPOSITORY = Symbol('CHECKOUT_SESSION_REPOSITORY');

export interface CheckoutSessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly planCode: PlanCode;
  readonly status: CheckoutSessionStatus;
  readonly idempotencyKey: string;
  readonly paddleCheckoutUrl: string | null;
  readonly paddleTransactionId: string | null;
  readonly expiresAt: Date;
}

export interface CheckoutSessionRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<CheckoutSessionRecord | null>;
  /** A user's currently-open (PENDING, not yet expired) checkout, if any — Phase 4's "duplicate
   * active checkout" prevention. */
  findOpenByUserId(userId: string, now: Date): Promise<CheckoutSessionRecord | null>;
  findByPaddleTransactionId(paddleTransactionId: string): Promise<CheckoutSessionRecord | null>;
  create(params: {
    userId: string;
    planCode: PlanCode;
    idempotencyKey: string;
    expiresAt: Date;
    paddleCheckoutUrl: string;
    paddleTransactionId: string | null;
  }): Promise<CheckoutSessionRecord>;
  markCompleted(id: string, now: Date): Promise<void>;
}

@Injectable()
export class PrismaCheckoutSessionRepository implements CheckoutSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<CheckoutSessionRecord | null> {
    return this.prisma.checkoutSession.findUnique({ where: { idempotencyKey } });
  }

  async findOpenByUserId(userId: string, now: Date): Promise<CheckoutSessionRecord | null> {
    return this.prisma.checkoutSession.findFirst({
      where: { userId, status: CheckoutSessionStatus.PENDING, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByPaddleTransactionId(paddleTransactionId: string): Promise<CheckoutSessionRecord | null> {
    return this.prisma.checkoutSession.findUnique({ where: { paddleTransactionId } });
  }

  async create(params: {
    userId: string;
    planCode: PlanCode;
    idempotencyKey: string;
    expiresAt: Date;
    paddleCheckoutUrl: string;
    paddleTransactionId: string | null;
  }): Promise<CheckoutSessionRecord> {
    return this.prisma.checkoutSession.create({
      data: {
        id: randomUUID(),
        userId: params.userId,
        planCode: params.planCode,
        idempotencyKey: params.idempotencyKey,
        expiresAt: params.expiresAt,
        paddleCheckoutUrl: params.paddleCheckoutUrl,
        paddleTransactionId: params.paddleTransactionId,
      },
    });
  }

  async markCompleted(id: string, now: Date): Promise<void> {
    await this.prisma.checkoutSession.update({
      where: { id },
      data: { status: CheckoutSessionStatus.COMPLETED, completedAt: now },
    });
  }
}
