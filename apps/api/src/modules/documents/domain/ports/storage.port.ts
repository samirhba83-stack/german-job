export const STORAGE_PORT = Symbol('STORAGE_PORT');

export class StorageObjectTooLargeError extends Error {}
export class StorageObjectNotFoundError extends Error {}

/**
 * M28.5 — the one storage abstraction every document upload/resolution path depends on. Never a
 * concrete S3/MinIO type outside `infrastructure/adapters/`. Every read is bounded by construction
 * (`maxBytes` is enforced inside the adapter, not merely trusted from the caller) — Phase 8
 * "Bounded attachment reads" / Non-Negotiable Principle #8 ("never load unbounded files into
 * memory").
 */
export interface StoragePort {
  readonly providerId: string;

  putObject(bucket: string, objectKey: string, content: Buffer, contentType: string): Promise<void>;

  /** Throws `StorageObjectTooLargeError` if the real stored object exceeds `maxBytes` — checked
   * against the object's reported content-length before its body is ever read into memory, not
   * only after. Throws `StorageObjectNotFoundError` when the key doesn't exist. */
  getObject(bucket: string, objectKey: string, maxBytes: number): Promise<Buffer>;

  deleteObject(bucket: string, objectKey: string): Promise<void>;

  objectExists(bucket: string, objectKey: string): Promise<boolean>;
}
