import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@german-job-engine/database';
import { PrismaEmailQueueRepository } from './prisma-email-queue.repository';

/**
 * M28 — real Postgres concurrency test for `EmailQueueRepository.claimBatch()`, matching the M27
 * `webhook-and-checkout-dedup.concurrency.spec.ts` precedent: requires a live database reachable
 * via `DATABASE_URL`, excluded from the default `pnpm test` run (see package.json's
 * `testPathIgnorePatterns`), and run on demand via `pnpm test:concurrency`.
 *
 * What this actually proves: `claimBatch()` claims a message via a conditional `updateMany({
 * where: { id, status: candidate.status } })`, not a `SELECT ... FOR UPDATE`. Under genuine
 * concurrent workers reading the same QUEUED row before either write commits, only the DB's own
 * atomic row-level update — the `count === 1` check — can be trusted to mean "I actually won the
 * claim." This test fires several real concurrent `claimBatch()` calls against one shared row
 * (not mocks, not sequential awaits) to prove exactly one worker ever wins it.
 */
describe('PrismaEmailQueueRepository.claimBatch() under real concurrency', () => {
  let prisma: PrismaClient;
  let repository: PrismaEmailQueueRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    repository = new PrismaEmailQueueRepository(prisma as never);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('claims a single QUEUED message exactly once across concurrent workers', async () => {
    const idempotencyKey = `test-concurrency-claim-${randomUUID()}`;
    const now = new Date();
    const message = await prisma.emailMessage.create({
      data: {
        idempotencyKey,
        priority: 'NORMAL',
        status: 'QUEUED',
        senderName: 'German Job Engine',
        senderEmail: 'noreply@example.com',
        recipientEmail: 'recruiter@example.de',
        subject: 'Concurrency test',
        plainTextBody: 'Hello',
        htmlBody: null,
        attachmentsMeta: [],
        maxAttempts: 5,
        correlationId: null,
        traceId: null,
        campaignId: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    const workers = Array.from({ length: 8 }, () => repository.claimBatch(1, new Date()));
    const results = await Promise.all(workers);

    const winners = results.filter((claimed) => claimed.some((m) => m.id === message.id));
    expect(winners).toHaveLength(1);

    const row = await prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(row.status).toBe('SENDING');
    expect(row.attempts).toBe(1);

    await prisma.emailMessage.delete({ where: { id: message.id } });
  });

  it('never double-claims across many concurrently queued messages', async () => {
    const batchTag = `test-concurrency-batch-${randomUUID()}`;
    const now = new Date();
    const created = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        prisma.emailMessage.create({
          data: {
            idempotencyKey: `${batchTag}-${i}`,
            priority: 'NORMAL',
            status: 'QUEUED',
            senderName: 'German Job Engine',
            senderEmail: 'noreply@example.com',
            recipientEmail: `recruiter-${i}@example.de`,
            subject: 'Concurrency batch test',
            plainTextBody: 'Hello',
            htmlBody: null,
            attachmentsMeta: [],
            maxAttempts: 5,
            correlationId: null,
            traceId: null,
            campaignId: null,
            createdAt: now,
            updatedAt: now,
          },
        }),
      ),
    );

    const workers = Array.from({ length: 5 }, () => repository.claimBatch(10, new Date()));
    const results = await Promise.all(workers);
    const claimedIds = results.flat().map((m) => m.id);
    const uniqueClaimedIds = new Set(claimedIds);

    expect(claimedIds).toHaveLength(uniqueClaimedIds.size);
    expect(uniqueClaimedIds.size).toBe(created.length);

    await prisma.emailMessage.deleteMany({ where: { id: { in: created.map((m) => m.id) } } });
  });
});
