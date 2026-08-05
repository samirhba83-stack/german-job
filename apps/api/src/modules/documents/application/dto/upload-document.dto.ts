import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { DocumentType } from '../../domain/models/document-type';

const DOCUMENT_TYPES: DocumentType[] = ['CV', 'MOTIVATION_LETTER', 'SUPPORTING_DOCUMENT'];

/** Multipart form fields alongside the uploaded file — the file's own bytes are handled by
 * `FileInterceptor`, never by class-validator. */
export class UploadDocumentDto {
  @IsIn(DOCUMENT_TYPES)
  documentType!: DocumentType;

  @IsOptional()
  @IsUUID()
  scopeApplicationId?: string;
}

export class DocumentResponseDto {
  @IsString()
  id!: string;

  documentType!: DocumentType;
  version!: number;
  isActive!: boolean;
  safeFileName!: string;
  mimeType!: string;
  sizeBytes!: number;
  scanStatus!: string;
  createdAt!: Date;
}
