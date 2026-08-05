import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { PlanCode } from '@german-job-engine/shared-types';

export class CreateCheckoutSessionDto {
  @ApiProperty({ enum: PlanCode })
  @IsEnum(PlanCode)
  planCode!: PlanCode;

  /** Client-generated per checkout attempt (not per click-retry) — Phase 4's real idempotency
   * anchor. The frontend generates one UUID when the user opens the checkout flow and reuses it
   * for every retry of that same attempt. */
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey!: string;
}
