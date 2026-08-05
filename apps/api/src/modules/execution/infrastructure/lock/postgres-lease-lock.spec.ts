import { PostgresLeaseLock } from './postgres-lease-lock';
import { FixedClock } from '../clock/fixed-clock';

const NOW = new Date('2026-01-01T00:00:00.000Z');

/** A minimal fake of the interactive-transaction `tx` client acquire() drives. */
function createFakeTx(existingRow: { fencingToken: number; expiresAt: Date } | null, updateManyCount: number) {
  return {
    executionLease: {
      findUnique: jest.fn().mockResolvedValue(existingRow),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: updateManyCount }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(
        existingRow ? { ...existingRow, fencingToken: existingRow.fencingToken + 1 } : null,
      ),
    },
  };
}

function createPrisma(fakeTx: ReturnType<typeof createFakeTx>) {
  return {
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback(fakeTx)),
    executionLease: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

describe('PostgresLeaseLock.acquire', () => {
  it('creates a new lease with fencingToken 1 when the key does not exist yet', async () => {
    const fakeTx = createFakeTx(null, 0);
    const prisma = createPrisma(fakeTx);
    const lock = new PostgresLeaseLock(prisma as any, new FixedClock(NOW));

    const lease = await lock.acquire('scheduler:campaign-1', 30_000);

    expect(lease).not.toBeNull();
    expect(lease!.key).toBe('scheduler:campaign-1');
    expect(lease!.fencingToken).toBe(1);
    expect(fakeTx.executionLease.create).toHaveBeenCalledTimes(1);
    expect(fakeTx.executionLease.updateMany).not.toHaveBeenCalled();
  });

  it('returns null when the existing lease has not expired yet', async () => {
    const fakeTx = createFakeTx({ fencingToken: 3, expiresAt: new Date('2026-01-01T00:01:00.000Z') }, 0);
    const prisma = createPrisma(fakeTx);
    const lock = new PostgresLeaseLock(prisma as any, new FixedClock(NOW));

    const lease = await lock.acquire('scheduler:campaign-1', 30_000);

    expect(lease).toBeNull();
    expect(fakeTx.executionLease.updateMany).not.toHaveBeenCalled();
  });

  it('reclaims an expired lease and increments the fencing token', async () => {
    const fakeTx = createFakeTx({ fencingToken: 3, expiresAt: new Date('2025-12-31T23:59:00.000Z') }, 1);
    const prisma = createPrisma(fakeTx);
    const lock = new PostgresLeaseLock(prisma as any, new FixedClock(NOW));

    const lease = await lock.acquire('scheduler:campaign-1', 30_000);

    expect(lease).not.toBeNull();
    expect(lease!.fencingToken).toBe(4);
    const updateCall = fakeTx.executionLease.updateMany.mock.calls[0][0];
    expect(updateCall.where).toMatchObject({ key: 'scheduler:campaign-1', fencingToken: 3 });
  });

  it('returns null when a concurrent acquirer wins the race on an expired lease', async () => {
    const fakeTx = createFakeTx({ fencingToken: 3, expiresAt: new Date('2025-12-31T23:59:00.000Z') }, 0);
    const prisma = createPrisma(fakeTx);
    const lock = new PostgresLeaseLock(prisma as any, new FixedClock(NOW));

    const lease = await lock.acquire('scheduler:campaign-1', 30_000);

    expect(lease).toBeNull();
  });

  it('releases by deleting only the row matching key, fencingToken, and holderId', async () => {
    const fakeTx = createFakeTx(null, 0);
    const prisma = createPrisma(fakeTx);
    const lock = new PostgresLeaseLock(prisma as any, new FixedClock(NOW));

    const lease = await lock.acquire('scheduler:campaign-1', 30_000);
    await lease!.release();

    expect(prisma.executionLease.deleteMany).toHaveBeenCalledWith({
      where: { key: 'scheduler:campaign-1', fencingToken: 1, holderId: expect.any(String) },
    });
  });
});
