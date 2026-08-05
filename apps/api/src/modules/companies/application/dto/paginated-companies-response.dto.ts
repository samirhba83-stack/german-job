import { ApiProperty } from '@nestjs/swagger';
import { CompanyResponseDto } from './company-response.dto';

export class PaginatedCompaniesResponseDto {
  @ApiProperty({ type: [CompanyResponseDto] })
  items!: CompanyResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
