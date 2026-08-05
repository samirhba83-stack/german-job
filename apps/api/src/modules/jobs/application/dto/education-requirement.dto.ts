import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EducationLevel } from '@german-job-engine/shared-types';

export class EducationRequirementDto {
  @ApiProperty({ enum: EducationLevel })
  @IsEnum(EducationLevel)
  level!: EducationLevel;

  @ApiPropertyOptional({ example: 'Computer Science', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fieldOfStudy?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}
