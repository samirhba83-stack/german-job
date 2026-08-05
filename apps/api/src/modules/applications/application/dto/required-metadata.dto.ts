import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** Shared body shape for transitions carrying mandatory context metadata: scheduleInterview, receiveOffer.
 * Metadata is a bounded flat record (max 20 keys) — depth/size limits are enforced by the domain's
 * Metadata value object and surfaced as 400s, not re-validated here. */
export class RequiredMetadataDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  metadata!: Record<string, string | number | boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
