import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApplicationLifecycleStatus, ApplicationChannelType } from '@german-job-engine/shared-types';

export class SearchApplicationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: ApplicationLifecycleStatus })
  @IsOptional()
  @IsEnum(ApplicationLifecycleStatus)
  status?: ApplicationLifecycleStatus;

  @ApiPropertyOptional({ enum: ApplicationChannelType })
  @IsOptional()
  @IsEnum(ApplicationChannelType)
  channelType?: ApplicationChannelType;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdFrom?: Date;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdTo?: Date;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
