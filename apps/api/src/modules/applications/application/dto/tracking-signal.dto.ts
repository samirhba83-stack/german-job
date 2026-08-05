import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

/** Shared body shape for passive tracking signals: markDelivered, markOpened, markViewed. */
export class TrackingSignalDto {
  @ApiProperty({ example: 'email-webhook' })
  @IsString()
  @MaxLength(100)
  evidenceType!: string;

  @ApiProperty({ example: 'evt_9f2a1c' })
  @IsString()
  @MaxLength(200)
  evidenceExternalId!: string;

  @ApiProperty({ minimum: 0, maximum: 1, example: 0.9 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  evidenceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
