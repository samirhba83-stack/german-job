import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class SmartBatchPlanDto {
  @ApiProperty({ minimum: 1, example: 10 })
  @IsInt()
  @Min(1)
  baseBatchSize!: number;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  minBatchSize!: number;

  @ApiProperty({ minimum: 1, example: 20 })
  @IsInt()
  @Min(1)
  maxBatchSize!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  adaptive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expansionIncrement?: number;
}
