import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { AcquiredLease, DistributedLock } from '../../domain/ports/distributed-lock.port';
import { ExecutionClock, EXECUTION_CLOCK } from '../../domain/ports/execution-clock.port';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * Postgres-backed distributed lock. Acquisition uses the same conditional-`updateMany`
 * pattern as PrismaCampaignRepository.save(): the WHERE clause re-checks the row's
 * fencing token at the moment Postgres takes the row lock, so two concurrent acquirers
 * racing on an EXISTING key can never both succeed — the loser's updateMany affects zero
 * rows. No explicit `SELECT ... FOR UPDATE` is needed.
 *
 * M26: the first-ever-acquire path (no existing row) was not equally race-safe — READ
 * COMMITTED (Postgres's default isolation, including inside a Prisma `$transaction`) lets two
 * concurrent transactions both observe `findUnique` returning null, then both attempt
 * `create()`; only one succeeds, the other hits the table's unique `key` constraint and used to
 * throw, breaking this port's own documented contract ("Returns null, never throws, when the
 * lease is currently held by someone else"). Found live by M26 Phase 12's concurrent-activation
 * test — the first real concurrent exerciser of this path since the lock was built (M2), which
 * only ever raced the update branch. Caught and translated to the same null-return outcome as
 * losing the updateMany race.
 */
@Injectable()
export class PostgresLeaseLock implements DistributedLock {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
  ) {}

  async acquire(key: string, ttlMs: number): Promise<AcquiredLease | null> {
    const holderId = randomUUID();
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + ttlMs);

    const fencingToken = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.executionLease.findUnique({ where: { key } });

      if (!existing) {
        try {
          const created = await tx.executionLease.create({
            data: { key, holderId, fencingToken: 1, expiresAt },
          });
          return created.fencingToken;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
            return null;
          }
          throw error;
        }
      }

      const isExpired = existing.expiresAt.getTime() <= now.getTime();
      if (!isExpired) {
        return null;
      }

      const result = await tx.executionLease.updateMany({
        where: { key, fencingToken: existing.fencingToken },
        data: { holderId, expiresAt, fencingToken: { increment: 1 } },
      });

      if (result.count === 0) {
        return null;
      }

      const updated = await tx.executionLease.findUniqueOrThrow({ where: { key } });
      return updated.fencingToken;
    });

    if (fencingToken === null) {
      return null;
    }

    return {
      key,
      fencingToken,
      release: () => this.release(key, fencingToken, holderId),
    };
  }

  private async release(key: string, fencingToken: number, holderId: string): Promise<void> {
    await this.prisma.executionLease.deleteMany({ where: { key, fencingToken, holderId } });
  }
}
