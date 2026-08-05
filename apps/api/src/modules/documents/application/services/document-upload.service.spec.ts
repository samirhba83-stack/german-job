import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DocumentUploadService } from './document-upload.service';
import { CandidateDocumentRepository } from '../../domain/ports/candidate-document.repository';
import { StoragePort } from '../../domain/ports/storage.port';
import { AttachmentScannerPort } from '../../domain/ports/attachment-scanner.port';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from './email-security-audit.service';
import { CandidateDocumentRecord } from '../../domain/models/candidate-document';

const NOW = new Date('2026-08-01T12:00:00.000Z');
const PDF = Buffer.from('%PDF-1.4 real cv bytes');

function documentRecord(overrides: Partial<CandidateDocumentRecord> = {}): CandidateDocumentRecord {
  return {
    id: 'doc-1',
    ownerUserId: 'user-1',
    documentType: 'CV',
    version: 1,
    isActive: true,
    storageProvider: 'minio',
    storageBucket: 'candidate-documents',
    storageObjectKey: 'user-1/cv/doc-1.pdf',
    originalFileName: 'cv.pdf',
    safeFileName: 'cv.pdf',
    mimeType: 'application/pdf',
    sizeBytes: PDF.length,
    checksumSha256: 'abc',
    scanStatus: 'NOT_SCANNED',
    scanFailureReason: null,
    scannedAt: null,
    scopeApplicationId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function harness() {
  const documents: jest.Mocked<CandidateDocumentRepository> = {
    findById: jest.fn(),
    findActiveByOwnerAndType: jest.fn(),
    findScopedToApplication: jest.fn(),
    listByOwner: jest.fn(),
    createNewVersion: jest.fn().mockResolvedValue(documentRecord()),
    updateScanResult: jest.fn().mockResolvedValue(undefined),
  };
  const storage: jest.Mocked<StoragePort> = { providerId: 'minio', putObject: jest.fn(), getObject: jest.fn(), deleteObject: jest.fn(), objectExists: jest.fn() };
  const scanner: jest.Mocked<AttachmentScannerPort> = { scannerId: 'test', scan: jest.fn().mockResolvedValue({ status: 'CLEAN', failureReason: null }) };
  const clock: ExecutionClock = { now: () => NOW };
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<EmailSecurityAuditService>;
  const config = {
    get: (key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        'attachmentSecurity.policy.maxFileSizeBytes': 10_000,
        'attachmentSecurity.policy.maxTotalSizeBytes': 20_000,
        'attachmentSecurity.policy.maxAttachmentCount': 5,
        'attachmentSecurity.storage.bucket': 'candidate-documents',
      };
      return values[key] ?? defaultValue;
    },
  } as unknown as ConfigService;

  const service = new DocumentUploadService(documents, storage, scanner, clock, audit, config);
  return { service, documents, storage, scanner, audit };
}

describe('DocumentUploadService', () => {
  it('rejects a policy violation (wrong MIME/magic-byte mismatch) without ever touching storage or the database', async () => {
    const { service, storage, documents } = harness();

    const result = await service.upload({ ownerUserId: 'user-1', documentType: 'CV', originalFileName: 'cv.exe', claimedMimeType: 'application/x-msdownload', content: Buffer.from([0x4d, 0x5a]), scopeApplicationId: null });

    expect(result.accepted).toBe(false);
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(documents.createNewVersion).not.toHaveBeenCalled();
  });

  it('accepts a valid PDF, stores it, creates a document row, and scans it', async () => {
    const { service, storage, documents, scanner } = harness();

    const result = await service.upload({ ownerUserId: 'user-1', documentType: 'CV', originalFileName: 'cv.pdf', claimedMimeType: 'application/pdf', content: PDF, scopeApplicationId: null });

    expect(result.accepted).toBe(true);
    expect(storage.putObject).toHaveBeenCalledTimes(1);
    expect(documents.createNewVersion).toHaveBeenCalledTimes(1);
    expect(scanner.scan).toHaveBeenCalledTimes(1);
    if (result.accepted) {
      expect(result.document.scanStatus).toBe('CLEAN');
    }
  });

  it('computes and stores a real SHA-256 checksum of the uploaded content', async () => {
    const { service, documents } = harness();

    await service.upload({ ownerUserId: 'user-1', documentType: 'CV', originalFileName: 'cv.pdf', claimedMimeType: 'application/pdf', content: PDF, scopeApplicationId: null });

    const createCall = documents.createNewVersion.mock.calls[0][0];
    const expectedChecksum = createHash('sha256').update(PDF).digest('hex');
    expect(createCall.checksumSha256).toBe(expectedChecksum);
  });

  it('records the scan result on the document row when the scanner rejects the file', async () => {
    const { service, documents, scanner } = harness();
    scanner.scan.mockResolvedValue({ status: 'REJECTED', failureReason: 'Matched EICAR marker.' });

    const result = await service.upload({ ownerUserId: 'user-1', documentType: 'CV', originalFileName: 'cv.pdf', claimedMimeType: 'application/pdf', content: PDF, scopeApplicationId: null });

    expect(documents.updateScanResult).toHaveBeenCalledWith('doc-1', 'REJECTED', 'Matched EICAR marker.', NOW);
    expect(result.accepted).toBe(true); // the document row exists (inspectable) even though its scan failed
    if (result.accepted) {
      expect(result.document.scanStatus).toBe('REJECTED');
    }
  });

  it('records ATTACHMENT_SCAN_STARTED then ATTACHMENT_SCAN_PASSED for a clean file', async () => {
    const { service, audit } = harness();

    await service.upload({ ownerUserId: 'user-1', documentType: 'CV', originalFileName: 'cv.pdf', claimedMimeType: 'application/pdf', content: PDF, scopeApplicationId: null });

    const eventTypes = (audit.record as jest.Mock).mock.calls.map((call) => call[0].eventType);
    expect(eventTypes).toEqual(expect.arrayContaining(['ATTACHMENT_SCAN_STARTED', 'ATTACHMENT_SCAN_PASSED']));
  });

  it('records ATTACHMENT_REJECTED (not a scan event) when the policy check itself fails', async () => {
    const { service, audit } = harness();

    await service.upload({ ownerUserId: 'user-1', documentType: 'CV', originalFileName: 'cv.jpg', claimedMimeType: 'image/jpeg', content: Buffer.from([0xff, 0xd8, 0xff]), scopeApplicationId: null });

    const eventTypes = (audit.record as jest.Mock).mock.calls.map((call) => call[0].eventType);
    expect(eventTypes).toEqual(['ATTACHMENT_REJECTED']);
  });

  it('normalizes a path-like original filename to a safe delivery filename before storing', async () => {
    const { service, documents } = harness();

    await service.upload({ ownerUserId: 'user-1', documentType: 'CV', originalFileName: '../../etc/passwd.pdf', claimedMimeType: 'application/pdf', content: PDF, scopeApplicationId: null });

    const createCall = documents.createNewVersion.mock.calls[0][0];
    expect(createCall.safeFileName).not.toContain('..');
    expect(createCall.safeFileName).not.toContain('/');
  });
});
