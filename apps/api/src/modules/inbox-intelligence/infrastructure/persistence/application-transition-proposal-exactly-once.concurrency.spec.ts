import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@german-job-engine/database';
import { PrismaApplicationTransitionProposalRepository } from './prisma-application-transition-proposal.repository';

/**
 * M30 Phase 7/19 — real Postgres concurrency test for
 * `ApplicationTransitionProposalRepository.tryTransition()`, matching the established
 * M28.5/M28.6/M29/M30 pattern exactly: requires a live database reachable via `DATABASE_URL`,
 * excluded from the default `pnpm test`/CI run, run on demand via `pnpm test:concurrency`.
 *
 * What this proves: a self-caught concurrency gap in `ApplicationTransitionProposalService`'s
 * first version of the M30 Phase 7 fix — `confirmProposal()`/`rejectProposal()` checked
 * `proposal.status === 'PENDING'` via a plain read, then wrote via an unconditional
 * `update({ where: { id } })`. Two concurrent callers for the SAME proposal id could both pass the
 * read-check before either write landed, both dispatch the underlying domain command a second
 * time — a real violation of the brief's own explicit "exactly-once execution" requirement. The
 * fix replaces the read-then-write with the same conditional `updateMany` + affected-row-count
 * idiom `PrismaEmailQueueRepository.claimBatch()` already uses to claim a row exactly once. This
 * test fires real concurrent `tryTransition()` calls (not sequential awaits) against the same row
 * to prove exactly one ever wins.
 */
describe('ApplicationTransitionProposal exactly-once transition under real concurrency', () => {
  let prisma: PrismaClient;
  let repository: PrismaApplicationTransitionProposalRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    repository = new PrismaApplicationTransitionProposalRepository(prisma as never);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createFixture(): Promise<{ userId: string; mailboxId: string; messageId: string; proposalId: string }> {
    const email = `test-concurrency-proposal-${randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email, password: 'not-a-real-hash' } });
    const mailbox = await prisma.connectedMailbox.create({
      data: {
        userId: user.id,
        provider: 'GOOGLE_GMAIL',
        providerAccountId: randomUUID(),
        emailAddress: email,
        status: 'CONNECTED',
      },
    });
    const message = await prisma.inboxMessage.create({
      data: {
        connectedMailboxId: mailbox.id,
        providerMessageId: randomUUID(),
        fromAddress: 'recruiter@example.com',
        toAddress: email,
        subject: 'Interview invitation',
        receivedAt: new Date(),
        correlationStatus: 'MATCHED',
        contentHashSha256: randomUUID(),
      },
    });
    const proposal = await repository.create(
      {
        inboxMessageId: message.id,
        applicationId: randomUUID(), // cross-aggregate reference by design, same as ApplicationFollowUpControl
        proposedAction: 'INTERVIEW_INVITED',
        classification: 'INTERVIEW_INVITATION',
        confidence: 0.9,
        evidence: {},
        actorType: 'SYSTEM',
        correlationId: null,
      },
      new Date(),
    );
    return { userId: user.id, mailboxId: mailbox.id, messageId: message.id, proposalId: proposal.id };
  }

  async function cleanup(userId: string): Promise<void> {
    await prisma.user.delete({ where: { id: userId } });
  }

  it('several concurrent confirm attempts on the same PENDING proposal — exactly one wins', async () => {
    const { userId, proposalId } = await createFixture();

    const attempt = () => repository.tryTransition(proposalId, 'PENDING', 'CONFIRMED', userId, new Date());
    const results = await Promise.all([attempt(), attempt(), attempt(), attempt(), attempt()]);

    const winners = results.filter((r) => r !== null);
    expect(winners).toHaveLength(1);

    const row = await prisma.applicationTransitionProposal.findUniqueOrThrow({ where: { id: proposalId } });
    expect(row.status).toBe('CONFIRMED');
    expect(row.confirmedByUserId).toBe(userId);

    await cleanup(userId);
  });

  it('a confirm racing a reject on the same PENDING proposal — exactly one side wins, never both', async () => {
    const { userId, proposalId } = await createFixture();

    const [confirmResult, rejectResult] = await Promise.all([
      repository.tryTransition(proposalId, 'PENDING', 'CONFIRMED', userId, new Date()),
      repository.tryTransition(proposalId, 'PENDING', 'REJECTED', userId, new Date()),
    ]);

    const winners = [confirmResult, rejectResult].filter((r) => r !== null);
    expect(winners).toHaveLength(1);

    const row = await prisma.applicationTransitionProposal.findUniqueOrThrow({ where: { id: proposalId } });
    expect(['CONFIRMED', 'REJECTED']).toContain(row.status);
    // Whichever one actually won is reflected consistently — not a torn write.
    if (row.status === 'CONFIRMED') {
      expect(confirmResult).not.toBeNull();
      expect(rejectResult).toBeNull();
    } else {
      expect(rejectResult).not.toBeNull();
      expect(confirmResult).toBeNull();
    }

    await cleanup(userId);
  });

  it('a second confirm attempt after the proposal is already CONFIRMED gets null, never a second claim', async () => {
    const { userId, proposalId } = await createFixture();

    const first = await repository.tryTransition(proposalId, 'PENDING', 'CONFIRMED', userId, new Date());
    const second = await repository.tryTransition(proposalId, 'PENDING', 'CONFIRMED', userId, new Date());

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    await cleanup(userId);
  });

  it('rolling a claimed CONFIRMED proposal back to PENDING (unexpected-failure recovery) succeeds exactly once and is retryable', async () => {
    const { userId, proposalId } = await createFixture();

    const claimed = await repository.tryTransition(proposalId, 'PENDING', 'CONFIRMED', userId, new Date());
    expect(claimed).not.toBeNull();

    const rolledBack = await repository.tryTransition(proposalId, 'CONFIRMED', 'PENDING', userId, new Date());
    expect(rolledBack).not.toBeNull();
    expect(rolledBack!.status).toBe('PENDING');
    expect(rolledBack!.confirmedByUserId).toBeNull();
    expect(rolledBack!.confirmedAt).toBeNull();

    // Now retryable — a fresh claim succeeds again.
    const reclaimed = await repository.tryTransition(proposalId, 'PENDING', 'CONFIRMED', userId, new Date());
    expect(reclaimed).not.toBeNull();

    await cleanup(userId);
  });
});
