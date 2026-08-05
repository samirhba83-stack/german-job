import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PlanCode } from '@german-job-engine/shared-types';

export class ChangePlanDto {
  @ApiProperty({ enum: PlanCode })
  @IsEnum(PlanCode)
  planCode!: PlanCode;
}
