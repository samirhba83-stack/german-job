import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AusbildungAvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  isAusbildungPosition!: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  durationMonths?: number;
}
