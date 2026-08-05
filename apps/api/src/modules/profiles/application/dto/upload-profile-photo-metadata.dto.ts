import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export class UploadProfilePhotoMetadataDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  fileUrl!: string;

  @IsIn(ALLOWED_PHOTO_MIME_TYPES)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_PHOTO_SIZE_BYTES)
  sizeBytes!: number;
}
