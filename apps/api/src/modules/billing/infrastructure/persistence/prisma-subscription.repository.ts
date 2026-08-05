import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { Subscription } from '../../domain/entities/subscription.entity';
import { SubscriptionMapper } from '../mappers/subscription.mapper';

const NON_TERMINAL_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.CANCEL_AT_PERIOD_END,
];

@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Subscription | null> {
    const raw = await this.prisma.subscription.findUnique({ where: { id } });
    return raw ? SubscriptionMapper.toDomain(raw) : null;
  }

  async findByPaddleSubscriptionId(paddleSubscriptionId: string): Promise<Subscription | null> {
    const raw = await this.prisma.subscription.findUnique({ where: { paddleSubscriptionId } });
    return raw ? SubscriptionMapper.toDomain(raw) : null;
  }

  async findCurrentByUserId(userId: string): Promise<Subscription | null> {
    const raw = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: NON_TERMINAL_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? SubscriptionMapper.toDomain(raw) : null;
  }

  async save(subscription: Subscription): Promise<void> {
    const data = SubscriptionMapper.toPersistence(subscription);
    await this.prisma.subscription.upsert({
      where: { id: subscription.id },
      create: data,
      update: data,
    });
  }
}
