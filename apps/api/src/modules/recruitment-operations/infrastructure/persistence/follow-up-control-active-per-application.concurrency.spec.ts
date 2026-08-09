import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@german-job-engine/database';
import { PrismaFollowUpControlRepository } from './prisma-follow-up-control.repository';
import { CreateFollowUpControlInput } from '../../domain/models/follow-up-control';

/**
 * M30 — real Postgres concurrency test for `FollowUpControlRepository.createSuperseding()`,
 * matching the established M28.5/M28.6/M29 pattern exactly: requires a live database reachable
 * via `DATABASE_URL`, excluded from the default `pnpm test`/CI run, run on demand via
 * `pnpm test:concurrency`.
 *
 * What this proves: the partial unique index
 * (`application_follow_up_controls_active_per_application_unique` — `applicationId` WHERE
 * status='ACTIVE') is the real backstop "enforce one coherent active control decision per
 * applicable scope" (Phase 3) relies on. The application-layer "mark old ACTIVE row SUPERSEDED,
 * then create new ACTIVE row" transaction is not by itself sufficient to guarantee "at most one
 * active control per application" under genuine concurrent writes — this fires real concurrent
 * `createSuperseding()` calls (not sequential awaits) to prove exactly one ever wins per race, and
 * that an application can never end up with two simultaneously ACTIVE follow-up controls.
 */
describe('ApplicationFollowUpControl active-per-application uniqueness under real concurrency', () => {
  let prisma: PrismaClient;
  let repository: PrismaFollowUpControlRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    repository = new PrismaFollowUpControlRepository(prisma as never);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTestUser(): Promise<string> {
    const email = `test-concurrency-followup-${randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email, password: 'not-a-real-hash' } });
    return user.id;
  }

  function controlInput(userId: string, applicationId: string, overrides: Partial<CreateFollowUpControlInput> = {}): CreateFollowUpControlInput {
    return {
      userId,
      applicationId,
      campaignId: 'campaign-1',
      companyId: null,
      jobId: null,
      sourceInboxMessageId: null,
      sourceProviderMessageId: null,
      controlType: 'TEMPORARY_HOLD',
      reasonCode: 'DOCUMENT_REQUEST',
      explanation: 'Documents requested.',
      classification: 'DOCUMENT_REQUEST',
      confidence: 0.7,
      evidence: null,
      createdByActorType: 'SYSTEM',
      createdByActorId: null,
      expiresAt: null,
      correlationId: null,
      idempotencyKey: `followup-control:${applicationId}:${randomUUID()}`,
      ...overrides,
    };
  }

  it('several concurrent first-time control creations for the same application never leave more than one ACTIVE row', async () => {
    const userId = await createTestUser();
    const applicationId = randomUUID(); // Application isn't a Prisma FK target here (plain id, cross-aggregate reference by design) — a real, disposable id is enough to prove the constraint.

    // Not asserting an exact fulfilled/rejected split — matching M28.6's own identical note: some
    // of these 5 concurrent calls may genuinely race and only one can win (the rest reject
    // P2002), or several may serialize fast enough to each correctly supersede the prior (also
    // legitimate). The invariant the partial unique index actually guarantees, checked below, is
    // exactly one final ACTIVE row.
    const attempt = () => repository.createSuperseding(controlInput(userId, applicationId), new Date());
    const results = await Promise.allSettled([attempt(), attempt(), attempt(), attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.length + rejected.length).toBe(5);
    for (const failure of rejected) {
      expect((failure as PromiseRejectedResult).reason.code).toBe('P2002');
    }

    const activeRows = await prisma.applicationFollowUpControl.findMany({ where: { applicationId, status: 'ACTIVE' } });
    expect(activeRows).toHaveLength(1);

    await prisma.user.delete({ where: { id: userId } });
  });

  it('a real sequential supersede (e.g. DOCUMENT_REQUEST hold followed by a REJECTION) correctly supersedes the prior active control', async () => {
    const userId = await createTestUser();
    const applicationId = randomUUID();

    const first = await repository.createSuperseding(controlInput(userId, applicationId), new Date());
    const second = await repository.createSuperseding(
      controlInput(userId, applicationId, { controlType: 'PERMANENT_SUPPRESSION', reasonCode: 'REJECTION', explanation: 'Application rejected.', idempotencyKey: `followup-control:${applicationId}:${randomUUID()}` }),
      new Date(),
    );

    expect(first.status).toBe('ACTIVE');
    expect(second.controlType).toBe('PERMANENT_SUPPRESSION');

    const rows = await prisma.applicationFollowUpControl.findMany({ where: { applicationId }, orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.status)).toEqual(['SUPERSEDED', 'ACTIVE']);

    await prisma.user.delete({ where: { id: userId } });
  });

  it('concurrent supersedes after a real prior active control still result in exactly one final ACTIVE row', async () => {
    const userId = await createTestUser();
    const applicationId = randomUUID();
    await repository.createSuperseding(controlInput(userId, applicationId), new Date());

    const attempt = () => repository.createSuperseding(controlInput(userId, applicationId, { idempotencyKey: `followup-control:${applicationId}:${randomUUID()}` }), new Date());
    const results = await Promise.allSettled([attempt(), attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const activeRows = await prisma.applicationFollowUpControl.findMany({ where: { applicationId, status: 'ACTIVE' } });
    expect(activeRows).toHaveLength(1);

    await prisma.user.delete({ where: { id: userId } });
  });

  it('two different applications creating controls concurrently never interfere with each other', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const applicationA = randomUUID();
    const applicationB = randomUUID();

    const results = await Promise.allSettled([
      repository.createSuperseding(controlInput(userA, applicationA), new Date()),
      repository.createSuperseding(controlInput(userB, applicationB), new Date()),
      repository.createSuperseding(controlInput(userA, applicationA, { controlType: 'PERMANENT_SUPPRESSION', idempotencyKey: `followup-control:${applicationA}:${randomUUID()}` }), new Date()),
      repository.createSuperseding(controlInput(userB, applicationB, { controlType: 'PERMANENT_SUPPRESSION', idempotencyKey: `followup-control:${applicationB}:${randomUUID()}` }), new Date()),
    ]);

    expect(results.every((r) => r.status === 'fulfilled' || (r as PromiseRejectedResult).reason.code === 'P2002')).toBe(true);

    const activeA = await prisma.applicationFollowUpControl.findMany({ where: { applicationId: applicationA, status: 'ACTIVE' } });
    const activeB = await prisma.applicationFollowUpControl.findMany({ where: { applicationId: applicationB, status: 'ACTIVE' } });
    expect(activeA).toHaveLength(1);
    expect(activeB).toHaveLength(1);

    await prisma.user.delete({ where: { id: userA } });
    await prisma.user.delete({ where: { id: userB } });
  });
});
