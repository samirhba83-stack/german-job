import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@german-job-engine/database';
import { PrismaConnectedMailboxRepository } from './prisma-connected-mailbox.repository';
import { CreateConnectedMailboxInput } from '../../domain/models/connected-mailbox';

/**
 * M28.6 — real Postgres concurrency test for `ConnectedMailboxRepository.createConnected()`,
 * matching the M28.5 `candidate-document-version.concurrency.spec.ts` precedent exactly: requires
 * a live database reachable via `DATABASE_URL`, excluded from the default `pnpm test`/CI run, run
 * on demand via `pnpm test:concurrency`.
 *
 * What this proves: `createConnected()`'s own transaction (deactivate-then-create) is not by
 * itself sufficient to guarantee "at most one active connected mailbox per user" under genuine
 * concurrent connection attempts — the same READ COMMITTED race M28.5 already demonstrated for
 * `CandidateDocument`. The real backstop is the DB-level partial unique index added proactively
 * from the start (`connected_mailboxes_active_per_user_unique`, migration
 * `20260802090000_m28_6_connected_mailbox`) — this test fires genuine concurrent
 * `createConnected()` calls (not sequential awaits) to prove exactly one ever wins, and that a
 * real user can never end up with two simultaneously active connected mailboxes.
 */
describe('ConnectedMailbox active-per-user uniqueness under real concurrency', () => {
  let prisma: PrismaClient;
  let repository: PrismaConnectedMailboxRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    repository = new PrismaConnectedMailboxRepository(prisma as never);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** ConnectedMailbox.userId is a real foreign key to User (onDelete: Cascade) — creates (and the
   * FK cascade cleans up) a real, disposable test user. */
  async function createTestUser(): Promise<string> {
    const email = `test-concurrency-mailbox-${randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email, password: 'not-a-real-hash' } });
    return user.id;
  }

  function baseInput(userId: string): CreateConnectedMailboxInput {
    return {
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
  }

  it('several concurrent first-time connections for the same user never leave more than one active mailbox — real DB constraint holds regardless of timing', async () => {
    const userId = await createTestUser();

    // Not asserting an exact fulfilled/rejected split — see candidate-document-version.concurrency
    // .spec.ts's identical note: some of these 5 concurrent calls may genuinely race and only one
    // can win (the rest reject P2002), or several may serialize fast enough to each correctly
    // supersede the prior (also legitimate). The invariant the partial unique index actually
    // guarantees, checked below, is exactly one final active row.
    const attempt = () => repository.createConnected(baseInput(userId), new Date());
    const results = await Promise.allSettled([attempt(), attempt(), attempt(), attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.length + rejected.length).toBe(5);
    for (const failure of rejected) {
      expect((failure as PromiseRejectedResult).reason.code).toBe('P2002'); // Prisma unique-constraint violation
    }

    const activeRows = await prisma.connectedMailbox.findMany({ where: { userId, isActive: true } });
    expect(activeRows).toHaveLength(1);

    await prisma.user.delete({ where: { id: userId } }); // cascades to connected_mailboxes
  });

  it('a real sequential reconnect (e.g. switching from Gmail to Outlook) correctly supersedes the prior active mailbox', async () => {
    const userId = await createTestUser();

    const first = await repository.createConnected(baseInput(userId), new Date());
    const second = await repository.createConnected({ ...baseInput(userId), provider: 'MICROSOFT_OUTLOOK' }, new Date());

    expect(first.isActive).toBe(true);

    const rows = await prisma.connectedMailbox.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.isActive)).toEqual([false, true]);
    expect(second.provider).toBe('MICROSOFT_OUTLOOK');

    await prisma.user.delete({ where: { id: userId } });
  });

  it('concurrent reconnections after a real prior active mailbox still result in exactly one final active row', async () => {
    const userId = await createTestUser();
    await repository.createConnected(baseInput(userId), new Date());

    const attempt = () => repository.createConnected(baseInput(userId), new Date());
    const results = await Promise.allSettled([attempt(), attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const activeRows = await prisma.connectedMailbox.findMany({ where: { userId, isActive: true } });
    expect(activeRows).toHaveLength(1);

    await prisma.user.delete({ where: { id: userId } });
  });

  it('two different users connecting concurrently never interfere with each other — each ends up with exactly one active mailbox', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();

    const results = await Promise.allSettled([
      repository.createConnected(baseInput(userA), new Date()),
      repository.createConnected(baseInput(userB), new Date()),
      repository.createConnected({ ...baseInput(userA), provider: 'MICROSOFT_OUTLOOK' }, new Date()),
      repository.createConnected({ ...baseInput(userB), provider: 'MICROSOFT_OUTLOOK' }, new Date()),
    ]);

    expect(results.every((r) => r.status === 'fulfilled' || (r as PromiseRejectedResult).reason.code === 'P2002')).toBe(true);

    const activeA = await prisma.connectedMailbox.findMany({ where: { userId: userA, isActive: true } });
    const activeB = await prisma.connectedMailbox.findMany({ where: { userId: userB, isActive: true } });
    expect(activeA).toHaveLength(1);
    expect(activeB).toHaveLength(1);

    await prisma.user.delete({ where: { id: userA } });
    await prisma.user.delete({ where: { id: userB } });
  });
});
