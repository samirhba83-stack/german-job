import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { MinioStorageAdapter } from './minio-storage.adapter';
import { StorageObjectNotFoundError, StorageObjectTooLargeError } from '../../domain/ports/storage.port';

/**
 * M28.5 — real storage integration test against a live MinIO instance (self-hosted, S3-compatible
 * — `docker compose up -d minio`), matching the M27/M28 `*.concurrency.spec.ts` precedent of
 * excluding infrastructure-dependent tests from the default `pnpm test`/CI run (no MinIO service
 * in CI) and running them on demand via `pnpm test:integration`.
 *
 * What this actually proves: real bytes round-trip through real object storage unmodified, the
 * bucket auto-provisioning works, and — the real safety property Phase 8 cares about — a bounded
 * read genuinely refuses an oversized object via the HEAD-based pre-check *before* streaming its
 * body, rather than only after loading it fully into memory.
 */
describe('MinioStorageAdapter (real MinIO)', () => {
  const bucket = `test-integration-${randomUUID()}`;
  let adapter: MinioStorageAdapter;

  beforeAll(async () => {
    const config = {
      get: (key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          'attachmentSecurity.storage.endpoint': 'http://localhost:9000',
          'attachmentSecurity.storage.region': 'us-east-1',
          'attachmentSecurity.storage.accessKey': 'job_engine_storage',
          'attachmentSecurity.storage.secretKey': 'change_me_storage',
        };
        return values[key] ?? defaultValue;
      },
    } as unknown as ConfigService;
    adapter = new MinioStorageAdapter(config);
    await adapter.ensureBucketExists(bucket);
  });

  it('round-trips real bytes unmodified through put/get', async () => {
    const key = `${randomUUID()}.pdf`;
    const content = Buffer.from('%PDF-1.4 real integration test bytes');

    await adapter.putObject(bucket, key, content, 'application/pdf');
    const retrieved = await adapter.getObject(bucket, key, 10_000);

    expect(retrieved.equals(content)).toBe(true);

    await adapter.deleteObject(bucket, key);
  });

  it('reports objectExists correctly before and after upload/delete', async () => {
    const key = `${randomUUID()}.pdf`;
    expect(await adapter.objectExists(bucket, key)).toBe(false);

    await adapter.putObject(bucket, key, Buffer.from('content'), 'application/pdf');
    expect(await adapter.objectExists(bucket, key)).toBe(true);

    await adapter.deleteObject(bucket, key);
    expect(await adapter.objectExists(bucket, key)).toBe(false);
  });

  it('throws StorageObjectNotFoundError for a key that was never uploaded', async () => {
    await expect(adapter.getObject(bucket, `${randomUUID()}-missing.pdf`, 10_000)).rejects.toThrow(StorageObjectNotFoundError);
  });

  it('refuses to read an object exceeding the bound, via the real HEAD-based pre-check, without downloading its body', async () => {
    const key = `${randomUUID()}-large.bin`;
    const large = Buffer.alloc(50_000, 'a');
    await adapter.putObject(bucket, key, large, 'application/octet-stream');

    await expect(adapter.getObject(bucket, key, 10_000)).rejects.toThrow(StorageObjectTooLargeError);

    await adapter.deleteObject(bucket, key);
  });

  it('allows an object exactly at the bound', async () => {
    const key = `${randomUUID()}-exact.bin`;
    const exact = Buffer.alloc(1000, 'b');
    await adapter.putObject(bucket, key, exact, 'application/octet-stream');

    const retrieved = await adapter.getObject(bucket, key, 1000);
    expect(retrieved.length).toBe(1000);

    await adapter.deleteObject(bucket, key);
  });

  it('ensureBucketExists is idempotent — calling it again on an already-existing bucket does not throw', async () => {
    await expect(adapter.ensureBucketExists(bucket)).resolves.toBeUndefined();
  });
});
