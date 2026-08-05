import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

export const BILLING_CUSTOMER_REPOSITORY = Symbol('BILLING_CUSTOMER_REPOSITORY');

export interface BillingCustomerRecord {
  readonly userId: string;
  readonly paddleCustomerId: string;
}

export interface BillingCustomerRepository {
  findByUserId(userId: string): Promise<BillingCustomerRecord | null>;
  create(userId: string, paddleCustomerId: string): Promise<BillingCustomerRecord>;
}

@Injectable()
export class PrismaBillingCustomerRepository implements BillingCustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<BillingCustomerRecord | null> {
    const record = await this.prisma.billingCustomer.findUnique({ where: { userId } });
    return record ? { userId: record.userId, paddleCustomerId: record.paddleCustomerId } : null;
  }

  async create(userId: string, paddleCustomerId: string): Promise<BillingCustomerRecord> {
    const record = await this.prisma.billingCustomer.create({
      data: { id: randomUUID(), userId, paddleCustomerId },
    });
    return { userId: record.userId, paddleCustomerId: record.paddleCustomerId };
  }
}
