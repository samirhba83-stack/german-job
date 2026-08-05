import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AttachmentResolverService } from './attachment-resolver.service';
import { CandidateDocumentRepository } from '../../domain/ports/candidate-document.repository';
import { StoragePort, StorageObjectNotFoundError } from '../../domain/ports/storage.port';
import { CandidateDocumentRecord } from '../../domain/models/candidate-document';
import { AttachmentReferenceContext } from '../../domain/models/resolved-attachment';
import { EmailSecurityAuditService } from './email-security-audit.service';

const CONTENT = Buffer.from('%PDF-1.4 real cv bytes');
const CHECKSUM = createHash('sha256').update(CONTENT).digest('hex');

function document(overrides: Partial<CandidateDocumentRecord> = {}): CandidateDocumentRecord {
  return {
    id: 'doc-1',
    ownerUserId: 'user-1',
    documentType: 'CV',
    version: 1,
    isActive: true,
    storageProvider: 'minio',
    storageBucket: 'candidate-documents',
    storageObjectKey: 'user-1/cv/doc-1.pdf',
    originalFileName: 'My CV.pdf',
    safeFileName: 'My_CV.pdf',
    mimeType: 'application/pdf',
    sizeBytes: CONTENT.length,
    checksumSha256: CHECKSUM,
    scanStatus: 'CLEAN',
    scanFailureReason: null,
    scannedAt: new Date('2026-08-01T00:00:00.000Z'),
    scopeApplicationId: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function ref(overrides: Partial<AttachmentReferenceContext> = {}): AttachmentReferenceContext {
  return { documentId: 'doc-1', requestingUserId: 'user-1', applicationContextId: 'app-1', ...overrides };
}

function harness(limits = { maxFileSizeBytes: 10_000, maxTotalSizeBytes: 20_000, maxAttachmentCount: 3 }) {
  const documents: jest.Mocked<CandidateDocumentRepository> = {
    findById: jest.fn(),
    findActiveByOwnerAndType: jest.fn(),
    findScopedToApplication: jest.fn(),
    listByOwner: jest.fn(),
    createNewVersion: jest.fn(),
    updateScanResult: jest.fn(),
  };
  const storage: jest.Mocked<StoragePort> = {
    providerId: 'minio',
    putObject: jest.fn(),
    getObject: jest.fn(),
    deleteObject: jest.fn(),
    objectExists: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<EmailSecurityAuditService>;
  const config = {
    get: (key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        'attachmentSecurity.policy.maxFileSizeBytes': limits.maxFileSizeBytes,
        'attachmentSecurity.policy.maxTotalSizeBytes': limits.maxTotalSizeBytes,
        'attachmentSecurity.policy.maxAttachmentCount': limits.maxAttachmentCount,
      };
      return values[key] ?? defaultValue;
    },
  } as unknown as ConfigService;

  const service = new AttachmentResolverService(documents, storage, audit, config);
  return { service, documents, storage, audit };
}

describe('AttachmentResolverService', () => {
  it('returns an empty result with no failure and no I/O when given zero references', async () => {
    const { service, documents, storage } = harness();
    const result = await service.resolve([]);
    expect(result).toEqual({ resolved: [], failure: null });
    expect(documents.findById).not.toHaveBeenCalled();
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it('rejects an unknown document id (also proves an id that looks like a path-traversal attempt is treated as an opaque lookup, never touching the filesystem)', async () => {
    const { service, documents, storage } = harness();
    documents.findById.mockResolvedValue(null);

    const result = await service.resolve([ref({ documentId: '../../etc/passwd' })]);

    expect(result.failure?.reason).toBe('DOCUMENT_NOT_FOUND');
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it('rejects when the requesting user does not own the document (cross-user access)', async () => {
    const { service, documents } = harness();
    documents.findById.mockResolvedValue(document({ ownerUserId: 'someone-else' }));

    const result = await service.resolve([ref({ requestingUserId: 'user-1' })]);

    expect(result.failure?.reason).toBe('OWNERSHIP_MISMATCH');
  });

  it('rejects when the document is scoped to a different application', async () => {
    const { service, documents } = harness();
    documents.findById.mockResolvedValue(document({ scopeApplicationId: 'app-other' }));

    const result = await service.resolve([ref({ applicationContextId: 'app-1' })]);

    expect(result.failure?.reason).toBe('SCOPE_MISMATCH');
  });

  it('accepts a document scoped to exactly the requested application', async () => {
    const { service, documents, storage } = harness();
    documents.findById.mockResolvedValue(document({ scopeApplicationId: 'app-1' }));
    storage.getObject.mockResolvedValue(CONTENT);

    const result = await service.resolve([ref({ applicationContextId: 'app-1' })]);

    expect(result.failure).toBeNull();
  });

  it('rejects a superseded (inactive) document version', async () => {
    const { service, documents } = harness();
    documents.findById.mockResolvedValue(document({ isActive: false }));

    const result = await service.resolve([ref()]);

    expect(result.failure?.reason).toBe('DOCUMENT_INACTIVE');
  });

  it('rejects a document that failed security scanning', async () => {
    const { service, documents } = harness();
    documents.findById.mockResolvedValue(document({ scanStatus: 'REJECTED', scanFailureReason: 'Matched EICAR marker.' }));

    const result = await service.resolve([ref()]);

    expect(result.failure?.reason).toBe('SCAN_REJECTED');
    expect(result.failure?.detail).toBe('Matched EICAR marker.');
  });

  it('rejects a document that has not finished scanning yet — fails closed rather than sending an unscanned file', async () => {
    const { service, documents, storage } = harness();
    documents.findById.mockResolvedValue(document({ scanStatus: 'NOT_SCANNED' }));

    const result = await service.resolve([ref()]);

    expect(result.failure?.reason).toBe('SCAN_NOT_COMPLETE');
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it('rejects a document whose scan itself failed to complete', async () => {
    const { service, documents } = harness();
    documents.findById.mockResolvedValue(document({ scanStatus: 'SCAN_FAILED' }));

    const result = await service.resolve([ref()]);

    expect(result.failure?.reason).toBe('SCAN_FAILED');
  });

  it('rejects when the stored bytes do not match the recorded checksum (corruption/tampering)', async () => {
    const { service, documents, storage } = harness();
    documents.findById.mockResolvedValue(document());
    storage.getObject.mockResolvedValue(Buffer.from('tampered content, different from what was checksummed'));

    const result = await service.resolve([ref()]);

    expect(result.failure?.reason).toBe('CHECKSUM_MISMATCH');
  });

  it('rejects when storage reports the object is missing', async () => {
    const { service, documents, storage } = harness();
    documents.findById.mockResolvedValue(document());
    storage.getObject.mockRejectedValue(new StorageObjectNotFoundError('missing'));

    const result = await service.resolve([ref()]);

    expect(result.failure?.reason).toBe('STORAGE_UNAVAILABLE');
  });

  it('rejects the whole batch when the attachment count exceeds the configured limit', async () => {
    const { service, documents } = harness({ maxFileSizeBytes: 10_000, maxTotalSizeBytes: 20_000, maxAttachmentCount: 1 });
    documents.findById.mockImplementation(async (id: string) => document({ id }));

    const result = await service.resolve([ref({ documentId: 'doc-1' }), ref({ documentId: 'doc-2' })]);

    expect(result.failure?.reason).toBe('TOO_MANY_ATTACHMENTS');
  });

  it('rejects the whole batch when the total declared size exceeds the configured limit', async () => {
    const { service, documents } = harness({ maxFileSizeBytes: 10_000, maxTotalSizeBytes: 30, maxAttachmentCount: 5 });
    documents.findById.mockImplementation(async (id: string) => document({ id, sizeBytes: 20 }));

    const result = await service.resolve([ref({ documentId: 'doc-1' }), ref({ documentId: 'doc-2' })]);

    expect(result.failure?.reason).toBe('TOTAL_SIZE_EXCEEDED');
  });

  it('resolves successfully and returns a bounded, provider-neutral payload with real matching content', async () => {
    const { service, documents, storage } = harness();
    documents.findById.mockResolvedValue(document());
    storage.getObject.mockResolvedValue(CONTENT);

    const result = await service.resolve([ref()]);

    expect(result.failure).toBeNull();
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]).toEqual({ documentId: 'doc-1', version: 1, fileName: 'My_CV.pdf', mimeType: 'application/pdf', sizeBytes: CONTENT.length, checksumSha256: CHECKSUM, content: CONTENT });
  });

  it('records ATTACHMENT_REFERENCE_SELECTED, ATTACHMENT_RESOLUTION_STARTED, and ATTACHMENT_RESOLVED audit events on success', async () => {
    const { service, documents, storage, audit } = harness();
    documents.findById.mockResolvedValue(document());
    storage.getObject.mockResolvedValue(CONTENT);

    await service.resolve([ref()]);

    const eventTypes = (audit.record as jest.Mock).mock.calls.map((call) => call[0].eventType);
    expect(eventTypes).toEqual(expect.arrayContaining(['ATTACHMENT_REFERENCE_SELECTED', 'ATTACHMENT_RESOLUTION_STARTED', 'ATTACHMENT_RESOLVED']));
  });

  it('records an ATTACHMENT_REJECTED audit event on failure, including the rejection reason', async () => {
    const { service, documents, audit } = harness();
    documents.findById.mockResolvedValue(document({ ownerUserId: 'someone-else' }));

    await service.resolve([ref()]);

    const rejectedCall = (audit.record as jest.Mock).mock.calls.find((call) => call[0].eventType === 'ATTACHMENT_REJECTED');
    expect(rejectedCall).toBeDefined();
    expect(rejectedCall![0].metadata).toMatchObject({ reason: 'OWNERSHIP_MISMATCH' });
  });

  it('never returns partial results — a failure on the second of two references blocks both', async () => {
    const { service, documents, storage } = harness();
    documents.findById.mockImplementation(async (id: string) => (id === 'doc-1' ? document({ id: 'doc-1' }) : document({ id: 'doc-2', ownerUserId: 'someone-else' })));
    storage.getObject.mockResolvedValue(CONTENT);

    const result = await service.resolve([ref({ documentId: 'doc-1' }), ref({ documentId: 'doc-2' })]);

    expect(result.resolved).toHaveLength(0);
    expect(result.failure?.reason).toBe('OWNERSHIP_MISMATCH');
  });
});
