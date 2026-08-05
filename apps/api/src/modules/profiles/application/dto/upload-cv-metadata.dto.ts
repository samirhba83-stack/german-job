import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

const ALLOWED_CV_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const MAX_CV_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export class UploadCvMetadataDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  fileUrl!: string;

  @IsIn(ALLOWED_CV_MIME_TYPES)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_CV_SIZE_BYTES)
  sizeBytes!: number;
}
