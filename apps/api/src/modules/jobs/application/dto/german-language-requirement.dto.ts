import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';
import { GermanLevel } from '@german-job-engine/shared-types';

export class GermanLanguageRequirementDto {
  @ApiProperty({ enum: GermanLevel })
  @IsEnum(GermanLevel)
  level!: GermanLevel;

  @ApiProperty()
  @IsBoolean()
  required!: boolean;
}
