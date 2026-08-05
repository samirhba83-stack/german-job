import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, Min } from 'class-validator';
import { Currency, SalaryPeriod } from '@german-job-engine/shared-types';

export class SalaryRangeDto {
  @ApiProperty({ example: 45000 })
  @IsInt()
  @Min(0)
  min!: number;

  @ApiProperty({ example: 60000 })
  @IsInt()
  @Min(0)
  max!: number;

  @ApiProperty({ enum: Currency })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiProperty({ enum: SalaryPeriod })
  @IsEnum(SalaryPeriod)
  period!: SalaryPeriod;
}
