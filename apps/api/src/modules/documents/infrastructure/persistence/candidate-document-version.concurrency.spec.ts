import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@german-job-engine/database';
import { PrismaCandidateDocumentRepository } from './prisma-candidate-document.repository';
import { CreateCandidateDocumentInput } from '../../domain/models/candidate-document';

/**
 * M28.5 — real Postgres concurrency test for `CandidateDocumentRepository.createNewVersion()`,
 * matching the M27/M28 `*.concurrency.spec.ts` precedent: requires a live database reachable via
 * `DATABASE_URL`, excluded from the default `pnpm test`/CI run, run on demand via
 * `pnpm test:concurrency`.
 *
 * What this actually proves: a real race exists in `createNewVersion()`'s own transaction under
 * Postgres's default READ COMMITTED isolation — two concurrent calls for the same (ownerUserId,
 * documentType) with no prior active row can both read "no prior active" before either commits,
 * and both then attempt to insert a new `isActive: true` row. The real backstop is the DB-level
 * partial unique index added specifically because this test proved the bug
 * (`candidate_documents_active_version_unique`, migration
 * `20260801130000_m28_5_candidate_document_active_version_uniqueness`) — this test fires genuine
 * concurrent `createNewVersion()` calls (not sequential awaits) to prove exactly one ever wins,
 * and that a real user (owner+userId) can never end up with two simultaneously active documents
 * of the same type.
 */
describe('CandidateDocument active-version uniqueness under real concurrency', () => {
  let prisma: PrismaClient;
  let repository: PrismaCandidateDocumentRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    repository = new PrismaCandidateDocumentRepository(prisma as never);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** CandidateDocument.ownerUserId is a real foreign key to User (onDelete: Cascade) — a
   * synthetic id with no backing row would fail with a foreign-key violation, not the race this
   * test is actually about. Creates (and the FK cascade cleans up) a real, disposable test user. */
  async function createTestUser(): Promise<string> {
    const email = `test-concurrency-${randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email, password: 'not-a-real-hash' } });
    return user.id;
  }

  function baseInput(ownerUserId: string): CreateCandidateDocumentInput {
    return {
      ownerUserId,
      documentType: 'CV',
      storageProvider: 'minio',
      storageBucket: 'candidate-documents',
      storageObjectKey: `${ownerUserId}/cv/${randomUUID()}.pdf`,
      originalFileName: 'cv.pdf',
      safeFileName: 'cv.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksumSha256: randomUUID().replace(/-/g, ''),
      scopeApplicationId: null,
    };
  }

  it('several concurrent first-time uploads for the same owner+type never leave more than one active row — real DB constraint holds regardless of timing', async () => {
    const ownerUserId = await createTestUser();

    // Not asserting an exact fulfilled/rejected split: depending on real scheduling, some of
    // these 5 concurrent calls may genuinely race (both reading "no prior active" before either
    // commits — only one such racer can win, the rest reject P2002) while others may serialize
    // fast enough to correctly see and supersede an already-committed prior version (also a
    // legitimate success, not a bug). The invariant that must ALWAYS hold regardless of that
    // timing — the one the partial unique index actually guarantees — is checked below: exactly
    // one final active row, and every rejection (if any) is a real unique-constraint violation,
    // never some other error.
    const attempt = () => repository.createNewVersion({ ...baseInput(ownerUserId), storageObjectKey: `${ownerUserId}/cv/${randomUUID()}.pdf` });
    const results = await Promise.allSettled([attempt(), attempt(), attempt(), attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.length + rejected.length).toBe(5);
    for (const failure of rejected) {
      expect((failure as PromiseRejectedResult).reason.code).toBe('P2002'); // Prisma unique-constraint violation
    }

    const activeRows = await prisma.candidateDocument.findMany({ where: { ownerUserId, documentType: 'CV', isActive: true } });
    expect(activeRows).toHaveLength(1);

    await prisma.user.delete({ where: { id: ownerUserId } }); // cascades to candidate_documents
  });

  it('a real sequential re-upload correctly supersedes the prior version — exactly one active row at any time, version increments', async () => {
    const ownerUserId = await createTestUser();

    const first = await repository.createNewVersion(baseInput(ownerUserId));
    const second = await repository.createNewVersion({ ...baseInput(ownerUserId), storageObjectKey: `${ownerUserId}/cv/${randomUUID()}.pdf` });
    const third = await repository.createNewVersion({ ...baseInput(ownerUserId), storageObjectKey: `${ownerUserId}/cv/${randomUUID()}.pdf` });

    expect([first.version, second.version, third.version]).toEqual([1, 2, 3]);

    const rows = await prisma.candidateDocument.findMany({ where: { ownerUserId, documentType: 'CV' }, orderBy: { version: 'asc' } });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.isActive)).toEqual([false, false, true]);

    await prisma.user.delete({ where: { id: ownerUserId } });
  });

  it('concurrent re-uploads after a real prior active version still result in exactly one final active row', async () => {
    const ownerUserId = await createTestUser();
    await repository.createNewVersion(baseInput(ownerUserId));

    const attempt = () => repository.createNewVersion({ ...baseInput(ownerUserId), storageObjectKey: `${ownerUserId}/cv/${randomUUID()}.pdf` });
    const results = await Promise.allSettled([attempt(), attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const activeRows = await prisma.candidateDocument.findMany({ where: { ownerUserId, documentType: 'CV', isActive: true } });
    expect(activeRows).toHaveLength(1);

    await prisma.user.delete({ where: { id: ownerUserId } });
  });
});
