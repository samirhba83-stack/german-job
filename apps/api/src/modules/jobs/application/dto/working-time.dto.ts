import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class WorkingTimeDto {
  @ApiPropertyOptional({ example: 40, minimum: 1, maximum: 80 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(80)
  hoursPerWeek?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFlexible?: boolean;
}
