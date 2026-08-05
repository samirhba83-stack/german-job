import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class ContactDto {
  @ApiPropertyOptional({ example: 'Jane Recruiter', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @ApiProperty({ example: 'jobs@acme.de' })
  @IsEmail()
  contactEmail!: string;

  @ApiPropertyOptional({ example: '+49 30 1234567', maxLength: 25 })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  contactPhone?: string;
}
