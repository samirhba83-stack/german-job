import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@german-job-engine/database';
import { PrismaNotificationRepository } from './prisma-notification.repository';
import { CreateNotificationInput } from '../../domain/models/notification';

/**
 * M29 — real Postgres concurrency test for `NotificationRepository.createIfNotDuplicate()`.
 * Requires a live database reachable via `DATABASE_URL`, excluded from the default `pnpm
 * test`/CI run, run on demand via `pnpm test:concurrency`.
 *
 * What this proves: `@@unique([userId, dedupeKey])` is the real backstop the repository's own
 * check-then-insert-with-catch-and-refetch logic relies on (see that method's own doc comment).
 * A real scenario this covers: the polling tick driver and a provider webhook notification both
 * detecting the same reply and racing to call `notify()` for the same `AMBIGUOUS_REPLY_REVIEW`
 * dedupe key at nearly the same instant — this test proves that race never produces two
 * notification rows, and that every concurrent caller still gets back a valid (the same) record
 * rather than an unhandled rejection.
 */
describe('Notification (userId, dedupeKey) dedup under real concurrency', () => {
  let prisma: PrismaClient;
  let repository: PrismaNotificationRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    repository = new PrismaNotificationRepository(prisma as never);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTestUser(): Promise<string> {
    const email = `test-concurrency-notification-${randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email, password: 'not-a-real-hash' } });
    return user.id;
  }

  function notificationInput(userId: string, dedupeKey: string): CreateNotificationInput {
    return {
      userId,
      kind: 'AMBIGUOUS_REPLY_REVIEW',
      relatedInboxMessageId: randomUUID(),
      relatedApplicationId: null,
      title: 'A reply needs manual review',
      body: 'A message could not be automatically matched to one of your applications.',
      dedupeKey,
    };
  }

  it('several concurrent notify() calls with the same dedupe key never persist more than one row, and every caller resolves', async () => {
    const userId = await createTestUser();
    const dedupeKey = `AMBIGUOUS_REPLY_REVIEW:${randomUUID()}`;

    const attempt = () => repository.createIfNotDuplicate(notificationInput(userId, dedupeKey), new Date());
    const results = await Promise.allSettled([attempt(), attempt(), attempt(), attempt(), attempt()]);

    // Unlike InboxMessage.create()'s bare P2002 race, createIfNotDuplicate() is designed to never
    // reject on a legitimate dedupe race — every concurrent caller must resolve successfully.
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const fulfilledResults = results as PromiseFulfilledResult<Awaited<ReturnType<typeof repository.createIfNotDuplicate>>>[];
    const newlyCreatedCount = fulfilledResults.filter((r) => r.value.wasNewlyCreated).length;
    expect(newlyCreatedCount).toBe(1);

    // Every caller — winner and losers alike — must agree on the same underlying notification id.
    const notificationIds = new Set(fulfilledResults.map((r) => r.value.notification.id));
    expect(notificationIds.size).toBe(1);

    const rows = await prisma.notification.findMany({ where: { userId, dedupeKey } });
    expect(rows).toHaveLength(1);

    await prisma.user.delete({ where: { id: userId } });
  });

  it('the same dedupe key for two DIFFERENT users is not treated as a duplicate', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const sharedDedupeKey = `AMBIGUOUS_REPLY_REVIEW:${randomUUID()}`;

    const results = await Promise.allSettled([
      repository.createIfNotDuplicate(notificationInput(userA, sharedDedupeKey), new Date()),
      repository.createIfNotDuplicate(notificationInput(userB, sharedDedupeKey), new Date()),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const rowsA = await prisma.notification.findMany({ where: { userId: userA, dedupeKey: sharedDedupeKey } });
    const rowsB = await prisma.notification.findMany({ where: { userId: userB, dedupeKey: sharedDedupeKey } });
    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);

    await prisma.user.delete({ where: { id: userA } });
    await prisma.user.delete({ where: { id: userB } });
  });

  it('a sequential repeat call after the first has already committed returns the existing row via the fast findUnique path', async () => {
    const userId = await createTestUser();
    const dedupeKey = `AMBIGUOUS_REPLY_REVIEW:${randomUUID()}`;

    const first = await repository.createIfNotDuplicate(notificationInput(userId, dedupeKey), new Date());
    const second = await repository.createIfNotDuplicate(notificationInput(userId, dedupeKey), new Date());

    expect(first.wasNewlyCreated).toBe(true);
    expect(second.wasNewlyCreated).toBe(false);
    expect(second.notification.id).toBe(first.notification.id);

    await prisma.user.delete({ where: { id: userId } });
  });
});
