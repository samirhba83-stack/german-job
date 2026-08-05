import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class WorkLocationDto {
  @ApiProperty({ example: 'Berlin', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'Germany', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country!: string;

  @ApiPropertyOptional({ example: '10115', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Torstraße 1', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;
}
