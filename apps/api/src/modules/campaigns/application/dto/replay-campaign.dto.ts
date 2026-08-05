import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ReplayScope } from '@german-job-engine/shared-types';

export class ReplayCampaignDto {
  @ApiProperty({ enum: ReplayScope })
  @IsEnum(ReplayScope)
  scope!: ReplayScope;

  @ApiPropertyOptional({ type: [String], description: 'Required when scope is SPECIFIC_TARGETS' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  targetIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
