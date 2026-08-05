import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@german-job-engine/database';
import { PrismaInboxMessageRepository } from './prisma-inbox-message.repository';
import { PrismaConnectedMailboxRepository } from '../../../connected-mailbox/infrastructure/persistence/prisma-connected-mailbox.repository';
import { CreateConnectedMailboxInput } from '../../../connected-mailbox/domain/models/connected-mailbox';
import { CreateInboxMessageInput } from '../../domain/models/inbox-message';

/**
 * M29 — real Postgres concurrency test for `InboxMessageRepository.create()`. Requires a live
 * database reachable via `DATABASE_URL`, excluded from the default `pnpm test`/CI run, run on
 * demand via `pnpm test:concurrency`.
 *
 * What this proves: `@@unique([connectedMailboxId, providerMessageId])` (schema doc comment,
 * Phase 5/21 — "notification replay is idempotent") is the real backstop against a redelivered
 * Gmail Pub/Sub push or Graph change notification creating a second `InboxMessage` row for the
 * same provider message. `ReplyIngestionService` itself only checks-then-creates (see its own
 * idempotency note) — it is this DB constraint, not application logic, that makes the guarantee
 * hold under genuine concurrent delivery, exactly mirroring the M28.5 `CandidateDocument`
 * versioning precedent and the M28.6 connected-mailbox-active-per-user precedent.
 */
describe('InboxMessage (connectedMailboxId, providerMessageId) idempotency under real concurrency', () => {
  let prisma: PrismaClient;
  let messageRepository: PrismaInboxMessageRepository;
  let mailboxRepository: PrismaConnectedMailboxRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    messageRepository = new PrismaInboxMessageRepository(prisma as never);
    mailboxRepository = new PrismaConnectedMailboxRepository(prisma as never);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTestUser(): Promise<string> {
    const email = `test-concurrency-inbox-msg-${randomUUID()}@example.com`;
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

  function messageInput(connectedMailboxId: string, providerMessageId: string): CreateInboxMessageInput {
    return {
      connectedMailboxId,
      providerMessageId,
      providerThreadId: 'thread-1',
      rfcMessageId: '<reply-1@company.example>',
      inReplyTo: null,
      referencesHeaders: [],
      fromAddress: 'hr@company.example',
      toAddress: 'candidate@example.com',
      subject: 'Re: Your application',
      receivedAt: new Date(),
      correlationStatus: 'MATCHED',
      correlationConfidence: 0.97,
      correlationEvidence: [],
      correlatedApplicationId: randomUUID(),
      correlatedCampaignId: null,
      contentHashSha256: createHash('sha256').update(providerMessageId).digest('hex'),
      sanitizedExcerpt: 'We would like to invite you to interview.',
      detectedLanguage: 'EN',
    };
  }

  it('several concurrent creates for the same (mailbox, provider message id) — a simulated webhook replay — only ever persist one row', async () => {
    const userId = await createTestUser();
    const mailboxId = await createTestMailbox(userId);
    const providerMessageId = randomUUID();

    const attempt = () => messageRepository.create(messageInput(mailboxId, providerMessageId), new Date());
    const results = await Promise.allSettled([attempt(), attempt(), attempt(), attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(4);
    for (const failure of rejected) {
      expect((failure as PromiseRejectedResult).reason.code).toBe('P2002');
    }

    const rows = await prisma.inboxMessage.findMany({ where: { connectedMailboxId: mailboxId, providerMessageId } });
    expect(rows).toHaveLength(1);

    await prisma.user.delete({ where: { id: userId } });
  });

  it('the same providerMessageId across two DIFFERENT mailboxes is not treated as a duplicate', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const mailboxA = await createTestMailbox(userA);
    const mailboxB = await createTestMailbox(userB);
    const sharedProviderMessageId = randomUUID();

    const results = await Promise.allSettled([
      messageRepository.create(messageInput(mailboxA, sharedProviderMessageId), new Date()),
      messageRepository.create(messageInput(mailboxB, sharedProviderMessageId), new Date()),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const rowsA = await prisma.inboxMessage.findMany({ where: { connectedMailboxId: mailboxA, providerMessageId: sharedProviderMessageId } });
    const rowsB = await prisma.inboxMessage.findMany({ where: { connectedMailboxId: mailboxB, providerMessageId: sharedProviderMessageId } });
    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);

    await prisma.user.delete({ where: { id: userA } });
    await prisma.user.delete({ where: { id: userB } });
  });
});
