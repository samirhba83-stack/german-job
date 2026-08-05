import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@german-job-engine/database';
import { PrismaInboxWatchRepository } from './prisma-inbox-watch.repository';
import { PrismaConnectedMailboxRepository } from '../../../connected-mailbox/infrastructure/persistence/prisma-connected-mailbox.repository';
import { CreateConnectedMailboxInput } from '../../../connected-mailbox/domain/models/connected-mailbox';
import { CreateInboxWatchInput } from '../../domain/models/inbox-watch';

/**
 * M29 — real Postgres concurrency test for `InboxWatchRepository.upsert()`, matching the M28.6
 * `connected-mailbox-active-per-user.concurrency.spec.ts` precedent: requires a live database
 * reachable via `DATABASE_URL`, excluded from the default `pnpm test`/CI run, run on demand via
 * `pnpm test:concurrency`.
 *
 * What this proves: `InboxWatch.connectedMailboxId` is `@unique` in the schema (Phase 5 — "one real
 * provider-native change-notification registration per inbox-enabled mailbox"). Two concurrent
 * watch-registration/renewal attempts for the SAME mailbox (a real scenario: the polling tick
 * driver and a provider webhook notification both triggering renewal at the same moment) must
 * never leave two competing `InboxWatch` rows — Prisma's native Postgres `upsert()` on a unique
 * target compiles to an atomic `INSERT ... ON CONFLICT DO UPDATE`, so this test proves that
 * atomicity actually holds under genuine concurrent load, not just sequential calls.
 */
describe('InboxWatch one-row-per-mailbox uniqueness under real concurrency', () => {
  let prisma: PrismaClient;
  let watchRepository: PrismaInboxWatchRepository;
  let mailboxRepository: PrismaConnectedMailboxRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    watchRepository = new PrismaInboxWatchRepository(prisma as never);
    mailboxRepository = new PrismaConnectedMailboxRepository(prisma as never);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTestUser(): Promise<string> {
    const email = `test-concurrency-watch-${randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email, password: 'not-a-real-hash' } });
    return user.id;
  }

  async function createTestMailbox(userId: string): Promise<string> {
    const input: CreateConnectedMailboxInput = {
      userId,
      provider: 'GOOGLE_GMAIL',
      providerAccountId: randomUUID(),
      emailAddress: `${randomUUID()}@gmail.com`,
      displayName: 'Test Candidate',
      grantedScopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid'],
      encryptedRefreshToken: 'iv:tag:ciphertext',
      encryptedAccessToken: 'iv:tag:ciphertext',
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      tokenEncryptionVersion: 1,
      hasRefreshToken: true,
      consentVersion: '1.0',
    };
    const mailbox = await mailboxRepository.createConnected(input, new Date());
    return mailbox.id;
  }

  function watchInput(connectedMailboxId: string, overrides: Partial<CreateInboxWatchInput> = {}): CreateInboxWatchInput {
    return {
      connectedMailboxId,
      provider: 'GOOGLE_GMAIL',
      providerWatchId: null,
      historyCursor: randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      ...overrides,
    };
  }

  it('several concurrent watch registrations for the same mailbox never leave more than one InboxWatch row', async () => {
    const userId = await createTestUser();
    const mailboxId = await createTestMailbox(userId);

    const attempt = (cursor: string) => watchRepository.upsert(watchInput(mailboxId, { historyCursor: cursor }), new Date());
    const results = await Promise.allSettled([attempt('cursor-a'), attempt('cursor-b'), attempt('cursor-c'), attempt('cursor-d'), attempt('cursor-e')]);

    // upsert() never throws on a legitimate race (unlike create()) — every call should resolve.
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const rows = await prisma.inboxWatch.findMany({ where: { connectedMailboxId: mailboxId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ACTIVE');

    await prisma.user.delete({ where: { id: userId } }); // cascades to connected_mailboxes -> inbox_watches
  });

  it('a renewal upsert after an existing watch correctly updates the same row rather than creating a second one', async () => {
    const userId = await createTestUser();
    const mailboxId = await createTestMailbox(userId);

    const first = await watchRepository.upsert(watchInput(mailboxId, { historyCursor: 'cursor-initial' }), new Date());
    const renewed = await watchRepository.upsert(watchInput(mailboxId, { historyCursor: 'cursor-renewed' }), new Date());

    expect(renewed.id).toBe(first.id);
    expect(renewed.historyCursor).toBe('cursor-renewed');

    const rows = await prisma.inboxWatch.findMany({ where: { connectedMailboxId: mailboxId } });
    expect(rows).toHaveLength(1);

    await prisma.user.delete({ where: { id: userId } });
  });

  it('two different mailboxes registering watches concurrently never interfere with each other', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const mailboxA = await createTestMailbox(userA);
    const mailboxB = await createTestMailbox(userB);

    const results = await Promise.allSettled([
      watchRepository.upsert(watchInput(mailboxA, { historyCursor: 'a1' }), new Date()),
      watchRepository.upsert(watchInput(mailboxB, { historyCursor: 'b1' }), new Date()),
      watchRepository.upsert(watchInput(mailboxA, { historyCursor: 'a2' }), new Date()),
      watchRepository.upsert(watchInput(mailboxB, { historyCursor: 'b2' }), new Date()),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const rowsA = await prisma.inboxWatch.findMany({ where: { connectedMailboxId: mailboxA } });
    const rowsB = await prisma.inboxWatch.findMany({ where: { connectedMailboxId: mailboxB } });
    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);

    await prisma.user.delete({ where: { id: userA } });
    await prisma.user.delete({ where: { id: userB } });
  });
});
