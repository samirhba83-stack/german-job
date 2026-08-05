import { checkAttachmentPolicy, checkAttachmentBudget, detectFileKind, normalizeToSafeFileName, looksLikeEncryptedPdf, AttachmentPolicyLimits } from './attachment-policy';

const LIMITS: AttachmentPolicyLimits = { maxFileSizeBytes: 1024, maxTotalSizeBytes: 2048, maxAttachmentCount: 3 };

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

function pdfBuffer(body = 'some pdf content'): Buffer {
  return Buffer.from(`%PDF-1.4\n${body}\n%%EOF`);
}

function encryptedPdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Encrypt 5 0 R >>\nendobj\n%%EOF');
}

function docxBuffer(): Buffer {
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('...[Content_Types].xml...rest of a real docx zip...')]);
}

describe('detectFileKind', () => {
  it('detects a real PDF header', () => {
    expect(detectFileKind(pdfBuffer())).toBe('pdf');
  });

  it('detects a real PNG header', () => {
    expect(detectFileKind(PNG_HEADER)).toBe('png');
  });

  it('detects a real JPEG header', () => {
    expect(detectFileKind(JPEG_HEADER)).toBe('jpeg');
  });

  it('detects a genuine OOXML (docx) zip package via the [Content_Types].xml marker', () => {
    expect(detectFileKind(docxBuffer())).toBe('ooxml-zip');
  });

  it('reports unknown for a zip that lacks the OOXML content-types marker (e.g. a renamed generic zip)', () => {
    const genericZip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('just some other zip payload with no ooxml marker')]);
    expect(detectFileKind(genericZip)).toBe('unknown');
  });

  it('reports unknown for arbitrary bytes (e.g. an executable header)', () => {
    expect(detectFileKind(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBe('unknown');
  });
});

describe('looksLikeEncryptedPdf', () => {
  it('flags a PDF containing an /Encrypt marker', () => {
    expect(looksLikeEncryptedPdf(encryptedPdfBuffer())).toBe(true);
  });

  it('does not flag a normal PDF', () => {
    expect(looksLikeEncryptedPdf(pdfBuffer())).toBe(false);
  });
});

describe('normalizeToSafeFileName', () => {
  it('strips path separators, keeping only the base name', () => {
    expect(normalizeToSafeFileName('../../etc/passwd')).toBe('passwd');
    expect(normalizeToSafeFileName('C:\\Users\\evil\\resume.pdf')).toBe('resume.pdf');
  });

  it('replaces unsafe characters with underscores', () => {
    expect(normalizeToSafeFileName('my résumé (final)!.pdf')).toMatch(/^my_r_sum__\(final\)_\.pdf$|^[a-zA-Z0-9._-]+$/);
  });

  it('never returns an empty string', () => {
    expect(normalizeToSafeFileName('///')).toBe('document');
  });
});

describe('checkAttachmentPolicy', () => {
  it('accepts a valid PDF CV within size limits', () => {
    const result = checkAttachmentPolicy({ documentType: 'CV', claimedMimeType: 'application/pdf', originalFileName: 'cv.pdf', content: pdfBuffer() }, LIMITS);
    expect(result.accepted).toBe(true);
    expect(result.safeFileName).toBe('cv.pdf');
  });

  it('rejects an empty file', () => {
    const result = checkAttachmentPolicy({ documentType: 'CV', claimedMimeType: 'application/pdf', originalFileName: 'cv.pdf', content: Buffer.alloc(0) }, LIMITS);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe('EMPTY_FILE');
  });

  it('rejects a file exceeding the configured size limit', () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 'x')]);
    const result = checkAttachmentPolicy({ documentType: 'CV', claimedMimeType: 'application/pdf', originalFileName: 'cv.pdf', content: big }, LIMITS);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe('FILE_TOO_LARGE');
  });

  it('rejects a MIME type not allowed for the document type (executable disguised as CV)', () => {
    const result = checkAttachmentPolicy({ documentType: 'CV', claimedMimeType: 'application/x-msdownload', originalFileName: 'cv.exe', content: Buffer.from([0x4d, 0x5a]) }, LIMITS);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe('MIME_TYPE_NOT_ALLOWED');
  });

  it('rejects a JPEG renamed to claim it is a PDF (magic-bytes/MIME mismatch)', () => {
    const result = checkAttachmentPolicy({ documentType: 'CV', claimedMimeType: 'application/pdf', originalFileName: 'cv.pdf', content: JPEG_HEADER }, LIMITS);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe('MAGIC_BYTES_MISMATCH');
  });

  it('rejects a real PNG declared as a CV (image not allowed for CV document type)', () => {
    const result = checkAttachmentPolicy({ documentType: 'CV', claimedMimeType: 'image/png', originalFileName: 'cv.png', content: PNG_HEADER }, LIMITS);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe('MIME_TYPE_NOT_ALLOWED');
  });

  it('accepts a real PNG for a supporting document', () => {
    const result = checkAttachmentPolicy({ documentType: 'SUPPORTING_DOCUMENT', claimedMimeType: 'image/png', originalFileName: 'certificate.png', content: PNG_HEADER }, LIMITS);
    expect(result.accepted).toBe(true);
  });

  it('rejects a password-protected PDF', () => {
    const result = checkAttachmentPolicy({ documentType: 'CV', claimedMimeType: 'application/pdf', originalFileName: 'cv.pdf', content: encryptedPdfBuffer() }, LIMITS);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe('PASSWORD_PROTECTED');
  });

  it('accepts a genuine DOCX motivation letter', () => {
    const result = checkAttachmentPolicy(
      { documentType: 'MOTIVATION_LETTER', claimedMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', originalFileName: 'letter.docx', content: docxBuffer() },
      LIMITS,
    );
    expect(result.accepted).toBe(true);
  });
});

describe('checkAttachmentBudget', () => {
  it('rejects when adding one more attachment would exceed the count limit', () => {
    const result = checkAttachmentBudget(3, 100, 50, LIMITS);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe('TOO_MANY_ATTACHMENTS');
  });

  it('rejects when adding this attachment would exceed the total size limit', () => {
    const result = checkAttachmentBudget(1, 2000, 100, LIMITS);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe('TOTAL_SIZE_EXCEEDED');
  });

  it('accepts when within both budgets', () => {
    const result = checkAttachmentBudget(1, 100, 50, LIMITS);
    expect(result.accepted).toBe(true);
  });
});
