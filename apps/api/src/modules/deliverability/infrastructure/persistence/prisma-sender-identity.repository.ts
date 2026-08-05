import { Injectable } from '@nestjs/common';
import type { SenderIdentity as PrismaSenderIdentity, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { SenderIdentityRepository } from '../../domain/ports/sender-identity.repository';
import { CreateSenderIdentityInput, SenderIdentityRecord, SenderVerificationStatus } from '../../domain/models/sender-identity';

@Injectable()
export class PrismaSenderIdentityRepository implements SenderIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SenderIdentityRecord | null> {
    const row = await this.prisma.senderIdentity.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByEmailAndProvider(emailAddress: string, providerId: string): Promise<SenderIdentityRecord | null> {
    const row = await this.prisma.senderIdentity.findUnique({ where: { emailAddress_providerId: { emailAddress, providerId } } });
    return row ? this.toRecord(row) : null;
  }

  async listAll(): Promise<SenderIdentityRecord[]> {
    const rows = await this.prisma.senderIdentity.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toRecord(row));
  }

  async create(input: CreateSenderIdentityInput, now: Date): Promise<SenderIdentityRecord> {
    const created = await this.prisma.senderIdentity.create({
      data: {
        displayName: input.displayName,
        emailAddress: input.emailAddress,
        domain: input.domain,
        providerId: input.providerId,
        replyToEmailAddress: input.replyToEmailAddress,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toRecord(created);
  }

  async updateVerification(
    id: string,
    fields: { verificationStatus: SenderVerificationStatus; dkimVerified?: boolean; spfReady?: boolean; dmarcReady?: boolean; failureReason: string | null; providerIdentityRef?: string | null },
    now: Date,
  ): Promise<SenderIdentityRecord> {
    const updated = await this.prisma.senderIdentity.update({
      where: { id },
      data: {
        verificationStatus: fields.verificationStatus as unknown as Prisma.SenderIdentityUpdateInput['verificationStatus'],
        ...(fields.dkimVerified !== undefined ? { dkimVerified: fields.dkimVerified } : {}),
        ...(fields.spfReady !== undefined ? { spfReady: fields.spfReady } : {}),
        ...(fields.dmarcReady !== undefined ? { dmarcReady: fields.dmarcReady } : {}),
        ...(fields.providerIdentityRef !== undefined ? { providerIdentityRef: fields.providerIdentityRef } : {}),
        failureReason: fields.failureReason,
        verifiedAt: fields.verificationStatus === 'VERIFIED' ? now : null,
        updatedAt: now,
      },
    });
    return this.toRecord(updated);
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.prisma.senderIdentity.update({ where: { id }, data: { isActive } });
  }

  private toRecord(row: PrismaSenderIdentity): SenderIdentityRecord {
    return {
      id: row.id,
      displayName: row.displayName,
      emailAddress: row.emailAddress,
      domain: row.domain,
      providerId: row.providerId,
      providerIdentityRef: row.providerIdentityRef,
      verificationStatus: row.verificationStatus as unknown as SenderVerificationStatus,
      dkimVerified: row.dkimVerified,
      spfReady: row.spfReady,
      dmarcReady: row.dmarcReady,
      replyToEmailAddress: row.replyToEmailAddress,
      allowedRegions: row.allowedRegions,
      isActive: row.isActive,
      failureReason: row.failureReason,
      verifiedAt: row.verifiedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
