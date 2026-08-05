import { LanguageProficiency } from '@german-job-engine/shared-types';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LanguageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  language!: string;

  @IsEnum(LanguageProficiency)
  proficiency!: LanguageProficiency;
}
