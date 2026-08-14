import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UserRole } from '@german-job-engine/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';
import { STORAGE_PORT, StoragePort, StorageObjectNotFoundError, StorageObjectTooLargeError } from '../src/modules/documents/domain/ports/storage.port';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://job_engine:change_me@localhost:5432/german_job_engine?schema=public';

/** In-memory `StoragePort` fake — this suite's real subject is the HTTP upload boundary (multer
 * parsing/limits/error-mapping via `PinnedFileInterceptor`, magic-byte/MIME policy enforcement,
 * auth), not object-storage connectivity, which already has its own dedicated, real-MinIO
 * integration coverage (`minio-storage.adapter.integration.spec.ts`, run on demand via
 * `pnpm test:integration`). Overriding `STORAGE_PORT` here matches this repo's own established
 * e2e pattern of overriding exactly one real infrastructure seam (e.g. `EXECUTION_CLOCK` in
 * `execution-activation.e2e-spec.ts`) while leaving the entire real app module graph — auth guard,
 * multer/interceptor, magic-byte policy, Prisma persistence — genuinely wired and exercised. */
class InMemoryStoragePort implements StoragePort {
  readonly providerId = 'in-memory-test-double';
  private readonly objects = new Map<string, Buffer>();

  async putObject(bucket: string, objectKey: string, content: Buffer): Promise<void> {
    this.objects.set(`${bucket}/${objectKey}`, content);
  }

  async getObject(bucket: string, objectKey: string, maxBytes: number): Promise<Buffer> {
    const content = this.objects.get(`${bucket}/${objectKey}`);
    if (!content) throw new StorageObjectNotFoundError(objectKey);
    if (content.length > maxBytes) throw new StorageObjectTooLargeError(objectKey);
    return content;
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    this.objects.delete(`${bucket}/${objectKey}`);
  }

  async objectExists(bucket: string, objectKey: string): Promise<boolean> {
    return this.objects.has(`${bucket}/${objectKey}`);
  }
}

const REAL_PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('real e2e regression-test PDF content, not a fixture stub'.repeat(20))]);
const REAL_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, ...Buffer.from('real jpeg bytes for the e2e regression suite'.repeat(5))]);

/**
 * M32 Security Remediation — real, HTTP-level regression coverage for the document upload
 * endpoint, added because none existed before this pass: `document-upload.service.spec.ts` covers
 * the service/policy layer with mocks, but the actual HTTP/multer boundary (the exact layer this
 * milestone's multer remediation touches — see `PinnedFileInterceptor`) had zero real end-to-end
 * coverage. Bootstraps the real, unmodified `AppModule` — real `JwtAuthGuard`, real
 * `PinnedFileInterceptor`, real magic-byte/MIME attachment policy, real Prisma persistence —
 * the only override is `STORAGE_PORT` (see `InMemoryStoragePort` above).
 */
describe('Documents upload (real HTTP, real multer/interceptor boundary) [e2e]', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let candidateToken: string;
  let candidateId: string;
  let otherCandidateToken: string;
  let otherCandidateId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STORAGE_PORT)
      .useValue(new InMemoryStoragePort())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    candidateId = randomUUID();
    otherCandidateId = randomUUID();
    const passwordHash = await bcrypt.hash('Password123!', 4);
    const candidateEmail = `m32-upload-e2e-${Date.now()}@example.com`;
    const otherEmail = `m32-upload-e2e-other-${Date.now()}@example.com`;

    await prisma.user.create({ data: { id: candidateId, email: candidateEmail, password: passwordHash, role: UserRole.CANDIDATE } });
    await prisma.user.create({ data: { id: otherCandidateId, email: otherEmail, password: passwordHash, role: UserRole.CANDIDATE } });

    const login = await request(app.getHttpServer()).post('/auth/login').send({ email: candidateEmail, password: 'Password123!' });
    candidateToken = login.body?.accessToken;

    const otherLogin = await request(app.getHttpServer()).post('/auth/login').send({ email: otherEmail, password: 'Password123!' });
    otherCandidateToken = otherLogin.body?.accessToken;

    if (!candidateToken || !otherCandidateToken) {
      throw new Error('Failed to obtain real access tokens via /auth/login — cannot run upload e2e suite.');
    }
  });

  afterAll(async () => {
    await prisma.candidateDocument.deleteMany({ where: { ownerUserId: { in: [candidateId, otherCandidateId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [candidateId, otherCandidateId] } } });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${candidateToken}` });

  it('1. accepts a valid, supported document (real PDF magic bytes)', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents')
      .set(auth())
      .field('documentType', 'CV')
      .attach('file', REAL_PDF, { filename: 'cv.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe('application/pdf');
    expect(res.body.safeFileName).toBe('cv.pdf');
    expect(res.body.sizeBytes).toBe(REAL_PDF.length);
  });

  it('2. rejects an invalid/mismatched MIME type (magic-byte sniffing catches a mislabeled JPEG as a PDF)', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents')
      .set(auth())
      .field('documentType', 'CV')
      .attach('file', REAL_JPEG, { filename: 'cv.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('MAGIC_BYTES_MISMATCH');
  });

  it('3. rejects an oversized file at the real multer/interceptor boundary (PayloadTooLargeException, not the app-level policy)', async () => {
    const oversized = Buffer.alloc(16 * 1024 * 1024, 'a'); // exceeds the 15MB MULTER_OUTER_SIZE_BOUND_BYTES
    const res = await request(app.getHttpServer())
      .post('/documents')
      .set(auth())
      .field('documentType', 'CV')
      .attach('file', oversized, { filename: 'huge.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(413);
  });

  it('4. rejects an empty file', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents')
      .set(auth())
      .field('documentType', 'CV')
      .attach('file', Buffer.alloc(0), { filename: 'empty.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('EMPTY_FILE');
  });

  it('5. rejects a malformed multipart request (wrong Content-Type, no real multipart boundary)', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents')
      .set(auth())
      .set('Content-Type', 'multipart/form-data; boundary=broken')
      .send('this is not a real multipart body at all');

    expect(res.status).toBe(400);
  });

  it('6. sanitizes an unusual/hostile filename (path traversal, null-ish separators) into a safe delivery name', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents')
      .set(auth())
      .field('documentType', 'CV')
      .attach('file', REAL_PDF, { filename: '../../../etc/passwd/../weird name (é).pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.safeFileName).not.toMatch(/[/\\]/);
    expect(res.body.safeFileName).not.toContain('..');
  });

  it('7. handles multiple sequential upload attempts for the same owner (real versioning)', async () => {
    const first = await request(app.getHttpServer())
      .post('/documents')
      .set(auth())
      .field('documentType', 'MOTIVATION_LETTER')
      .attach('file', REAL_PDF, { filename: 'letter-v1.pdf', contentType: 'application/pdf' });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/documents')
      .set(auth())
      .field('documentType', 'MOTIVATION_LETTER')
      .attach('file', REAL_PDF, { filename: 'letter-v2.pdf', contentType: 'application/pdf' });
    expect(second.status).toBe(201);
    expect(second.body.version).toBeGreaterThan(first.body.version);
  });

  it('8a. rejects an upload with no auth token', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents')
      .field('documentType', 'CV')
      .attach('file', REAL_PDF, { filename: 'cv.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(401);
  });

  it("8b. a candidate cannot read another candidate's uploaded document", async () => {
    const upload = await request(app.getHttpServer())
      .post('/documents')
      .set(auth())
      .field('documentType', 'CV')
      .attach('file', REAL_PDF, { filename: 'private.pdf', contentType: 'application/pdf' });
    expect(upload.status).toBe(201);

    const res = await request(app.getHttpServer())
      .get(`/documents/me/${upload.body.id}`)
      .set({ Authorization: `Bearer ${otherCandidateToken}` });

    // The controller returns the literal value `null` for cross-owner access (see
    // DocumentsController.getMine) — Express/NestJS sends this as an empty JSON body, which
    // supertest surfaces as `{}` rather than a parsed `null` (a real, pre-existing
    // supertest/Express serialization quirk, unrelated to this remediation). The property this
    // test actually verifies — that no other candidate's real document data (id/fileName/mimeType)
    // is ever returned — holds either way.
    expect(res.body).not.toHaveProperty('id');
    expect(res.body).not.toHaveProperty('safeFileName');
    expect(res.body).not.toHaveProperty('mimeType');
  });

  it('9. existing document workflow: list-mine reflects real uploaded documents', async () => {
    const res = await request(app.getHttpServer()).get('/documents/me').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const doc of res.body) {
      expect(doc.storageProvider).toBeUndefined();
      expect(doc.storageBucket).toBeUndefined();
      expect(doc.storageObjectKey).toBeUndefined();
    }
  });
});
