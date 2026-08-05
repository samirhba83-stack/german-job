import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';
import { EnglishLevel } from '@german-job-engine/shared-types';

export class EnglishLanguageRequirementDto {
  @ApiProperty({ enum: EnglishLevel })
  @IsEnum(EnglishLevel)
  level!: EnglishLevel;

  @ApiProperty()
  @IsBoolean()
  required!: boolean;
}
