import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddCampaignTargetDto {
  @ApiProperty()
  @IsUUID()
  jobId!: string;

  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
