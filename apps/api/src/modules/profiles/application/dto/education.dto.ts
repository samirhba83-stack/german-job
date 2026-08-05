import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class EducationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  institution!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  degree!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fieldOfStudy?: string;

  @IsISO8601()
  startDate!: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
