import { AvailabilityStatus } from '@german-job-engine/shared-types';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';

export class AvailabilityDto {
  @IsEnum(AvailabilityStatus)
  status!: AvailabilityStatus;

  @IsOptional()
  @IsISO8601()
  availableFrom?: string;
}
