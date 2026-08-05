import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { EmailProviderHealthRepository, EmailProviderHealthSnapshot } from '../../domain/ports/email-provider-health.repository';

@Injectable()
export class PrismaEmailProviderHealthRepository implements EmailProviderHealthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(providerId: string): Promise<EmailProviderHealthSnapshot | null> {
    const row = await this.prisma.emailProviderHealthState.findUnique({ where: { providerId } });
    return row ? this.toSnapshot(row) : null;
  }

  async getAll(): Promise<ReadonlyArray<EmailProviderHealthSnapshot>> {
    const rows = await this.prisma.emailProviderHealthState.findMany();
    return rows.map((row) => this.toSnapshot(row));
  }

  async recordSuccess(providerId: string, now: Date): Promise<void> {
    await this.prisma.emailProviderHealthState.upsert({
      where: { providerId },
      create: { providerId, consecutiveFailures: 0, lastSuccessAt: now, lastFailureAt: null, circuitOpenUntil: null },
      update: { consecutiveFailures: 0, lastSuccessAt: now, circuitOpenUntil: null },
    });
  }

  async recordFailure(providerId: string, now: Date, threshold: number, cooldownMs: number): Promise<void> {
    // Atomic at the DB level (Postgres translates `increment` to `x = x + 1` in one UPDATE) — no
    // read-modify-write race even under concurrent failures for the same provider.
    const updated = await this.prisma.emailProviderHealthState.upsert({
      where: { providerId },
      create: { providerId, consecutiveFailures: 1, lastFailureAt: now },
      update: { consecutiveFailures: { increment: 1 }, lastFailureAt: now },
    });

    if (updated.consecutiveFailures >= threshold) {
      await this.prisma.emailProviderHealthState.update({
        where: { providerId },
        data: { circuitOpenUntil: new Date(now.getTime() + cooldownMs) },
      });
    }
  }

  async forceOpen(providerId: string, now: Date, cooldownMs: number): Promise<void> {
    await this.prisma.emailProviderHealthState.upsert({
      where: { providerId },
      create: { providerId, consecutiveFailures: 0, circuitOpenUntil: new Date(now.getTime() + cooldownMs) },
      update: { circuitOpenUntil: new Date(now.getTime() + cooldownMs) },
    });
  }

  async forceClose(providerId: string): Promise<void> {
    await this.prisma.emailProviderHealthState.upsert({
      where: { providerId },
      create: { providerId, consecutiveFailures: 0, circuitOpenUntil: null },
      update: { consecutiveFailures: 0, circuitOpenUntil: null },
    });
  }

  private toSnapshot(row: {
    providerId: string;
    consecutiveFailures: number;
    lastFailureAt: Date | null;
    lastSuccessAt: Date | null;
    circuitOpenUntil: Date | null;
  }): EmailProviderHealthSnapshot {
    return {
      providerId: row.providerId,
      consecutiveFailures: row.consecutiveFailures,
      lastFailureAt: row.lastFailureAt,
      lastSuccessAt: row.lastSuccessAt,
      circuitOpenUntil: row.circuitOpenUntil,
    };
  }
}
