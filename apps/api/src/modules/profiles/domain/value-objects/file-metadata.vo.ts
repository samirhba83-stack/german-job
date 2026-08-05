import { ValueObject } from '../../../../shared/domain';
import { InvalidFileMetadataException } from '../exceptions/invalid-file-metadata.exception';

interface FileMetadataProps {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

/** Shared by both CV and profile photo uploads — only metadata is stored, not the binary. */
export class FileMetadata extends ValueObject<FileMetadataProps> {
  private constructor(props: FileMetadataProps) {
    super(props);
  }

  get fileName(): string {
    return this.props.fileName;
  }

  get fileUrl(): string {
    return this.props.fileUrl;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get sizeBytes(): number {
    return this.props.sizeBytes;
  }

  get uploadedAt(): Date {
    return this.props.uploadedAt;
  }

  static create(props: {
    fileName: string;
    fileUrl: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt?: Date;
  }): FileMetadata {
    const fileName = props.fileName.trim();
    const fileUrl = props.fileUrl.trim();
    const mimeType = props.mimeType.trim();

    if (!fileName) {
      throw new InvalidFileMetadataException('File name is required');
    }
    if (!fileUrl) {
      throw new InvalidFileMetadataException('File URL is required');
    }
    if (!mimeType) {
      throw new InvalidFileMetadataException('File MIME type is required');
    }
    if (props.sizeBytes <= 0) {
      throw new InvalidFileMetadataException('File size must be a positive number of bytes');
    }

    return new FileMetadata({
      fileName,
      fileUrl,
      mimeType,
      sizeBytes: props.sizeBytes,
      uploadedAt: props.uploadedAt ?? new Date(),
    });
  }
}
