import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class SkillsDto {
  @ApiPropertyOptional({ type: [String], example: ['TypeScript', 'NestJS'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  required?: string[];

  @ApiPropertyOptional({ type: [String], example: ['GraphQL'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  niceToHave?: string[];
}
