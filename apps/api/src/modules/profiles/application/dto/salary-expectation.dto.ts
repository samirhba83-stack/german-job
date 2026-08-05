import { IsInt, IsString, Matches, Min } from 'class-validator';

export class SalaryExpectationDto {
  @IsInt()
  @Min(0)
  min!: number;

  @IsInt()
  @Min(0)
  max!: number;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'currency must be a 3-letter ISO 4217 code' })
  currency!: string;
}
