import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  NotFound,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { StoragePort, StorageObjectNotFoundError, StorageObjectTooLargeError } from '../../domain/ports/storage.port';

/**
 * M28.5 — real object storage via the standard S3 API (self-hosted MinIO by default; the same
 * client works unmodified against real AWS S3 by only changing the endpoint/credentials —
 * see `EMAIL_ATTACHMENT_STORAGE_ENDPOINT` in the M28.5 report's Environment Variable Reference).
 * `forcePathStyle: true` is required for MinIO (and any non-AWS S3-compatible endpoint) — virtual-
 * hosted-style bucket URLs don't resolve correctly against a self-hosted endpoint.
 */
@Injectable()
export class MinioStorageAdapter implements StoragePort {
  readonly providerId = 'minio';
  private readonly logger = new Logger(MinioStorageAdapter.name);
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): S3Client {
    if (this.client) return this.client;
    this.client = new S3Client({
      endpoint: this.config.get<string>('attachmentSecurity.storage.endpoint', 'http://localhost:9000'),
      region: this.config.get<string>('attachmentSecurity.storage.region', 'us-east-1'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('attachmentSecurity.storage.accessKey', ''),
        secretAccessKey: this.config.get<string>('attachmentSecurity.storage.secretKey', ''),
      },
    });
    return this.client;
  }

  /** Idempotent — safe to call before every upload; a real production deployment would run this
   * once via infra provisioning instead, but for this self-hosted MinIO default, ensuring the
   * bucket exists here keeps the whole pipeline working out of the box with zero manual setup. */
  async ensureBucketExists(bucket: string): Promise<void> {
    const client = this.getClient();
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        this.logger.log(`Created storage bucket "${bucket}".`);
      } catch (createError) {
        this.logger.error(`Failed to create storage bucket "${bucket}": ${createError instanceof Error ? createError.message : String(createError)}`);
      }
    }
  }

  async putObject(bucket: string, objectKey: string, content: Buffer, contentType: string): Promise<void> {
    await this.getClient().send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: content, ContentType: contentType, ContentLength: content.length }));
  }

  /** Checks the object's real reported size via `HEAD` before ever reading its body — a
   * malicious or corrupted object whose stored size exceeds `maxBytes` is rejected before a
   * single byte of content is streamed into memory (Non-Negotiable Principle #8 / Phase 8
   * "bounded attachment reads"), not merely truncated after an unbounded read. */
  async getObject(bucket: string, objectKey: string, maxBytes: number): Promise<Buffer> {
    const client = this.getClient();

    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      const reportedSize = head.ContentLength ?? 0;
      if (reportedSize > maxBytes) {
        throw new StorageObjectTooLargeError(`Object "${objectKey}" is ${reportedSize} bytes, exceeding the ${maxBytes}-byte bound.`);
      }
    } catch (error) {
      if (error instanceof NotFound || (error as { name?: string }).name === 'NotFound') {
        throw new StorageObjectNotFoundError(`Object "${objectKey}" does not exist in bucket "${bucket}".`);
      }
      throw error;
    }

    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    const body = result.Body;
    if (!body || !(body instanceof Readable)) {
      throw new StorageObjectNotFoundError(`Object "${objectKey}" returned no readable body.`);
    }

    return this.readBounded(body, maxBytes, objectKey);
  }

  /** Defense in depth beyond the HEAD-based pre-check above — enforces the same bound while
   * actually streaming, in case the object grows between the HEAD and GET calls (a real, if
   * narrow, TOCTOU window) or a provider misreports content-length. */
  private readBounded(stream: Readable, maxBytes: number, objectKey: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      stream.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          stream.destroy();
          reject(new StorageObjectTooLargeError(`Object "${objectKey}" exceeded the ${maxBytes}-byte bound while streaming.`));
          return;
        }
        chunks.push(chunk);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (error) => reject(error));
    });
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    await this.getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
  }

  async objectExists(bucket: string, objectKey: string): Promise<boolean> {
    try {
      await this.getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      return true;
    } catch (error) {
      if (error instanceof NotFound || (error as { name?: string }).name === 'NotFound' || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
        return false;
      }
      this.logger.warn(`objectExists check failed for "${objectKey}": ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
