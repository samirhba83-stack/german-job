import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class RateLimitProfileDto {
  @ApiProperty({ minimum: 1, example: 50 })
  @IsInt()
  @Min(1)
  maxPerDay!: number;

  @ApiProperty({ minimum: 1, example: 10 })
  @IsInt()
  @Min(1)
  maxPerHour!: number;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  maxPerCompanyPerWindow!: number;
}
