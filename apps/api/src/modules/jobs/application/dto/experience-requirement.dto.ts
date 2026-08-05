import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { ExperienceLevel } from '@german-job-engine/shared-types';

export class ExperienceRequirementDto {
  @ApiProperty({ example: 3, minimum: 0, maximum: 50 })
  @IsInt()
  @Min(0)
  @Max(50)
  minYears!: number;

  @ApiProperty({ enum: ExperienceLevel })
  @IsEnum(ExperienceLevel)
  level!: ExperienceLevel;
}
