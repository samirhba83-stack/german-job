import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Weekday } from '@german-job-engine/shared-types';

export class ExecutionWindowDto {
  @ApiProperty({ enum: Weekday, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Weekday, { each: true })
  allowedWeekdays!: Weekday[];

  @ApiProperty({ minimum: 0, maximum: 23, example: 8 })
  @IsInt()
  @Min(0)
  @Max(23)
  dailyStartHour!: number;

  @ApiProperty({ minimum: 1, maximum: 24, example: 18 })
  @IsInt()
  @Min(1)
  @Max(24)
  dailyEndHour!: number;

  @ApiProperty({ example: 'Europe/Berlin' })
  @IsString()
  timezone!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  respectHolidays?: boolean;
}
