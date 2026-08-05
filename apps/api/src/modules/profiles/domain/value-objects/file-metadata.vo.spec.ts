import { FileMetadata } from './file-metadata.vo';
import { InvalidFileMetadataException } from '../exceptions/invalid-file-metadata.exception';

describe('FileMetadata', () => {
  it('creates valid file metadata and defaults uploadedAt to now', () => {
    const before = Date.now();
    const file = FileMetadata.create({
      fileName: 'cv.pdf',
      fileUrl: 'https://storage.example.com/cv.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });

    expect(file.fileName).toBe('cv.pdf');
    expect(file.uploadedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('rejects a non-positive file size', () => {
    expect(() =>
      FileMetadata.create({ fileName: 'a.pdf', fileUrl: 'url', mimeType: 'application/pdf', sizeBytes: 0 }),
    ).toThrow(InvalidFileMetadataException);
  });

  it('rejects an empty file name', () => {
    expect(() =>
      FileMetadata.create({ fileName: '  ', fileUrl: 'url', mimeType: 'application/pdf', sizeBytes: 10 }),
    ).toThrow(InvalidFileMetadataException);
  });
});
