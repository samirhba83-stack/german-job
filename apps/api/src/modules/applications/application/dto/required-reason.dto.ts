import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TransitionReasonCode } from '@german-job-engine/shared-types';

/** Shared body shape for transitions whose reason is mandatory: reject, withdraw. */
export class RequiredReasonDto {
  @ApiProperty({ enum: TransitionReasonCode })
  @IsEnum(TransitionReasonCode)
  reasonCode!: TransitionReasonCode;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
